// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { transcribeBrowserRecording } from '../src/modules/recognition/engines/browser/transcribeRecording.ts';

function fixture({
  overload = true,
  policy = true,
  load = true,
  prefixed = false,
  local = true,
  availability = 'available',
  startError,
  resume,
  setupError,
} = {}) {
  const frames = [],
    probes = [],
    instances = [],
    starts = [],
    contexts = [],
    checks = [],
    installs = [],
    timers = new Map();
  let id = 0,
    captures = 0;
  const track = (kind) => ({
    kind,
    readyState: 'live',
    stops: 0,
    stop() {
      this.stops++;
      this.readyState = 'ended';
    },
  });
  const video = track('video'),
    audio = track('audio');
  class Recognition {
    static async available(options) {
      checks.push(options);
      return typeof availability === 'function' ? availability() : availability;
    }
    static async install(options) {
      installs.push(options);
      availability = 'available';
      return true;
    }
    constructor() {
      assert.equal(probes.length, 1, 'probe must precede host construction');
      if (local) this.processLocally = false;
      instances.push(this);
    }
    start(...args) {
      assert.equal(args.length, 1, 'never call microphone start()');
      assert.equal(args[0], audio);
      this.track = args[0];
      starts.push(this);
      if (startError) throw startError;
    }
    stop() {
      this.stops = (this.stops ?? 0) + 1;
    }
    abort() {
      this.aborts = (this.aborts ?? 0) + 1;
      this.onend?.();
    }
  }
  class Probe {
    constructor() {
      probes.push(this);
    }
    start(input) {
      assert.equal(frames[0].allow, "microphone 'none'");
      assert.equal(input, video);
      assert.equal(input.readyState, 'ended');
      if (overload) throw Object.assign(new Error('invalid track'), { name: 'InvalidStateError' });
    }
    abort() {
      this.aborted = true;
    }
  }
  const source = {
    starts: 0,
    stops: 0,
    disconnects: 0,
    connect(node) {
      this.connected = node;
    },
    start() {
      this.starts++;
    },
    stop() {
      this.stops++;
      this.onended?.();
    },
    disconnect() {
      this.disconnects++;
    },
  };
  const destination = {
    disconnects: 0,
    stream: { getAudioTracks: () => [audio], getTracks: () => [audio] },
    disconnect() {
      this.disconnects++;
    },
  };
  class Audio {
    constructor() {
      contexts.push(this);
      this.destination = { speakers: true };
      this.closes = 0;
    }
    createMediaStreamDestination() {
      return destination;
    }
    createBufferSource() {
      return source;
    }
    createBuffer(channels, length, rate) {
      if (setupError) throw setupError;
      this.bufferArgs = [channels, length, rate];
      this.samples = new Float32Array(length);
      return { getChannelData: () => this.samples };
    }
    resume() {
      this.resumes = (this.resumes ?? 0) + 1;
      return resume?.() ?? Promise.resolve();
    }
    close() {
      this.closes++;
      return Promise.resolve();
    }
  }
  const globals = {
    [prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition']: Recognition,
    [prefixed ? 'webkitAudioContext' : 'AudioContext']: Audio,
    navigator: {
      mediaDevices: {
        getUserMedia() {
          captures++;
          assert.fail('must not capture microphone');
        },
        getDisplayMedia() {
          captures++;
          assert.fail('must not capture screen');
        },
      },
    },
    setTimeout(fn, ms) {
      timers.set(++id, { fn, ms });
      return id;
    },
    clearTimeout(timer) {
      timers.delete(timer);
    },
    document: {
      body: {
        append(frame) {
          frame.isConnected = true;
          if (load) frame.onload();
        },
      },
      createElement(tag) {
        assert.equal(tag, 'iframe');
        const frame = {
          isConnected: false,
          remove() {
            this.removed = true;
            this.isConnected = false;
          },
          contentWindow: { [prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition']: Probe },
          contentDocument: {
            featurePolicy: policy
              ? { features: () => ['microphone'], allowsFeature: () => false }
              : undefined,
            createElement(tag) {
              assert.equal(tag, 'canvas');
              return {
                captureStream: () => ({ getVideoTracks: () => [video], getTracks: () => [video] }),
              };
            },
          },
        };
        frames.push(frame);
        return frame;
      },
    },
  };
  return {
    globals,
    frames,
    probes,
    video,
    audio,
    source,
    destination,
    instances,
    starts,
    contexts,
    checks,
    installs,
    timers,
    run(options = {}) {
      return transcribeBrowserRecording(new Float32Array([0.25, -0.5]), 16000, {
        globals,
        ...options,
      });
    },
    captures: () => captures,
    timeout() {
      const timer = [...timers.values()].find(({ ms }) => ms > 3000);
      assert.ok(timer);
      timer.fn();
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const result = (text, isFinal = true) => Object.assign([{ transcript: text }], { isFinal });
function released(f, signal) {
  assert.equal(f.timers.size, 0);
  assert.equal(f.frames[0]?.removed, true);
  assert.equal(f.frames[0]?.onload, null);
  assert.equal(f.captures(), 0);
  if (f.contexts.length) {
    assert.equal(f.contexts[0].closes, 1);
    assert.equal(f.audio.stops, 1);
    assert.equal(f.source.onended, null);
    assert.equal(f.source.buffer, null);
    assert.equal(f.source.disconnects, 1);
    assert.equal(f.destination.disconnects, 1);
  }
  if (f.starts.length)
    for (const handler of ['onstart', 'onresult', 'onerror', 'onend'])
      assert.equal(f.starts[0][handler], null);
  if (signal) assert.equal(getEventListeners(signal, 'abort').length, 0);
}

for (const options of [{ overload: false }, { policy: false }])
  test(
    'unsupported external audio fails closed without host recognition or capture ' +
      JSON.stringify(options),
    async () => {
      const f = fixture(options);
      await assert.rejects(f.run(), { code: 'external-audio-unsupported' });
      assert.equal(f.instances.length, 0);
      assert.equal(f.contexts.length, 0);
      released(f);
    },
  );

for (const prefixed of [false, true])
  test(
    'saved PCM waits for native start and delayed finals/end, deduplicating cumulative results ' +
      prefixed,
    async () => {
      const f = fixture({ prefixed }),
        controller = new AbortController();
      let done = false;
      const pending = f.run({ lang: 'en-US', signal: controller.signal }).then((text) => {
        done = true;
        return text;
      });
      await flush();
      const native = f.starts[0];
      assert.ok(native);
      assert.equal(native.lang, 'en-US');
      assert.equal(native.processLocally, true);
      assert.equal(native.continuous, true);
      assert.equal(f.source.connected, f.destination);
      assert.deepEqual(f.contexts[0].bufferArgs, [1, 2, 16000]);
      assert.deepEqual([...f.contexts[0].samples], [0.25, -0.5]);
      assert.equal(f.source.starts, 0);
      native.onstart();
      native.onstart();
      await flush();
      assert.equal(f.source.starts, 1);
      native.onresult({ results: [result('first'), result('temporary', false)] });
      f.source.onended();
      assert.equal(native.stops, 1);
      assert.equal(native.aborts, undefined);
      await flush();
      assert.equal(done, false);
      native.onresult({ results: [result('first'), result('second')] });
      native.onresult({ results: [result('first'), result('second')] });
      await flush();
      assert.equal(done, false);
      native.onend();
      assert.equal(await pending, 'first second');
      assert.equal(f.starts.length, 1);
      released(f, controller.signal);
    },
  );

test('local capability auto-install is reused, and remote processing requires explicit opt-in', async () => {
  const f = fixture({ availability: 'downloadable' });
  const pending = f.run();
  await flush();
  assert.deepEqual(f.installs, [{ langs: ['pt-BR'], processLocally: true }]);
  assert.equal(f.checks.length, 2);
  f.starts[0].onstart();
  await flush();
  f.source.onended();
  f.starts[0].onend();
  assert.equal(await pending, '');
  released(f);
  const remote = fixture({ local: false });
  const next = remote.run({ processLocally: false });
  await flush();
  assert.equal(remote.checks.length, 0);
  remote.starts[0].onstart();
  await flush();
  remote.source.onended();
  remote.starts[0].onend();
  assert.equal(await next, '');
  released(remote);
});

for (const config of [
  { local: false },
  { availability: 'unavailable' },
  { availability: 'downloadable' },
])
  test('local-only capability never silently falls back ' + JSON.stringify(config), async () => {
    const f = fixture(config);
    await assert.rejects(f.run({ autoInstallLocalPack: false }), {
      code: 'recognition-unavailable',
    });
    assert.equal(f.starts.length, 0);
    assert.equal(f.contexts.length, 0);
    assert.equal(f.installs.length, 0);
    released(f);
  });

test('pre-aborted operation creates no resources', async () => {
  const f = fixture(),
    c = new AbortController();
  c.abort();
  await assert.rejects(f.run({ signal: c.signal }), { name: 'AbortError' });
  assert.equal(f.frames.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.instances.length, 0);
});

test('cancellation during protected probe removes frame, timer, and listener', async () => {
  const f = fixture({ load: false }),
    c = new AbortController();
  const pending = f.run({ signal: c.signal });
  c.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await flush();
  assert.equal(f.instances.length, 0);
  released(f, c.signal);
});

test('cancellation during capability ignores its late resolution', async () => {
  let resolve;
  const f = fixture({
      availability: () =>
        new Promise((r) => {
          resolve = r;
        }),
    }),
    c = new AbortController();
  const pending = f.run({ signal: c.signal });
  await flush();
  c.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  resolve('downloadable');
  await flush();
  assert.equal(
    f.installs.length,
    0,
    'late capability cannot download a language pack after cancellation',
  );
  assert.equal(f.starts.length, 0);
  assert.equal(f.contexts.length, 0);
  released(f, c.signal);
});

for (const phase of ['waiting-start', 'resume', 'playing', 'waiting-final'])
  test(
    'cancellation releases all resources and ignores stale callbacks during ' + phase,
    async () => {
      let releaseResume;
      const f = fixture({
          resume:
            phase === 'resume'
              ? () =>
                  new Promise((r) => {
                    releaseResume = r;
                  })
              : undefined,
        }),
        c = new AbortController();
      const pending = f.run({ signal: c.signal });
      await flush();
      const native = f.starts[0],
        staleStart = native.onstart,
        staleResult = native.onresult,
        staleEnd = native.onend;
      if (phase !== 'waiting-start') {
        native.onstart();
        await flush();
      }
      if (phase === 'waiting-final') f.source.onended();
      c.abort();
      await assert.rejects(pending, { name: 'AbortError' });
      releaseResume?.();
      staleStart();
      staleResult({ results: [result('late')] });
      staleEnd();
      await flush();
      assert.equal(native.aborts, 1);
      assert.equal(f.source.starts, phase === 'playing' || phase === 'waiting-final' ? 1 : 0);
      assert.equal(f.starts.length, 1);
      released(f, c.signal);
    },
  );

for (const phase of ['capability', 'waiting-start', 'waiting-final'])
  test('completion deadline is bounded even during ' + phase, async () => {
    const f = fixture({
      availability: phase === 'capability' ? () => new Promise(() => {}) : 'available',
    });
    const pending = f.run();
    await flush();
    if (phase === 'waiting-final') {
      f.starts[0].onstart();
      await flush();
      f.source.onended();
    }
    const timer = [...f.timers.values()].find(({ ms }) => ms > 3000);
    assert.equal(timer.ms, 30001);
    f.timeout();
    await assert.rejects(pending, { code: 'recognition-timeout' });
    if (f.starts.length) assert.equal(f.starts[0].aborts, 1);
    released(f);
  });

test('native early end rejects partial transcription without replay or restart', async () => {
  const f = fixture();
  const pending = f.run();
  await flush();
  f.starts[0].onstart();
  await flush();
  f.starts[0].onresult({ results: [result('partial')] });
  f.starts[0].onend();
  await assert.rejects(pending, { code: 'recording-incomplete' });
  assert.equal(f.starts.length, 1);
  assert.equal(f.source.starts, 1);
  released(f);
});

for (const phase of ['start', 'native', 'resume', 'setup', 'stop'])
  test(
    'errors abort native recognition and clean independent audio resources during ' + phase,
    async () => {
      const error = new Error('fake failure');
      const f = fixture({
        startError: phase === 'start' ? error : undefined,
        setupError: phase === 'setup' ? error : undefined,
        resume: phase === 'resume' ? () => Promise.reject(error) : undefined,
      });
      const pending = f.run();
      const rejected = assert.rejects(
        pending,
        phase === 'native' ? { code: 'network' } : /fake failure/,
      );
      await flush();
      if (phase === 'native') f.starts[0].onerror({ error: 'network' });
      if (phase === 'resume' || phase === 'stop') {
        f.starts[0].onstart();
        await flush();
      }
      if (phase === 'stop') {
        f.starts[0].stop = () => {
          throw error;
        };
        f.source.onended();
      }
      await rejected;
      if (f.starts.length) assert.equal(f.starts[0].aborts, 1);
      released(f);
    },
  );

test('invalid PCM is rejected before any browser work', async () => {
  const f = fixture();
  for (const [pcm, rate] of [
    [new Float32Array(), 16000],
    [new Float32Array([NaN]), 16000],
    [new Float32Array([0]), 0],
  ])
    await assert.rejects(transcribeBrowserRecording(pcm, rate, { globals: f.globals }), RangeError);
  assert.equal(f.frames.length, 0);
  assert.equal(f.timers.size, 0);
});
