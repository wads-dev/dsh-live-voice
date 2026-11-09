// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { VoiceCoordinator } from '../../live-voice/src/modules/core/coordinator.ts';
import { mockRecordingRepository } from '../../live-voice/test/helpers/recording.js';
import { WhisperHttpRecognitionEngine } from '../../live-voice/src/modules/recognition/engines/whisper/WhisperRecognitionEngine.ts';
import {
  DIAGNOSTIC_KEY,
  publishDiagnosticSource,
  readCoordinatorDiagnostics,
} from '../../live-voice/src/modules/core/diagnostics.ts';
import { createInspector } from '../src/inspector.ts';
import { DebuggerPanel } from '../src/DebuggerPanel.tsx';
import { copyFor, dictionaries } from '../src/i18n/index.ts';
import { apply } from '../src/apply.tsx';
import { readDeveloperExtension } from '../../live-voice/src/modules/core/developerExtension.ts';

test('localizes plugin references in debugger copy', () => {
  for (const [locale, name] of Object.entries({
    'pt-BR': 'Voz ao Vivo',
    es: 'Voz en vivo',
    fr: 'Voix en direct',
    hi: 'लाइव वॉइस',
    zh: '实时语音',
  })) {
    assert.ok(dictionaries[locale].commons.title.includes(name), locale);
    assert.ok(dictionaries[locale].commons.waiting.includes(name), locale);
    for (const value of Object.values(dictionaries[locale]).flatMap((group) =>
      Object.values(group),
    ))
      assert.ok(!value.includes('Live Voice'), locale);
  }
});

function fixture(t) {
  let callbacks,
    draft = '';
  const coordinator = new VoiceCoordinator({
    recognition: {
      capability: async () => ({ supported: true }),
      start: async (options) => {
        callbacks = options;
      },
      stop: async () => {},
    },
    meter: {
      capability: async () => ({ supported: true }),
      start: async () => true,
      stop: async () => {},
      level: () => 0.25,
    },
    engines: { browser: { capability: async () => ({ supported: true }), stop: async () => {} } },
    composer: {
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text;
      },
      submit() {},
    },
    settings: { mode: 'headphones', sendingMode: 'queue' },
  });
  const source = {
    version: 1,
    read: (options = {}) => ({
      sessions: { example: readCoordinatorDiagnostics(coordinator, options.includeContent) },
    }),
    subscribe: coordinator.subscribe,
  };
  t.after(() => coordinator.dispose());
  return {
    coordinator,
    source,
    activity: (active) => callbacks.onActivity(active),
    processing: (pending) => callbacks.onProcessingChange({ pending }),
    result: (text) => callbacks.onResult({ final: text }),
  };
}

test('reported DSH Enter behavior is visible without exposing private settings text', async (t) => {
  const f = fixture(t);
  const inspector = createInspector(f.source);
  t.after(() => inspector.dispose());
  for (const behavior of ['queue', 'steer']) {
    await f.coordinator.updateSettings({ dshBusyEnterBehavior: behavior });
    const settings = inspector.read().state.sessions.example.settings;
    assert.equal(settings.dshBusyEnterBehavior, behavior);
    assert.equal(typeof settings.voiceCommandSend, 'object');
  }
});

