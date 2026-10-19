import test from 'node:test';
import assert from 'node:assert/strict';
import { QwenHttpRecognitionEngine } from '../src/modules/recognition/engines/qwen/QwenRecognitionEngine.js';
import { resolveConversationStatus } from '../src/modules/conversation/components/conversationStatus.js';
import { PinDetector } from '../src/modules/recording/PinDetector.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.js';
import { mockRecordingRepository } from './helpers/recording.js';
import { recordingSegments } from '../src/modules/recording/types.js';
for (const Engine of [WhisperHttpRecognitionEngine, QwenHttpRecognitionEngine]) {
  test(
    Engine.name + ': silent audio writes never report transcription while real requests do',
    async (t) => {
      const recordings = mockRecordingRepository();
      const begin = recordings.begin.bind(recordings);
      let releaseWrite;
      const writeGate = new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      recordings.begin = async (input) => {
        const writer = await begin(input);
        const append = writer.append.bind(writer);
        writer.append = async (pcm) => {
          await writeGate;
          await append(pcm);
        };
        return writer;
      };
      let ingest, classify, reply;
      let sentBytes = 0;
      let recognizing = false;
      const changes = [];
      const statuses = [];
      const language = {
        recognition: {
          status: {
            waiting: () => 'Waiting',
            listening: () => 'Listening',
            processing: () => 'Transcribing',
            listeningProcessing: () => 'Listening and transcribing',
          },
        },
      };
      const engine = new Engine({
        recordings,
        meter: { context: { sampleRate: 16000 }, source: {} },
        voiceDetectionEngine: 'silero',
        voiceDetectionPreset: 'short',
        voiceDetectionMinimumSpeechMs: 50,
        vadAvailable: async () => true,
        vadFactory: (options) => {
          classify = options.onProbability;
          return { release() {} };
        },
        vadCapture: async (_context, _source, _stream, callback) => {
          ingest = callback;
          return { finish: async () => {}, release() {} };
        },
        globals: {
          fetch: (_url, options) => {
            sentBytes = options.body.byteLength;
            return new Promise((resolve) => {
              reply = resolve;
            });
          },
        },
      });
      t.after(async () => {
        releaseWrite();
        await engine.stop();
      });
      await engine.start({
        onActivity: (active) => {
          recognizing = active;
        },
        onProcessingChange: (state) => {
          changes.push(state);
          statuses.push(
            resolveConversationStatus(
              {
                listening: true,
                recognizing,
                pendingTranscriptions: state.pending,
                pendingTranscriptionRequests: state.transcribing,
              },
              null,
              language,
            ),
          );
        },
      });
      const frame = (count, probability) => {
        const pcm = new Float32Array(count).fill(probability ? 0.1 : 0);
        ingest(pcm, 16000);
        classify({ probability, pcm });
      };
      for (let i = 0; i < 20; i++) frame(512, 0);
      assert.ok(
        changes.some((change) => change.pending > 0),
        'writes remain a release and page-leave barrier',
      );
      assert.ok(changes.every((change) => change.transcribing === 0));
      assert.ok(
        changes.every((change) => change.deliveryPending === 0),
        'silent writes must not block sending',
      );
      assert.ok(statuses.every((status) => status === 'Waiting'));
      releaseWrite();
      await tick();
      assert.equal(changes.at(-1).pending, 0);
      statuses.length = 0;
      frame(1600, 0.9);
      await tick();
      assert.ok(
        statuses.every((status) => !status.includes('transcrib')),
        'speech storage alone is not HTTP work',
      );
      frame(12800, 0);
      assert.ok(
        changes.at(-1).deliveryPending > 0,
        'speech pin serialization blocks delivery before the attempt is queued',
      );
      await tick();
      assert.equal(typeof reply, 'function');
      const pendingAttempt = (await recordings.list())[0].attempts[0];
      assert.equal(pendingAttempt.request?.payloadBytes, sentBytes);
      assert.equal(pendingAttempt.request?.sampleCount, (sentBytes - 44) / 2);
      assert.equal(pendingAttempt.request?.durationMs, (sentBytes - 44) / 32);
      assert.equal(pendingAttempt.request?.responseStatus, undefined);
      assert.equal(changes.at(-1).transcribing, 1);
      assert.ok(changes.at(-1).deliveryPending > 0);
      assert.equal(statuses.at(-1), 'Transcribing');
      for (let i = 0; i < 10; i++) frame(512, 0);
      await tick();
      assert.equal(changes.at(-1).transcribing, 1);
      assert.ok(changes.at(-1).deliveryPending > 0);
      reply({ ok: true, status: 200, json: async () => ({ ok: true, value: { text: 'words' } }) });
      await tick();
      assert.equal(changes.at(-1).transcribing, 0);
      assert.equal(statuses.at(-1), 'Waiting');
      assert.equal((await recordings.list())[0].attempts[0].request?.responseStatus, 200);
      const quietStart = statuses.length;
      for (let i = 0; i < 10; i++) frame(512, 0);
      await tick();
      assert.ok(statuses.slice(quietStart).every((status) => status === 'Waiting'));
    },
  );
}

