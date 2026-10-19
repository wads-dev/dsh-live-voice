// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.js';
import {
  MeetingToggle,
  MeetingBars,
} from '../src/modules/conversation/components/MeetingControls.js';
import { MeetingSourceSettings } from '../src/modules/settings/sections/conversation/MeetingSourceSettings.js';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { defaultSettings } from '../src/modules/core/settings.js';
import { styles } from '../src/styles/index.js';

async function fixture(t, initial = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const old = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const settings = {
    ...defaultSettings,
    recognitionEngine: 'whisper-http',
    attendeeBotName: 'Default helper',
  };
  const calls = [];
  const listeners = new Set();
  let state = {
    active: false,
    starting: false,
    participants: [],
    botId: '',
    joining: false,
    joinUncertain: false,
    hasBotControl: false,
    leaving: false,
    controlError: null,
    botState: '',
    ...initial,
  };
  const patch = (next) => {
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  };
  const credentials = new Map();
  const client = {
    credentialMetadata: async (origin) => ({ hasSavedKey: credentials.has(origin) }),
    removeCredential: async (origin) => {
      credentials.delete(origin);
      return { hasSavedKey: false };
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => state,
    start: async (config) => {
      calls.push(['connect', config]);
      if (config.apiKey) credentials.set(config.apiUrl, true);
      patch({ active: true, hasBotControl: true });
    },
    join: async (...args) => {
      calls.push(['join', ...args]);
      patch({ joining: true });
    },
    stop: async () => {
      calls.push(['disconnect']);
      patch({ active: false });
    },
    leave: async () => {
      calls.push(['leave']);
      patch({ controlError: 'leave-failed' });
    },
    releaseControl: async () => {
      calls.push(['release']);
      patch({ hasBotControl: false, controlError: 'control-released' });
    },
    rename() {},
    dispose: async () => {},
  };
  const meeting = new MeetingController({
    settings: () => settings,
    translate: (key) => key,
    composer: { getDraft: () => '', setDraft() {} },
    createSource: () => {
      throw Error('no real capture');
    },
  });
  meeting.attendee = client;
  const voice = { settings };
  const controller = { subscribe: () => () => {}, getSnapshot: () => voice };
  const root = createRoot(document.getElementById('root'));
  const save = [];
  const render = async (configuration = false) =>
    act(async () =>
      root.render(
        <LiveVoiceTranslationProvider>
          {configuration ? (
            <MeetingSourceSettings
              controller={{ attendee: client }}
              settings={settings}
              updateSettings={(next) => save.push(next)}
            />
          ) : (
            <>
              <MeetingToggle
                meeting={meeting}
                controller={controller}
                onToggle={() => calls.push(['shared'])}
              />
              <MeetingBars meeting={meeting} />
            </>
          )}
        </LiveVoiceTranslationProvider>,
      ),
    );
  t.after(async () => {
    await act(async () => {
      root.unmount();
      await meeting.dispose();
    });
    dom.window.close();
    Object.assign(globalThis, old);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  await render();
  const button = (text) =>
    [...document.querySelectorAll('button')].find(
      (node) => node.textContent === text || node.getAttribute('aria-label') === text,
    );
  const click = async (text) => {
    const node = button(text);
    assert.ok(node, text);
    await act(async () => node.click());
  };
  const input = async (node, text) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        node,
        text,
      );
      node.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
  const openMeet = async () => {
    await act(async () => document.querySelector('[aria-label="Meeting mode"]').click());
    const choice = button('Join Google Meet · experimental');
    if (choice.getAttribute('aria-expanded') !== 'true')
      await click('Join Google Meet · experimental');
  };
  return {
    settings,
    calls,
    client,
    credentials,
    patch,
    render,
    save,
    button,
    click,
    input,
    openMeet,
  };
}

test('meeting click and context actions never capture or join until an explicit selection', async (t) => {
  const f = await fixture(t);
  const trigger = document.querySelector('[aria-label="Meeting mode"]');
  await act(async () => trigger.click());
  assert.deepEqual(f.calls, []);
  assert.equal(
    document.querySelector('[role=dialog]').getAttribute('aria-label'),
    'Meeting actions',
  );
  await f.click('Share audio from a tab');
  assert.deepEqual(f.calls, [['shared']]);
  await act(async () =>
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  await act(async () =>
    trigger.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true })),
  );
  assert.ok(f.button('Share audio from a tab'));
  assert.ok(f.button('Join Google Meet · experimental'));
  assert.deepEqual(f.calls, [['shared']]);
});

