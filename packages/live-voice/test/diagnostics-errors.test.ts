import test from 'node:test';
import assert from 'node:assert/strict';
import { installVoiceErrorSink, reportVoiceError, sanitizeVoiceErrorEvent, type VoiceErrorEvent } from '../src/modules/core/diagnosticsErrors.ts';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { LocalModelManager } from '../src/modules/recognition/local/LocalModelManager.js';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';

test('error diagnostics are optional, redacted and isolated', () => {
  const target: { [key: symbol]: unknown } = {};
  let accesses = 0;
  const lazy = { get name() { accesses++; return 'Error'; } };
  reportVoiceError('recording.storage', lazy, {}, {}, target);
  assert.equal(accesses, 0);
  const events: VoiceErrorEvent[] = [];
  const unbind = installVoiceErrorSink(target, (event) => events.push(event));
  const error = Object.assign(new Error('private words', { cause: new DOMException('private cause', 'QuotaExceededError') }), { code: 'storage-failed' });
  reportVoiceError('recording.storage', error, { recordingId: 'abc', attempt: 2 }, {}, target);
  assert.equal(events[0].exception.cause?.name, 'QuotaExceededError');
  assert.equal(events[0].exception.code, 'storage-failed');
  assert.equal(events[0].context.attempt, 2);
  assert.doesNotMatch(JSON.stringify(events), /private/);
  reportVoiceError('capture.failure', { name: 'SecretName', code: 'SecretCode', cause: { name: 'SecretCause', code: 'SecretInner' } }, {}, {}, target);
  assert.deepEqual(events[1].exception, { name: 'Error', cause: { name: 'Error' } });
  assert.doesNotMatch(JSON.stringify(events), /Secret/);
  reportVoiceError('capture.failure', { name: 'NotAllowedError', code: 'http_503', cause: { name: 'QuotaExceededError', code: 22 } }, {}, {}, target);
  assert.deepEqual(events[2].exception, { name: 'NotAllowedError', code: 'http_503', cause: { name: 'QuotaExceededError', code: 22 } });
  const legacy = sanitizeVoiceErrorEvent({ at: 123, operation: 'SecretOperation', context: { source: 'SecretSource', stage: 'SecretStage', recordingId: 'SecretId', attempt: 999999, status: 999999 }, exception: { name: 'Error', message: 'SecretMessage', frames: ['12:34', 'SecretFrame'], cause: { name: 'SecretName', code: 'SecretCode' } } });
  assert.deepEqual(legacy, { at: 123, operation: 'voice.unknown', context: {}, exception: { name: 'Error', frames: ['12:34'], cause: { name: 'Error' } } });
  const id = '12345678-1234-4234-8234-123456789abc';
  assert.equal(sanitizeVoiceErrorEvent({ at: 1, operation: 'recording.storage', context: { source: 'shared', stage: 'append', recordingId: id, status: 503, attempt: 2 }, exception: { name: 'Error' } })?.context.recordingId, id);
  reportVoiceError('recording.storage', new DOMException('cancelled', 'AbortError'), {}, {}, target);
  assert.equal(events.length, 3);
  const removeBroken = installVoiceErrorSink(target, () => { throw new Error('sink failed'); });
  assert.doesNotThrow(() => reportVoiceError('recording.storage', error, {}, {}, target));
  unbind();
  assert.equal(Object.getOwnPropertySymbols(target).length, 1);
  removeBroken();
  assert.equal(Object.getOwnPropertySymbols(target).length, 0);
});

test('attendee join and leave report structured errors without meeting details', async () => {
  const events: VoiceErrorEvent[] = [];
  const unbind = installVoiceErrorSink(globalThis as any, event => events.push(event));
  const client = new AttendeeClient({} as any, () => {}, (key: string) => key);
  client.owner = 'secret-owner';
  client.request = async () => { throw Object.assign(new Error('secret meeting url'), { code: 'http_503', cause: new DOMException('secret participant', 'NetworkError') }); };
  try {
    await client.join('https://secret-meeting.invalid', 'secret-name');
    client.snapshot.botId = 'secret-bot';
    await client.leave();
    assert.deepEqual(events.map(event => [event.operation, event.context.stage]), [['attendee.failure', 'join'], ['attendee.failure', 'leave']]);
    assert.equal(events[0].exception.code, 'http_503');
    assert.equal(events[0].exception.cause?.name, 'NetworkError');
    assert.doesNotMatch(JSON.stringify(events), /secret/i);
  } finally { unbind(); }
});

test('attendee queue limits and audio failures retain safe codes at their boundaries', async () => {
  const events: VoiceErrorEvent[] = [];
  const unbind = installVoiceErrorSink(globalThis as any, event => events.push(event));
  const client = new AttendeeClient({} as any, () => {}, (key: string) => key);
  const event = { botId: 'secret-bot', participantId: 'secret-person', chunk: 'pcm' };
  client.stop = async () => {};
  try {
    client.abort = new AbortController();
    client.fetcher = async () => ({ ok: true, json: async () => ({ ok: true, value: { events: [event] } }) });
    for (let i = 0; i < 16; i++) client.queues.set(String(i), Promise.resolve());
    await client.poll(client.generation);
    assert.equal(events[0].context.stage, 'poll');
    assert.equal(events[0].exception.code, 'participants-limit');
    client.queues.clear();
    client.queuedBytes = 2000000;
    await client.poll(client.generation);
    assert.equal(events[1].exception.code, 'overloaded');
    client.queuedBytes = 0;
    for (let i = 0; i < 16; i++) client.rows.set(String(i), {});
    client.enqueue(event, client.generation);
    await client.queues.get('attendee:secret-bot:secret-person');
    assert.equal(events[2].context.stage, 'audio');
    assert.equal(events[2].exception.code, 'participants-limit');
    assert.doesNotMatch(JSON.stringify(events), /secret|pcm/i);
  } finally { unbind(); }
});

test('meeting startup and browser-local inference report redacted errors', async () => {
  const events: VoiceErrorEvent[] = [];
  const unbind = installVoiceErrorSink(globalThis as any, event => events.push(event));
  const failure = Object.assign(new Error('secret transcript', { cause: Object.assign(new Error('secret cause'), { code: 'audio-gap' }) }), { code: 'download-failed' });
  const meeting = new MeetingController({
    composer: { getDraft: () => '', setDraft() {} }, settings: () => ({}), translate: (key: string) => key,
    createSource: () => ({ meter: { start: async () => { throw failure; }, stop: async () => {} }, engine: { capability: async () => ({ supported: true }), stop: async () => {} } }),
  });
  try {
    await meeting.start('microphone');
    const manager = new LocalModelManager({ caches: {} });
    await assert.rejects(manager.transcribe('whisper-tiny', new Float32Array(1), 'en'));
    assert.equal(events[0].operation, 'meeting.start');
    assert.equal(events[0].exception.code, 'download-failed');
    assert.equal(events[0].exception.cause?.code, 'audio-gap');
    assert.ok(events.some(event => event.operation === 'browser-local.transcribe'));
    assert.doesNotMatch(JSON.stringify(events), /secret/);
    await meeting.dispose();
  } finally { unbind(); }
});
