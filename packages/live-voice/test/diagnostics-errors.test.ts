import test from 'node:test';
import assert from 'node:assert/strict';
import { installVoiceErrorSink, reportVoiceError, type VoiceErrorEvent } from '../src/modules/core/diagnosticsErrors.ts';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { LocalModelManager } from '../src/modules/recognition/local/LocalModelManager.js';

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
  reportVoiceError('recording.storage', new DOMException('cancelled', 'AbortError'), {}, {}, target);
  assert.equal(events.length, 1);
  const removeBroken = installVoiceErrorSink(target, () => { throw new Error('sink failed'); });
  assert.doesNotThrow(() => reportVoiceError('recording.storage', error, {}, {}, target));
  unbind();
  assert.equal(Object.getOwnPropertySymbols(target).length, 1);
  removeBroken();
  assert.equal(Object.getOwnPropertySymbols(target).length, 0);
});

test('meeting startup and browser-local inference report redacted errors', async () => {
  const events: VoiceErrorEvent[] = [];
  const unbind = installVoiceErrorSink(globalThis as any, event => events.push(event));
  const failure = Object.assign(new Error('secret transcript', { cause: Object.assign(new Error('secret cause'), { code: 'inner-code' }) }), { code: 'outer-code' });
  const meeting = new MeetingController({
    composer: { getDraft: () => '', setDraft() {} }, settings: () => ({}), translate: (key: string) => key,
    createSource: () => ({ meter: { start: async () => { throw failure; }, stop: async () => {} }, engine: { capability: async () => ({ supported: true }), stop: async () => {} } }),
  });
  try {
    await meeting.start('microphone');
    const manager = new LocalModelManager({ caches: {} });
    await assert.rejects(manager.transcribe('whisper-tiny', new Float32Array(1), 'en'));
    assert.equal(events[0].operation, 'meeting.start');
    assert.equal(events[0].exception.code, 'outer-code');
    assert.equal(events[0].exception.cause?.code, 'inner-code');
    assert.ok(events.some(event => event.operation === 'browser-local.transcribe'));
    assert.doesNotMatch(JSON.stringify(events), /secret/);
    await meeting.dispose();
  } finally { unbind(); }
});
