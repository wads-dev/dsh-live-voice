import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordingRepositoryError } from '../src/modules/recording/codec.ts';
import { installVoiceErrorSink, reportVoiceError, type VoiceErrorEvent } from '../src/modules/core/diagnosticsErrors.ts';

test('recording diagnostics retain each known repository error code without messages', () => {
  const target: { [key: symbol]: unknown } = {};
  const events: VoiceErrorEvent[] = [];
  const release = installVoiceErrorSink(target, (event) => events.push(event));
  const codes = ['codec-unsupported', 'codec-failed', 'storage-unavailable', 'storage-failed', 'quota-exceeded', 'memory-limit', 'not-found', 'active-recording', 'sealed', 'archive-gap', 'invalid-range', 'disposed'] as const;
  for (const code of codes) reportVoiceError('recording.storage', new RecordingRepositoryError(code, 'PRIVATE'), { stage: 'begin' }, {}, target);
  assert.deepEqual(events.map((event) => event.exception.code), [...codes]);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE/);
  release();
});