test('Meet form connects without autojoin, uses an unsaved per-meeting name and clears credentials', async (t) => {
  const f = await fixture(t);
  await f.openMeet();
  assert.deepEqual(f.calls, []);
  await f.input(document.querySelector('input[type=url]'), 'https://meet.google.com/abc-defg-hij');
  const name = [...document.querySelectorAll('input')].find(
    (node) => node.value === 'Default helper',
  );
  await f.input(name, 'One meeting helper');
  assert.equal(f.button('Join meeting').disabled, true);
  assert.equal(
    document.querySelector('input[type=password]'),
    null,
    'no credential field in the quick menu',
  );
  assert.equal(
    document.querySelector('.dlv-attendee-quick [role=status]'),
    null,
    'no idle receiver status in quick UI',
  );
  await f.click('Configure Attendee connection');
  assert.equal(
    document.querySelector('.dlv-context-popover'),
    null,
    'quick popover closes before modal opens',
  );
  assert.equal(document.querySelector('dialog').open, true);
  assert.equal(document.querySelector('dialog').parentElement, document.body);
  assert.match(
    styles,
    /\.dlv-attendee-dialog\.dlv-settings\{width:420px;max-width:calc\(100vw - 24px\);max-height:calc\(100vh - 24px\);padding:18px;overflow:auto!important\}/,
    'specific dialog geometry overrides the generic Settings shell even when its CSS appears later',
  );
  await f.input(document.querySelector('input[type=password]'), 'fixture-only-key');
  await f.click('Connect to Attendee');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'connect');
  assert.equal(f.calls[0][1].apiKey, 'fixture-only-key');
  assert.equal(document.querySelector('input[type=password]'), null);
  await act(async () =>
    document
      .querySelector('dialog')
      .dispatchEvent(new window.Event('cancel', { cancelable: true })),
  );
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.activeElement.getAttribute('aria-label'), 'Meeting mode');
  await f.openMeet();
  assert.equal(
    document.querySelector('input[type=url]').value,
    'https://meet.google.com/abc-defg-hij',
    'configuration detour preserves the join draft',
  );
  assert.equal(f.button('Join meeting').disabled, false);
  await f.click('Join meeting');
  await f.click('Requesting entry…');
  assert.equal(
    document.querySelector('[aria-label="Join meeting"]')?.textContent || '',
    '',
    'confirmation uses an icon, not a large text CTA',
  );
  assert.deepEqual(f.calls[1], [
    'join',
    'https://meet.google.com/abc-defg-hij',
    'One meeting helper',
  ]);
  assert.equal(f.calls.length, 2, 'disabled repeated click never creates a second bot');
  assert.equal(f.settings.attendeeBotName, 'Default helper');
  assert.deepEqual(f.save, []);
});

test('default bot name is editable in Settings while disconnected and shared is the preferred source', async (t) => {
  const f = await fixture(t);
  await f.render(true);
  const field = [...document.querySelectorAll('input')].find(
    (node) => node.value === 'Default helper',
  );
  assert.ok(field);
  assert.match(field.closest('label').textContent, /Default bot name/);
  assert.equal(field.closest('details').open, false, 'meeting settings retain their disclosure');
  assert.equal(document.querySelector('input[type=password]'), null);
  assert.equal(f.button('Join meeting'), undefined);
  await f.input(field, 'New default');
  await act(async () => field.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })));
  assert.deepEqual(f.save, [{ attendeeBotName: 'New default' }]);
});