test('simulated recognition events expose real cross-domain transitions without leaking text', async (t) => {
  const f = fixture(t);
  const inspector = createInspector(f.source, () => 123, 8);
  t.after(() => inspector.dispose());
  await f.coordinator.startConversation();
  f.activity(true);
  assert.equal(inspector.read().state.sessions.example.vad.activity, true);
  f.processing(2);
  assert.equal(inspector.read().state.sessions.example.recognition.pendingTranscriptions, 2);
  f.activity(false);
  f.processing(0);
  f.result('Synthetic recognition phrase');
  const state = inspector.read().state.sessions.example;
  assert.equal(state.composer.characters, 28);
  assert.equal(state.delivery.countdownActive, true);
  assert.equal(JSON.stringify(inspector.read()).includes('Synthetic recognition phrase'), false);
  assert.equal(
    inspector.read(true).state.sessions.example.composer.draft,
    'Synthetic recognition phrase',
  );
  assert.ok(inspector.read().transitions.some((entry) => entry.module === 'delivery'));
  assert.ok(inspector.read().transitions.length <= 8);
  await f.coordinator.stopListening();
  assert.equal(inspector.read().state.sessions.example.delivery.countdownActive, false);
  assert.equal(inspector.read().state.sessions.example.capture.listening, false);
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('PCM chunks expose recording-owned pins, saved samples and range recognition', async (t) => {
  const processor = { connect() {}, disconnect() {} };
  const context = {
    sampleRate: 16000,
    destination: {},
    createScriptProcessor: () => processor,
    createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
  };
  const meter = { context, source: { connect() {}, disconnect() {} }, level: () => 0.2 };
  const engine = new WhisperHttpRecognitionEngine({
    recordings: mockRecordingRepository(),
    voiceDetectionEngine: 'energy',
    meter,
    globals: { fetch: () => new Promise(() => {}) },
    voiceDetectionPreset: 'short',
  });
  await engine.start();
  t.after(() => engine.stop());
  const controller = {
    recognition: engine,
    meter,
    getSnapshot: () => ({ settings: { recognitionEngine: 'whisper-http' } }),
  };
  const emit = (value) =>
    processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(value) },
    });
  emit(0.1);
  await tick();
  assert.equal(readCoordinatorDiagnostics(controller).recording.pins, 2);
  emit(0);
  await tick();
  assert.equal(readCoordinatorDiagnostics(controller).recording.savedSamples, 8192);
  emit(0);
  await tick();
  emit(0);
  emit(0);
  await tick();
  assert.equal(readCoordinatorDiagnostics(controller).recognition.activeRequest, true);
  emit(0.1);
  emit(0);
  emit(0);
  await tick();
  emit(0);
  emit(0);
  await tick();
  const queue = readCoordinatorDiagnostics(controller).recognition.queue;
  assert.equal(queue.length, 1);
  assert.ok(queue[0].durationMs > 500);
  await engine.stop();
  assert.equal(readCoordinatorDiagnostics(controller).chunker.available, false);
});

test('diagnostic bridge tolerates replacement and old disposer cannot remove newer source', () => {
  const target = new EventTarget();
  const source = { version: 1, read: () => null, subscribe: () => () => {} };
  const removeOld = publishDiagnosticSource(target, source);
  const newer = { ...source };
  const removeNew = publishDiagnosticSource(target, newer);
  removeOld();
  assert.equal(target[DIAGNOSTIC_KEY], newer);
  removeNew();
  assert.equal(target[DIAGNOSTIC_KEY], undefined);
});

test('debugger catalogs have complete sorted keys and match DSH locales', () => {
  const groups = Object.keys(dictionaries.en);
  assert.deepEqual(groups, [...groups].sort());
  for (const locale of ['en', 'pt-BR', 'es', 'fr', 'hi', 'zh']) {
    assert.deepEqual(Object.keys(dictionaries[locale]), groups);
    for (const group of groups) {
      const keys = Object.keys(dictionaries.en[group]);
      assert.deepEqual(keys, [...keys].sort());
      assert.deepEqual(Object.keys(dictionaries[locale][group]), keys);
    }
  }
  assert.equal(copyFor('pt-BR').commons.activate, 'Abrir debugger em janela separada');
});

