// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { apply } from '../src/app/client/apply.tsx';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { HostAudioSpeakingEngine } from '../src/modules/speak/engines/audio/HostAudioEngine.js';
import { BrowserSpeakingEngine } from '../src/modules/speak/engines/browser/BrowserSpeakingEngine.js';

const h = React.createElement;
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function fixture(
  t,
  {
    pendingStore = true,
    realSpeech = false,
    realLifecycle = false,
    initialSettings = {},
    settingsReady,
  } = {},
) {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    { url: 'http://localhost' },
  );
  const restore = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restore.push(() => {
      if (old) Object.defineProperty(globalThis, key, old);
      else delete globalThis[key];
    });
  }
  dom.window.speechSynthesis = new dom.window.EventTarget();
  Object.defineProperty(dom.window.navigator, 'mediaDevices', {
    configurable: true,
    value: new dom.window.EventTarget(),
  });
  dom.window.localStorage.setItem(
    'dsh-live-voice.settings',
    JSON.stringify({ engine: 'say', mode: 'headphones' }),
  );
  let serverSettings = { assistantSpeechDelaySeconds: 0.6, ...initialSettings };
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/dsh-live-voice/settings') {
      await settingsReady;
      if (options.method === 'PUT')
        serverSettings = { ...serverSettings, ...JSON.parse(options.body) };
      return Response.json({ ok: true, value: serverSettings });
    }
    return Response.json({ ok: true, value: {} });
  });
  const controllers = [];
  const calls = [];
  const holds = new Map();
  t.mock.method(VoiceCoordinator.prototype, 'refreshCapabilities', async function (options) {
    assert.deepEqual(
      options,
      { localOnly: true },
      'implicit app discovery must never check provider health',
    );
    controllers.push(this);
    this.patch({
      capabilities: {
        browser: { supported: true, pause: true, resume: true },
        say: { supported: true, pause: true, resume: true },
        recognition: { supported: false },
        capture: { supported: true, permission: 'prompt' },
      },
    });
  });
  t.mock.method(VoiceCoordinator.prototype, 'startDictation', async function () {
    calls.push(['start', this]);
  });
  t.mock.method(VoiceCoordinator.prototype, 'startHoldToTalk', async function () {
    calls.push(['hold-start', this]);
  });
  t.mock.method(VoiceCoordinator.prototype, 'releaseHoldToTalk', async function () {
    calls.push(['hold-release', this]);
  });
  t.mock.method(VoiceCoordinator.prototype, 'startConversation', async function () {
    calls.push(['conversation', this]);
  });
  if (!realSpeech)
    t.mock.method(VoiceCoordinator.prototype, 'speak', async function (...args) {
      calls.push(['speak', this, ...args]);
    });
  t.mock.method(VoiceCoordinator.prototype, 'stopListening', async function () {
    calls.push(['stop', this]);
  });
  if (!realLifecycle) t.mock.method(VoiceCoordinator.prototype, 'stopSpeech', async function () {});
  if (!realLifecycle)
    t.mock.method(VoiceCoordinator.prototype, 'endConversation', async function () {
      calls.push(['end', this]);
      await holds.get(this)?.promise;
    });
  if (!realLifecycle)
    t.mock.method(VoiceCoordinator.prototype, 'dispose', async function () {
      this.disposed = true;
      calls.push(['dispose', this]);
      await holds.get(this)?.promise;
    });
  const stores = new Map();
  const pending = new Map();
  const pendingListeners = new Set();
  const pendingInteractions = {
    getSnapshot: () => pending,
    subscribe(listener) {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
  };
  const slots = new Map();
  const cleanup = [];
  function store(id) {
    if (!stores.has(id)) {
      const listeners = new Set();
      let snapshot = {
        nodes: new Map([
          [
            'one',
            {
              kind: 'assistant-step',
              data: {
                turn: 1,
                step: 0,
                status: 'settled',
                finalNode: { messageId: 'm' },
                blocks: [{ kind: 'text', text: 'History.' }],
              },
            },
          ],
        ]),
      };
      stores.set(id, {
        listeners,
        getSnapshot: () => snapshot,
        setSnapshot(next) {
          snapshot = next;
          for (const listener of listeners) listener();
        },
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      });
    }
    return stores.get(id);
  }
  const ctx = {
    connection: {
      rpc: async () => {
        throw Error('unexpected RPC');
      },
    },
    uiSession: pendingStore ? { pendingInteractions } : {},
    uiConversation: {
      binding: (id) => ({
        target: (name) => {
          assert.equal(name, 'chat');
          return store(id);
        },
      }),
    },
    effect: (fn) => cleanup.push(fn()),
    slots: {
      inject: (_name, fn) => fn(),
      register: ({ name }, component) => slots.set(name, component),
    },
  };
  apply(ctx);
  const root = createRoot(document.getElementById('root'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    for (const fn of cleanup.reverse()) fn?.();
  };
  const render = async (children) =>
    act(async () => {
      root.render(h(React.StrictMode, null, children));
    });
  const props = (id, actions = { setDraft() {} }) => ({
    sessionId: id,
    inputActions: actions,
    input: { draft: 'Draft' },
    messageId: 'm',
  });
  const Buttons = slots.get('conversation.input.right'),
    Action = slots.get('conversation.chat.assistant-actions');
  t.after(async () => {
    await act(async () => {
      root.unmount();
      close();
    });
    dom.window.close();
    for (const fn of restore) fn();
  });
  return {
    serverSettings: () => serverSettings,
    chatStore: store,
    render,
    props,
    Buttons,
    Dock: slots.get('conversation.input.dock'),
    Action,
    Settings: slots.get('settings.section'),
    controllers,
    calls,
    holds,
    store,
    publishPending(id, interaction) {
      if (interaction) pending.set(id, interaction);
      else pending.delete(id);
      for (const listener of pendingListeners) listener();
    },
    pendingListeners,
    close,
  };
}

test('microphone leave confirmation follows live state and cancellation does not end transcription', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const controller = f.controllers.find((c) => !c.disposed);
  const leave = () => {
    const event = new window.Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(leave(), false);
  await act(async () => controller.patch({ starting: true }));
  assert.equal(leave(), true);
  await act(async () => controller.patch({ starting: false, listening: true }));
  const callsBefore = f.calls.length;
  assert.equal(leave(), true);
  assert.equal(leave(), true);
  assert.equal(controller.getSnapshot().listening, true);
  assert.equal(f.calls.length, callsBefore);
  await act(async () => controller.patch({ listening: false, pendingTranscriptions: 1 }));
  assert.equal(leave(), true);
  await act(async () =>
    controller.patch({ pendingTranscriptions: 0, conversation: true, speaking: true }),
  );
  assert.equal(leave(), false);
  await act(async () => controller.patch({ listening: true }));
  assert.equal(leave(), true);
  await act(async () => f.close());
  assert.equal(leave(), false);
});

test('meeting-only leave protection survives composer navigation and clears after source stop', async (t) => {
  let meeting;
  t.mock.method(MeetingController.prototype, 'start', async function (source, request) {
    await request;
    meeting = this;
    this.patch(source, { starting: false, listening: true });
  });
  const f = await fixture(t);
  const request = async () => new window.EventTarget();
  window.navigator.mediaDevices.getDisplayMedia = request;
  await f.render(h(f.Buttons, f.props('a')));
  await act(async () => document.querySelector('[aria-label="Shared audio"]').click());
  const leave = () => {
    const event = new window.Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.ok(meeting);
  assert.equal(leave(), true);
  await f.render(h(f.Buttons, f.props('b')));
  assert.equal(leave(), true);
  await act(async () => meeting.patch('shared', { listening: false, pending: 1 }));
  assert.equal(leave(), true);
  await act(async () => meeting.patch('shared', { pending: 0 }));
  assert.equal(leave(), false);
});

test('real assistant-step rows enable playback even without local recognition', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Action, f.props('a')));
  await act(async () =>
    f.controllers[0].patch({
      capabilities: {
        browser: { supported: true },
        recognition: { supported: false },
        capture: { supported: true },
      },
    }),
  );
  assert.equal(
    f.controllers[0].getSnapshot().settings.engine,
    'browser',
    'legacy browser preferences are ignored',
  );
  const button = document.querySelector('button');
  assert.equal(button.disabled, false);
  await act(async () => button.click());
  assert.equal(f.calls.filter(([name]) => name === 'speak').length, 1);
});

