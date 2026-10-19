// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.js';
import { MeetingSourceSettings } from '../src/modules/settings/sections/conversation/MeetingSourceSettings.js';
import { AttendeeControls } from '../src/modules/conversation/components/AttendeeControls.js';
import { MeetingBars } from '../src/modules/conversation/components/MeetingControls.js';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
import { defaultSettings } from '../src/modules/core/settings.js';
import { styles } from '../src/styles/index.js';

test('Attendee configuration hides connection details while composer operations edit participants; three UUIDs render independent bars with visible names before their waves', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://dsh.local/',
    pretendToBeVisual: true,
  });
  const old = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root'));
  const meeting = new MeetingController({
    settings: () => defaultSettings,
    translate: (k) => k,
    composer: { getDraft: () => '', setDraft() {} },
    createSource: () => {
      throw Error('unused');
    },
  });
  meeting.attendee = new AttendeeClient(
    meeting,
    () => {},
    (k) => k,
  );
  meeting.attendee.credentialMetadata = async () => ({ hasSavedKey: false });
  const settings = { ...defaultSettings, meetingSource: 'attendee' };
  const saved = [];
  const longName =
    'A participant with a very long full display name that must not push controls out of the bar';
  t.after(async () => {
    await act(async () => root.unmount());
    await meeting.dispose();
    dom.window.close();
    Object.assign(globalThis, old);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const render = () => (
    <LiveVoiceTranslationProvider>
      <MeetingSourceSettings
        controller={{ attendee: meeting.attendee }}
        settings={settings}
        updateSettings={(patch) => saved.push(patch)}
      />
      <AttendeeControls
        client={meeting.attendee}
        settings={{ ...settings, recognitionEngine: 'whisper-http' }}
      />
      <MeetingBars meeting={meeting} />
    </LiveVoiceTranslationProvider>
  );
  await act(async () => root.render(render()));
  assert.equal(
    document.querySelector('input[type=password]'),
    null,
    'quick UI and collapsed Settings contain no mounted credential draft',
  );
  const connection = [...document.querySelectorAll('details')].find(
    (node) => node.querySelector('summary')?.textContent === 'Connection settings',
  );
  await act(async () => {
    connection.open = true;
    connection.dispatchEvent(new window.Event('toggle'));
  });
  const passwords = [...document.querySelectorAll('input[type=password]')];
  assert.equal(passwords.length, 1);
  assert.match(passwords[0].closest('label').textContent, /API key/);
  assert.equal(document.querySelector('.dlv-attendee-controls p'), null);
  const api = [...document.querySelectorAll('.dlv-attendee-controls input')].find(
    (input) => input.value === settings.attendeeApiUrl,
  );
  await act(async () => {
    api.value = 'http://127.0.0.1:8000';
    api.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.deepEqual(saved, []);
  await act(async () =>
    api.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true })),
  );
  assert.deepEqual(saved, [{ attendeeApiUrl: 'http://127.0.0.1:8000' }]);
  await act(async () => {
    for (const [source, name] of [
      ['attendee:1', 'First'],
      ['attendee:2', 'Second'],
      ['attendee:3', longName],
    ])
      meeting.input(source).patch({ listening: true, conversation: true });
    meeting.attendee.patch({
      active: true,
      ingestUrl: 'wss://receiver.example/?token=secret',
      participants: [
        { source: 'attendee:1', name: 'First', blocks: ['active'] },
        { source: 'attendee:2', name: 'Second', blocks: ['active'] },
        { source: 'attendee:3', name: longName, blocks: ['active'] },
      ],
    });
  });
  assert.equal(document.querySelectorAll('.dlv-meeting-bars [role=group]').length, 3);
  const names = [...document.querySelectorAll('.dlv-meeting-bars .dlv-source-name')];
  assert.deepEqual(
    names.map((node) => node.textContent),
    ['First', 'Second', longName],
  );
  for (const name of names) {
    assert.equal(name.previousElementSibling.tagName, 'BUTTON', 'name follows the source icon');
    assert.equal(
      name.title,
      name.textContent,
      'full name remains available when visually truncated',
    );
    assert.equal(name.closest('[role=group]').getAttribute('aria-label'), name.textContent);
    const wave = name.parentElement.querySelector('.dlv-wave');
    assert.ok(name.compareDocumentPosition(wave) & window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.equal(name.hasAttribute('hidden'), false);
    assert.equal(name.getAttribute('aria-hidden'), null);
  }
  // JSDOM does not lay out flexboxes: enforce the scoped responsive CSS contract here;
  // real narrow-viewport geometry is checked separately in the running GUI.
  assert.match(
    styles,
    /\.dlv-source-name\{[^}]*min-width:0;[^}]*max-width:clamp\(64px,18vw,144px\);[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap/,
  );
  assert.match(styles, /\.dlv-pill:has\(>\.dlv-source-name\)>\.dlv-wave\{min-width:0\}/);
  assert.match(styles, /\.dlv-pill:has\(>\.dlv-source-name\)>button\{flex-shrink:0\}/);
  assert.match(styles, /@media\(max-width:480px\)\{[^\n]*\.dlv-pill\{flex-wrap:wrap\}/);
  assert.equal(document.body.textContent.includes('token=secret'), false);
  assert.equal(document.querySelector('input[readonly]'), null);
  assert.ok(
    [...document.querySelectorAll('button')].some(
      (button) => button.textContent === 'Disconnect meeting',
    ),
  );
  await act(async () =>
    meeting.attendee.patch({ active: false, starting: false, hasBotControl: false, botId: '' }),
  );
  assert.ok(
    [...document.querySelectorAll('button')].some((button) => button.textContent === 'Connect'),
  );
  assert.ok(document.body.textContent.includes('Meeting participants'));
  assert.equal(
    [...document.querySelectorAll('input')].filter((input) =>
      ['First', 'Second', longName].includes(input.value),
    ).length,
    3,
  );
  const joins = [];
  meeting.attendee.connectMeeting = async (url, name) => joins.push([url, name]);
  const link = document.querySelector('input[type=url]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(
      link,
      'https://meet.google.com/abc-defg-hij',
    );
    link.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  const join = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Connect',
  );
  await act(async () => join.click());
  assert.deepEqual(joins, [['https://meet.google.com/abc-defg-hij', 'DSH Live Voice']]);
  const person = [...document.querySelectorAll('input')].find((input) => input.value === 'First');
  const renamed = [];
  meeting.attendee.rename = (...args) => renamed.push(args);
  await act(async () => {
    person.value = 'My colleague';
    person.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.deepEqual(renamed, []);
  await act(async () =>
    person.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true })),
  );
  assert.deepEqual(renamed, [['attendee:1', 'My colleague']]);
  await act(async () =>
    meeting.attendee.patch({
      participants: meeting.attendee
        .getSnapshot()
        .participants.map((participant) =>
          participant.source === 'attendee:1'
            ? { ...participant, name: 'My colleague' }
            : participant,
        ),
    }),
  );
  assert.deepEqual(
    [...document.querySelectorAll('.dlv-meeting-bars .dlv-source-name')].map(
      (node) => node.textContent,
    ),
    ['My colleague', 'Second', longName],
    'alias refresh updates the visible name without recreating or merging sources',
  );
  await act(async () => document.querySelector('.dlv-meeting-bars [role=group] button').click());
  assert.equal(meeting.input('attendee:1').getSnapshot().muted, true);
  assert.equal(meeting.input('attendee:2').getSnapshot().muted, false);
});
