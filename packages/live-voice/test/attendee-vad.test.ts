// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { SileroVadPool } from '../src/modules/recognition/vad/SileroVadRuntime.js';
import { SileroWorkerRuntime } from '../src/modules/recognition/vad/SileroWorkerRuntime.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.js';
import { QwenHttpRecognitionEngine } from '../src/modules/recognition/engines/qwen/QwenRecognitionEngine.js';
import { mockRecordingRepository } from './helpers/recording.js';
const tick = () => new Promise((r) => setImmediate(r));
function runtimeFixture() {
  const calls = [],
    frames = [],
    blocks = [],
    errors = [];
  class Tensor {
    constructor(type, data, dims) {
      Object.assign(this, { type, data, dims });
    }
  }
  const ort = {
    env: { wasm: {} },
    Tensor,
    InferenceSession: {
      async create() {
        return {
          async run(feeds) {
            calls.push(feeds);
            return {
              output: new Tensor('float32', Float32Array.of(0.8), [1, 1]),
              stateN: new Tensor(
                'float32',
                new Float32Array(256).fill(feeds.input.data[64]),
                [2, 1, 128],
              ),
            };
          },
          release() {},
        };
      },
    },
  };
  let worker;
  const runtime = new SileroWorkerRuntime(ort, '/', (m) => worker.onmessage?.({ data: m }));
  worker = {
    onmessage: null,
    onerror: null,
    postMessage(m) {
      runtime.receive(m);
    },
    terminate() {
      runtime.dispose();
    },
  };
  const pool = new SileroVadPool(() => worker);
  // Keep one worker alive for all independent participant streams in this fixture.
  const anchor = pool.acquire({ onProbability() {}, onError: (e) => errors.push(e) });
  return {
    calls,
    frames,
    blocks,
    errors,
    pool,
    acquire(callbacks) {
      const source = Symbol();
      const stream = pool.acquire({
        ...callbacks,
        onProbability(m) {
          frames.push({ ...m, source });
          callbacks.onProbability(m);
        },
        onError(e) {
          errors.push(e);
          callbacks.onError(e);
        },
      });
      const ingest = stream.ingest.bind(stream);
      stream.ingest = (pcm, rate) => {
        blocks.push({ pcm: pcm.slice(), rate });
        ingest(pcm, rate);
      };
      return stream;
    },
    dispose() {
      anchor.release();
      runtime.dispose();
    },
  };
}
function pcmMeter(rate) {
  let listener;
  const stale = [];
  return {
    context: { sampleRate: rate },
    source: {},
    subscribePcm(f) {
      listener = f;
      stale.push(f);
      return () => {
        if (listener === f) listener = null;
      };
    },
    push(pcm) {
      listener?.(pcm, rate);
    },
    late(pcm) {
      stale[0]?.(pcm, rate);
    },
    count() {
      return stale.length;
    },
  };
}
function source(f, rate, Engine = WhisperHttpRecognitionEngine, id = 'attendee:fixture:a') {
  const meter = pcmMeter(rate),
    requests = [],
    results = [],
    errors = [];
  const engine = new Engine({
    meter,
    recordings: mockRecordingRepository(),
    inputSource: 'shared',
    sourceId: id,
    vadAvailable: async () => true,
    vadFactory: (c) => f.acquire(c),
    vadCapture: async () => {
      throw Error('External PCM must not recapture microphone/shared audio');
    },
    globals: {
      fetch: async (_url, options) => {
        requests.push(options);
        return Response.json({ ok: true, value: { text: 'synthetic complete phrase' } });
      },
    },
  });
  return {
    engine,
    meter,
    requests,
    results,
    errors,
    async start(signal) {
      await engine.start({
        signal,
        onError: (e) => errors.push(e),
        onResult: (r) => results.push(r),
      });
    },
  };
}
const signal = (length) => Float32Array.from({ length }, (_, i) => (i % 2 ? -0.25 : 0.5));
const joined = (arrays) => Float32Array.from(arrays.flatMap((a) => [...a]));
for (const rate of [8000, 16000]) {
  for (const length of [1, 127, 513, rate / 4, rate, rate / 4 + 7]) {
    test(
      'participant PCM ' +
        rate +
        ' Hz / ' +
        length +
        ' samples preserves raw audio and real Silero framing',
      async () => {
        const f = runtimeFixture(),
          s = source(f, rate);
        try {
          await s.start();
          const raw = signal(length);
          s.meter.push(raw);
          await s.engine.finish();
          await tick();
          assert.deepEqual(s.errors, []);
          assert.deepEqual(f.errors, []);
          const recorded = await s.engine.session.writer.read(0, length);
          assert.deepEqual(recorded, raw);
          assert.equal(s.engine.session.writer.session.sampleRate, rate);
          assert.equal(s.engine.session.writer.session.capturedSamples, length);
          const expected = rate === 8000 ? Float32Array.from([...raw].flatMap((v) => [v, v])) : raw;
          assert.deepEqual(joined(f.blocks.map((b) => b.pcm)), expected);
          assert.ok(f.blocks.every((b) => b.rate === 16000 && b.pcm.length <= 4000));
          assert.deepEqual(joined(f.frames.map((frame) => frame.pcm)), expected);
          assert.equal(
            f.frames.reduce((sum, frame) => sum + frame.pcm.length, 0) / 16000,
            length / rate,
          );
          assert.ok(f.frames.every((frame) => frame.pcm.length <= 512));
          assert.equal(f.frames.at(-1).pcm.length, expected.length % 512 || 512);
          assert.equal(f.calls.length, Math.ceil(expected.length / 512));
        } finally {
          await s.engine.stop();
          f.dispose();
        }
      },
    );
  }
}
for (const Engine of [WhisperHttpRecognitionEngine, QwenHttpRecognitionEngine]) {
  test(
    Engine.name + ' participant 8 kHz packet retains STT duration and original nonzero content',
    async () => {
      const f = runtimeFixture(),
        s = source(f, 8000, Engine);
      try {
        await s.start();
        const raw = new Float32Array(8000).fill(0.25);
        s.meter.push(raw);
        await s.engine.finish();
        await tick();
        assert.deepEqual(s.errors, []);
        assert.equal(s.requests.length, 1);
        const wav = new DataView(s.requests[0].body);
        assert.equal(wav.getUint32(24, true), 16000);
        const audio = new Int16Array(s.requests[0].body, 44);
        assert.equal(audio.length / 16000, 1);
        assert.ok(audio.every((v) => v === 8191));
        assert.equal(s.engine.session.writer.session.capturedSamples, 8000);
        assert.deepEqual(await s.engine.session.writer.read(0, 8000), raw);
        assert.equal(s.results.length, 1);
      } finally {
        await s.engine.stop();
        f.dispose();
      }
    },
  );
}
test('two participant UUID streams keep independent framing, sample clocks and recurrent state', async () => {
  const f = runtimeFixture(),
    a = source(f, 8000, WhisperHttpRecognitionEngine, 'attendee:bot:a'),
    b = source(f, 16000, WhisperHttpRecognitionEngine, 'attendee:bot:b');
  try {
    await a.start();
    await b.start();
    a.meter.push(new Float32Array(4000).fill(0.25));
    b.meter.push(new Float32Array(8007).fill(-0.5));
    await Promise.all([a.engine.finish(), b.engine.finish()]);
    assert.deepEqual(f.errors, []);
    const bySource = new Map();
    for (const frame of f.frames) {
      const frames = bySource.get(frame.source) || [];
      frames.push(frame);
      bySource.set(frame.source, frames);
    }
    assert.equal(bySource.size, 2);
    const lines = [...bySource.values()].map((frames) => joined(frames.map((m) => m.pcm)));
    assert.ok(lines.some((line) => line.length === 8000 && line.every((v) => v === 0.25)));
    assert.ok(lines.some((line) => line.length === 8007 && line.every((v) => v === -0.5)));
    assert.ok(
      f.calls.every(
        (feeds) => feeds.state.data[0] === 0 || feeds.state.data[0] === feeds.input.data[64],
      ),
    );
  } finally {
    await a.engine.stop();
    await b.engine.stop();
    f.dispose();
  }
});
test('stale external callbacks after stop or abort cannot append raw PCM or feed the VAD stream', async () => {
  for (const stop of [true, false]) {
    const f = runtimeFixture(),
      s = source(f, 8000),
      abort = new AbortController();
    try {
      await s.start(abort.signal);
      s.meter.push(signal(127));
      await tick();
      const session = s.engine.session;
      if (stop) await s.engine.stop();
      else {
        abort.abort();
        await tick();
      }
      const blocks = f.blocks.length;
      s.meter.late(signal(8000));
      await tick();
      assert.equal(f.blocks.length, blocks);
      assert.equal(session.writer.session.capturedSamples, 127);
      assert.equal(s.requests.length, 0);
      assert.equal(s.results.length, 0);
    } finally {
      await s.engine.stop();
      f.dispose();
    }
  }
});
test('pre-aborted participant start never subscribes PCM or creates inference work', async () => {
  const f = runtimeFixture(),
    s = source(f, 8000),
    abort = new AbortController();
  abort.abort();
  try {
    await assert.rejects(s.start(abort.signal), { name: 'AbortError' });
    assert.equal(s.meter.count(), 0);
    assert.equal(f.blocks.length, 0);
    assert.equal(f.calls.length, 0);
  } finally {
    await s.engine.stop();
    f.dispose();
  }
});
test('participant packet boundaries retain 512-frame phase and exact nonzero tail across bursts', async () => {
  const f = runtimeFixture(),
    s = source(f, 8000);
  try {
    await s.start();
    const chunks = [signal(3), signal(2000), signal(7), signal(8000), signal(1)];
    for (const pcm of chunks) {
      s.meter.push(pcm);
      await tick();
    }
    await s.engine.finish();
    const raw = joined(chunks);
    assert.deepEqual(await s.engine.session.writer.read(0, raw.length), raw);
    assert.deepEqual(
      joined(f.frames.map((m) => m.pcm)),
      Float32Array.from([...raw].flatMap((v) => [v, v])),
    );
    assert.equal(f.frames.length, Math.ceil((raw.length * 2) / 512));
    assert.deepEqual(f.errors, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.engine.stop();
    f.dispose();
  }
});