function runtimeFixture() {
  return {
    status: 'ready',
    workerActive: true,
    activeSources: 2,
    modelLoadMs: 120,
    processedFrames: 40,
    inferenceLastMs: 2.5,
    inferenceAverageMs: 3,
    queuedFrames: 1,
    accountedBufferBytes: 1048576,
    totalRamBytes: null,
    assets: { modelBytes: 2097152, wasmBytes: 3145728, packageBytes: null },
    pageHeap: { usedBytes: 4194304, totalBytes: 8388608, scope: 'page-js-heap-estimate' },
  };
}
test('root runtime/source events ignore frame metrics and preserve semantic transitions', () => {
  let state = {
    vadRuntime: runtimeFixture(),
    audioSources: {
      microphone: {
        capture: { listening: true, level: 0.1 },
        vad: { activity: false, probability: 0.2, silenceMs: 1 },
        chunker: { available: true, bufferedSamples: 1, bufferedChunks: 1 },
      },
      shared: null,
    },
    sessions: {},
  };
  let notify;
  const inspector = createInspector({
    version: 1,
    read: () => structuredClone(state),
    subscribe: (listener) => {
      notify = listener;
      return () => {};
    },
  });
  for (let i = 0; i < 250; i++) {
    state.vadRuntime.processedFrames++;
    state.vadRuntime.inferenceLastMs++;
    state.vadRuntime.queuedFrames++;
    state.vadRuntime.accountedBufferBytes++;
    state.vadRuntime.pageHeap.usedBytes++;
    state.audioSources.microphone.vad.probability = i / 250;
    state.audioSources.microphone.vad.silenceMs++;
    state.audioSources.microphone.capture.level = i / 250;
    state.audioSources.microphone.chunker.bufferedSamples++;
    notify();
  }
  assert.equal(inspector.read().transitions.length, 0);
  state.vadRuntime.status = 'failed';
  state.audioSources.microphone.vad.activity = true;
  notify();
  assert.deepEqual(
    inspector.read().transitions.map((e) => e.module),
    ['vadRuntime', 'audioSources.microphone.vad'],
  );
  assert.equal(inspector.read().transitions[0].sessionId, null);
  assert.equal('probability' in inspector.read().transitions[1].after, false);
  inspector.setPaused(true);
  state.vadRuntime.workerActive = false;
  notify();
  inspector.setPaused(false);
  assert.equal(inspector.read().transitions.length, 2);
  state.audioSources.shared = { capture: { listening: true } };
  notify();
  assert.equal(inspector.read().transitions.at(-1).module, 'audioSources.shared.capture');
  state.audioSources.shared = null;
  notify();
  assert.equal(inspector.read().transitions.at(-1).after, null);
  inspector.clear();
  assert.equal(inspector.read().transitions.length, 0);
  inspector.dispose();
});
test('runtime tab is conditional, translated, keyboard accessible and honest about memory', async (t) => {
  await domFixture(t);
  const root = createRoot(document.getElementById('root'));
  let runtimes = { models: [], events: [] };
  let notify = () => {};
  window[DIAGNOSTIC_KEY] = {
    version: 1,
    read: () => ({ runtimes, sessions: {} }),
    subscribe: (fn) => {
      notify = fn;
      return () => {};
    },
  };
  for (const copy of Object.values(dictionaries)) {
    runtimes = { models: [], events: [] };
    await act(async () => root.render(<DebuggerPanel copy={copy} onClose={() => {}} />));
    assert.equal(
      [...document.querySelectorAll('[role=tab]')].some(
        (e) => e.textContent === copy.runtimes.title,
      ),
      false,
    );
    runtimes = {
      runtimeId: 'worker-v3',
      versions: { onnx: '1.31', transformers: '4.3' },
      pageJsHeapBytes: null,
      models: [
        {
          key: 'whisper-small',
          name: 'Whisper small (q4)',
          phase: 'ready',
          device: 'webgpu',
          workerActive: true,
          repository: 'onnx-community/whisper-small',
          revision: 'sha',
          encoderDtype: 'q4',
          decoderDtype: 'q4',
          modelBytes: 302101039,
          cachedBytes: 302101039,
          pcmBytes: 0,
          workerLoadMs: 100,
          loadMs: 150,
          workerInferenceMs: 50,
          audioMs: 100,
          queued: 0,
          active: 0,
          pendingRequests: 0,
          completed: 1,
          failed: 0,
        },
      ],
      events: [],
    };
    await act(async () => {
      notify();
      await new Promise((r) => setTimeout(r, 110));
    });
    const tabs = [...document.querySelectorAll('[role=tab]')];
    assert.equal(tabs.length, 4);
    const rt = tabs.find((e) => e.textContent === copy.runtimes.title);
    assert.ok(rt);
    await act(async () =>
      tabs[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true })),
    );
    assert.equal(rt.getAttribute('aria-selected'), 'true');
    const panel = document.getElementById(rt.getAttribute('aria-controls'));
    assert.equal(panel.hidden, false);
    assert.ok(panel.textContent.includes('Whisper small (q4)'));
    assert.ok(panel.textContent.includes('0.281 GiB'));
    assert.ok(panel.textContent.includes(copy.runtimes.unavailable));
    assert.ok(panel.textContent.includes(copy.runtimes.ram));
    assert.ok(!panel.textContent.includes('undefined'));
    runtimes = { models: [], events: [] };
    await act(async () => {
      notify();
      await new Promise((r) => setTimeout(r, 110));
    });
    assert.equal(
      [...document.querySelectorAll('[role=tab]')].some(
        (e) => e.textContent === copy.runtimes.title,
      ),
      false,
    );
  }
  await act(async () => root.unmount());
});

