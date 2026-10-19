// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { apply } from '../src/app/client/apply.tsx';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';

async function fixture(t, settings = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const restore = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restore.push(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  dom.window.speechSynthesis = new dom.window.EventTarget();
  Object.defineProperty(dom.window.navigator, 'mediaDevices', {
    value: new dom.window.EventTarget(),
  });
  // No Attendee, microphone, model download or provider requests are allowed.
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, '/api/dsh-live-voice/settings');
    return Response.json({
      ok: true,
      value: {
        sendingMode: 'manual',
        voiceCommandsEnabled: false,
        recognitionFilterEnabled: false,
        timestampsEnabled: false,
        sharedTimestampsEnabled: false,
        ...settings,
      },
    });
  });
  let microphone, meeting;
  t.mock.method(VoiceCoordinator.prototype, 'refreshCapabilities', async function () {
    microphone = this;
  });
  const applySettings = MeetingController.prototype.applySettings;
  t.mock.method(MeetingController.prototype, 'applySettings', function (value) {
    meeting = this;
    return applySettings.call(this, value);
  });
  const slots = new Map();
  const cleanup = [];
  apply({
    connection: {},
    uiSession: {},
    uiConversation: {
      binding: () => ({
        target: () => ({ getSnapshot: () => ({ nodes: new Map() }), subscribe: () => () => {} }),
      }),
    },
    effect: (fn) => cleanup.push(fn()),
    slots: {
      inject: (_name, fn) => fn(),
      register: ({ name }, component) => slots.set(name, component),
    },
  });
  const root = createRoot(document.getElementById('root'));
  const writes = [];
  const Buttons = slots.get('conversation.input.right');
  const render = (draft = '', sessionId = 'current') =>
    act(async () => {
      root.render(
        React.createElement(Buttons, {
          sessionId,
          input: { draft },
          inputActions: { setDraft: (text) => writes.push([sessionId, text]) },
        }),
      );
    });
  t.after(async () => {
    await act(async () => {
      root.unmount();
      for (const dispose of cleanup.reverse()) dispose?.();
    });
    dom.window.close();
    for (const reset of restore) reset();
  });
  await render();
  assert.ok(meeting);
  await act(async () => microphone.patch({ listening: true }));
  return { meeting, microphone, writes, render };
}

for (const receiverActive of [true, false]) {
  for (const participantTimestamps of [false, true]) {
    test(
      'Attendee A → microphone → A preserves attribution with shared audio off and microphone timestamps off; participant timestamps ' +
        participantTimestamps +
        '; receiver active ' +
        receiverActive,
      async (t) => {
        const f = await fixture(t, { sharedTimestampsEnabled: participantTimestamps });
        const source = 'attendee:bot_fixture:participant-a';
        const participant = f.meeting.input(source);
        await act(async () => {
          f.meeting.attendee.patch({ active: true });
          f.meeting.transcript.setLabel(source, 'Alice');
          f.meeting.transcript.setActive(source, true);
          participant.patch({ listening: true });
        });
        assert.equal(f.meeting.getSnapshot().shared.listening, false);
        assert.equal(f.microphone.getSnapshot().timestamps, false);
        const onset = new Date(2026, 9, 18, 14, 30, 0).getTime();
        const stamp = participantTimestamps ? '[2026/10/18 14:30:00] ' : '';
        await act(async () => participant.onResult({ final: 'First proposal', startedAt: onset }));
        assert.equal(f.writes.at(-1)[1], stamp + 'Alice: First proposal');
        if (!receiverActive) {
          // Pending participant work may outlive the receiving connection.
          await act(async () => {
            f.meeting.attendee.patch({ active: false });
            f.meeting.patch(source, { listening: false, pending: 1 });
          });
        }
        // A new manual publication must remain authoritative, not an old voice snapshot.
        const manual = f.writes.at(-1)[1] + ' (manual note)';
        await f.render(manual);
        await act(async () => f.microphone.onResult({ final: 'My response', startedAt: onset }));
        assert.equal(f.writes.at(-1)[1], manual + '\n\nMe: My response');
        await act(async () => {
          f.meeting.patch(source, { listening: true, pending: 0 });
          participant.onResult({ final: 'Follow-up proposal', startedAt: onset });
        });
        assert.equal(
          f.writes.at(-1)[1],
          manual + '\n\nMe: My response\n\n' + stamp + 'Alice: Follow-up proposal',
        );
        await act(async () => f.microphone.onResult({ interim: 'Uncommitted hypothesis' }));
        assert.equal(f.writes.length, 3, 'interim recognition never writes composer text');
        const oldMicrophone = f.microphone;
        await f.render('Other draft', 'other');
        const count = f.writes.length;
        await act(async () => oldMicrophone.onResult({ final: 'Stale microphone result' }));
        assert.equal(
          f.writes.length,
          count,
          'old composer recognition never writes into the new chat',
        );
      },
    );
  }
}

test('microphone-only dictation keeps its unlabelled append-only fallback', async (t) => {
  const f = await fixture(t);
  await f.render('Manual draft');
  await act(async () => f.microphone.onResult({ final: 'Voice addition' }));
  assert.deepEqual(f.writes, [['current', 'Manual draft Voice addition']]);
});