test('receiver failure preserves explicit Leave and retry; discarding control requires confirmation', async (t) => {
  const f = await fixture(t, { botId: 'bot_fixture', hasBotControl: true, active: false });
  assert.ok(f.button('Leave meeting'), 'Leave remains in composer dock without receiving audio');
  await f.openMeet();
  const leaves = [...document.querySelectorAll('button')].filter(
    (node) => node.textContent === 'Leave meeting',
  );
  assert.equal(leaves.length, 2, 'dock and operation panel share the same explicit action');
  await act(async () => leaves[0].click());
  assert.ok(f.button('Leave meeting'), 'failed Leave remains available for retry');
  assert.match(document.body.textContent, /Could not confirm the request to leave/);
  assert.equal(document.body.textContent.includes('leave-failed'), false);
  assert.equal(document.body.textContent.includes('joined'), false);
  await f.click('Discard bot control…');
  assert.equal(f.calls.filter(([name]) => name === 'release').length, 0);
  assert.match(document.body.textContent, /does not remove the bot/);
  await f.click('Discard control without leaving');
  assert.equal(f.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(f.button('Leave meeting'), undefined);
});

for (const code of [
  'control-unavailable',
  'control-expired',
  'control-released',
  'control-unknown',
]) {
  test('bot control failure is localized, never raw: ' + code, async (t) => {
    const f = await fixture(t, { botId: 'bot_fixture', controlError: code });
    assert.equal(document.body.textContent.includes(code), false);
    assert.match(document.body.textContent, /Attendee/);
    await f.openMeet();
    assert.equal(f.button('Leave meeting'), undefined);
  });
}

test('departure status requires an accepted Leave request, never a guessed upstream state', async (t) => {
  const f = await fixture(t, {
    botId: 'bot_fixture',
    hasBotControl: true,
    botState: 'fatal_error',
  });
  assert.match(document.body.textContent, /Meeting admission is not confirmed/);
  assert.doesNotMatch(document.body.textContent, /Departure requested/);
  await act(async () => f.patch({ botState: 'ended' }));
  assert.doesNotMatch(document.body.textContent, /Departure requested/);
  await act(async () => f.patch({ botState: '', leaveRequested: true }));
  assert.match(
    document.body.textContent,
    /Departure requested; removal from the meeting is not confirmed/,
  );
  await act(async () => f.patch({ leaveRequested: false, leaving: true }));
  assert.match(document.body.textContent, /Requesting departure/);
});

test('connection dialog cancellation clears only ephemeral key and never disconnects the client', async (t) => {
  const f = await fixture(t);
  await f.openMeet();
  await f.click('Configure Attendee connection');
  await f.input(document.querySelector('input[type=password]'), 'discard-me');
  await act(async () =>
    document
      .querySelector('dialog')
      .dispatchEvent(new window.Event('cancel', { cancelable: true })),
  );
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.save, []);
  await f.openMeet();
  await f.click('Configure Attendee connection');
  assert.equal(document.querySelector('input[type=password]').value, '');
});

test('Settings advanced connection reuses ephemeral credentials without preference persistence', async (t) => {
  const f = await fixture(t);
  await f.render(true);
  const details = [...document.querySelectorAll('details')].find(
    (node) => node.querySelector('summary')?.textContent === 'Connection settings',
  );
  assert.equal(document.querySelector('input[type=password]'), null);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  await f.input(document.querySelector('input[type=password]'), 'settings-fixture-key');
  assert.deepEqual(f.save, []);
  await f.click('Connect to Attendee');
  assert.equal(f.calls[0][0], 'connect');
  assert.equal(f.calls[0][1].apiKey, 'settings-fixture-key');
  assert.deepEqual(f.save, []);
  assert.equal(
    f.calls.some(([name]) => name === 'join'),
    false,
  );
});

test('Enter submit and rapid repeated confirmation create at most one bot while the request is pending', async (t) => {
  const f = await fixture(t, { active: true, hasBotControl: true });
  let settle;
  f.client.join = (...args) => {
    f.calls.push(['join', ...args]);
    return new Promise((resolve) => {
      settle = resolve;
    });
  };
  await f.openMeet();
  await f.input(document.querySelector('input[type=url]'), 'https://meet.google.com/abc-defg-hij');
  const form = document.querySelector('.dlv-attendee-quick > form');
  assert.equal(f.button('Join meeting').type, 'submit');
  assert.equal(f.button('Configure Attendee connection').type, 'button');
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    f.button('Join meeting').click();
  });
  assert.equal(f.calls.filter(([name]) => name === 'join').length, 1);
  await act(async () => settle());
});

