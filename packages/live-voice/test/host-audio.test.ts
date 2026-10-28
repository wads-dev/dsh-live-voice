// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { HostAudioSpeakingEngine } from '../src/modules/speak/engines/audio/HostAudioEngine.ts';

class AudioMock extends EventTarget {
  paused = true;
  playbackRate = 1;
  async play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
}

test('host M4A engine prepares standardized audio and browser owns playback', async () => {
  const revoked = [],
    audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine({
    endpoint: '/speech',
    globals: {
      fetch: async () => new Response(new Blob(['M4A-test'], { type: 'audio/mp4' })),
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL: (url) => revoked.push(url) },
      Audio: class {
        constructor() {
          return audio;
        }
      },
    },
  });
  const prepared = await engine.prepare('hello');
  let started = 0;
  const playing = engine.playPrepared(prepared, { onPlaybackStart: () => started++ });
  assert.equal(started, 0);
  await Promise.resolve();
  assert.equal(audio.paused, false);
  audio.dispatchEvent(new Event('playing'));
  assert.equal(started, 1);
  audio.dispatchEvent(new Event('ended'));
  await playing;
  assert.deepEqual(revoked, ['blob:test']);
});

test('host speech applies latest playback volume without altering synthesis or pause state', async () => {
  const audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine();
  for (const volume of [0, 0.4, 1]) {
    const playing = engine.playPrepared({ audio, dispose() {} }, { volume, retainPrepared: true });
    await Promise.resolve();
    assert.equal(audio.volume, volume);
    assert.equal(engine.pause(), true);
    engine.setVolume(0.2);
    assert.equal(audio.volume, 0.2);
    assert.equal(audio.paused, true);
    await engine.resume();
    assert.equal(audio.volume, 0.2);
    audio.dispatchEvent(new Event('ended'));
    await playing;
  }
  const playing = engine.playPrepared({ audio, dispose() {} });
  await Promise.resolve();
  assert.equal(audio.volume, 1);
  audio.dispatchEvent(new Event('ended'));
  await playing;
});

test('host audio maps synthesis and browser playback rates independently', async () => {
  const requests = [],
    audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine({
    endpoint: '/speech',
    synthesisRate: () => 175,
    playbackRate: (rate) => rate,
    globals: {
      fetch: async (_url, options) => {
        requests.push(JSON.parse(options.body));
        return new Response(new Blob(['M4A-test'], { type: 'audio/mp4' }));
      },
      URL: { createObjectURL: () => 'blob:rate', revokeObjectURL() {} },
      Audio: class {
        constructor() {
          return audio;
        }
      },
    },
  });
  const prepared = await engine.prepare('hello', { rate: 1.6 });
  const playing = engine.playPrepared(prepared, { rate: 1.6 });
  await Promise.resolve();
  assert.equal(requests[0].rate, 175);
  assert.equal(audio.playbackRate, 1.6);
  audio.dispatchEvent(new Event('ended'));
  await playing;
});

test('host audio retains pause while output routing is pending and resumes only explicitly', async () => {
  let route;
  const audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine();
  let plays = 0;
  audio.setSinkId = () =>
    new Promise((resolve) => {
      route = resolve;
    });
  audio.play = () => {
    plays++;
    return Promise.resolve();
  };
  const playing = engine.playPrepared({ audio, dispose() {} }, { outputDeviceId: 'selected' });
  await Promise.resolve();
  assert.equal(engine.pause(), true);
  route();
  await Promise.resolve();
  assert.equal(plays, 0);
  await engine.resume();
  assert.equal(plays, 1);
  audio.dispatchEvent(new Event('ended'));
  await playing;
});

