// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { BrowserSpeakingEngine } from '../src/modules/speak/engines/browser/BrowserSpeakingEngine.ts';
import { BrowserRecognitionEngine } from '../src/modules/recognition/engines/browser/BrowserRecognitionEngine.ts';

const local = { name: 'Local', voiceURI: 'local', lang: 'pt-BR', localService: true };
const remote = { name: 'Remote', voiceURI: 'remote', lang: 'pt-BR', localService: false };
function synthesis(voices = [remote, local]) {
  const spoken = [];
  const globals = {
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
      }
    },
    speechSynthesis: {
      cancelled: 0,
      paused: false,
      getVoices: () => voices,
      speak: (utterance) => spoken.push(utterance),
      cancel() {
        this.cancelled++;
        spoken.at(-1)?.onend?.();
      },
      pause() {
        this.paused = true;
      },
      resume() {
        this.paused = false;
      },
    },
  };
  return { globals, spoken, engine: new BrowserSpeakingEngine({ globals }) };
}
function recognition({
  availability = 'available',
  localProperty = true,
  startError,
  installResult = false,
} = {}) {
  const instances = [],
    checks = [],
    installs = [],
    timers = new Map();
  let nextTimer = 0;
  class Recognition {
    static async available(options) {
      checks.push(options);
      return typeof availability === 'function' ? availability() : availability;
    }
    static async install(options) {
      installs.push(options);
      return installResult;
    }
    constructor() {
      if (localProperty) this.processLocally = false;
      instances.push(this);
    }
    start() {
      if (this.processLocally !== undefined) assert.equal(typeof this.processLocally, 'boolean');
      this.started = true;
      if (startError) throw startError;
    }
    abort() {
      this.aborted = true;
      this.onend?.();
    }
    emit(name, value = {}) {
      this['on' + name]?.(value);
    }
  }
  const globals = {
    SpeechRecognition: Recognition,
    setTimeout(fn) {
      timers.set(++nextTimer, fn);
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  return {
    globals,
    instances,
    checks,
    installs,
    timers,
    current: () => instances.at(-1),
    tick() {
      const entries = [...timers];
      timers.clear();
      for (const [, fn] of entries) fn();
    },
  };
}
const result = (transcript, isFinal = false) => Object.assign([{ transcript }], { isFinal });
const detached = (r) => {
  for (const name of ['onresult', 'onerror', 'onend', 'onspeechstart', 'onspeechend'])
    assert.equal(r[name], null);
};

test('synthesis reports and honors optional pause support truthfully', () => {
  const { globals } = synthesis();
  delete globals.speechSynthesis.pause;
  delete globals.speechSynthesis.resume;
  const engine = new BrowserSpeakingEngine({ globals });
  assert.deepEqual(
    { pause: engine.capability().pause, resume: engine.capability().resume },
    { pause: false, resume: false },
  );
  assert.equal(engine.pause(), false);
  assert.equal(engine.resume(), false);
});

test('synthesis exposes only local voices and completes on end, not enqueue', async () => {
  const { engine, spoken, globals } = synthesis();
  assert.equal(engine.capability().supported, true);
  assert.deepEqual(engine.voices(), [local]);
  const controller = new AbortController();
  let complete = false;
  const pending = engine.speak('Olá', { rate: 1.2, signal: controller.signal }).then(() => {
    complete = true;
  });
  await Promise.resolve();
  assert.equal(complete, false);
  assert.equal(spoken[0].voice, local);
  assert.equal(spoken[0].lang, 'pt-BR');
  assert.equal(spoken[0].rate, 1.2);
  engine.pause();
  assert.equal(globals.speechSynthesis.paused, true);
  engine.resume();
  assert.equal(globals.speechSynthesis.paused, false);
  spoken[0].onend();
  await pending;
  assert.equal(spoken[0].onend, null);
  assert.equal(spoken[0].onerror, null);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('synthesis never chooses remote or forged voices and handles late voice discovery', async () => {
  const voices = [remote];
  const { engine, spoken } = synthesis(voices);
  assert.equal(engine.capability().supported, false);
  await assert.rejects(engine.speak('no'), /Local browser speech synthesis/);
  voices.push(local);
  assert.equal(engine.capability().supported, true);
  await assert.rejects(engine.speak('no', { voice: remote }), /not an available local/);
  await assert.rejects(engine.speak('no', { voice: { ...local } }), /not an available local/);
  await assert.rejects(engine.speak('no', { rate: NaN }), RangeError);
  const pending = engine.speak('yes', { voice: 'local' });
  assert.equal(spoken[0].voice, local);
  spoken[0].onend();
  await pending;
});

test('synthesis replacement, signal abort and stop reject once and ignore stale events', async () => {
  const { engine, spoken, globals } = synthesis();
  const first = engine.speak('old');
  const oldEnd = spoken[0].onend;
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const controller = new AbortController();
  const second = engine.speak('new', { signal: controller.signal });
  const rejectedSecond = assert.rejects(second, { name: 'AbortError' });
  oldEnd();
  assert.ok(engine.current);
  controller.abort();
  await Promise.all([rejected, rejectedSecond]);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(engine.current, null);
  assert.equal(globals.speechSynthesis.cancelled, 2);
  await engine.stop();
  await assert.rejects(engine.speak('never', { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(spoken.length, 2);
});

test('synthesis native errors and synchronous exceptions release handlers', async () => {
  const { engine, spoken, globals } = synthesis();
  const controller = new AbortController();
  const pending = engine.speak('error', { signal: controller.signal });
  spoken[0].onerror({ error: 'synthesis-failed' });
  await assert.rejects(pending, { code: 'synthesis-failed' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  globals.speechSynthesis.speak = () => {
    throw new Error('native throw');
  };
  await assert.rejects(engine.speak('throw', { signal: controller.signal }), /native throw/);
  assert.equal(engine.current, null);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(new BrowserSpeakingEngine({ globals: {} }).capability().supported, false);
});

test('local-only recognition requires exact availability when automatic install is disabled', async () => {
  for (const options of [
    { localProperty: false },
    { availability: 'downloadable' },
    { availability: 'downloading' },
    { availability: 'unavailable' },
    { availability: true },
    {
      availability: () => {
        throw new Error('denied');
      },
    },
  ]) {
    const fake = recognition(options);
    const engine = new BrowserRecognitionEngine({
      globals: fake.globals,
      autoInstallLocalPack: false,
    });
    assert.equal((await engine.capability()).supported, false);
    await assert.rejects(engine.start(), /Local browser speech recognition|Local recognition for/s);
    assert.equal(
      fake.instances.some((r) => r.started),
      false,
    );
    assert.equal(engine.active, false);
  }
  for (const globals of [{}, { SpeechRecognition: class {} }]) {
    assert.equal((await new BrowserRecognitionEngine({ globals }).capability()).supported, false);
  }
});

test('recognition locality is user-controlled and local packs may install automatically', async () => {
  const remote = recognition({ localProperty: false });
  const remoteEngine = new BrowserRecognitionEngine({
    globals: remote.globals,
    processLocally: false,
  });
  assert.deepEqual(await remoteEngine.capability(), {
    supported: true,
    local: false,
    reason: 'Browser recognition service may process audio remotely.',
  });
  await remoteEngine.start();
  assert.equal(remote.current().processLocally, undefined);
  await remoteEngine.stop();
  let availability = 'downloadable';
  const local = recognition({ availability: () => availability, installResult: true });
  local.globals.SpeechRecognition.install = async (options) => {
    local.installs.push(options);
    availability = 'available';
    return true;
  };
  const localEngine = new BrowserRecognitionEngine({
    globals: local.globals,
    processLocally: true,
    autoInstallLocalPack: true,
  });
  assert.equal((await localEngine.capability()).supported, true);
  assert.deepEqual(local.installs, [{ langs: ['pt-BR'], processLocally: true }]);
});

test('recognition configures local continuous interim recognition, deduplicates finals, clears activity', async () => {
  const fake = recognition(),
    results = [],
    activity = [];
  const engine = new BrowserRecognitionEngine({
    globals: fake.globals,
    onResult: (r) => results.push(r),
    onActivity: (a) => activity.push(a),
  });
  const controller = new AbortController();
  await engine.start({ signal: controller.signal });
  assert.deepEqual(fake.checks, [{ langs: ['pt-BR'], processLocally: true }]);
  const r = fake.current();
  assert.equal(r.continuous, true);
  assert.equal(r.interimResults, true);
  assert.equal(r.lang, 'pt-BR');
  r.emit('speechstart');
  r.emit('speechstart');
  r.emit('result', { resultIndex: 0, results: [result('Olá')] });
  r.emit('result', { resultIndex: 0, results: [result('Olá', true), result('mundo')] });
  r.emit('result', { resultIndex: 1, results: [result('Olá', true), result('mundo', true)] });
  r.emit('result', { resultIndex: 1, results: [result('Olá', true), result('mundo', true)] });
  assert.deepEqual(
    results.map(({ startedAt, ...text }) => text),
    [
      { interim: 'Olá', final: '' },
      { interim: 'mundo', final: 'Olá' },
      { interim: '', final: 'mundo' },
      { interim: '', final: '' },
    ],
  );
  const stale = r.onresult;
  await engine.stop();
  stale({ results: [result('ignored', true)] });
  assert.equal(results.length, 4);
  assert.deepEqual(activity, [true, false]);
  assert.equal(r.aborted, true);
  detached(r);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('recognition reset starts a fresh native result list and ignores the old instance', async () => {
  const fake = recognition(),
    results = [],
    activity = [];
  const engine = new BrowserRecognitionEngine({
    globals: fake.globals,
    onResult: (value) => results.push(value),
    onActivity: (value) => activity.push(value),
  });
  await engine.start();
  const old = fake.current();
  old.emit('speechstart');
  old.emit('result', { results: [result('sent phrase', true)] });
  const staleResult = old.onresult;

  assert.equal(engine.reset(), true);
  assert.equal(old.aborted, true);
  detached(old);
  const fresh = fake.current();
  assert.notEqual(fresh, old);
  assert.equal(fresh.started, true);
  staleResult({ results: [result('sent phrase', true), result('stale continuation')] });
  fresh.emit('result', { results: [result('new phrase')] });

  assert.deepEqual(
    results.map(({ startedAt, ...text }) => text),
    [
      { interim: '', final: 'sent phrase' },
      { interim: 'new phrase', final: '' },
    ],
  );
  assert.deepEqual(activity, [true, false]);
  await engine.stop();
});

test('recognition stop promptly cancels pending checks and later checks cannot resurrect capture', async () => {
  let release;
  const fake = recognition({
    availability: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const engine = new BrowserRecognitionEngine({ globals: fake.globals });
  const controller = new AbortController();
  const pending = engine.start({ signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await engine.stop();
  await rejected;
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  release('available');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    fake.instances.some((r) => r.started),
    false,
  );
  assert.equal(engine.active, false);
});

test('recognition overlapping starts accept only newest language and abort active sessions', async () => {
  const releases = [];
  const fake = recognition({
    availability: () => new Promise((resolve) => releases.push(resolve)),
  });
  const engine = new BrowserRecognitionEngine({ globals: fake.globals });
  const first = engine.start();
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const controller = new AbortController();
  const second = engine.start({ lang: 'en-US', signal: controller.signal });
  releases[1]('available');
  await second;
  releases[0]('available');
  await rejected;
  assert.equal(fake.current().lang, 'en-US');
  assert.equal(fake.instances.filter((r) => r.started).length, 1);
  controller.abort();
  assert.equal(engine.active, false);
  detached(fake.current());
  await assert.rejects(engine.start({ signal: controller.signal }), { name: 'AbortError' });
});

test('recognition consecutive no-progress restarts are bounded', async () => {
  const fake = recognition(),
    errors = [],
    results = [],
    delays = [];
  const schedule = fake.globals.setTimeout;
  fake.globals.setTimeout = (fn, delay) => {
    delays.push(delay);
    return schedule(fn);
  };
  const engine = new BrowserRecognitionEngine({
    globals: fake.globals,
    maxRestarts: 2,
    onError: (e) => errors.push(e),
    onResult: (r) => results.push(r),
  });
  await engine.start();
  for (let i = 0; i < 3; i++) {
    const r = fake.current();
    r.emit('result', { results: [result('')] });
    r.emit('end');
    detached(r);
    fake.tick();
  }
  assert.equal(fake.instances.filter((r) => r.started).length, 3);
  assert.equal(errors[0].code, 'restart-limit');
  assert.equal(
    errors[0].retryable,
    true,
    'outer recovery may replace the exhausted native session',
  );
  assert.deepEqual(delays, [100, 200]);
  assert.equal(results.length, 3);
  assert.equal(engine.active, false);
  assert.equal(fake.timers.size, 0);
});

test('healthy recognition continues beyond restart limit and resets final indexes', async () => {
  for (const progress of ['result', 'speechstart']) {
    const fake = recognition(),
      results = [],
      errors = [];
    const engine = new BrowserRecognitionEngine({
      globals: fake.globals,
      onResult: (r) => results.push(r),
      onError: (e) => errors.push(e),
    });
    await engine.start();
    for (let i = 0; i < 10; i++) {
      const r = fake.current();
      if (progress === 'result') r.emit('result', { results: [result('repeat', true)] });
      else r.emit('speechstart');
      r.emit('end');
      detached(r);
      fake.tick();
      assert.equal(engine.active, true);
    }
    assert.equal(fake.instances.filter((r) => r.started).length, 11);
    assert.equal(errors.length, 0);
    if (progress === 'result')
      assert.deepEqual(
        results.map((r) => r.final),
        Array(10).fill('repeat'),
      );
    await engine.stop();
  }
});

test('recognition capability safely rejects broken constructors and unwritable local flags', async () => {
  const constructors = [
    class {
      constructor() {
        throw new Error('constructor failed');
      }
      static available() {
        return 'available';
      }
    },
    class {
      constructor() {
        Object.defineProperty(this, 'processLocally', { value: false });
      }
      start() {}
      abort() {}
      static available() {
        return 'available';
      }
    },
    Object.assign(() => {}, { available: () => 'available' }),
  ];
  for (const SpeechRecognition of constructors) {
    const engine = new BrowserRecognitionEngine({ globals: { SpeechRecognition } });
    assert.equal((await engine.capability()).supported, false);
    await assert.rejects(engine.start(), /browser recognition service/);
  }
  const globals = {
    get SpeechRecognition() {
      throw new Error('access denied');
    },
  };
  assert.equal((await new BrowserRecognitionEngine({ globals }).capability()).supported, false);
  const fake = recognition();
  assert.equal(
    (
      await new BrowserRecognitionEngine({
        globals: { SpeechRecognition: {}, webkitSpeechRecognition: fake.globals.SpeechRecognition },
      }).capability()
    ).supported,
    true,
  );
});

test('stop cancels scheduled restart; retained timer and event callbacks are harmless', async () => {
  const fake = recognition();
  const engine = new BrowserRecognitionEngine({ globals: fake.globals });
  await engine.start();
  const end = fake.current().onend;
  end();
  const timer = [...fake.timers.values()][0];
  await engine.stop();
  assert.equal(fake.timers.size, 0);
  end();
  timer();
  fake.tick();
  assert.equal(fake.instances.filter((r) => r.started).length, 1);
});

test('recognition fatal errors stop without fallback; synchronous start errors clean up', async () => {
  const fake = recognition(),
    errors = [];
  const controller = new AbortController();
  const engine = new BrowserRecognitionEngine({
    globals: fake.globals,
    onError: (e) => errors.push(e),
  });
  await engine.start({ signal: controller.signal });
  const r = fake.current();
  const end = r.onend;
  r.emit('error', { error: 'not-allowed' });
  end();
  fake.tick();
  assert.equal(errors[0].code, 'not-allowed');
  assert.equal(engine.active, false);
  detached(r);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  const throwing = recognition({ startError: new Error('start failed') });
  const broken = new BrowserRecognitionEngine({ globals: throwing.globals });
  await assert.rejects(broken.start({ signal: controller.signal }), /start failed/);
  detached(throwing.current());
  assert.equal(throwing.current().aborted, true);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('recognition no-speech may restart and consumer exceptions do not leak resources', async () => {
  const fake = recognition();
  const engine = new BrowserRecognitionEngine({
    globals: fake.globals,
    onActivity() {
      throw new Error('consumer');
    },
    onError() {
      throw new Error('consumer');
    },
    onResult() {
      throw new Error('consumer');
    },
  });
  await engine.start();
  const r = fake.current();
  r.emit('speechstart');
  r.emit('result', { results: [result('text')] });
  r.emit('error', { error: 'no-speech' });
  assert.equal(engine.active, true);
  r.emit('end');
  fake.tick();
  assert.equal(fake.instances.filter((r) => r.started).length, 2);
  await engine.stop();
  detached(fake.current());
});

test('native caption estimate waits for start and excludes paused time', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const f = synthesis();
  const playing = f.engine.speak('Synthetic speech caption sentence');
  assert.equal(f.engine.getPlaybackProgress(), null);
  f.spoken[0].onstart();
  t.mock.timers.tick(1000);
  assert.equal(f.engine.getPlaybackProgress().positionSeconds, 1);
  f.engine.pause();
  t.mock.timers.tick(3000);
  assert.equal(f.engine.getPlaybackProgress().positionSeconds, 1);
  f.engine.resume();
  t.mock.timers.tick(500);
  assert.equal(f.engine.getPlaybackProgress().positionSeconds, 1.5);
  f.spoken[0].onend();
  await playing;
  assert.equal(f.engine.getPlaybackProgress(), null);
});