test('connection errors remain visible in the separate dialog and quick form stays free of credentials', async (t) => {
  const f = await fixture(t);
  f.client.start = async () => {
    throw Error('private-provider-detail');
  };
  await f.openMeet();
  assert.equal(
    document.querySelector('input[type=url]').getAttribute('aria-label'),
    'Google Meet link',
  );
  assert.equal(document.querySelector('input[type=url]').placeholder, 'Google Meet link');
  await f.click('Configure Attendee connection');
  await f.input(document.querySelector('input[type=password]'), 'session-key');
  await f.click('Connect to Attendee');
  const dialog = document.querySelector('dialog');
  assert.match(dialog.querySelector('[role=alert]').textContent, /Receiver stopped/);
  assert.equal(document.body.textContent.includes('private-provider-detail'), false);
  assert.deepEqual(f.save, []);
});

test('Connect configures the key once; reopening and reconnecting uses host metadata without a browser secret', async (t) => {
  const f = await fixture(t);
  await f.openMeet();
  await f.click('Configure Attendee connection');
  await f.input(document.querySelector('input[type=password]'), 'synthetic-first-key');
  await f.click('Connect to Attendee');
  assert.equal(f.calls[0][1].apiKey, 'synthetic-first-key');
  assert.match(document.querySelector('dialog').textContent, /API key configured on this host/);
  assert.deepEqual(f.save, []);
  await f.click('Disconnect from Attendee');
  await act(async () => f.patch({ hasBotControl: false }));
  await act(async () =>
    document
      .querySelector('dialog')
      .dispatchEvent(new window.Event('cancel', { cancelable: true })),
  );
  await f.openMeet();
  await f.click('Configure Attendee connection');
  const field = document.querySelector('input[type=password]');
  assert.equal(field.value, '');
  assert.equal(field.placeholder, 'API key configured on this host');
  assert.equal(f.button('Connect to Attendee').disabled, false);
  assert.equal(document.body.textContent.includes('synthetic-first-key'), false);
  await f.click('Connect to Attendee');
  assert.equal(
    Object.hasOwn(f.calls[2][1], 'apiKey'),
    false,
    'empty field reuses host storage rather than sending an empty replacement',
  );
  assert.deepEqual(f.save, []);
});

test('saved-key removal is explicit and available while reception/control is active, without departure', async (t) => {
  const f = await fixture(t, { active: true, hasBotControl: true, botId: 'existing-bot' });
  f.credentials.set(f.settings.attendeeApiUrl, true);
  await f.render(true);
  const details = [...document.querySelectorAll('details')].find(
    (node) => node.querySelector('summary')?.textContent === 'Connection settings',
  );
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  await f.click('Remove saved API key');
  assert.equal(
    f.credentials.has(f.settings.attendeeApiUrl),
    true,
    'opening confirmation is not deletion',
  );
  assert.match(document.querySelector('[role=group]').textContent, /does not request departure/);
  await f.click('Cancel');
  assert.equal(f.credentials.has(f.settings.attendeeApiUrl), true);
  await f.click('Remove saved API key');
  await f.click('Remove saved key');
  assert.equal(f.credentials.has(f.settings.attendeeApiUrl), false);
  assert.equal(f.client.getSnapshot().active, true);
  assert.equal(f.client.getSnapshot().hasBotControl, true);
  assert.deepEqual(f.calls, []);
  assert.match(document.body.textContent, /API key not configured on this host/);
});