for (const action of ['stop', 'abort', 'fail']) {
  test('host audio cannot launch after ' + action + ' during pending output routing', async () => {
    let route, fail;
    const pending = new Promise((resolve, reject) => {
      route = resolve;
      fail = reject;
    });
    const audio = new AudioMock();
    let plays = 0,
      disposals = 0;
    audio.setSinkId = () => pending;
    audio.play = () => {
      plays++;
      return Promise.resolve();
    };
    const engine = new HostAudioSpeakingEngine();
    const controller = new AbortController();
    const playing = engine.playPrepared(
      { audio, dispose: () => disposals++ },
      {
        outputDeviceId: 'selected',
        signal: controller.signal,
      },
    );
    const rejected = assert.rejects(
      playing,
      action === 'fail' ? /routing failed/ : { name: 'AbortError' },
    );
    await Promise.resolve();
    if (action === 'abort') controller.abort();
    if (action === 'stop') await engine.stop();
    if (action === 'fail') fail(new Error('routing failed'));
    else route();
    await rejected;
    assert.equal(plays, 0);
    assert.equal(engine.current, null);
    assert.ok(disposals > 0);
  });
}

for (const [name, recoverable] of [
  ['NotAllowedError', false],
  ['SecurityError', false],
  ['NotSupportedError', false],
  ['AbortError', true],
  ['NetworkError', true],
  ['Error', false],
]) {
  for (const synchronous of [false, true]) {
    test('host play preserves ' + name + ' diagnostics, sync=' + synchronous, async () => {
      const audio = new AudioMock();
      let plays = 0,
        disposals = 0;
      const original = Object.assign(new Error('play rejected'), {
        name,
        code: 42,
        cause: new Error('root'),
      });
      audio.play = () => {
        plays++;
        audio.paused = false;
        if (synchronous) throw original;
        return Promise.reject(original);
      };
      const engine = new HostAudioSpeakingEngine();
      await assert.rejects(engine.playPrepared({ audio, dispose: () => disposals++ }), (error) => {
        assert.equal(error.name, name);
        assert.equal(error.code, 42);
        assert.equal(error.cause, original);
        assert.equal(error.cause.cause.message, 'root');
        assert.equal(error.phase, 'play');
        assert.equal(error.recoverable, recoverable);
        return true;
      });
      assert.equal(audio.paused, true);
      assert.equal(engine.current, null);
      assert.equal(disposals, 1);
      assert.equal(plays, 1);
    });
  }
}

for (const code of [1, 2, 3, 4]) {
  test('host media error exposes code ' + code + ' and pauses retained audio', async () => {
    const engine = new HostAudioSpeakingEngine();
    const audio = new AudioMock();
    let disposals = 0;
    const playing = engine.playPrepared(
      { audio, dispose: () => disposals++ },
      { retainPrepared: true },
    );
    const rejected = assert.rejects(playing, (error) => {
      assert.equal(error.mediaCode, code);
      assert.equal(error.code, code);
      assert.equal(error.phase, 'media');
      assert.equal(error.recoverable, code !== 4);
      assert.equal(error.category, code === 4 ? 'unsupported' : 'media');
      return true;
    });
    await Promise.resolve();
    audio.error = { code, message: 'media failed' };
    audio.dispatchEvent(new Event('error'));
    await rejected;
    assert.equal(audio.paused, true);
    assert.equal(disposals, 0);
    assert.equal(engine.current, null);
  });
}

for (const [name, recoverable] of [
  ['NotAllowedError', false],
  ['NotSupportedError', false],
  ['NotFoundError', true],
  ['AbortError', true],
]) {
  test('host output routing classifies ' + name, async () => {
    const audio = new AudioMock();
    const original = Object.assign(new Error('routing failed'), { name });
    audio.setSinkId = async () => {
      throw original;
    };
    const engine = new HostAudioSpeakingEngine();
    await assert.rejects(
      engine.playPrepared({ audio, dispose() {} }, { outputDeviceId: 'private-id' }),
      (error) => {
        assert.equal(error.phase, 'output-routing');
        assert.equal(error.cause, original);
        assert.equal(error.recoverable, recoverable);
        assert.equal(JSON.stringify(error).includes('private-id'), false);
        return true;
      },
    );
    assert.equal(audio.paused, true);
  });
}