test('native Settings owns preferences without a composer gear', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  assert.equal(document.querySelector('[aria-label="Voice settings"]'), null);
  await f.render(h(f.Settings));
  assert.ok(document.querySelector('[aria-label="Live Voice settings"]'));
  const select = document.querySelector('select');
  await act(async () => {
    select.value = 'say';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(f.serverSettings().engine, 'say');
  assert.deepEqual(JSON.parse(localStorage.getItem('dsh-live-voice.settings')), {
    engine: 'say',
    mode: 'headphones',
  });
  const test = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Test selected speech output',
  );
  await act(async () => test.click());
  assert.equal(f.calls.filter(([name]) => name === 'speak').length, 1);
});

test('changing speech Settings preserves active voice and persists next-segment preferences', async (t) => {
  const f = await fixture(t);
  await f.render([h(f.Buttons, { ...f.props('a'), key: 'a' }), h(f.Settings, { key: 'settings' })]);
  const session = f.controllers[0];
  session.patch({ conversation: true, listening: true });
  const engine = document.querySelector('select');
  await act(async () => {
    engine.value = 'say';
    engine.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(f.serverSettings().engine, 'say');
  assert.deepEqual(JSON.parse(localStorage.getItem('dsh-live-voice.settings')), {
    engine: 'say',
    mode: 'headphones',
  });
  assert.equal(
    f.calls.some(([name, controller]) => name === 'end' && controller === session),
    false,
  );
  assert.equal(session.getSnapshot().conversation, true);
  assert.equal(session.getSnapshot().listening, true);
  assert.equal(session.getSnapshot().settings.engine, 'say');
  assert.equal(document.querySelector('[role=alert]'), null);
});

test('recognized browser text writes through the actual InputState and InputActions slot contract', async (t) => {
  const f = await fixture(t);
  const written = [];
  await f.render(h(f.Buttons, f.props('a', { setDraft: (text) => written.push(text) })));
  const c = f.controllers[0];
  c.patch({ listening: true });
  c.onResult({ interim: 'Olá mundo', final: '' });
  assert.deepEqual(written, [], 'interim recognition is status-only');
  c.onResult({ interim: '', final: 'Olá mundo' });
  assert.equal(written.at(-1), 'Draft Olá mundo');
});

test('StrictMode shares committed owners and releases action-only sessions on final unmount', async (t) => {
  const f = await fixture(t);
  await f.render([
    h(f.Action, { ...f.props('a'), key: 'one' }),
    h(f.Action, { ...f.props('a'), key: 'two' }),
  ]);
  assert.equal(f.controllers.length, 1);
  assert.equal(f.store('a').listeners.size, 1);
  assert.equal(f.controllers[0].consumed.get('1:0'), 'History.'.length);
  await f.render(null);
  assert.equal(f.store('a').listeners.size, 0);
  assert.equal(f.calls.filter(([name]) => name === 'dispose').length, 1);
  await f.render(h(f.Action, f.props('a')));
  assert.equal(f.controllers.length, 2, 'remount gets a fresh non-retained session');
});

test('abandoned Suspense render creates no session or chat subscriptions', async (t) => {
  const f = await fixture(t);
  const never = new Promise(() => {});
  function Suspend() {
    throw never;
  }
  await f.render(
    h(React.Suspense, { fallback: 'waiting' }, h(f.Action, f.props('abandoned')), h(Suspend)),
  );
  assert.equal(f.controllers.length, 0);
});

test('composer detach is immediate while action owner survives, updates use latest actions', async (t) => {
  const f = await fixture(t);
  const old = [],
    fresh = [];
  const view = (actions) => [
    h(f.Buttons, { ...f.props('a', actions), key: 'buttons' }),
    h(f.Action, { ...f.props('a'), key: 'action' }),
  ];
  await f.render(view({ setDraft: (text) => old.push(text) }));
  const c = f.controllers[0];
  c.composer.setDraft('one');
  await f.render(view({ setDraft: (text) => fresh.push(text) }));
  c.composer.setDraft('two');
  await f.render([h(f.Action, { ...f.props('a'), key: 'action' })]);
  c.composer.setDraft('late');
  assert.deepEqual(old, ['one']);
  assert.deepEqual(fresh, ['two']);
  assert.equal(c.disposed, false);
  await c.startDictation();
  assert.equal(f.calls.filter(([name]) => name === 'start').length, 0);
});

test('holding Control globally starts one temporary capture and release finishes it', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  f.controllers[0].updateSettings({ holdToTalkEnabled: true });
  const key = (type) =>
    document.dispatchEvent(
      new window.KeyboardEvent(type, {
        key: 'Control',
        code: 'ControlLeft',
        ctrlKey: type === 'keydown',
        bubbles: true,
        cancelable: true,
      }),
    );
  await act(async () => {
    key('keydown');
    key('keydown');
  });
  assert.equal(f.calls.filter(([name]) => name === 'hold-start').length, 1);
  await act(async () => key('keyup'));
  assert.equal(f.calls.filter(([name]) => name === 'hold-release').length, 1);
  f.controllers[0].updateSettings({ holdToTalkEnabled: false });
  await act(async () => {
    key('keydown');
    key('keyup');
  });
  assert.equal(f.calls.filter(([name]) => name === 'hold-start').length, 1);
});

test('custom shortcuts use composer actions and settings capture never activates them', async (t) => {
  const f = await fixture(t, {
    initialSettings: {
      holdToTalkEnabled: true,
      holdToTalkShortcut: 'Alt+KeyH',
      microphoneShortcut: 'Alt+KeyM',
      meetingShortcut: 'Alt+KeyR',
      assistantSpeechShortcut: 'Alt+KeyS',
    },
  });
  let meeting;
  let sharedRequests = 0;
  navigator.mediaDevices.getDisplayMedia = () => {
    sharedRequests++;
    return Promise.resolve({ getTracks: () => [] });
  };
  t.mock.method(MeetingController.prototype, 'start', async function (source, request) {
    await request;
    meeting = this;
    this.patch(source, { listening: true });
  });
  const stopped = [];
  t.mock.method(MeetingController.prototype, 'stop', async function (source) {
    stopped.push(source);
    this.patch(source, { listening: false });
  });
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const key = async (code, options = {}, target = document, type = 'keydown') =>
    act(async () => {
      target.dispatchEvent(
        new window.KeyboardEvent(type, {
          code,
          altKey: true,
          bubbles: true,
          cancelable: true,
          ...options,
        }),
      );
    });
  await key('KeyM');
  assert.equal(f.calls.filter(([name]) => name === 'conversation').length, 1);
  c.patch({ conversation: true });
  await key('KeyM');
  assert.equal(c.getSnapshot().conversation, false);
  await key('KeyR');
  assert.equal(sharedRequests, 1);
  assert.equal(meeting.getSnapshot().shared.listening, true);
  await key('KeyR');
  assert.deepEqual(stopped, ['shared']);
  await key('KeyS');
  assert.equal(c.getSnapshot().settings.announceAssistantMessages, false);
  await key('KeyS', { repeat: true });
  assert.equal(c.getSnapshot().settings.announceAssistantMessages, false);
  await key('KeyS');
  assert.equal(c.getSnapshot().settings.announceAssistantMessages, true);
  await key('KeyH');
  await key('KeyH', {}, document, 'keyup');
  assert.equal(f.calls.filter(([name]) => name === 'hold-start').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'hold-release').length, 1);
  const field = document.createElement('button');
  field.className = 'dlv-shortcut-field';
  document.body.append(field);
  await key('KeyM', {}, field);
  assert.equal(f.calls.filter(([name]) => name === 'conversation').length, 1);
});