test('origin changes immediately clear drafts and block Connect until current-origin metadata, ignoring late old replies', async (t) => {
  const f = await fixture(t);
  let resolveOld;
  let resolveNew;
  f.client.credentialMetadata = (origin) =>
    new Promise((resolve) => {
      if (origin.endsWith(':8000')) resolveOld = resolve;
      else resolveNew = resolve;
    });
  await f.render(true);
  const details = [...document.querySelectorAll('details')].find(
    (node) => node.querySelector('summary')?.textContent === 'Connection settings',
  );
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  await f.input(document.querySelector('input[type=password]'), 'old-origin-draft');
  assert.equal(f.button('Connect to Attendee').disabled, true);
  f.settings.attendeeApiUrl = 'http://localhost:9000';
  await f.render(true);
  assert.equal(document.querySelector('input[type=password]').value, '');
  assert.equal(f.button('Connect to Attendee').disabled, true);
  await act(async () => resolveOld({ hasSavedKey: true }));
  assert.equal(
    f.button('Connect to Attendee').disabled,
    true,
    'old origin must not enable connection',
  );
  await act(async () => resolveNew({ hasSavedKey: false }));
  assert.equal(f.button('Connect to Attendee').disabled, true, 'new origin has no saved key');
  await f.input(document.querySelector('input[type=password]'), 'new-origin-draft');
  assert.equal(f.button('Connect to Attendee').disabled, false);
  assert.deepEqual(f.calls, []);
});

test('a failed connection refreshes saved metadata, clears the transient draft and keeps the connection error visible', async (t) => {
  const f = await fixture(t);
  f.client.start = async (config) => {
    f.credentials.set(config.apiUrl, true);
    f.patch({ error: 'Could not verify the Attendee connection.' });
  };
  await f.openMeet();
  await f.click('Configure Attendee connection');
  await f.input(document.querySelector('input[type=password]'), 'synthetic-rejected-key');
  await f.click('Connect to Attendee');
  assert.equal(document.querySelector('input[type=password]').value, '');
  assert.match(document.body.textContent, /API key configured on this host/);
  assert.match(document.querySelector('[role=alert]').textContent, /Could not verify/);
  assert.equal(
    f.button('Connect to Attendee').disabled,
    false,
    'retry can use the stored key without redigitating',
  );
  assert.deepEqual(f.save, []);
});

for (const [code, expected] of [
  ['credential-missing', /No API key is configured/],
  ['credential-storage-invalid', /Saved-key storage is invalid/],
  ['credential-storage-unavailable', /Saved-key storage is unavailable/],
])
  test(
    'saved-key metadata failure is localized and never enables a blind connection: ' + code,
    async (t) => {
      const f = await fixture(t);
      f.client.credentialMetadata = async () => {
        throw Error(code);
      };
      await f.openMeet();
      await f.click('Configure Attendee connection');
      assert.match(document.querySelector('dialog [role=alert]').textContent, expected);
      assert.equal(document.body.textContent.includes(code), false);
      await f.input(document.querySelector('input[type=password]'), 'not-persisted-on-error');
      assert.equal(f.button('Connect to Attendee').disabled, true);
      assert.deepEqual(f.save, []);
    },
  );

test('editing the actual API origin before blur blocks old-origin Connect and credential deletion immediately', async (t) => {
  const f = await fixture(t);
  f.credentials.set(f.settings.attendeeApiUrl, true);
  let removed = 0;
  f.client.removeCredential = async () => {
    removed++;
    return { hasSavedKey: false };
  };
  await f.render(true);
  const details = [...document.querySelectorAll('details')].find(
    (node) => node.querySelector('summary')?.textContent === 'Connection settings',
  );
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  await f.input(document.querySelector('input[type=password]'), 'old-origin-unsaved-draft');
  await f.click('Remove saved API key');
  const confirm = f.button('Remove saved key');
  const connect = f.button('Connect to Attendee');
  const origin = [...document.querySelectorAll('input')].find(
    (node) => node.value === f.settings.attendeeApiUrl,
  );
  await act(async () => {
    origin.value = 'http://localhost:9000';
    origin.dispatchEvent(new window.Event('input', { bubbles: true }));
    connect.click();
    confirm.click();
  });
  assert.equal(document.querySelector('input[type=password]').value, '');
  assert.equal(f.button('Connect to Attendee').disabled, true);
  assert.equal(f.button('Remove saved API key'), undefined);
  assert.equal(f.button('Remove saved key'), undefined);
  assert.equal(removed, 0, 'same-tick stale confirmation must be guarded before React rerenders');
  assert.deepEqual(f.calls, [], 'no old-origin connection before blur/metadata');
  assert.deepEqual(f.save, [], 'typing the origin does not save preferences before blur');
  assert.equal(f.credentials.has(f.settings.attendeeApiUrl), true);
});
