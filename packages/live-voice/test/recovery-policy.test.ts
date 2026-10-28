import test from 'node:test';
import { voiceNetworkFailure } from '../src/modules/core/networkFailure.js';
import { HostAudioSpeakingEngine } from '../src/modules/speak/engines/audio/HostAudioEngine.js';
import assert from 'node:assert/strict';
import { isRetryableVoiceError } from '../src/modules/core/recovery.js';
import { hostAudioPlaybackError } from '../src/modules/speak/engines/audio/HostAudioEngine.js';

test('fetch failures are retryable without reclassifying programming errors or cancellation', async () => {
  const original = new TypeError('Failed to fetch');
  assert.equal(isRetryableVoiceError(original), false);
  const failure = voiceNetworkFailure(original);
  assert.equal(failure.cause, original);
  assert.equal(isRetryableVoiceError(failure), true);
  const controller = new AbortController();
  controller.abort();
  assert.equal(voiceNetworkFailure(original, controller.signal), original);
  assert.equal(
    isRetryableVoiceError({ code: 'network', name: 'NotAllowedError', retryable: true }),
    false,
  );
  const engine = new HostAudioSpeakingEngine({
    endpoint: '/speech',
    globals: {
      fetch: async () => {
        throw original;
      },
    },
  });
  await assert.rejects(
    engine.prepare('test'),
    (error: any) => error.cause === original && isRetryableVoiceError(error),
  );
});

test('host synthesis HTTP failures keep retry metadata and permanent errors stop', async () => {
  for (const status of [400, 401, 403, 408, 429, 500, 503]) {
    const engine = new HostAudioSpeakingEngine({
      endpoint: '/speech',
      globals: {
        fetch: async () =>
          new Response(JSON.stringify({ error: { message: 'provider failure' } }), { status }),
      },
    });
    await assert.rejects(engine.prepare('test'), (error: any) => {
      assert.equal(error.code, 'http_' + status);
      assert.equal(isRetryableVoiceError(error), [408, 429, 500, 503].includes(status));
      return true;
    });
  }
});

test('host media failure metadata reaches shared retry policy', () => {
  for (const mediaCode of [1, 2, 3]) {
    assert.equal(
      isRetryableVoiceError(hostAudioPlaybackError(null, 'media', { error: { code: mediaCode } })),
      true,
    );
  }
  assert.equal(
    isRetryableVoiceError(hostAudioPlaybackError({ name: 'AbortError' }, 'play', {})),
    true,
  );
  assert.equal(isRetryableVoiceError({ name: 'AbortError' }), false);
  assert.equal(
    isRetryableVoiceError(hostAudioPlaybackError({ name: 'NotAllowedError' }, 'play', {})),
    false,
  );
  assert.equal(
    isRetryableVoiceError(hostAudioPlaybackError(null, 'media', { error: { code: 4 } })),
    false,
  );
  for (const code of ['not-allowed', 'service-not-allowed', 'language-not-supported'])
    assert.equal(isRetryableVoiceError({ code, retryable: true }), false);
});