test('hold-Control is ignored when more than one composer session is mounted', async (t) => {
  const f = await fixture(t);
  await f.render([
    h(f.Buttons, { ...f.props('a'), key: 'one' }),
    h(f.Buttons, { ...f.props('b'), key: 'two' }),
  ]);
  await act(async () => {
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'Control',
        code: 'ControlLeft',
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });
  assert.equal(f.calls.filter(([name]) => name === 'hold-start').length, 0);
});

test('one keyboard handler across duplicate mounts; ambiguous sessions are ignored', async (t) => {
  const f = await fixture(t);
  const key = () =>
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        code: 'Space',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  await f.render([
    h(f.Buttons, { ...f.props('a'), key: 'one' }),
    h(f.Buttons, { ...f.props('a'), key: 'two' }),
  ]);
  await act(async () => {
    key();
  });
  assert.equal(f.calls.filter(([name]) => name === 'conversation').length, 1);
  await f.render([
    h(f.Buttons, { ...f.props('a'), key: 'one' }),
    h(f.Buttons, { ...f.props('b'), key: 'two' }),
  ]);
  // Voice mode legitimately follows the new committed composer. Count only
  // additional calls from the ambiguous keyboard event, not that resumption.
  const resumed = f.calls.filter(([name]) => name === 'conversation').length;
  assert.equal(resumed, 2);
  await act(async () => {
    key();
  });
  assert.equal(f.calls.filter(([name]) => name === 'conversation').length, resumed);
  f.close();
  await act(async () => {
    key();
  });
  assert.equal(f.calls.filter(([name]) => name === 'conversation').length, resumed);
  assert.equal(f.store('a').listeners.size, 0);
  assert.equal(f.store('b').listeners.size, 0);
});

test('stop cancels queued acquisition without cancelling another session handoff on unmount', async (t) => {
  const f = await fixture(t);
  await f.render([
    h(f.Buttons, { ...f.props('a'), key: 'a' }),
    h(f.Buttons, { ...f.props('b'), key: 'b' }),
  ]);
  const [a, b] = f.controllers;
  const hold = deferred();
  f.holds.set(a, hold);
  const cancelled = b.startDictation();
  await Promise.resolve();
  await b.stopListening();
  hold.resolve();
  await cancelled;
  assert.equal(f.calls.filter(([name]) => name === 'start').length, 0);
  const hold2 = deferred();
  f.holds.set(a, hold2);
  const next = b.startDictation();
  await Promise.resolve();
  await f.render([h(f.Buttons, { ...f.props('b'), key: 'b' })]);
  hold2.resolve();
  await next;
  assert.deepEqual(
    f.calls.filter(([name]) => name === 'start').map(([, c]) => c),
    [b],
  );
});

test('retiring owner teardown stays in handoff barrier after registry removal', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const a = f.controllers[0];
  const hold = deferred();
  f.holds.set(a, hold);
  await f.render(null);
  assert.equal(f.store('a').listeners.size, 0);
  await f.render(h(f.Buttons, f.props('b')));
  const b = f.controllers[1];
  const started = b.startDictation();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.calls.filter(([name]) => name === 'start').length, 0);
  hold.resolve();
  await started;
  assert.deepEqual(
    f.calls.filter(([name]) => name === 'start').map(([, c]) => c),
    [b],
  );
});

test('manual message playback remains usable without a provider health result', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Action, f.props('a')));
  const c = f.controllers[0];
  await act(async () => c.patch({ capabilities: {} }));
  const button = document.querySelector('.dlv-speaker');
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-label'), 'Speak message');
});

test('late browser voices refresh live sessions and listener detaches on disposal', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Action, f.props('a')));
  assert.equal(f.controllers.length, 1);
  await act(async () => window.speechSynthesis.dispatchEvent(new window.Event('voiceschanged')));
  assert.equal(f.controllers.length, 2);
  f.close();
  window.speechSynthesis.dispatchEvent(new window.Event('voiceschanged'));
  assert.equal(f.controllers.length, 2);
});

test('device and visibility changes refresh live sessions and Settings, then detach', async (t) => {
  const f = await fixture(t);
  await f.render([h(f.Action, { ...f.props('a'), key: 'a' }), h(f.Settings, { key: 'settings' })]);
  const initial = f.controllers.length;
  await act(async () => navigator.mediaDevices.dispatchEvent(new window.Event('devicechange')));
  assert.ok(f.controllers.length > initial);
  const afterDevice = f.controllers.length;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
  assert.ok(f.controllers.length > afterDevice);
  const afterVisible = f.controllers.length;
  f.close();
  navigator.mediaDevices.dispatchEvent(new window.Event('devicechange'));
  assert.equal(f.controllers.length, afterVisible);
});

test('new user messages continue speech by default and optional interruption ignores history pagination', async (t) => {
  const f = await fixture(t);
  await f.render(h(React.Fragment, null, h(f.Action, f.props('a')), h(f.Buttons, f.props('a'))));
  const c = f.controllers[0];
  let stops = 0;
  t.mock.method(c, 'stopSpeech', async () => {
    stops++;
  });
  await act(async () => c.patch({ speaking: true }));
  const store = f.store('a');
  await act(async () => {
    store.getSnapshot().nodes.set('user', { kind: 'user', anchorSeq: 10 });
    store.listeners.forEach((fn) => fn());
  });
  assert.equal(stops, 0, 'default preserves current speech');
  await act(async () => c.updateSettings({ interruptSpeechOnUserMessage: true }));
  await act(async () => {
    store.getSnapshot().nodes.set('new-user', { kind: 'steering', anchorSeq: 11 });
    store.listeners.forEach((fn) => fn());
  });
  assert.equal(stops, 1);
  await act(async () => {
    store.getSnapshot().nodes.set('old', { kind: 'user', anchorSeq: 3 });
    store.listeners.forEach((fn) => fn());
  });
  assert.equal(stops, 1);
});

