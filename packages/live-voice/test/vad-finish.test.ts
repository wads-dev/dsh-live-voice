import test from 'node:test';
import assert from 'node:assert/strict';
import { mockRecordingRepository } from './helpers/recording.js';
import {
  SileroVadPool,
  attachSileroVadCapture,
} from '../src/modules/recognition/vad/SileroVadRuntime.js';
import { SileroWorkerRuntime } from '../src/modules/recognition/vad/SileroWorkerRuntime.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.ts';
import { QwenHttpRecognitionEngine } from '../src/modules/recognition/engines/qwen/QwenRecognitionEngine.ts';
import { SileroFrameResampler } from '../src/modules/recognition/vad/StreamingResampler.js';
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function ortFixture(run: (feeds: any) => Promise<void> = async () => {}) {
  const calls: any[] = [];
  class Tensor {
    constructor(
      public type: string,
      public data: any,
      public dims: number[],
    ) {}
  }
  return {
    calls,
    ort: {
      env: { wasm: { wasmPaths: '', numThreads: 0 } },
      Tensor,
      InferenceSession: {
        async create() {
          return {
            async run(feeds: any) {
              calls.push(feeds);
              await run(feeds);
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
    },
  };
}
class LoopWorker {
  onmessage: any = null;
  onerror: any = null;
  messages: any[] = [];
  terminated = 0;
  constructor(public runtime: SileroWorkerRuntime) {}
  postMessage(message: any) {
    this.messages.push(message);
    this.runtime.receive(message);
  }
  terminate() {
    this.terminated++;
    this.runtime.dispose();
  }
}
function loopFixture(t: any, run?: (feeds: any) => Promise<void>, bound = 32, pending = 64) {
  const fake = ortFixture(run);
  let worker!: LoopWorker;
  const runtime = new SileroWorkerRuntime(
    fake.ort,
    '/',
    (m) => worker?.onmessage?.({ data: m }),
    bound,
  );
  worker = new LoopWorker(runtime);
  const pool = new SileroVadPool(() => worker, pending);
  const errors: Error[] = [];
  const frames: any[] = [];
  const stream = pool.acquire({
    onProbability: (m) => frames.push(m),
    onError: (e) => errors.push(e),
  });
  t.after(() => {
    stream.release();
    runtime.dispose();
  });
  return { ...fake, runtime, worker, pool, stream, frames, errors };
}
let Processor: any;
async function captureFixture(
  t: any,
  stream: any,
  holdStop = false,
  onPcm?: (pcm: Float32Array, sampleRate: number) => void,
) {
  const originals = [
    'AudioWorkletProcessor',
    'registerProcessor',
    'sampleRate',
    'AudioWorkletNode',
    '__vadTestPort',
  ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const messages: any[] = [];
  let handler: any = null;
  let stopped: any;
  let closed = false;
  let disconnected = 0;
  const hostPort: any = {
    get onmessage() {
      return handler;
    },
    set onmessage(h) {
      handler = h;
    },
    postMessage(m: any) {
      messages.push(m);
      if (holdStop && m.type === 'stop') stopped = m;
      else processor.port.onmessage?.({ data: m });
    },
    close() {
      closed = true;
    },
  };
  const workletPort: any = {
    onmessage: null,
    postMessage(m: any) {
      queueMicrotask(() => handler?.({ data: m }));
    },
  };
  Object.assign(globalThis, {
    sampleRate: 48000,
    __vadTestPort: workletPort,
    AudioWorkletProcessor: class {
      port = (globalThis as any).__vadTestPort;
    },
    registerProcessor(_name: string, p: any) {
      Processor = p;
    },
  });
  await import('../src/modules/recognition/vad/vad.capture.js');
  const processor = new Processor();
  // The bundled worklet module initializes once; inject a fresh port for each instance.
  processor.port = workletPort;
  const node: any = {
    port: hostPort,
    onprocessorerror: null,
    connect() {},
    disconnect() {
      disconnected++;
    },
  };
  Object.assign(globalThis, {
    AudioWorkletNode: class {
      constructor() {
        return node;
      }
    },
  });
  t.after(() =>
    originals.forEach(([key, descriptor]) => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }),
  );
  const source: any = {
    connect() {},
    disconnect() {
      disconnected++;
    },
  };
  const context: any = { audioWorklet: { async addModule() {} }, destination: {} };
  const capture = await attachSileroVadCapture(context, source, stream, onPcm);
  t.after(() => capture.release());
  return {
    capture,
    processor,
    node,
    messages,
    sendStop() {
      processor.port.onmessage?.({ data: stopped });
    },
    pcm(input: Float32Array) {
      return processor.process([[input]], [[new Float32Array(input.length)]]);
    },
    get closed() {
      return closed;
    },
    get disconnected() {
      return disconnected;
    },
  };
}

test('resampler flush preserves its incomplete averaging cell and exact unpadded tail once', () => {
  const r: any = new SileroFrameResampler();
  assert.deepEqual(r.process(Float32Array.of(3, 6, 9, 12), 48000), []);
  assert.deepEqual(Array.from(r.flush()), [6, 12]);
  assert.equal(r.flush().length, 0);
  assert.deepEqual(r.process(Float32Array.of(1, 2, 3), 48000), []);
  assert.deepEqual(Array.from(r.flush()), [2]);
});

test('stream flush is an ordered barrier behind in-flight frames even with no tail', async (t) => {
  const gate = deferred();
  const f = loopFixture(t, () => gate.promise);
  f.stream.ingest(new Float32Array(512).fill(0.25), 16000);
  await tick();
  let done = false;
  const flushing = (f.stream as any).flush().then(() => {
    done = true;
  });
  await tick();
  assert.equal(done, false);
  assert.equal(f.frames.length, 0);
  gate.resolve();
  await flushing;
  assert.equal(f.frames.length, 1);
});

test('stream flush returns exact residual PCM, padding only inference, without duplicating a second flush', async (t) => {
  const f = loopFixture(t);
  await f.stream.process(
    Float32Array.from({ length: 1540 }, (_, i) => i / 1540),
    48000,
  );
  await (f.stream as any).flush();
  assert.deepEqual(
    f.frames.map((m) => m.pcm.length),
    [512, 2],
  );
  const tail = f.frames[1].pcm;
  assert.equal(tail[0], Math.fround((1536 + 1537 + 1538) / 3 / 1540));
  assert.equal(tail[1], Math.fround(1539 / 1540));
  assert.equal(f.calls[1].input.data.length, 576);
  assert.deepEqual(Array.from(f.calls[1].input.data.slice(64, 66)), Array.from(tail));
  assert.ok(f.calls[1].input.data.slice(66).every((n: number) => n === 0));
  await (f.stream as any).flush();
  assert.equal(f.frames.length, 2);
});

test('worklet flush drains the partial buffer without ending capture', async (t) => {
  const f = loopFixture(t);
  const received: number[] = [];
  const c = await captureFixture(t, f.stream, false, (pcm) => received.push(...pcm));
  c.pcm(new Float32Array(128).fill(0.25));
  await c.capture.flush();
  assert.equal(received.length, 128);
  assert.ok(received.every((n) => n === 0.25));
  assert.equal(c.closed, false);
  assert.equal(c.disconnected, 0);
  c.pcm(new Float32Array(128).fill(0.5));
  await c.capture.flush();
  assert.equal(received.length, 256);
  assert.ok(received.slice(128).every((n) => n === 0.5));
  assert.equal(c.closed, false);
});

test('worklet navigation flush freezes PCM until explicit resume', async (t) => {
  const f = loopFixture(t);
  const received: number[] = [];
  const c = await captureFixture(t, f.stream, false, (pcm) => received.push(...pcm));
  c.pcm(new Float32Array(128).fill(0.25));
  await c.capture.flush(true);
  assert.equal(received.length, 128);
  c.pcm(new Float32Array(2048).fill(0.9));
  await tick();
  assert.equal(received.length, 128);
  c.capture.resume();
  c.pcm(new Float32Array(128).fill(0.5));
  await c.capture.flush();
  assert.equal(received.length, 256);
  assert.ok(received.slice(128).every((n) => n === 0.5));
  assert.equal(c.closed, false);
});

test('actual worklet finish emits buffered PCM before ack, drains worker, cleans capture only and is idempotent', async (t) => {
  const gate = deferred();
  const f = loopFixture(t, () => gate.promise);
  const c = await captureFixture(t, f.stream);
  c.pcm(new Float32Array(128).fill(0.75));
  assert.equal(f.worker.messages.filter((m) => m.type === 'pcm').length, 0);
  const finishing = (c.capture as any).finish();
  assert.equal((c.capture as any).finish(), finishing);
  await tick();
  assert.equal(c.closed, false);
  assert.deepEqual(
    f.worker.messages.filter((m) => m.type !== 'open').map((m) => m.type),
    ['pcm', 'flush'],
  );
  assert.equal(c.pcm(new Float32Array(128)), false);
  gate.resolve();
  await finishing;
  assert.equal(c.closed, true);
  assert.equal(c.disconnected, 2);
  assert.equal(f.stream.released, false);
  assert.equal(f.frames.length, 1);
  assert.equal(f.frames[0].pcm.length, 43);
  assert.ok(f.frames[0].pcm.every((n: number) => n === 0.75));
  await (c.capture as any).finish();
  assert.equal(c.messages.filter((m) => m.type === 'stop').length, 1);
});

for (const phase of ['ack', 'drain'])
  test(
    'capture cancellation during ' + phase + ' rejects AbortError and suppresses stale PCM',
    async (t) => {
      const gate = deferred();
      const f = loopFixture(t, () => gate.promise);
      const c = await captureFixture(t, f.stream, phase === 'ack');
      c.pcm(new Float32Array(128).fill(0.5));
      const finish = (c.capture as any).finish();
      const rejected = assert.rejects(finish, { name: 'AbortError' });
      await tick();
      c.capture.release();
      await rejected;
      c.sendStop();
      gate.resolve();
      await tick();
      assert.equal(f.frames.length, 0);
      assert.equal(c.closed, true);
    },
  );

test('worklet full packets and residual tail drain exactly once, including an empty finish', async (t) => {
  const f = loopFixture(t);
  const c = await captureFixture(t, f.stream);
  c.pcm(new Float32Array(2048).fill(0.125));
  c.pcm(new Float32Array(31).fill(0.125));
  await c.capture.finish();
  assert.deepEqual(
    f.frames.map((m) => m.pcm.length),
    [512, 181],
  );
  assert.equal(
    f.frames.reduce((n, m) => n + m.pcm.length, 0),
    693,
  );
  assert.ok(f.frames.every((m) => m.pcm.every((n: number) => n === 0.125)));
  const empty = f.pool.acquire({
    onProbability() {
      assert.fail('Empty capture must not infer');
    },
    onError() {},
  });
  t.after(() => empty.release());
  const d = await captureFixture(t, empty);
  await d.capture.finish();
  assert.equal(d.closed, true);
  assert.equal(f.calls.length, 2);
});

test('reset cancels pending finish but leaves ordinary active capture usable', async (t) => {
  const f = loopFixture(t);
  const c = await captureFixture(t, f.stream, true);
  f.stream.reset();
  assert.equal(c.closed, false);
  const rejected = assert.rejects(c.capture.finish(), { name: 'AbortError' });
  f.stream.reset();
  await rejected;
  assert.equal(c.closed, true);
});

test('release before finish rejects and detached port cannot ingest queued PCM', async (t) => {
  const f = loopFixture(t);
  const c = await captureFixture(t, f.stream);
  c.pcm(new Float32Array(2048));
  c.capture.release();
  const pcmCount = f.worker.messages.filter((m) => m.type === 'pcm').length;
  await tick();
  assert.equal(f.worker.messages.filter((m) => m.type === 'pcm').length, pcmCount);
  await assert.rejects(c.capture.finish(), { name: 'AbortError' });
});

test('worker failure before acknowledgement and synchronous stop send failure reject finish', async (t) => {
  const f = loopFixture(t);
  const c = await captureFixture(t, f.stream, true);
  const rejected = assert.rejects(c.capture.finish(), /worker failed/);
  f.worker.onerror({ message: 'worker failed' });
  await rejected;
  assert.equal(c.closed, true);
  const g = loopFixture(t);
  const d = await captureFixture(t, g.stream);
  d.node.port.postMessage = () => {
    throw new Error('stop send failed');
  };
  await assert.rejects(d.capture.finish(), /stop send failed/);
  assert.equal(d.closed, true);
});

test('invalid capture PCM poisons flush instead of silently losing the packet', async (t) => {
  const f = loopFixture(t);
  f.stream.ingest(Float32Array.of(NaN), 16000);
  await tick();
  await assert.rejects(f.stream.flush(), /Invalid VAD PCM/);
});

test('failed stream cannot attach a new capture and leak connected resources', async (t) => {
  const f = loopFixture(t);
  f.stream.reportError(new Error('capture failed already'));
  await assert.rejects(captureFixture(t, f.stream), /capture failed already/);
});

test('stream release during capture acknowledgement rejects immediately', async (t) => {
  const f = loopFixture(t);
  const c = await captureFixture(t, f.stream, true);
  const finish = (c.capture as any).finish();
  const rejected = assert.rejects(finish, { name: 'AbortError' });
  f.stream.release();
  await rejected;
  assert.equal(c.closed, true);
});

test('processor failure during acknowledgement and failed inference during drain cannot succeed', async (t) => {
  const f = loopFixture(t, async () => {
    throw new Error('inference failed');
  });
  const c = await captureFixture(t, f.stream);
  c.pcm(new Float32Array(128));
  await assert.rejects((c.capture as any).finish(), /inference failed/);
  assert.equal(c.closed, true);
  const other = f.pool.acquire({ onProbability() {}, onError() {} });
  t.after(() => other.release());
  const d = await captureFixture(t, other, true);
  const rejected = assert.rejects((d.capture as any).finish(), /AudioWorklet/);
  d.node.onprocessorerror();
  await rejected;
  assert.equal(d.closed, true);
});

test('capture flush timeout releases its node and a replacement capture remains usable', async (t) => {
  const f = loopFixture(t);
  const old = await captureFixture(t, f.stream);
  const post = old.node.port.postMessage.bind(old.node.port);
  old.node.port.postMessage = (message: any) => {
    if (message.type !== 'flush') post(message);
  };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timedOut = assert.rejects(old.capture.flush(true), /VAD capture flush timed out/);
  t.mock.timers.tick(3000);
  await timedOut;
  assert.equal(old.closed, true);
  const replacementStream = f.pool.acquire({ onProbability() {}, onError() {} });
  t.after(() => replacementStream.release());
  const next = await captureFixture(t, replacementStream);
  next.pcm(new Float32Array(128).fill(0.3));
  await next.capture.flush(true);
  assert.equal(next.closed, false);
});

test('capture and worker flush have bounded acknowledgement/drain waits', async (t) => {
  const f = loopFixture(t);
  const c = await captureFixture(t, f.stream, true);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rejected = assert.rejects((c.capture as any).finish(), /timed out/i);
  t.mock.timers.tick(60000);
  await rejected;
  assert.equal(c.closed, true);
  const w: any = { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
  const pool = new SileroVadPool(() => w);
  const stream = pool.acquire({ onProbability() {}, onError() {} });
  t.after(() => stream.release());
  const drainRejected = assert.rejects((stream as any).flush(), /timed out/i);
  t.mock.timers.tick(60000);
  await drainRejected;
});

test('pool pending and worker frame overload cannot silently finish after losing audio', async (t) => {
  for (const side of ['pool', 'worker']) {
    const gate = deferred();
    const f = loopFixture(
      t,
      () => gate.promise,
      side === 'worker' ? 1 : 32,
      side === 'pool' ? 1 : 64,
    );
    f.stream.ingest(new Float32Array(512), 16000);
    await tick();
    f.stream.ingest(new Float32Array(1024), 16000);
    await assert.rejects((f.stream as any).flush(), /overloaded/);
    gate.resolve();
    await tick();
    assert.equal(f.frames.length, 0);
  }
});

test('flushing or cancelling one source preserves another source FIFO and recurrent state', async (t) => {
  const gate = deferred();
  let first = true;
  const f = loopFixture(t, async () => {
    if (first) {
      first = false;
      await gate.promise;
    }
  });
  const frames: any[] = [];
  const b: any = f.pool.acquire({ onProbability: (m) => frames.push(m), onError() {} });
  t.after(() => b.release());
  f.stream.ingest(new Float32Array(512).fill(0.1), 16000);
  await tick();
  b.ingest(new Float32Array(512).fill(0.2), 16000);
  b.ingest(new Float32Array(7).fill(0.3), 16000);
  const flushing = b.flush();
  const cancelled = assert.rejects((f.stream as any).flush(), { name: 'AbortError' });
  f.stream.release();
  await cancelled;
  assert.equal(f.worker.terminated, 0);
  gate.resolve();
  await flushing;
  assert.deepEqual(
    frames.map((m) => m.pcm.length),
    [512, 7],
  );
  assert.equal(f.calls[2].state.data[0], Math.fround(0.2));
  assert.equal(f.frames.length, 0);
});

test('one flush barrier can drain a full accepted worker queue without overload', async (t) => {
  const gate = deferred();
  const f = loopFixture(t, () => gate.promise, 2, 2);
  f.stream.ingest(new Float32Array(1024).fill(0.25), 16000);
  const flushing = f.stream.flush();
  assert.equal(f.stream.flush(), flushing);
  assert.equal(f.errors.length, 0);
  gate.resolve();
  await flushing;
  assert.equal(
    f.frames.reduce((n, m) => n + m.pcm.length, 0),
    1024,
  );
  await f.stream.process(Float32Array.of(0.5), 16000);
  await f.stream.flush();
  assert.equal(f.frames.at(-1).pcm.length, 1);
  assert.equal(f.frames.at(-1).pcm[0], 0.5);
});

for (const Engine of [WhisperHttpRecognitionEngine, QwenHttpRecognitionEngine]) {
  test(
    Engine.name + ': real capture/pool/worker finish preserves every WAV tail sample',
    async (t) => {
      const gate = deferred();
      const f = loopFixture(t, () => gate.promise);
      // The fixture's initial source keeps its worker alive while the engine acquires its own.
      let c: any;
      const requests: any[] = [],
        results: any[] = [],
        errors: any[] = [];
      const engine = new Engine({
        recordings: mockRecordingRepository(),
        meter: { context: { sampleRate: 48000 }, source: {} },
        vadAvailable: async () => true,
        vadFactory: (callbacks: any) => f.pool.acquire(callbacks),
        vadCapture: async (_context: any, _source: any, stream: any, onPcm: any) => {
          c = await captureFixture(t, stream, false, onPcm);
          return c.capture;
        },
        globals: {
          fetch: async (url: string, options: any) => {
            requests.push({ url, options });
            return Response.json({ ok: true, value: { text: 'synthetic complete phrase' } });
          },
        },
      });
      t.after(() => engine.stop());
      await engine.start({
        onResult: (x: any) => results.push(x),
        onError: (x: any) => errors.push(x),
      });
      for (let i = 0; i < 12; i++) c.pcm(new Float32Array(2048).fill(0.25));
      c.pcm(new Float32Array(31).fill(0.25));
      const finish = engine.finish();
      await tick();
      assert.equal(requests.length, 0);
      assert.equal(c.closed, false);
      gate.resolve();
      await finish;
      await tick();
      assert.equal(errors.length, 0);
      assert.equal(requests.length, 1);
      const pcm = new Int16Array(requests[0].options.body, 44);
      const stored = await engine.session.writer.read(0, 12 * 2048 + 31);
      assert.equal(stored.length, 12 * 2048 + 31);
      assert.ok(
        stored.every((n: number) => n === 0.25),
        'raw recording preserves every residual capture sample',
      );
      assert.equal(pcm.length, Math.floor((12 * 2048 + 31) / 3));
      assert.ok(pcm.every((n) => n === 8191));
      assert.equal(c.closed, true);
      assert.equal(results.length, 1);
    },
  );
}
