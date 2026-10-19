// @ts-nocheck
import test from 'node:test';
import { iconPaths } from '../src/shared/design-system/icons/icons.js';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import {
  MeetingToggle,
  MeetingBars,
} from '../src/modules/conversation/components/MeetingControls.js';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.js';
test('meeting menu starts shared audio only after selection and renders its own active bar', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const old = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, old);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const listeners = new Set();
  let snapshot = { shared: {}, microphone: { listening: true } };
  let starts = 0;
  const input = new VoiceCoordinator({
    recognition: { stop: async () => {} },
    meter: { stop: async () => {} },
    engines: {},
    composer: { getDraft: () => '', setDraft() {} },
  });
  const meeting = {
    input: () => input,
    jobs: new Map(),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    toggleTimestamps: () => {
      snapshot = { ...snapshot, timestamps: !snapshot.timestamps };
      listeners.forEach((fn) => fn());
    },
    stop: (source) => {
      assert.equal(source, 'shared');
      snapshot = { ...snapshot, shared: {} };
      listeners.forEach((fn) => fn());
    },
    patch: () => {},
  };
  await act(async () =>
    root.render(
      <LiveVoiceTranslationProvider>
        <MeetingToggle
          meeting={meeting}
          onToggle={() => {
            starts++;
            input.patch({ listening: true });
            snapshot = { ...snapshot, shared: { listening: true } };
            listeners.forEach((fn) => fn());
          }}
        />
        <MeetingBars meeting={meeting} />
      </LiveVoiceTranslationProvider>,
    ),
  );
  assert.equal(document.querySelectorAll('[role="group"]').length, 0);
  const toggle = document.querySelector('button[aria-label="Meeting mode"]');
  assert.equal(toggle.dataset.toggleActive, 'false');
  assert.equal(toggle.querySelector('path').getAttribute('d'), iconPaths.meetingOff);
  await act(async () => document.querySelector('button[aria-label="Meeting mode"]').click());
  assert.equal(starts, 0);
  await act(async () => document.querySelector('.dlv-meeting-menu > button').click());
  assert.equal(starts, 1);
  assert.equal(toggle.dataset.toggleActive, 'true');
  assert.equal(toggle.querySelector('path').getAttribute('d'), iconPaths.meeting);
  assert.equal(
    document.querySelector('button[aria-label="Meeting mode"]').title,
    'Meeting actions',
  );
  assert.equal(document.querySelectorAll('[role="group"]').length, 1);
  assert.equal(document.querySelector('p'), null);
  assert.equal(document.querySelector('[role="status"]').textContent, 'Waiting');
  const clock = document.querySelector('[aria-label="Transcript timestamps"]');
  assert.equal(clock.getAttribute('data-toggle-active'), 'false');
  assert.equal(clock.textContent, 'Timestamp');
  await act(async () => clock.click());
  assert.equal(clock.getAttribute('data-toggle-active'), 'true');
  await act(async () => document.querySelector('[role="group"] button').click());
  assert.equal(document.querySelectorAll('[role="group"]').length, 1);
  assert.equal(input.getSnapshot().muted, true);
  assert.equal(input.getSnapshot().listening, true);
  assert.equal(snapshot.microphone.listening, true);
  await act(async () => document.querySelector('[role="group"] button').click());
  assert.equal(input.getSnapshot().muted, false);
  assert.ok(document.querySelector('[aria-label="Enable exact voice commands"]'));
  const cases = [
    [{ recognizing: false, pendingTranscriptions: 1 }, 'Transcribing'],
    [{ recognizing: true, pendingTranscriptions: 1 }, 'Listening and transcribing'],
    [{ recognizing: true, pendingTranscriptions: 0 }, 'Listening'],
    [{ recognizing: false, pendingTranscriptions: 0 }, 'Waiting'],
    [{ muted: true, recognizing: true, pendingTranscriptions: 2 }, 'Waiting for command'],
    [{ recognizing: false, pendingTranscriptions: 0 }, 'Waiting for command'],
    [{ muted: false }, 'Waiting'],
  ];
  for (const [patch, expected] of cases) {
    await act(async () => input.patch(patch));
    const status = document.querySelector('[role="status"]');
    assert.equal(status.textContent, expected, JSON.stringify(patch));
    assert.doesNotMatch(status.textContent, /…|\.\.\./);
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(
      snapshot.microphone.listening,
      true,
      'shared status never changes microphone capture',
    );
  }
  input.cancelAutoSend();
});