test('voice conversation mode follows the composer across chat switches until explicitly ended', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, { ...f.props('a'), key: 'a' }));
  const a = f.controllers[0];
  await a.startConversation();
  a.patch({ conversation: true, listening: true });

  await f.render(h(f.Buttons, { ...f.props('b'), key: 'b' }));
  const b = f.controllers.at(-1);
  assert.notEqual(b, a);
  assert.ok(
    f.calls.some(([name, controller]) => name === 'conversation' && controller === b),
    'the next composer resumes voice conversation mode',
  );

  await b.endConversation();
  await f.render(h(f.Buttons, { ...f.props('c'), key: 'c' }));
  const c = f.controllers.at(-1);
  assert.equal(
    f.calls.some(([name, controller]) => name === 'conversation' && controller === c),
    false,
    'an explicit end keeps the following composer out of voice mode',
  );
});

test('automatic speech follows new chat text with mic off and mic start preserves partial offsets', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const played = [];
  t.mock.method(c, 'play', async (text) => played.push(text));
  const store = f.store('a');
  const publish = async (text, status = 'running') =>
    act(async () => {
      store.setSnapshot({
        nodes: new Map([
          ...store.getSnapshot().nodes,
          [
            'new',
            {
              kind: 'assistant-step',
              visibility: 'visible',
              data: {
                turn: 2,
                step: 0,
                time: Date.now() + 1,
                status,
                blocks: [{ kind: 'text', text }],
              },
            },
          ],
        ]),
      });
    });
  assert.equal(c.snapshot.conversation, false);
  await publish('First.\nPartial');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['First.']);
  await act(async () => c.startConversation());
  await publish('First.\nPartial completed.', 'settled');
  await publish('First.\nPartial completed.', 'settled');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['First.', 'Partial completed.']);

  await act(async () => c.updateSettings({ announceAssistantMessages: false }));
  await publish('First.\nPartial completed.\nSkipped.');
  await act(async () => c.updateSettings({ announceAssistantMessages: true }));
  await publish('First.\nPartial completed.\nSkipped.\nNew tail.', 'settled');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['First.', 'Partial completed.', 'New tail.']);
});

for (const keepAction of [false, true]) {
  test(
    'session return keeps active segment and queued/new text without history replay, action retained=' +
      keepAction,
    async (t) => {
      const played = [];
      t.mock.method(BrowserSpeakingEngine.prototype, 'prepare', async function (text) {
        return { text, dispose() {} };
      });
      t.mock.method(BrowserSpeakingEngine.prototype, 'playPrepared', function (item, options) {
        let finish;
        const promise = new Promise((resolve) => {
          finish = resolve;
        });
        this.finishTest = finish;
        played.push({ text: item.text, finish });
        options.onPlaybackStart();
        return promise;
      });
      t.mock.method(BrowserSpeakingEngine.prototype, 'stop', function () {
        this.finishTest?.();
        this.finishTest = null;
      });
      const f = await fixture(t, {
        realSpeech: true,
        realLifecycle: true,
        initialSettings: { mode: 'headphones', segmentGapMs: 0 },
      });
      const view = (key) =>
        h(
          React.Fragment,
          null,
          ...(keepAction ? [h(f.Action, { ...f.props('a'), key: 'retained-action' })] : []),
          h(f.Buttons, { ...f.props(key), key }),
        );
      const reply = (turn, text, status = 'running', time = Date.now()) => ({
        kind: 'assistant-step',
        data: { turn, step: 0, time, status, blocks: [{ kind: 'text', text }] },
      });
      await f.render(view('a'));
      const old = f.controllers.at(-1);
      if (keepAction) await act(async () => old.startConversation());
      await act(async () => {
        f.store('a').getSnapshot().nodes.set('new', reply(2, 'First. Second.\nPartial'));
        f.store('a').listeners.forEach((fn) => fn());
      });
      await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
      assert.deepEqual(
        played.map((p) => p.text),
        ['First.'],
      );
      await f.render(view('b'));
      assert.equal(old.snapshot.speaking, false);
      assert.equal(played.length, 1);
      const store = f.store('a');
      await act(async () => {
        store
          .getSnapshot()
          .nodes.set('new', reply(2, 'First. Second.\nPartial completed.', 'settled'));
        store.getSnapshot().nodes.set('newer', reply(3, 'Next answer.', 'settled'));
        store.getSnapshot().nodes.set('backfill', reply(0, 'Old backfill.', 'settled', 1));
        store.listeners.forEach((fn) => fn());
      });
      assert.equal(played.length, 1, 'background updates never speak');
      await f.render(view('a'));
      await act(async () => {
        await new Promise(setImmediate);
      });
      await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
      assert.deepEqual(
        played.map((p) => p.text),
        ['First.', 'First.'],
      );
      for (let index = 1; index <= 4; index++) {
        await act(async () => {
          played[index]?.finish();
          await new Promise(setImmediate);
        });
      }
      await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
      assert.deepEqual(
        played.map((p) => p.text),
        ['First.', 'First.', 'Second.', 'Partial completed.', 'Next answer.'],
      );
      await f.render(view('b'));
      await f.render(view('a'));
      assert.equal(played.length, 5, 'completed segments never replay on a later return');
    },
  );
}

