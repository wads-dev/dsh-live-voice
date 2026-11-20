import assert from 'node:assert/strict';
import type {
  RecordingRepository,
  RecordingSession,
  RecordingWriter,
} from '../../src/modules/recording/types.js';
import { recordingSegments } from '../../src/modules/recording/types.js';

/** Deterministic PCM repository for engine tests; no browser codec or persistence. */
export function mockRecordingRepository(): RecordingRepository {
  const sessions: RecordingSession[] = [];
  const writers = new Map<string, RecordingWriter>();
  const checkRange = (session: RecordingSession, start: number, end: number) => {
    assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end));
    assert.ok(start >= 0 && end >= start && end <= session.capturedSamples);
  };
  return {
    version: 1,
    timeline: () => async () => {},
    segments: recordingSegments,
    subscribe: () => () => {},
    list: async () => sessions.map((s) => structuredClone(s)),
    get: async (id) => structuredClone(sessions.find((s) => s.id === id) ?? null),
    audio: async () => {
      throw new Error('Audio export is not used by engine mocks.');
    },
    export: async () => {
      throw new Error('Archive export is not used by engine mocks.');
    },
    remove: async (id) => {
      const at = sessions.findIndex((s) => s.id === id);
      if (at >= 0) sessions.splice(at, 1);
    },
    dispose: async () => {
      await Promise.all([...writers.values()].map((w) => w.finish('interrupted')));
    },
    async setStarred(id, starred) {
      const session = sessions.find((s) => s.id === id);
      if (session) session.starred = starred;
    },
    async begin(input) {
      const session: RecordingSession = {
        id: crypto.randomUUID(),
        sourceId: input.sourceId,
        kind: input.kind,
        label: input.label,
        sampleRate: input.sampleRate,
        startedAt: input.startedAt ?? new Date(Date.now()).toISOString(),
        state: 'recording',
        capturedSamples: 0,
        savedSamples: 0,
        persistent: false,
        codec: 'mock-pcm',
        pins: [],
        attempts: [],
      };
      sessions.push(session);
      const chunks: Float32Array[] = [];
      let sealed = false;
      const writer: RecordingWriter = {
        get session() {
          return structuredClone(session);
        },
        async append(pcm) {
          assert.equal(sealed, false, 'PCM cannot be appended after recording completion');
          chunks.push(pcm.slice());
          session.capturedSamples += pcm.length;
          session.savedSamples = session.capturedSamples;
        },
        async pin(kind, atSample, confirmedAtSample) {
          assert.equal(sealed, false, 'Pins cannot be appended after recording completion');
          checkRange(session, atSample, confirmedAtSample);
          const pin = {
            id: crypto.randomUUID(),
            kind,
            atSample,
            confirmedAtSample,
            delaySamples: confirmedAtSample - atSample,
          };
          session.pins.push(pin);
          return structuredClone(pin);
        },
        async attempt(value) {
          checkRange(session, value.startSample, value.endSample);
          session.attempts = [
            ...session.attempts.filter((a) => a.id !== value.id),
            structuredClone(value),
          ];
        },
        async read(start, end) {
          checkRange(session, start, end);
          const pcm = new Float32Array(session.capturedSamples);
          let at = 0;
          for (const chunk of chunks) {
            pcm.set(chunk, at);
            at += chunk.length;
          }
          return pcm.slice(start, end);
        },
        async finish(state = 'completed', error) {
          if (sealed) return;
          sealed = true;
          session.state = state;
          session.error = error;
          session.endedAt = new Date(Date.now()).toISOString();
        },
      };
      writers.set(session.id, writer);
      return writer;
    },
  };
}