test('VAD status and asset sizes use only the expandable audioSources state tree in every locale', async (t) => {
  await domFixture(t);
  const root = createRoot(document.getElementById('root'));
  window[DIAGNOSTIC_KEY] = {
    version: 1,
    read: () => ({
      audioSources: {
        vad: {
          status: 'ready',
          assets: { modelBytes: 2097152, wasmBytes: 3145728, modelMiB: 2, wasmMiB: 3 },
        },
        microphone: null,
        shared: null,
      },
      sessions: {},
    }),
    subscribe: () => () => {},
  };
  for (const copy of Object.values(dictionaries)) {
    await act(async () => root.render(<DebuggerPanel copy={copy} onClose={() => {}} />));
    const pane = document.querySelector('.dlvd-state-pane');
    const scroll = pane.querySelector('.dlvd-scroll');
    assert.equal(scroll.children.length, 1);
    const context = scroll.firstElementChild;
    assert.equal(context.querySelector(':scope > summary > code').textContent, 'context');
    const branch = (parent, name) =>
      [...parent.querySelectorAll(':scope > details')].find(
        (node) => node.querySelector(':scope > summary > code').textContent === name,
      );
    const audioSources = branch(context, 'audioSources');
    const vad = branch(audioSources, 'vad');
    const assets = branch(vad, 'assets');
    assert.ok(vad instanceof window.HTMLDetailsElement);
    assert.ok(vad.open);
    await act(async () => {
      assets.open = false;
    });
    assert.equal(assets.open, false);
    assert.match(vad.textContent, /statusready/);
    for (const [key, value] of Object.entries({
      modelBytes: 2097152,
      wasmBytes: 3145728,
      modelMiB: 2,
      wasmMiB: 3,
    }))
      assert.ok(assets.textContent.includes(key + value));
    await act(async () => {
      assets.open = true;
    });
    assert.equal(assets.open, true);
    await act(async () => {
      vad.open = false;
    });
    assert.equal(vad.open, false);
    await act(async () => {
      vad.open = true;
    });
    assert.equal(pane.querySelector('section, dl, .dlvd-vad-summary'), null);
    assert.doesNotMatch(pane.textContent, /vadRuntime|pageHeap|totalRamBytes|accountedBufferBytes/);
  }
  await act(async () => root.unmount());
});

async function domFixture(t) {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  t.after(() => {
    Object.assign(globalThis, previous);
    dom.window.close();
  });
  return dom;
}