test('off/on in another chat drops parked speech and only admits fresh messages on return', async (t) => {
  const f = await fixture(t);
  const played = [];
  t.mock.method(VoiceCoordinator.prototype, 'play', async (text) => played.push(text));
  const reply = (turn, text, time = Date.now()) => ({
    kind: 'assistant-step',
    data: {
      turn,
      step: 0,
      time,
      status: 'running',
      blocks: [{ kind: 'text', text }],
    },
  });
  await f.render(h(f.Buttons, { ...f.props('a'), key: 'a' }));
  await act(async () => {
    f.store('a').getSnapshot().nodes.set('new', reply(2, 'Spoken.\nPending'));
    f.store('a').listeners.forEach((fn) => fn());
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['Spoken.']);
  await f.render(h(f.Buttons, { ...f.props('b'), key: 'b' }));
  const b = f.controllers.at(-1);
  await act(async () => b.updateSettings({ announceAssistantMessages: false }));
  await act(async () => b.updateSettings({ announceAssistantMessages: true }));
  await act(async () => {
    f.store('a')
      .getSnapshot()
      .nodes.set('new', reply(2, 'Spoken.\nPending completed.\n', Date.now() - 100));
    f.store('a').listeners.forEach((fn) => fn());
  });
  await f.render(h(f.Buttons, { ...f.props('a'), key: 'a' }));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['Spoken.']);
  await act(async () => {
    f.store('a')
      .getSnapshot()
      .nodes.set('fresh', reply(3, 'Fresh answer.\n', Date.now() + 1));
    f.store('a').listeners.forEach((fn) => fn());
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['Spoken.', 'Fresh answer.']);
});

test('a rapid retained-session return interrupted during release preserves its parked queue', async (t) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const f = await fixture(t);
  const played = [];
  t.mock.method(VoiceCoordinator.prototype, 'play', async function (text) {
    played.push(text);
  });
  const view = (session) =>
    h(
      React.Fragment,
      null,
      h(f.Action, { ...f.props('a'), key: 'retained' }),
      h(f.Buttons, { ...f.props(session), key: session }),
    );
  await f.render(view('a'));
  const a = f.controllers[0];
  a.queue = [{ id: 'pending', text: 'Parked answer.' }];
  t.mock.method(a, 'suspendSpeech', function () {
    this.speechSuspended = true;
    this.queue = [];
    return held;
  });
  await f.render(view('b'));
  await f.render(view('a'));
  await f.render(view('b'));
  await act(async () => {
    release();
    await new Promise(setImmediate);
  });
  assert.equal(played.length, 0);
  await f.render(view('a'));
  await act(async () => {
    await new Promise(setImmediate);
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['Parked answer.']);
});

test('rapid A-B-C navigation permits only the latest committed composer to resume speech', async (t) => {
  const f = await fixture(t);
  const played = [];
  t.mock.method(VoiceCoordinator.prototype, 'play', async function (text) {
    played.push([this, text]);
  });
  await f.render(h(f.Buttons, { ...f.props('a'), key: 'a' }));
  const a = f.controllers[0];
  await act(async () => {
    f.store('a')
      .getSnapshot()
      .nodes.set('new', {
        kind: 'assistant-step',
        data: {
          turn: 2,
          step: 0,
          time: Date.now() + 1,
          status: 'running',
          blocks: [{ kind: 'text', text: 'Partial' }],
        },
      });
    f.store('a').listeners.forEach((fn) => fn());
  });
  await f.render(h(f.Buttons, { ...f.props('b'), key: 'b' }));
  await f.render(h(f.Buttons, { ...f.props('c'), key: 'c' }));
  assert.equal(played.length, 0);
  assert.equal(a.speechSuspended, true);
});

test('automatic speech waits for saved preferences instead of using the provisional default', async (t) => {
  const loaded = deferred();
  const f = await fixture(t, {
    settingsReady: loaded.promise,
    initialSettings: { announceAssistantMessages: false },
  });
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const played = [];
  t.mock.method(c, 'play', async (text) => played.push(text));
  const store = f.store('a');
  const publish = async (text) =>
    act(async () =>
      store.setSnapshot({
        nodes: new Map([
          [
            'reply',
            {
              kind: 'assistant-step',
              visibility: 'visible',
              data: {
                turn: 2,
                step: 0,
                status: 'settled',
                time: Date.now() + 1,
                blocks: [{ kind: 'text', text }],
              },
            },
          ],
        ]),
      }),
    );
  await publish('Before preferences.');
  assert.deepEqual(played, []);
  await act(async () => loaded.resolve());
  assert.equal(c.snapshot.settings.announceAssistantMessages, false);
  await publish('Before preferences.\nDisabled.');
  assert.deepEqual(played, []);
  await act(async () => c.updateSettings({ announceAssistantMessages: true }));
  await publish('Before preferences.\nDisabled.\nEnabled.');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['Enabled.']);
});

test('message actions without a committed composer cannot admit automatic speech', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Action, f.props('a')));
  const c = f.controllers[0];
  const played = [];
  t.mock.method(c, 'play', async (text) => played.push(text));
  const store = f.store('a');
  const node = store.getSnapshot().nodes.get('one');
  await act(async () => {
    node.data.blocks[0].text = 'Background update.';
    store.listeners.forEach((fn) => fn());
  });
  await f.render(h(React.Fragment, null, h(f.Action, f.props('a')), h(f.Buttons, f.props('a'))));
  assert.deepEqual(played, []);
  await act(async () => {
    node.data.blocks[0].text += '\nVisible reply.';
    store.listeners.forEach((fn) => fn());
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 650)));
  assert.deepEqual(played, ['Visible reply.']);
});

test('pagehide and plugin disposal invalidate pending starts and stale controllers', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const pending = c.startDictation();
  window.dispatchEvent(new window.Event('pagehide'));
  await pending;
  assert.equal(f.calls.filter(([name]) => name === 'start').length, 0);
  f.close();
  await c.startConversation();
  await c.speak('stale');
  assert.equal(f.calls.filter(([name]) => name === 'conversation' || name === 'speak').length, 0);
  assert.equal(f.store('a').listeners.size, 0);
});

test('steer delivery dispatches an accelerated composer gesture instead of normal submission', async (t) => {
  const f = await fixture(t);
  const calls = [];
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  document.body.append(editor);
  editor.addEventListener('keydown', (event) =>
    calls.push([event.key, event.ctrlKey, event.metaKey]),
  );
  const actions = {
    setDraft() {},
    submit() {
      calls.push(['normal-submit']);
    },
  };
  await f.render(h(f.Buttons, f.props('a', actions)));
  const controller = f.controllers[0];
  controller.composer.submit('steer');
  assert.deepEqual(calls, [['Enter', true, false]]);
  controller.composer.submit('queue');
  assert.deepEqual(calls, [['Enter', true, false], ['normal-submit']]);
  // Changing the reported DSH policy takes effect without remounting the composer.
  await act(async () => controller.updateSettings({ dshBusyEnterBehavior: 'steer' }));
  calls.length = 0;
  controller.composer.submit('steer');
  controller.composer.submit('queue');
  assert.deepEqual(calls, [
    ['Enter', false, false],
    ['Enter', true, false],
  ]);

  // A missing accelerated editor must not fall back to the wrong delivery mode.
  editor.remove();
  calls.length = 0;
  controller.composer.submit('queue');
  assert.deepEqual(calls, []);
});

test('voice controls mount when DSH omits the legacy pending-interaction store', async (t) => {
  const f = await fixture(t, { pendingStore: false });
  await f.render(h(f.Buttons, f.props('a')));
  assert.equal(f.controllers.length, 1);
  assert.equal(f.pendingListeners.size, 0);
});

test('new pending questions are spoken once only while voice conversation mode is active', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const controller = f.controllers[0];
  controller.patch({ conversation: true });
  const question = {
    kind: 'question',
    key: 'question:1',
    questions: [{ id: 'engine', question: 'Which speech engine should I use?' }],
  };
  await act(async () => f.publishPending('a', question));
  await act(async () => f.publishPending('a', question));
  const spoken = f.calls.filter(([name]) => name === 'speak');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0][2], 'Which speech engine should I use?');
  assert.equal(spoken[0][3], 'question:1');
  await f.render(null);
  assert.equal(f.pendingListeners.size, 0);
});

