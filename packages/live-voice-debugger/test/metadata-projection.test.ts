import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRecordings, projectSegments, projectAttempts, projectEvents, projectErrors } from '../src/metadataProjection.js';
import type { RecordingSession } from '../../live-voice/src/modules/recording/types.js';
import type { VoiceErrorEvent } from '../../live-voice/src/modules/core/diagnosticsErrors.js';
const id = '12345678-1234-4123-8123-123456789abc';
const secret = 'SECRET transcript name audio id';
const session = {
  id, sourceId: secret, label: secret, name: secret, participant: { originalName: secret },
  kind: 'microphone', state: 'completed', startedAt: '2026-01-01T00:00:00.000Z',
  sampleRate: 16000, capturedSamples: 100, savedSamples: 100, persistent: false, codec: secret,
  pins: [{ id: secret, kind: 'speech-start', atSample: 0, confirmedAtSample: 0, delaySamples: 0 }],
  attempts: [{ id: secret, segmentId: secret, startSample: 0, endSample: 100, engine: secret,
    createdAt: secret, status: 'success', text: secret, error: secret, request: { transport: 'http-wav',
      payloadBytes: 44, inputSamples: 100, inputSampleRate: 16000, sampleCount: 100, sampleRate: 16000,
      durationMs: 6, language: secret, preparedAt: secret } }],
  events: [{ id: secret, kind: 'assistant-error', occurredAt: secret, atSample: 10, details: { segmentId: secret } }],
  archiveGaps: [{ startSample: 1, endSample: 2, secret }, { startSample: 5, endSample: 6 }],
  error: secret,
} as unknown as RecordingSession;
const err = { at: 10, operation: 'capture.failure', context: { recordingId: id, stage: 'start' }, exception: { name: secret, message: secret, frames: [secret] } } as VoiceErrorEvent;
const allow = new Set([id]);
const req = { offset: 0, limit: 1 };
test('authorized projections whitelist metadata and never leak content or IDs', () => {
  const result = [projectRecordings([session], allow, req), projectSegments(session, allow, req),
    projectAttempts(session, allow, req), projectEvents(session, allow, req), projectErrors([err], allow, req)];
  const encoded = JSON.stringify(result);
  assert.ok(!encoded.includes(secret)); assert.ok(!encoded.includes(id));
  assert.equal(result[0].items.length, 1); assert.equal(result[1].items.length, 1);
  assert.equal(result[2].items[0].request?.payloadBytes, 44); assert.equal(result[4].items.length, 1);
  assert.equal(projectRecordings([session], allow, req).items[0].archiveGapCount, 2);
  assert.equal(projectRecordings([{ ...session, archiveGaps: undefined }], allow, req).items[0].archiveGapCount, null);
  assert.equal(projectEvents(session, allow, req).items[0].kind, 'assistant-error');
  assert.deepEqual(projectErrors([err], allow, req).items[0].exception, { name: 'Error', code: null });
  const safe = { ...err, exception: { name: 'NetworkError', code: 'http_503', message: secret, cause: { name: secret }, frames: [secret] } };
  assert.deepEqual(projectErrors([safe], allow, req).items[0].exception, { name: 'NetworkError', code: 'http_503' });
  const hostile = { ...session, events: [{ ...session.events![0], kind: secret }] } as unknown as RecordingSession;
  assert.equal(projectEvents(hostile, allow, req).items[0].kind, null);
  assert.ok(!JSON.stringify(projectErrors([safe], allow, req)).includes(secret));
});
test('authorization is required and missing provenance is excluded', () => {
  const none = new Set<string>();
  assert.deepEqual(projectRecordings([session], none, req).items, []);
  for (const f of [projectSegments, projectAttempts, projectEvents]) {
    assert.throws(() => f(session, none, req));
    assert.throws(() => f(session, undefined as any, req));
  }
  assert.throws(() => projectRecordings([session], undefined as any, req));
  assert.throws(() => projectErrors([err], undefined as any, req));
  assert.deepEqual(projectErrors([err, { ...err, context: {} }], none, req).items, []);
  assert.equal(projectErrors([{ ...err, context: {} }], allow, req).items.length, 0);
});
test('malformed exceptions are excluded before pagination', () => {
  const { exception: _exception, ...missing } = err;
  const malformed = [missing, ...[undefined, null, 'message', 0, false, Symbol('x'), 1n]
    .map(exception => ({ ...err, exception }))] as unknown as VoiceErrorEvent[];
  for (const entry of malformed) assert.deepEqual(projectErrors([entry], allow, req).items, []);
  const page = projectErrors([...malformed, err], allow, req);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextOffset, null);
});
test('oversized inputs fail before scanning and invalid pages fail before touching data', () => {
  const tooMany = Array(10_001);
  assert.throws(() => projectRecordings(tooMany, allow, req), /oversized/);
  assert.throws(() => projectErrors(tooMany, allow, req), /oversized/);
  assert.throws(() => projectSegments({ ...session, pins: tooMany }, allow, req), /oversized/);
  assert.throws(() => projectAttempts({ ...session, attempts: tooMany }, allow, req), /oversized/);
  assert.throws(() => projectEvents({ ...session, events: tooMany }, allow, req), /oversized/);
  const ids = new Set(Array.from({ length: 10_001 }, (_, i) => String(i)));
  assert.throws(() => projectRecordings([], ids, req));
  const bomb = new Proxy([], { get() { throw new Error('data accessed'); } });
  const invalid = { offset: 0, limit: 0 };
  for (const f of [() => projectRecordings(bomb, allow, invalid), () => projectErrors(bomb, allow, invalid),
    () => projectSegments({ ...session, pins: bomb }, allow, invalid),
    () => projectAttempts({ ...session, attempts: bomb }, allow, invalid),
    () => projectEvents({ ...session, events: bomb }, allow, invalid)]) assert.throws(f, /Invalid pagination/);
  assert.equal(projectRecordings(Array(10_000).fill(session), allow, req).nextOffset, 1);
});
test('pagination is explicit, bounded and applied after authorization', () => {
  const other = { ...session, id: 'other' };
  const list = [other, session, session, session];
  assert.equal(projectRecordings(list, allow, req).nextOffset, 1);
  assert.equal(projectRecordings(list, allow, { offset: 1, limit: 2 }).items.length, 2);
  assert.equal(projectRecordings(list, allow, { offset: 99, limit: 1 }).nextOffset, null);
  for (const bad of [{ offset: -1, limit: 1 }, { offset: 0, limit: 0 }, { offset: 0, limit: 101 },
    { offset: NaN, limit: 1 }, { offset: 0, limit: 1.5 }, { offset: Infinity, limit: 1 }])
    for (const f of [() => projectRecordings(list, allow, bad), () => projectSegments(session, allow, bad),
      () => projectAttempts(session, allow, bad), () => projectEvents(session, allow, bad), () => projectErrors([err], allow, bad)]) assert.throws(f, RangeError);
});
