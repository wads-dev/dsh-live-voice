import test from 'node:test';
import assert from 'node:assert/strict';
import { installVoiceErrorSink, reportVoiceError, type VoiceErrorEvent } from '../src/modules/core/diagnosticsErrors.ts';

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