test('pending questions stay silent outside voice conversation mode', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  await act(async () =>
    f.publishPending('a', {
      kind: 'question',
      key: 'question:quiet',
      questions: [{ id: 'one', question: 'Should remain silent?' }],
    }),
  );
  assert.equal(f.calls.filter(([name]) => name === 'speak').length, 0);
});

test('spoken finals answer pending questions as custom text without touching the chat draft', async (t) => {
  const f = await fixture(t);
  const writes = [];
  await f.render(h(f.Buttons, f.props('a', { setDraft: (text) => writes.push(text) })));
  const controller = f.controllers[0];
  controller.patch({ conversation: true, listening: true });
  const replies = [];
  await act(async () =>
    f.publishPending('a', {
      kind: 'question',
      key: 'question:hands-free',
      questions: [
        { id: 'first', question: 'Which engine?' },
        { id: 'second', question: 'Which voice?' },
      ],
      answer: async (reply) => replies.push(reply),
    }),
  );
  controller.onResult({ interim: 'Nave', final: '' });
  controller.onResult({ interim: '', final: 'Navegador' });
  await act(async () => {});
  controller.patch({ listening: true });
  controller.onResult({ interim: '', final: 'Voz local' });
  await act(async () => {});
  assert.deepEqual(replies, [
    {
      answers: [
        { id: 'first', selected: [], custom: 'Navegador' },
        { id: 'second', selected: [], custom: 'Voz local' },
      ],
    },
  ]);
  assert.deepEqual(writes, []);
  assert.deepEqual(
    f.calls.filter(([name]) => name === 'speak').map((call) => call[2]),
    ['Which engine?', 'Which voice?'],
  );
});

test('sharing requests permission on first click without ending normal voice or blocking speech', async (t) => {
  const f = await fixture(t);
  let requests = 0;
  let meeting;
  navigator.mediaDevices.getDisplayMedia = () => {
    requests++;
    return Promise.resolve({ getTracks: () => [] });
  };
  t.mock.method(MeetingController.prototype, 'start', async function (source, request) {
    meeting = this;
    assert.equal(source, 'shared');
    await request;
    this.patch('shared', { listening: true });
  });
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const before = f.calls.filter(([name]) => name === 'end').length;
  await act(async () => document.querySelector('[aria-label="Shared audio"]').click());
  assert.equal(requests, 1);
  assert.equal(f.calls.filter(([name]) => name === 'end').length, before);
  await c.speak('Test speech', 'test');
  assert.equal(f.calls.filter(([name]) => name === 'speak').length, 1);
  await c.startConversation();
  assert.equal(f.calls.filter(([name]) => name === 'conversation').length, 1);
  assert.equal(meeting.getSnapshot().shared.listening, true);
  const stops = f.calls.filter(([name]) => name === 'stop').length;
  await act(async () => document.querySelector('[aria-label="Shared audio"]').click());
  assert.equal(meeting.getSnapshot().shared.listening, false);
  assert.equal(f.calls.filter(([name]) => name === 'stop').length, stops);
});

test('all three bars stay ordered captions, shared audio, microphone with no duplicate microphone or autoplay controls', async (t) => {
  const f = await fixture(t);
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  let meeting;
  navigator.mediaDevices.getDisplayMedia = () => Promise.resolve({ getTracks: () => [] });
  t.mock.method(MeetingController.prototype, 'start', async function (source, request) {
    meeting = this;
    await request;
    this.patch('shared', { listening: true });
  });
  await f.render(h(React.Fragment, null, h(f.Buttons, f.props('a')), h(f.Dock, f.props('a'))));
  const c = f.controllers[0];
  await act(async () => {
    c.patch({
      conversation: true,
      listening: true,
      speaking: true,
      speechText: 'Visible captions',
      speechSegmentsRemaining: 3,
      speechSegmentsTotal: 3,
      speechSegmentIndex: 1,
    });
    document.querySelector('[aria-label="Shared audio"]').click();
  });
  const bars = [...document.querySelectorAll('.dlv-pill')];
  assert.equal(bars.length, 3);
  assert.ok(bars[0].classList.contains('dlv-speech-pill'));
  assert.equal(bars[1].getAttribute('aria-label'), 'Shared audio');
  assert.equal(bars[2].getAttribute('aria-label'), 'Voice controls');
  assert.equal(bars[2].querySelectorAll('.dlv-mic-state').length, 1);
  assert.equal(bars[2].firstElementChild.classList.contains('dlv-mic-state'), true);
  assert.equal(
    bars[2].querySelectorAll('button').length,
    4,
    'ignore, commands, timestamps and delivery mode',
  );
  assert.equal(bars[1].querySelectorAll('button').length, 4, 'shared input mirrors microphone');
  assert.equal(bars[2].querySelector('[role="switch"]'), null);
  assert.equal(bars[2].querySelector('.dlv-speech-count'), null);
  assert.equal(bars[0].querySelector('[role="switch"]'), null);
  assert.equal(document.querySelectorAll('[data-audio-mode]').length, 1);
  assert.equal(bars[0].querySelector('.dlv-speech-count').textContent, '1/3');
  await act(async () => {
    c.patch({ speaking: false, speechSegmentsRemaining: 0, speechRunActive: false });
  });
  assert.equal(document.querySelectorAll('.dlv-pill').length, 2);
  assert.ok(
    document.querySelector('[data-audio-mode]'),
    'autoplay remains accessible without speech',
  );
  assert.equal(meeting.getSnapshot().shared.listening, true);
});

test('composer autoplay remains between shared audio and microphone while idle, toggles settings without stopping either source', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const buttons = [...document.querySelectorAll('button')];
  assert.equal(buttons[0].getAttribute('aria-label'), 'Shared audio');
  assert.equal(buttons[1].getAttribute('data-audio-mode'), 'speaker');
  assert.equal(buttons[1].classList.contains('dlv-live-toggle'), false);
  assert.equal(buttons[1].querySelector('.dlv-toggle-state'), null);
  assert.match(buttons[1].title, /Next mode: Headphones/);
  assert.equal(buttons[0].title, 'Start audio sharing');
  assert.ok(buttons[2].title);
  assert.equal(buttons[2].classList.contains('dlv-mic'), true);
  const c = f.controllers[0];
  let updates = [];
  c.updateSettings = (next) => {
    updates.push(next);
    c.patch({ settings: { ...c.getSnapshot().settings, ...next } });
  };
  const before = f.calls.length;
  await act(async () => buttons[1].click());
  assert.deepEqual(updates, [{ announceAssistantMessages: true, mode: 'headphones' }]);
  assert.equal(buttons[1].getAttribute('data-audio-mode'), 'headphones');
  await act(async () => buttons[1].click());
  assert.deepEqual(updates[1], { announceAssistantMessages: false });
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'false');
  assert.match(buttons[1].title, /Next mode: Speakers/);
  await act(async () => buttons[1].click());
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(f.calls.length, before, 'capture and speech lifecycle actions are untouched');
});