test('floating panel updates at 100ms, waits for runtime and releases subscriptions on unmount', async (t) => {
  await domFixture(t);
  const root = createRoot(document.getElementById('root'));
  const timers = t.mock.timers;
  timers.enable({ apis: ['setInterval'] });
  await act(async () => root.render(<DebuggerPanel copy={copyFor()} onClose={() => {}} />));
  assert.match(document.body.textContent, /Waiting for a compatible/);
  let active = false,
    subscriptions = 0;
  window[DIAGNOSTIC_KEY] = {
    version: 1,
    read: () => ({
      sessions: {
        example: { capture: { listening: active }, speech: { queue: [{ characters: 12 }] } },
      },
    }),
    subscribe: () => {
      subscriptions++;
      return () => {
        subscriptions--;
      };
    },
  };
  await act(async () => timers.tick(100));
  assert.equal(subscriptions, 1);
  assert.equal(document.querySelector('.dlvd-vad-summary'), null);
  assert.match(document.body.textContent, /listeningfalse/);
  await act(async () =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Pause events')
      .click(),
  );
  active = true;
  await act(async () => timers.tick(100));
  assert.equal(document.querySelectorAll('.dlvd-history > details').length, 0);
  await act(async () =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Resume events')
      .click(),
  );
  await act(async () => timers.tick(100));
  assert.equal(document.querySelectorAll('.dlvd-history > details').length, 0);
  active = false;
  await act(async () => timers.tick(100));
  assert.equal(document.querySelectorAll('.dlvd-history > details').length, 1);
  await act(async () =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Clear events')
      .click(),
  );
  assert.equal(document.querySelectorAll('.dlvd-history > details').length, 0);
  active = true;
  await act(async () => timers.tick(100));
  assert.match(document.body.textContent, /listeningtrue/);
  assert.match(document.body.textContent, /characters12/);
  const rate = document.querySelector('[id$="-states"] .dlvd-toolbar select');
  assert.equal(rate.value, '10');
  const historyCount = document.querySelectorAll('.dlvd-history > details').length;
  await act(async () => {
    rate.value = '1';
    rate.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(document.querySelectorAll('.dlvd-history > details').length, historyCount);
  active = false;
  await act(async () => timers.tick(100));
  assert.match(document.querySelector('.dlvd-state-pane').textContent, /listeningtrue/);
  await act(async () => timers.tick(900));
  assert.match(document.querySelector('.dlvd-state-pane').textContent, /listeningfalse/);
  const columns = document.querySelector('.dlvd-columns');
  assert.equal(columns.children.length, 2);
  assert.ok(columns.querySelector('.dlvd-state-pane .dlvd-scroll'));
  assert.ok(columns.querySelector('.dlvd-event-pane .dlvd-scroll'));
  assert.equal(columns.querySelector('.dlvd-state-pane select'), null);
  assert.ok(columns.querySelector('.dlvd-event-pane select'));
  await act(async () => root.unmount());
  assert.equal(subscriptions, 0);
});

test('optional plugin opens a separate window and keeps it after Settings unmount', async (t) => {
  await domFixture(t);
  const child = new JSDOM('<html><head></head><body></body></html>');
  let closed = false;
  Object.defineProperty(child.window, 'closed', { get: () => closed });
  child.window.close = () => {
    closed = true;
  };
  window.open = () => child.window;
  const disposers = [],
    registrations = [];
  const localeState = { active: 'en' };
  const ctx = {
    locale: {
      addLanguage: () => () => {},
      register: () => () => {},
      bind: () => (key) => key.split('.').reduce((value, part) => value[part], copyFor()),
      subscribe: () => () => {},
      getSnapshot: () => localeState,
    },
    slots: {
      inject: (_, register) => register(),
      register: (meta, component) => registrations.push({ meta, component }),
    },
    effect: (effect) => {
      const dispose = effect();
      if (dispose) disposers.push(dispose);
    },
  };
  await act(async () => apply(ctx));
  assert.equal(registrations.length, 0);
  assert.equal(readDeveloperExtension().label(), 'Developer');
  assert.equal(document.querySelector('.dlvd-panel'), null);
  const root = createRoot(document.getElementById('root'));
  const Settings = readDeveloperExtension().component;
  await act(async () => root.render(<Settings />));
  window.open = () => null;
  await act(async () => document.querySelector('.dlv-diagnostics-button').click());
  assert.match(document.querySelector('[role="alert"]').textContent, /blocked/);
  assert.equal(document.querySelector('input'), null);
  assert.equal(document.querySelector('.dlvd-panel'), null);
  window.open = () => child.window;
  await act(async () => document.querySelector('.dlv-diagnostics-button').click());
  assert.equal(document.querySelector('.dlvd-panel'), null);
  assert.ok(child.window.document.querySelector('.dlvd-panel'));
  await act(async () => root.unmount());
  assert.equal(document.querySelector('.dlvd-panel'), null);
  assert.ok(child.window.document.querySelector('.dlvd-panel'));
  await act(async () =>
    child.window.document.querySelector('[aria-label="Close debugger"]').click(),
  );
  assert.equal(document.querySelector('.dlvd-panel'), null);
  await act(async () => {
    for (const dispose of disposers.reverse()) dispose();
  });
  assert.equal(document.querySelector('[data-plugin="dsh-live-voice-debugger"]'), null);
  assert.equal(readDeveloperExtension(), null);
  assert.equal(closed, true);
});
