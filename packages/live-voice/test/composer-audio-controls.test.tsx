// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ConversationControls } from '../src/modules/conversation/components/ConversationControls.tsx';
import { withAppLanguage, liveVoiceDictionaries } from '../src/app/client/i18n/index.ts';

test('composer cycles saved modes and opens synchronized device panels without activating audio', async () => {
  const dom = new JSDOM('<div id="root"></div><button id="outside">Outside</button>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const events = new dom.window.EventTarget();
  let devices = [
    { kind: 'audioinput', deviceId: 'mic-1', label: 'Studio mic' },
    { kind: 'audiooutput', deviceId: 'out-1', label: 'USB headphones' },
  ];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        enumerateDevices: async () => devices,
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
      },
    },
  });
  const root = createRoot(document.getElementById('root'));
  try {
    for (const locale of Object.keys(liveVoiceDictionaries)) {
      let state = {
        settings: { announceAssistantMessages: false, mode: 'headphones', engine: 'qwen-http' },
        speechSegmentsRemaining: 2,
      };
      const listeners = new Set();
      const patches = [];
      let starts = 0;
      const controller = {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot: () => state,
        updateSettings(patch) {
          patches.push(patch);
          state = { ...state, settings: { ...state.settings, ...patch } };
          listeners.forEach((fn) => fn());
        },
        startConversation() {
          starts++;
        },
      };
      const snapshot = { active: locale, revision: 0 };
      const Controls = withAppLanguage(ConversationControls, {
        subscribe: () => () => {},
        getSnapshot: () => snapshot,
      });
      await act(async () => root.render(<Controls controller={controller} />));
      const output = () => document.querySelector('[data-audio-mode]');
      const mic = () => document.querySelector('.dlv-mic');
      assert.equal(output().dataset.audioMode, 'off');
      for (const mode of ['speaker', 'headphones', 'off']) {
        await act(async () => output().click());
        assert.equal(output().dataset.audioMode, mode);
      }
      assert.deepEqual(patches.slice(0, 3), [
        { announceAssistantMessages: true, mode: 'speaker' },
        { announceAssistantMessages: true, mode: 'headphones' },
        { announceAssistantMessages: false },
      ]);
      assert.equal(starts, 0);
      const open = async (button) =>
        act(async () =>
          button.dispatchEvent(
            new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
          ),
        );
      await open(output());
      assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
      assert.equal(output().getAttribute('aria-expanded'), 'true');
      assert.ok(document.querySelector('select').textContent.includes('USB headphones'));
      assert.equal(document.activeElement, document.querySelector('select'));
      await act(async () => {
        const select = document.querySelector('select');
        select.value = 'out-1';
        select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      assert.equal(state.settings.outputDeviceId, 'out-1');
      assert.equal(state.settings.announceAssistantMessages, false);
      await act(async () =>
        document.dispatchEvent(
          new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      );
      assert.equal(document.querySelector('[role="dialog"]'), null);
      assert.equal(document.activeElement, output());
      await act(async () =>
        mic().dispatchEvent(
          new dom.window.KeyboardEvent('keydown', {
            key: 'F10',
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      assert.ok(document.querySelector('select').textContent.includes('Studio mic'));
      await act(async () => {
        const select = document.querySelector('select');
        select.value = 'mic-1';
        select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      assert.equal(state.settings.inputDeviceId, 'mic-1');
      assert.equal(starts, 0);
      devices = [...devices, { kind: 'audioinput', deviceId: 'mic-2', label: 'New mic' }];
      await act(async () => events.dispatchEvent(new dom.window.Event('devicechange')));
      assert.ok(document.querySelector('select').textContent.includes('New mic'));
      await act(async () =>
        document
          .getElementById('outside')
          .dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })),
      );
      assert.equal(document.querySelector('[role="dialog"]'), null);
      await act(async () => controller.updateSettings({ engine: 'say' }));
      await open(output());
      assert.ok(document.querySelector('select').textContent.includes('USB headphones'));
      assert.equal(document.querySelector('select').value, 'out-1');
      await act(async () => {
        const select = document.querySelector('select');
        select.value = '';
        select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      assert.equal(state.settings.outputDeviceId, '');
      assert.equal(document.querySelector('.dlv-hint-trigger'), null);
      assert.ok(!document.body.textContent.includes('dsh-live-voice.'));
      await act(async () => root.render(null));
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
    if (previous.navigator) Object.defineProperty(globalThis, 'navigator', previous.navigator);
    else delete globalThis.navigator;
  }
});