test('Settings selected say test calls macOS backend and never browser synthesis', async (t) => {
  const f = await fixture(t, { realSpeech: true });
  let browserCalls = 0;
  const requests = [];
  t.mock.method(BrowserSpeakingEngine.prototype, 'speak', async () => {
    browserCalls++;
  });
  t.mock.method(HostAudioSpeakingEngine.prototype, 'playPrepared', async (_audio, options) => {
    options.onPlaybackStart?.();
  });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/dsh-live-voice/settings') {
      if (options.method === 'PUT')
        return Response.json({
          ok: true,
          value: { engine: 'say', mode: 'headphones', voice: '', lang: 'pt-BR' },
        });
      return Response.json({ ok: true, value: { engine: 'browser', mode: 'headphones' } });
    }
    if (url === '/api/dsh-live-voice/say/speech') {
      requests.push({ url, body: JSON.parse(options.body) });
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mp4' } });
    }
    return Response.json({ ok: true, value: { supported: true } });
  });
  await f.render(h(f.Settings));
  const selector = document.querySelector('select');
  await act(async () => {
    selector.value = 'say';
    selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(selector.value, 'say');
  const button = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Test selected speech output',
  );
  await act(async () => {
    button.click();
    await new Promise((resolve) => setImmediate(resolve));
  });
  assert.equal(browserCalls, 0);
  assert.ok(requests.length > 0, 'selected say must send a real HTTP synthesis request');
  assert.equal(requests[0].body.lang, 'pt-BR');
  assert.equal(requests[0].body.rate, 175);
});

test('an older settings save response cannot make selected say test fall back to browser', async (t) => {
  const f = await fixture(t, { realSpeech: true });
  const firstSave = deferred();
  const secondSave = deferred();
  let put = 0;
  let browserCalls = 0;
  let backendCalls = 0;
  t.mock.method(BrowserSpeakingEngine.prototype, 'speak', async () => {
    browserCalls++;
  });
  t.mock.method(HostAudioSpeakingEngine.prototype, 'playPrepared', async (_audio, options) => {
    options.onPlaybackStart?.();
  });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/dsh-live-voice/settings') {
      if (options.method === 'PUT') {
        put++;
        return put === 1 ? firstSave.promise : secondSave.promise;
      }
      return Response.json({ ok: true, value: { engine: 'browser', mode: 'headphones' } });
    }
    if (url === '/api/dsh-live-voice/say/speech') {
      backendCalls++;
      return new Response(new Uint8Array([1, 2, 3]));
    }
    return Response.json({ ok: true, value: { supported: true } });
  });
  await f.render(h(f.Settings));
  const c = f.controllers.findLast((controller) => !controller.disposed);
  let oldSave;
  await act(async () => {
    oldSave = c.updateSettings({ rate: 1.2 });
    await new Promise((resolve) => setImmediate(resolve));
  });
  const selector = document.querySelector('select');
  await act(async () => {
    selector.value = 'say';
    selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(selector.value, 'say');
  await act(async () => {
    firstSave.resolve(
      Response.json({ ok: true, value: { engine: 'browser', mode: 'headphones', rate: 1.2 } }),
    );
    await oldSave;
  });
  const testButton = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Test selected speech output',
  );
  await act(async () => {
    testButton.click();
    await new Promise((resolve) => setImmediate(resolve));
  });
  secondSave.resolve(
    Response.json({ ok: true, value: { engine: 'say', mode: 'headphones', rate: 1.2 } }),
  );
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
  assert.equal(
    browserCalls,
    0,
    'old persistence responses must never override selected speech engine',
  );
  assert.ok(backendCalls > 0);
});

test('selected say failure reports error instead of silently falling back to browser speech', async (t) => {
  const f = await fixture(t, { realSpeech: true });
  let browserCalls = 0;
  let backendCalls = 0;
  t.mock.method(BrowserSpeakingEngine.prototype, 'speak', async () => {
    browserCalls++;
  });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/dsh-live-voice/settings')
      return Response.json({ ok: true, value: { engine: 'say', mode: 'headphones' } });
    if (url === '/api/dsh-live-voice/say/speech') {
      backendCalls++;
      return Response.json(
        { ok: false, error: { message: 'Simulated say backend failure' } },
        { status: 502 },
      );
    }
    return Response.json({ ok: true, value: { supported: true } });
  });
  await f.render(h(f.Settings));
  const selector = document.querySelector('select');
  await act(async () => {
    selector.value = 'say';
    selector.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(selector.value, 'say');
  const button = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Test selected speech output',
  );
  await act(async () => {
    button.click();
    await new Promise((resolve) => setImmediate(resolve));
  });
  assert.equal(browserCalls, 0);
  assert.ok(backendCalls > 0);
  assert.match(
    document.querySelector('[role="alert"]').textContent,
    /Simulated say backend failure/,
  );
});

