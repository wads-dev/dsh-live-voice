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
    saveCredential: async (origin, key) => {
      calls.push(['save-key', origin]);
      credentials.set(origin, true);
      return { hasSavedKey: true };
    },
    connectMeeting: async (...args) => {
      calls.push(['connect-meeting', ...args]);
      patch({ joining: true });
    },
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
    disconnectMeeting: async () => {
      calls.push(['disconnect-meeting']);
      patch({
        active: false,
        starting: false,
        hasBotControl: false,
        botId: '',
        botState: '',
        joining: false,
        joinUncertain: false,
        leaving: false,
        leaveRequested: false,
        controlError: null,
        error: null,
        participants: [],
      });
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
  const openSettings = async () => {
    await render(true);
    const details = [...document.querySelectorAll('details')].find(
      (node) => node.querySelector('summary')?.textContent === 'Connection settings',
    );
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new window.Event('toggle'));
    });
  };
  const openMeet = async () => {
    await act(async () => document.querySelector('.dlv-composer-toggle').click());
    const choice = button('Join Google Meet · experimental');
    if (choice && choice.getAttribute('aria-expanded') !== 'true')
      await click('Join Google Meet · experimental');
  };
  return {
    settings,
    openSettings,
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

test('one Disconnect stops/reset the meeting without a confirmation and allows connecting again', async (t) => {
  const f = await fixture(t, {
    active: false,
    botId: 'old-bot',
    hasBotControl: true,
    error: 'Receiver stopped',
  });
  await f.openMeet();
  assert.equal(document.querySelectorAll('.dlv-attendee-quick button').length, 1);
  assert.equal(f.button('Discard bot control…'), undefined);
  await f.click('Disconnect meeting');
  assert.deepEqual(f.calls, [['disconnect-meeting']]);
  assert.equal(document.querySelector('.dlv-meeting-confirm'), null);
  assert.equal(f.button('Disconnect meeting'), undefined);
  assert.ok(document.querySelector('input[type=url]'));
  await f.input(document.querySelector('input[type=url]'), 'https://meet.google.com/abc-defg-hij');
  await f.click('Connect');
  assert.equal(f.calls[1][0], 'connect-meeting');
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
    assert.match(
      document.querySelector('.dlv-composer-toggle').getAttribute('aria-label'),
      /Attendee/,
    );
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
  await f.openMeet();
  assert.match(
    document.querySelector('.dlv-meeting-menu').textContent,
    /Meeting admission is not confirmed/,
  );
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
  assert.equal(f.button('Save API key').disabled, true);
  f.settings.attendeeApiUrl = 'http://localhost:9000';
  await f.render(true);
  assert.equal(document.querySelector('input[type=password]').value, '');
  assert.equal(f.button('Save API key').disabled, true);
  await act(async () => resolveOld({ hasSavedKey: true }));
  assert.equal(f.button('Save API key').disabled, true, 'old origin must not enable connection');
  await act(async () => resolveNew({ hasSavedKey: false }));
  assert.equal(f.button('Save API key').disabled, true, 'new origin has no saved key');
  await f.input(document.querySelector('input[type=password]'), 'new-origin-draft');
  assert.equal(f.button('Save API key').disabled, false);
  assert.deepEqual(f.calls, []);
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
      await f.openSettings();
      assert.match(
        document.querySelector('.dlv-attendee-connection [role=alert]').textContent,
        expected,
      );
      assert.equal(document.body.textContent.includes(code), false);
      await f.input(document.querySelector('input[type=password]'), 'not-persisted-on-error');
      assert.equal(f.button('Save API key').disabled, true);
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
  const connect = f.button('Replace API key');
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
  assert.equal(f.button('Replace API key').disabled, true);
  assert.equal(f.button('Remove saved API key'), undefined);
  assert.equal(f.button('Remove saved key'), undefined);
  assert.equal(removed, 0, 'same-tick stale confirmation must be guarded before React rerenders');
  assert.deepEqual(f.calls, [], 'no old-origin connection before blur/metadata');
  assert.deepEqual(f.save, [], 'typing the origin does not save preferences before blur');
  assert.equal(f.credentials.has(f.settings.attendeeApiUrl), true);
});

for (const [name, state, expected] of [
  [
    'unknown admission',
    { botId: 'active', hasBotControl: true },
    /Meeting admission is not confirmed/,
  ],
  ['leaving', { botId: 'active', hasBotControl: true, leaving: true }, /Requesting departure/],
  [
    'departure accepted',
    { botId: 'active', hasBotControl: true, leaveRequested: true },
    /Departure requested/,
  ],
  [
    'failed reception and leave',
    {
      botId: 'active',
      hasBotControl: true,
      controlError: 'leave-failed',
      error: 'Receiver transport failed',
    },
    /Could not confirm the request to leave/,
  ],
  [
    'uncertain creation',
    { joinUncertain: true, hasBotControl: true },
    /join result may be unknown/i,
  ],
  [
    'expired known bot',
    { botId: 'old', hasBotControl: false, controlError: 'control-expired' },
    /expired/i,
  ],
])
  test(
    'active meeting has one direct compact control surface, never a floating dock: ' + name,
    async (t) => {
      const f = await fixture(t, state);
      assert.equal(document.querySelector('.dlv-meeting-bars'), null);
      assert.equal(
        document.querySelector('[role=alert]'),
        null,
        'closed menu has no loose raw alerts',
      );
      assert.equal(f.button('Leave meeting'), undefined);
      const trigger = document.querySelector('.dlv-composer-toggle');
      if (state.error || state.controlError || state.joinUncertain) {
        assert.equal(trigger.dataset.meetingError, 'true');
        assert.match(trigger.getAttribute('aria-label'), /Meeting mode: /);
        assert.match(trigger.title, /Meeting actions: /);
        assert.match(styles, /data-meeting-error="true".*:after.*width:6px/);
      }
      await act(async () => trigger.click());
      const menu = document.querySelector('.dlv-meeting-menu');
      assert.ok(menu);
      assert.match(menu.textContent, expected);
      assert.equal(
        f.button('Join Google Meet · experimental'),
        undefined,
        'active controls are not hidden behind a Join selector',
      );
      assert.equal(
        menu.querySelector('input[type=url]'),
        null,
        'active/uncertain meeting has no second join form',
      );
      assert.ok(f.button('Share audio from a tab'), 'independent shared capture remains available');
      const expectedLeave = true;
      const buttons = [...menu.querySelectorAll('button')].filter(
        (node) => node.textContent === 'Disconnect meeting',
      );
      assert.equal(buttons.length, expectedLeave ? 1 : 0);
      assert.equal(buttons[0].disabled, false, 'disconnect also resets stale or pending states');
      if (state.error)
        assert.equal(
          [...menu.querySelectorAll('[role=alert]')].filter((node) =>
            node.textContent.startsWith(state.error),
          ).length,
          1,
        );
      assert.deepEqual(f.calls, [], 'opening and rendering never invokes a meeting operation');
      await act(async () =>
        document.dispatchEvent(
          new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      );
      assert.equal(document.querySelector('.dlv-context-popover'), null);
      assert.equal(document.activeElement, trigger, 'Escape returns focus to the meeting control');
      assert.equal(f.button('Leave meeting'), undefined);
      assert.equal(document.querySelector('.dlv-meeting-bars'), null);
    },
  );

test('Meet menu contains only URL and text Connect, uses saved Settings name and performs no configuration operations', async (t) => {
  const f = await fixture(t);
  await f.openMeet();
  const menu = document.querySelector('.dlv-meeting-menu');
  assert.equal(menu.querySelectorAll('input').length, 1);
  assert.equal(menu.querySelector('input').type, 'url');
  assert.equal(menu.querySelector('[type=password]'), null);
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(f.button('Configure Attendee connection'), undefined);
  assert.equal(f.button('Connect to Attendee'), undefined);
  assert.equal(f.button('Disconnect from Attendee'), undefined);
  assert.equal(f.button('Connect').disabled, true);
  await f.input(menu.querySelector('input'), 'https://meet.google.com/abc-defg-hij');
  assert.equal(f.button('Connect').textContent, 'Connect');
  await f.click('Connect');
  assert.deepEqual(f.calls, [
    [
      'connect-meeting',
      'https://meet.google.com/abc-defg-hij',
      'Default helper',
      { apiUrl: f.settings.attendeeApiUrl, ingressUrl: f.settings.attendeeIngressUrl },
    ],
  ]);
  assert.deepEqual(f.save, []);
});

test('Settings saves and replaces the key without receiver operations, leaves input empty on remount and never stores browser preferences', async (t) => {
  const f = await fixture(t);
  await f.openSettings();
  assert.equal(f.button('Connect to Attendee'), undefined);
  assert.equal(f.button('Disconnect from Attendee'), undefined);
  const field = document.querySelector('input[type=password]');
  await f.input(field, 'synthetic-configured-key');
  await f.click('Save API key');
  assert.equal(field.value, '');
  assert.match(document.body.textContent, /API key configured on this host/);
  await f.input(field, 'synthetic-replacement-key');
  await f.click('Replace API key');
  assert.deepEqual(
    f.calls.map((x) => x[0]),
    ['save-key', 'save-key'],
  );
  assert.deepEqual(f.save, []);
  await f.render(false);
  await f.openSettings();
  assert.equal(document.querySelector('input[type=password]').value, '');
  assert.equal(
    document.querySelector('input[type=password]').placeholder,
    'API key configured on this host',
  );
  assert.equal(f.button('Replace API key').disabled, true, 'blank is not replacement or removal');
  assert.equal(document.body.textContent.includes('synthetic-'), false);
});

test('one explicit Enter or rapid repeated Connect uses one orchestration while pending', async (t) => {
  const f = await fixture(t);
  let done;
  f.client.connectMeeting = (...args) => {
    f.calls.push(['connect-meeting', ...args]);
    return new Promise((r) => (done = r));
  };
  await f.openMeet();
  await f.input(document.querySelector('input[type=url]'), 'https://meet.google.com/abc-defg-hij');
  const form = document.querySelector('form'),
    button = f.button('Connect');
  assert.equal(button.type, 'submit');
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    button.click();
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(f.calls.length, 1);
  await act(async () => done());
});

test('missing saved configuration gives a short Settings path without opening a technical form', async (t) => {
  const f = await fixture(t);
  f.client.connectMeeting = async () =>
    f.patch({ error: 'No API key is configured for this API origin. Enter it once and Connect.' });
  await f.openMeet();
  await f.input(document.querySelector('input[type=url]'), 'https://meet.google.com/abc-defg-hij');
  await f.click('Connect');
  assert.match(
    document.querySelector('[role=alert]').textContent,
    /Settings → Live Voice → Conversation → Meeting mode/,
  );
  assert.equal(document.querySelector('input[type=password]'), null);
  assert.equal(document.querySelector('dialog'), null);
  assert.deepEqual(f.save, []);
});

for (const stale of [
  { botId: 'old', hasBotControl: false, controlError: 'control-released' },
  { botId: 'expired', hasBotControl: false, controlError: 'control-expired' },
  { joinUncertain: true, hasBotControl: false },
])
  test(
    'legacy or uncertain control resets in one click without a discard step: ' +
      JSON.stringify(stale),
    async (t) => {
      const f = await fixture(t, stale);
      await f.openMeet();
      assert.ok(f.button('Disconnect meeting'));
      assert.equal(f.button('Discard bot control…'), undefined);
      await f.click('Disconnect meeting');
      assert.ok(document.querySelector('input[type=url]'));
      assert.deepEqual(f.calls, [['disconnect-meeting']]);
      assert.equal(document.querySelector('.dlv-meeting-confirm'), null);
    },
  );

test('disconnect warning is nonblocking and does not hide the idle URL form or keep the button pending', async (t) => {
  const f = await fixture(t, { botId: 'old', hasBotControl: true, active: true });
  let finish;
  f.client.disconnectMeeting = () => {
    f.calls.push(['disconnect-meeting']);
    f.patch({
      botId: '',
      hasBotControl: false,
      active: false,
      controlError: null,
      error: 'Remote departure was not confirmed.',
    });
    return new Promise((r) => (finish = r));
  };
  await f.openMeet();
  const button = f.button('Disconnect meeting');
  await act(async () => {
    button.click();
    button.click();
  });
  assert.equal(f.calls.length, 1);
  assert.ok(document.querySelector('input[type=url]'));
  assert.equal(f.button('Disconnect meeting'), undefined);
  assert.match(
    document.querySelector('[role=alert]').textContent,
    /Remote departure was not confirmed/,
  );
  await f.input(document.querySelector('input[type=url]'), 'https://meet.google.com/abc-defg-hij');
  assert.equal(f.button('Connect').disabled, false);
  await f.click('Connect');
  assert.equal(f.calls[1][0], 'connect-meeting');
  await act(async () => finish());
});

test('a control warning without ownership or bot identity does not freeze the active branch', async (t) => {
  const f = await fixture(t, { controlError: 'control-released' });
  await f.openMeet();
  assert.ok(document.querySelector('input[type=url]'));
  assert.equal(f.button('Disconnect meeting'), undefined);
  assert.equal(f.button('Discard bot control…'), undefined);
  assert.equal(document.querySelector('.dlv-meeting-active-title'), null);
});