test('paragraph decisions follow captured silence rather than HTTP completion time', async () => {
  const recordings = mockRecordingRepository();
  let ingest: (pcm: Float32Array, rate: number) => void;
  let classify: (result: any) => void;
  const results: any[] = [];
  const replies: Array<(result: any) => void> = [];
  const engine = new WhisperHttpRecognitionEngine({
    recordings,
    meter: { context: { sampleRate: 16000 }, source: {} },
    voiceDetectionEngine: 'silero',
    voiceDetectionPreset: 'short',
    voiceDetectionMinimumSpeechMs: 50,
    vadAvailable: async () => true,
    vadFactory: (options) => {
      classify = options.onProbability;
      return { release() {} };
    },
    vadCapture: async (_context, _source, _stream, onPcm) => {
      ingest = onPcm;
      return { finish: async () => {}, release() {} };
    },
    globals: { fetch: () => new Promise((resolve) => replies.push(resolve)) },
  });
  await engine.start({ onResult: (result) => results.push(result) });
  const frame = (seconds: number, voiced: boolean) => {
    const pcm = new Float32Array(seconds * 16000).fill(voiced ? 0.1 : 0);
    ingest(pcm, 16000);
    classify({ probability: voiced ? 0.9 : 0, pcm });
  };
  frame(0.1, true);
  frame(0.4, false);
  await tick();
  frame(0.1, true);
  frame(2, false);
  await tick();
  frame(0.1, true);
  frame(0.4, false);
  await engine.finish();
  for (let i = 0; i < 3; i++) {
    assert.equal(replies.length, i + 1);
    replies[i]({ ok: true, json: async () => ({ ok: true, value: { text: 'phrase ' + i } }) });
    await tick();
  }
  assert.deepEqual(
    results.map((result) => result.paragraphBefore),
    [false, false, true],
  );
  const session = (await recordings.list())[0];
  assert.deepEqual(
    session.attempts.map((attempt) => attempt.paragraphBefore),
    [false, false, true],
  );
  assert.equal(results[2].startedAt - results[1].startedAt, 2100);
  await engine.stop();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test('VAD retains transition pins only and backdates confirmed silence', () => {
  const pins: unknown[] = [];
  const detector = new PinDetector({
    sampleRate: 1000,
    threshold: 0.5,
    minimumSpeechMs: 100,
    silenceMs: 500,
    onPin: (...args) => pins.push(args),
    onActivity: () => {},
  });
  detector.frame(0.8, 100);
  detector.frame(0.8, 200);
  detector.frame(0.1, 499);
  assert.equal(pins.length, 1);
  detector.frame(0.1, 1);
  assert.deepEqual(pins, [
    ['speech-start', 0, 100],
    ['silence-start', 300, 800],
  ]);
});
test('recording engine saves continuous PCM before VAD and transcribes recording ranges with audit', async () => {
  let ingest: any;
  let probability: any;
  const pcm: number[] = [];
  const attempts: any[] = [];
  const session: any = {
    id: 'r',
    startedAt: new Date().toISOString(),
    sampleRate: 16000,
    savedSamples: 0,
    capturedSamples: 0,
    state: 'recording',
    pins: [],
    attempts,
  };
  const writer = {
    session,
    append: async (data: Float32Array) => {
      pcm.push(...data);
      session.capturedSamples = session.savedSamples = pcm.length;
    },
    pin: async (kind: string, atSample: number, confirmedAtSample: number) => {
      const pin = { id: 'p' + session.pins.length, kind, atSample, confirmedAtSample };
      session.pins.push(pin);
      return pin;
    },
    read: async (start: number, end: number) => Float32Array.from(pcm.slice(start, end)),
    attempt: async (a: any) => {
      const i = attempts.findIndex((x) => x.id === a.id);
      if (i < 0) attempts.push(a);
      else attempts[i] = a;
    },
    finish: async (state = 'completed') => {
      session.state = state;
    },
  };
  const results: any[] = [];
  const requests: any[] = [];
  const engine = new WhisperHttpRecognitionEngine({
    meter: { context: { sampleRate: 16000 }, source: {} },
    recordings: {
      begin: async () => writer,
      timeline: () => async (kind, details) => {
        (session as any).events ??= [];
        (session as any).events.push({ kind, details });
      },
    },
    voiceDetectionEngine: 'silero',
    voiceDetectionPreset: 'custom',
    voiceDetectionCustomSilenceMs: 500,
    voiceDetectionMinimumSpeechMs: 50,
    recordingPreRollMs: 0,
    recordingPostRollMs: 0,
    globals: {
      fetch: async (_url: string, request: any) => {
        requests.push(request);
        return { ok: true, json: async () => ({ ok: true, value: { text: 'saved speech' } }) };
      },
    },
    vadAvailable: async () => true,
    vadFactory: ({ onProbability }: any) => {
      probability = onProbability;
      return { release() {} };
    },
    vadCapture: async (_context: any, _source: any, _vad: any, onPcm: any) => {
      ingest = onPcm;
      return { finish: async () => {}, release() {} };
    },
  });
  await engine.start({ onResult: (result: any) => results.push(result) });
  const frame = (value: number, count: number, p: number) => {
    const data = new Float32Array(count).fill(value);
    ingest(data, 16000);
    probability({ probability: p, pcm: data });
  };
  frame(0, 1600, 0);
  frame(0.1, 1600, 0.9);
  frame(0, 8000, 0);
  await engine.finish();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(pcm.length, 11200);
  assert.equal(requests.length, 1);
  assert.deepEqual(
    session.pins.map((p: any) => [p.kind, p.atSample]),
    [
      ['silence-start', 0],
      ['speech-start', 1600],
      ['silence-start', 3200],
    ],
  );
  assert.equal(attempts[0].status, 'success');
  assert.equal(attempts[0].text, 'saved speech');
  assert.equal(results[0].final, 'saved speech');
  results[0].onCommandRecognized('send');
  results[0].onCommandRecognized('send');
  await tick();
  assert.deepEqual((session as any).events, [
    {
      kind: 'voice-command-recognized',
      details: { command: 'send', segmentId: attempts[0].segmentId, attemptId: attempts[0].id },
    },
  ]);
  assert.deepEqual(
    recordingSegments(session).map((s) => s.kind),
    ['silence', 'speech', 'silence'],
  );
  await engine.stop();
});