test('macOS say voice is visible, editable on blur, and clearing restores host default synthesis', async (t) => {
  let saved = { engine: 'say', voice: 'Grandma (português (Brasil))', mode: 'headphones' };
  const f = await fixture(t, { realSpeech: true, initialSettings: saved });
  const patches = [];
  const requests = [];
  t.mock.method(HostAudioSpeakingEngine.prototype, 'playPrepared', async (_audio, options) =>
    options.onPlaybackStart?.(),
  );
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/dsh-live-voice/settings') {
      if (options.method === 'PUT') {
        const patch = JSON.parse(options.body);
        patches.push(patch);
        saved = { ...saved, ...patch };
      }
      return Response.json({ ok: true, value: saved });
    }
    if (url === '/api/dsh-live-voice/say/speech') {
      requests.push(JSON.parse(options.body));
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mp4' } });
    }
    return Response.json({ ok: true, value: { supported: true } });
  });
  await f.render(h(f.Settings));
  await act(async () => {
    const select = document.querySelector('select');
    select.value = 'say';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  const field = [...document.querySelectorAll('label')]
    .find((label) => label.textContent === 'macOS say voice')
    .querySelector('input');
  assert.equal(field.value, 'Grandma (português (Brasil))');
  assert.match(document.body.textContent, /Leave empty to use the macOS default voice/);
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const before = patches.length;
  await act(async () => {
    setValue.call(field, '  Luciana  ');
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  assert.equal(patches.length, before, 'typing must not persist each keystroke');
  await act(async () => {
    field.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  });
  assert.equal(f.serverSettings().voice, 'Luciana');
  const button = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Test selected speech output',
  );
  await act(async () => {
    button.click();
    await new Promise((resolve) => setImmediate(resolve));
  });
  assert.equal(requests.at(-1).voice, 'Luciana');
  await act(async () => {
    setValue.call(field, '');
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await act(async () => {
    field.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  });
  assert.equal(f.serverSettings().voice, '');
  await act(async () => {
    button.click();
    await new Promise((resolve) => setImmediate(resolve));
  });
  assert.equal(
    Object.hasOwn(requests.at(-1), 'voice'),
    false,
    'empty voice omits -v and uses macOS default',
  );
});

test('switching chats baselines delayed history, preserves new streaming speech and ignores historical backfill', async (t) => {
  const f = await fixture(t);
  const observed = [];
  const original = VoiceCoordinator.prototype.observeMessage;
  t.mock.method(VoiceCoordinator.prototype, 'observeMessage', function (id, text, options) {
    observed.push({ controller: this, id, text, ...options });
    return original.call(this, id, text, options);
  });
  const snapshot = (messages) => ({
    nodes: {
      values: () =>
        new Map(
          messages.map(({ id, status = 'settled', time = 0, text = 'History' }) => [
            id,
            {
              kind: 'assistant-step',
              visibility: 'visible',
              data: { turn: Number(id), step: 0, status, time, blocks: [{ kind: 'text', text }] },
            },
          ]),
        ).values(),
    },
  });
  const store = f.chatStore('delayed');
  store.setSnapshot(snapshot([]));
  await f.render(h(f.Buttons, f.props('delayed')));
  await act(async () => store.setSnapshot(snapshot([{ id: '1' }, { id: '2' }])));
  const history = observed.filter((m) => m.id === '1:0' || m.id === '2:0');
  assert.equal(history.length, 2);
  assert.ok(history.every((m) => m.baseline));
  assert.equal(f.controllers.at(-1).queue.length, 0);
  const now = Date.now() + 1;
  await act(async () =>
    store.setSnapshot(
      snapshot([{ id: '1' }, { id: '2' }, { id: '3', status: 'running', time: now, text: 'New' }]),
    ),
  );
  assert.equal(observed.at(-1).baseline, false);
  await act(async () =>
    store.setSnapshot(
      snapshot([{ id: '1' }, { id: '2' }, { id: '3', time: now, text: 'New response' }]),
    ),
  );
  assert.equal(observed.at(-1).baseline, false);
  await act(async () =>
    store.setSnapshot(
      snapshot([
        { id: '0', time: 1 },
        { id: '1' },
        { id: '2' },
        { id: '3', time: now, text: 'New response' },
      ]),
    ),
  );
  assert.equal(observed.find((m) => m.id === '0:0').baseline, true);
  const empty = f.chatStore('empty');
  empty.setSnapshot(snapshot([]));
  await f.render(h(f.Buttons, f.props('empty')));
  await act(async () =>
    empty.setSnapshot(snapshot([{ id: '4', time: Date.now() + 1, text: 'First new reply' }])),
  );
  assert.equal(observed.at(-1).baseline, false);
  await f.render(h(f.Buttons, f.props('other')));
  observed.length = 0;
  await f.render(h(f.Buttons, f.props('delayed')));
  assert.ok(
    observed.filter((m) => m.controller === f.controllers.at(-1)).every((m) => !m.baseline),
    'return uses the saved cursor instead of rebasing every known message',
  );
});

test('shared meeting capture survives chat replacement and routes only to the committed composer', async (t) => {
  const f = await fixture(t);
  let requests = 0,
    stopped = 0;
  const track = new EventTarget();
  track.stop = () => {
    stopped++;
  };
  const stream = { getTracks: () => [track] };
  navigator.mediaDevices.getDisplayMedia = () => {
    requests++;
    return Promise.resolve(stream);
  };
  const creates = [];
  t.mock.method(MeetingController.prototype, 'start', async function (source, request) {
    await request;
    const abort = new AbortController();
    this.jobs.set(source, {
      abort,
      meter: { stop: async () => track.stop() },
      engine: { stop: async () => {} },
    });
    track.addEventListener('ended', () => void this.stop(source), { once: true });
    this.transcript.setActive(source, true);
    this.patch(source, { listening: true });
    creates.push(this);
  });
  const edits = [];
  const a = f.props('a', { setDraft: (text) => edits.push(['a', text]) });
  const b = f.props('b', { setDraft: (text) => edits.push(['b', text]) });
  await f.render(h(f.Buttons, a));
  await act(async () => document.querySelector('[aria-label="Shared audio"]').click());
  const meeting = creates[0];
  const job = meeting.jobs.get('shared');
  await act(async () => meeting.transcript.append('shared', 'Before navigation'));
  assert.deepEqual(edits, [['a', 'Draft Before navigation']]);
  await f.render(h(f.Buttons, b));
  assert.equal(meeting.jobs.get('shared'), job);
  assert.equal(stopped, 0);
  assert.equal(requests, 1);
  await act(async () => meeting.transcript.append('shared', 'After navigation'));
  assert.deepEqual(edits.at(-1), ['b', 'Draft After navigation']);
  await f.render(null);
  await act(async () => meeting.transcript.append('shared', 'No destination'));
  assert.equal(edits.length, 2);
  assert.equal(stopped, 0);
  await f.render(h(f.Buttons, a));
  assert.equal(meeting.jobs.get('shared'), job);
  await act(async () => track.dispatchEvent(new Event('ended')));
  assert.equal(meeting.getSnapshot().shared.listening, false);
  assert.equal(stopped, 1);
});

test('input preferences coalesce to latest engine without stopping playback or meeting', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const restart = [];
  t.mock.method(c, '_startInput', async function (conversation) {
    restart.push([conversation, this.recognition.lang]);
    this.patch({ listening: true });
  });
  c.patch({
    conversation: true,
    listening: true,
    speaking: true,
    paused: true,
    speechText: 'retained answer',
  });
  const history = c.speechHistory;
  const queue = c.queue;
  await act(async () => {
    await Promise.all([
      c.updateSettings({ recognitionLang: 'en-US' }),
      c.updateSettings({ recognitionLang: 'pt-BR' }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(restart.length, 1);
  assert.equal(restart[0][0], true);
  assert.equal(c.recognition.lang, 'pt-BR');
  assert.equal(c.getSnapshot().speaking, true);
  assert.equal(c.getSnapshot().paused, true);
  assert.equal(c.speechHistory, history);
  assert.equal(c.queue, queue);
  assert.equal(
    f.calls.some(([name, controller]) => name === 'end' && controller === c),
    false,
  );
});
test('explicit stop during pending input settings change prevents reacquisition', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, f.props('a')));
  const c = f.controllers[0];
  const restart = [];
  t.mock.method(c, '_startInput', async () => restart.push(true));
  c.patch({ conversation: true, listening: true });
  await act(async () => {
    const saved = c.updateSettings({ recognitionLang: 'pt-BR' });
    await c.stopListening();
    await saved;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.deepEqual(restart, []);
});

test('closing microphone mode preserves playback but disables voice continuity on the next chat', async (t) => {
  const f = await fixture(t);
  await f.render(h(f.Buttons, { ...f.props('a'), key: 'a' }));
  const a = f.controllers[0];
  await a.startConversation();
  await act(async () =>
    a.patch({
      conversation: true,
      listening: true,
      speaking: true,
      speechText: 'Manual answer',
      activeMessageId: 'manual',
    }),
  );
  const epoch = a.speechEpoch;
  await act(async () => a.stopConversationInput());
  assert.equal(a.snapshot.conversation, false);
  assert.equal(a.snapshot.speaking, true);
  assert.equal(a.snapshot.speechText, 'Manual answer');
  assert.equal(a.speechEpoch, epoch);
  assert.equal(
    f.calls.some(([name, controller]) => name === 'end' && controller === a),
    false,
  );
  await f.render(h(f.Buttons, { ...f.props('b'), key: 'b' }));
  const b = f.controllers.at(-1);
  assert.equal(
    f.calls.some(([name, controller]) => name === 'conversation' && controller === b),
    false,
  );
});