test('host resume rejection settles playback and cleans up once', async () => {
  const audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine();
  let disposals = 0;
  const playing = engine.playPrepared({ audio, dispose: () => disposals++ });
  const rejected = assert.rejects(playing, {
    name: 'NotAllowedError',
    phase: 'resume',
    recoverable: false,
  });
  await Promise.resolve();
  engine.pause();
  audio.play = async () => {
    throw Object.assign(new Error('autoplay blocked'), { name: 'NotAllowedError' });
  };
  await assert.rejects(engine.resume(), { name: 'NotAllowedError', phase: 'resume' });
  await rejected;
  audio.dispatchEvent(new Event('error'));
  assert.equal(disposals, 1);
  assert.equal(audio.paused, true);
  assert.equal(engine.current, null);
});

test('late play rejection cannot pause or dispose a newer playback of the same retained audio', async () => {
  const audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine();
  let rejectOld,
    disposals = 0;
  audio.play = () => {
    audio.paused = false;
    return new Promise((_, reject) => {
      rejectOld = reject;
    });
  };
  const prepared = { audio, dispose: () => disposals++ };
  const old = engine.playPrepared(prepared, { retainPrepared: true });
  const rejected = assert.rejects(old, { name: 'AbortError' });
  await Promise.resolve();
  await engine.stop();
  await rejected;
  audio.play = AudioMock.prototype.play;
  const newer = engine.playPrepared(prepared, { retainPrepared: true });
  await Promise.resolve();
  const current = engine.current;
  rejectOld(new Error('late rejection'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(engine.current, current);
  assert.equal(audio.paused, false);
  assert.equal(disposals, 0);
  audio.dispatchEvent(new Event('ended'));
  await newer;
});

test('stop settles pending routing immediately and ignores its late rejection', async () => {
  const audio = new AudioMock();
  const engine = new HostAudioSpeakingEngine();
  let rejectRoute,
    disposals = 0;
  audio.setSinkId = () =>
    new Promise((_, reject) => {
      rejectRoute = reject;
    });
  const playing = engine.playPrepared(
    { audio, dispose: () => disposals++ },
    { outputDeviceId: 'selected' },
  );
  const rejected = assert.rejects(playing, { name: 'AbortError' });
  await Promise.resolve();
  await engine.stop();
  await rejected;
  rejectRoute(new Error('late routing rejection'));
  await Promise.resolve();
  assert.equal(disposals, 1);
  assert.equal(audio.paused, true);
});

test('stop before playback admission prevents a late launch', async () => {
  const engine = new HostAudioSpeakingEngine();
  const audio = new AudioMock();
  let plays = 0,
    disposals = 0;
  audio.play = () => {
    plays++;
    return Promise.resolve();
  };
  const playing = engine.playPrepared({ audio, dispose: () => disposals++ });
  const rejected = assert.rejects(playing, { name: 'AbortError' });
  await engine.stop();
  await rejected;
  assert.equal(plays, 0);
  assert.equal(disposals, 1);
  assert.equal(engine.current, null);
});

test('concurrent playback admission keeps only the newest request', async () => {
  const engine = new HostAudioSpeakingEngine();
  const olderAudio = new AudioMock();
  const audio = new AudioMock();
  let disposals = 0;
  const older = engine.playPrepared({ audio: olderAudio, dispose: () => disposals++ });
  const rejected = assert.rejects(older, { name: 'AbortError' });
  const newer = engine.playPrepared({ audio, dispose() {} });
  await rejected;
  assert.equal(olderAudio.paused, true);
  assert.equal(audio.paused, false);
  assert.equal(engine.current.audio, audio);
  assert.equal(disposals, 1);
  audio.dispatchEvent(new Event('ended'));
  await newer;
});

test('host audio preparation aborts fetch and rejects stale work', async () => {
  const controller = new AbortController();
  const engine = new HostAudioSpeakingEngine({
    endpoint: '/speech',
    globals: {
      fetch: (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          ),
        ),
      URL: {},
      Audio: class {},
    },
  });
  const preparing = engine.prepare('hello', { signal: controller.signal });
  controller.abort();
  await assert.rejects(preparing, { name: 'AbortError' });
});
