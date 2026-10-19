// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createConversationComponents } from '../src/modules/conversation/components/createConversationComponents.tsx';
import { createLiveVoiceSettings } from '../src/modules/settings/components/createLiveVoiceSettings.tsx';
import { RecordingSettings } from '../src/modules/settings/sections/recognition/RecordingSettings.tsx';
import { withAppLanguage } from '../src/app/client/i18n/index.ts';
import { normalizeSettings } from '../src/modules/core/settings.ts';
import { CURRENT_VERSION } from '../src/modules/settings/services/releases.ts';
const [major, minor, patch] = CURRENT_VERSION.split('.').map(Number);
const NEXT_RELEASE_VERSION = `${major}.${minor}.${patch + 1}`;
const EN_SNAPSHOT = Object.freeze({ active: 'en', revision: 0 });
const EN_LOCALE = Object.freeze({ subscribe: () => () => {}, getSnapshot: () => EN_SNAPSHOT });
test('mounted voice UI exposes controls, distinct states, and capability failures', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  dom.window.fetch = async () => ({
    ok: true,
    json: async () => ({
      tag_name: 'v' + NEXT_RELEASE_VERSION,
      html_url:
        'https://github.com/victorwads/dsh-live-voice/releases/tag/v' + NEXT_RELEASE_VERSION,
    }),
  });
  const callbacks = new Set();
  const calls = [];
  let state = {
    conversation: false,
    listening: false,
    recognizing: false,
    starting: false,
    speaking: false,
    paused: false,
    settings: {
      engine: 'browser',
      recognitionEngine: 'browser',
      recognitionProcessLocally: true,
      recognitionAutoInstall: true,
      voiceDetectionPreset: 'natural',
      recognitionMaxUtteranceSeconds: 60,
      lang: 'pt-BR',
      mode: 'speaker',
      rate: 1,
    },
    capabilities: {
      browser: { supported: true, pause: true, resume: true },
      say: { supported: false },
      recognition: { supported: true },
      capture: { supported: true, permission: 'granted' },
    },
  };
  const controller = {
    subscribe: (cb) => {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    getSnapshot: () => state,
    meter: { level: () => 0 },
    startConversation: () => calls.push('conversation'),
    stopConversationInput: () => calls.push('end'),
    takeMicrophone: () => calls.push('conversation'),
    endConversation: () => calls.push('end'),
    stopSpeech: () => calls.push('stop'),
    skipSpeechSegment: () => calls.push('next'),
    resumeSpeech: () => calls.push('resume'),
    speak: (text) => calls.push(['speak', text]),
    updateSettings: (value) => {
      calls.push(['settings', value]);
      state = { ...state, settings: normalizeSettings({ ...state.settings, ...value }) };
      callbacks.forEach((cb) => cb());
    },
    clearError: () => calls.push('clear'),
  };
  const { MicrophoneButtons, RecordingBar } = createConversationComponents(React);
  const SettingsPanel = withAppLanguage(createLiveVoiceSettings(), EN_LOCALE);
  const root = createRoot(document.getElementById('root'));
  const click = (label) => document.querySelector('[aria-label="' + label + '"]').click();
  try {
    await act(async () =>
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(MicrophoneButtons, { controller }),
          React.createElement(RecordingBar, { controller }),
          React.createElement(SettingsPanel, { controller, onClose: () => calls.push('close') }),
        ),
      ),
    );
    const microphoneButtons = document.querySelectorAll('.dlv-mic');
    assert.equal(microphoneButtons.length, 1, 'only the conversation launcher is shown');
    assert.equal(microphoneButtons[0].getAttribute('aria-label'), 'Start voice conversation');
    assert.equal(
      microphoneButtons[0].querySelector('path').getAttribute('d'),
      'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8',
      'conversation launcher uses the microphone icon',
    );
    await act(async () => click('Start voice conversation'));
    assert.deepEqual(calls, ['conversation']);
    assert.equal(document.querySelector('[aria-label="Voice controls"]'), null);
    assert.equal(document.querySelector('option[value=say]').disabled, false);
    const versionBadges = document.querySelector('[aria-label="Version information"]');
    assert.ok(versionBadges);
    const badgeImages = [...versionBadges.querySelectorAll('.dlv-shields-badge img')];
    assert.equal(badgeImages.length, 2);
    assert.equal(badgeImages[0].src, 'https://cdn.simpleicons.org/npm/white');
    assert.equal(badgeImages[0].alt, '');
    assert.equal(badgeImages[0].parentElement.title, `DSH Live Voice v${CURRENT_VERSION}`);
    assert.equal(badgeImages[0].parentElement.textContent, `v${CURRENT_VERSION}`);
    assert.equal(badgeImages[1].src, 'https://cdn.simpleicons.org/deepseek/white');
    assert.equal(badgeImages[1].alt, '');
    assert.equal(badgeImages[1].parentElement.title, 'Compatible with DSH v0.2.1-rc.2');
    assert.equal(badgeImages[1].parentElement.textContent, 'v0.2.1-rc.2');
    assert.equal(
      versionBadges.querySelector(
        `[aria-label="DSH Live Voice v${CURRENT_VERSION}. Open releases"]`,
      ).href,
      'https://github.com/victorwads/dsh-live-voice/releases',
    );
    assert.equal(
      versionBadges.querySelector('[aria-label="Compatible with DSH v0.2.1-rc.2. Open release"]')
        .href,
      'https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2',
    );
    const starBadge = document.querySelector('[aria-label="Star DSH Live Voice on GitHub"]');
    assert.equal(starBadge.textContent, '★ Star Us on GitHub');
    assert.equal(starBadge.parentElement.className, 'dlv-settings-heading');
    assert.equal(starBadge.href, 'https://github.com/victorwads/dsh-live-voice');
    const updateBadge = document.querySelector('.dlv-update-badge');
    assert.equal(updateBadge.textContent, '↑Update available');
    assert.equal(updateBadge.parentElement.className, 'dlv-settings-heading');
    assert.equal(updateBadge.previousElementSibling.className, 'dlv-heading-divider');
    assert.equal(updateBadge.nextElementSibling.className, 'dlv-heading-divider');
    assert.equal(updateBadge.title, `Update available: v${NEXT_RELEASE_VERSION}`);
    assert.equal(
      updateBadge.href,
      `https://github.com/victorwads/dsh-live-voice/releases/tag/v${NEXT_RELEASE_VERSION}`,
    );
    const tabs = [...document.querySelectorAll('[role=tab]')];
    assert.deepEqual(
      tabs.map((tab) => tab.textContent),
      ['Speech', 'Speech recognition', 'Conversation'],
    );
    assert.deepEqual(
      tabs.map((tab) => tab.getAttribute('aria-selected')),
      ['false', 'false', 'true'],
      'Conversation is the initial settings tab',
    );
    const panels = [...document.querySelectorAll('[role=tabpanel]')];
    assert.equal(panels.length, 3);
    assert.deepEqual(
      panels.map((panel) => panel.hidden),
      [true, true, false],
      'only the Conversation panel is visible initially',
    );
    const conversation = panels.find((panel) => panel.id.endsWith('-panel-conversation'));
    assert.equal(conversation.hidden, false);
    assert.match(conversation.textContent, /Automatic assistant speech/);
    assert.match(conversation.textContent, /Stop assistant speech when I send a message/);
    assert.match(conversation.textContent, /does not stop the assistant audio/);
    assert.match(conversation.textContent, /Assistant response delay/);
    assert.match(conversation.textContent, /continuous silence/);
    assert.match(conversation.textContent, /Sending mode/);
    assert.match(conversation.textContent, /Playback releases the microphone/);
    assert.match(conversation.textContent, /participants in shared meeting audio/);
    assert.match(conversation.textContent, /resumes after stable silence/);
    await act(async () =>
      tabs[2].dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      ),
    );
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
    assert.equal(document.getElementById(tabs[0].getAttribute('aria-controls')).hidden, false);
    const speechPanel = document.getElementById(tabs[0].getAttribute('aria-controls'));
    assert.ok(speechPanel.textContent.includes('Test selected speech output'));
    assert.ok(speechPanel.textContent.includes('Refresh available engines'));
    const agentVoiceContext = speechPanel.querySelector('textarea');
    assert.ok(agentVoiceContext);
    assert.equal(typeof agentVoiceContext.value, 'string');
    assert.equal(
      [...speechPanel.querySelectorAll('input[type=checkbox]')].some(
        (input) =>
          input.parentElement.textContent.includes('Enable agent voice context') && input.checked,
      ),
      true,
    );
    assert.ok(
      [...speechPanel.querySelectorAll('button')].some(
        (button) => button.textContent === 'Restore default',
      ),
    );
    assert.equal(conversation.textContent.includes('Test selected speech output'), false);
    await act(async () => tabs[1].click());
    assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
    assert.equal(document.getElementById(tabs[1].getAttribute('aria-controls')).hidden, false);
    assert.equal(
      [...document.querySelectorAll('.dlv-settings label')].some((label) =>
        label.textContent.includes('Recognition engine'),
      ),
      true,
    );
    const recognitionSelect = [...document.querySelectorAll('select')].find((select) =>
      select.parentElement.textContent.includes('Recognition engine'),
    );
    assert.deepEqual(
      [...recognitionSelect.options].map((option) => option.textContent),
      [
        'Browser SpeechRecognition · Default option',
        'Whisper · Browser (recommended)',
        'Qwen · Browser',
        'Qwen3 ASR · HTTP API',
        'Whisper · HTTP API',
      ],
    );
    assert.equal(
      document.querySelector('[aria-label="Silence detection and paragraph settings"]'),
      null,
      'browser provider controls its own segmentation',
    );
    const checks = [...document.querySelectorAll('input[type=checkbox]')];
    assert.equal(checks.length, 10);
    assert.equal(checks.filter((input) => input.checked).length, 8);
    assert.equal(
      checks.find((input) =>
        input.parentElement.textContent.includes('Stop assistant speech when I send a message'),
      ).checked,
      false,
    );
    const command = [...document.querySelectorAll('.dlv-phrase-field input')].find((field) =>
      field.closest('.dlv-phrase-field').textContent.includes('Send to running agent'),
    );
    const beforeTyping = calls.length;
    for (const raw of ['send ', 'send,', 'send, ', 'send, another command ']) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
          command,
          raw,
        );
        command.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
      assert.equal(command.value, raw);
      assert.equal(calls.length, beforeTyping, 'typing must not normalize or save voice commands');
    }
    await act(async () =>
      command.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })),
    );
    assert.equal(calls.at(-1)[0], 'settings');
    assert.ok(calls.at(-1)[1].voiceCommandSend.endsWith('send, another command'));
    assert.equal(command.value, '');
    assert.ok(command.closest('.dlv-phrase-field').textContent.includes('another command'));
    const localRecognition = checks.find((input) =>
      input.parentElement.textContent.includes('Process recognition locally'),
    );
    await act(async () => localRecognition.click());
    assert.deepEqual(calls.at(-1), ['settings', { recognitionProcessLocally: false }]);
    assert.equal(
      [...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'Test selected speech output',
      ).disabled,
      false,
    );
    await act(async () =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent === 'Test selected speech output')
        .click(),
    );
    assert.equal(calls.at(-1)[0], 'speak');
    await act(async () => {
      state = { ...state, settings: { ...state.settings, recognitionEngine: 'whisper-http' } };
      callbacks.forEach((cb) => cb());
    });
    const language = [...document.querySelectorAll('select')].find((field) =>
      field.labels[0]?.textContent.includes('Recognition language'),
    );
    assert.equal(
      language.querySelector('option[value=auto]').textContent,
      'Automatic — detect language',
    );
    await act(async () => {
      language.value = 'auto';
      language.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.deepEqual(calls.at(-1), ['settings', { recognitionLang: 'auto' }]);
    const connection = [...document.querySelectorAll('.dlv-settings-subcard > summary')].find(
      (summary) => summary.textContent === 'Connection settings',
    );
    assert.ok(connection);
    assert.equal(
      connection.parentElement.querySelector('fieldset'),
      null,
      'connection fields are not wrapped in another card',
    );
    const detection = document
      .querySelector('summary[aria-label="Silence detection and paragraph settings"]')
      ?.closest('details');
    assert.ok(detection);
    assert.equal(detection.open, false);
    const maxUtterance = [...detection.querySelectorAll('label')].find((label) =>
      label.textContent.includes('Maximum continuous speech'),
    ).control;
    assert.equal(maxUtterance.value, '60');
    assert.equal(maxUtterance.min, '10');
    assert.equal(maxUtterance.max, '300');
    assert.equal(detection.querySelectorAll('input[type=radio]').length, 4);
    const long = [...detection.querySelectorAll('input[type=radio]')].find(
      (input) => input.value === 'long',
    );
    await act(async () => long.click());
    assert.deepEqual(calls.at(-1), ['settings', { voiceDetectionPreset: 'long' }]);
    assert.match(detection.querySelector('.dlv-vad-summary').textContent, /2000 ms/);
    await act(async () => detection.querySelector('input[value=custom]').click());
    assert.deepEqual(calls.at(-1), ['settings', { voiceDetectionPreset: 'custom' }]);
    const customPause = [...detection.querySelectorAll('label')].find((label) =>
      label.textContent.includes('Chunk pause (milliseconds)'),
    ).control;
    assert.equal(customPause.value, '1000');
    assert.equal(customPause.min, '100');
    assert.equal(customPause.max, '10000');
    const setCustom = async (value) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
          customPause,
          value,
        );
        customPause.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
      await act(async () =>
        customPause.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })),
      );
    };
    await setCustom('400');
    assert.deepEqual(calls.at(-1), ['settings', { voiceDetectionCustomSilenceMs: 400 }]);
    assert.match(detection.querySelector('.dlv-vad-summary').textContent, /400 ms/);
    const count = calls.length;
    await setCustom('');
    assert.equal(calls.length, count);
    assert.equal(customPause.value, '400');
    await setCustom('99');
    assert.equal(calls.length, count);
    assert.equal(customPause.value, '400');
    await act(async () => detection.querySelector('input[value=short]').click());
    assert.match(detection.querySelector('.dlv-vad-summary').textContent, /400 ms/);
    assert.equal(customPause.isConnected, false);
    await act(async () => detection.querySelector('input[value=custom]').click());
    assert.equal(
      [...detection.querySelectorAll('input[type=number]')].find((input) =>
        input.labels[0]?.textContent.includes('Chunk pause'),
      ).value,
      '400',
    );
    assert.equal([...detection.querySelectorAll('input[type=number]')].at(-1).value, '3000');
    await act(async () => {
      state = { ...state, conversation: true, listening: true, recognizing: true };
      callbacks.forEach((cb) => cb());
    });
    assert.equal(document.querySelector('[role=status]').textContent, 'Listening');
    assert.doesNotMatch(document.querySelector('[role=status]').textContent, /…|\.\.\./);
    const autoSendToggle = document.querySelector('[aria-label="Automatic delivery mode"]');
    const assistantSpeechToggle = document.querySelector(
      '[aria-label="Automatic assistant speech"]',
    );
    assert.equal(autoSendToggle.classList.contains('dlv-live-toggle'), true);
    assert.equal(autoSendToggle.getAttribute('aria-pressed'), 'false');
    assert.equal(autoSendToggle.textContent, 'OFF');
    assert.equal(assistantSpeechToggle.getAttribute('aria-checked'), 'true');
    assert.equal(assistantSpeechToggle.textContent, 'on');
    const muteMicrophone = document.querySelector('[aria-label="Ignore composer input"]');
    assert.ok(muteMicrophone);
    assert.equal(
      muteMicrophone.querySelector('path').getAttribute('d'),
      'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8',
      'listening state uses the open microphone icon',
    );
    await act(async () => autoSendToggle.click());
    assert.deepEqual(calls.at(-1), ['settings', { sendingMode: 'queue' }]);
    assert.equal(autoSendToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(autoSendToggle.textContent, 'QUEUE');
    await act(async () => autoSendToggle.click());
    assert.deepEqual(calls.at(-1), ['settings', { sendingMode: 'steer' }]);
    assert.equal(autoSendToggle.textContent, 'SEND');
    await act(async () => assistantSpeechToggle.click());
    assert.deepEqual(calls.at(-1), ['settings', { announceAssistantMessages: false }]);
    assert.equal(assistantSpeechToggle.getAttribute('aria-checked'), 'false');
    assert.equal(assistantSpeechToggle.textContent, 'OFF');
    await act(async () => {
      state = { ...state, speaking: true, paused: true, speechSegmentsRemaining: 2 };
      callbacks.forEach((cb) => cb());
    });
    await act(async () => click('Skip to next speech segment'));
    await act(async () => click('Resume speech'));
    await act(async () => {
      state = { ...state, speaking: false, paused: false, speechSegmentsRemaining: 2 };
      callbacks.forEach((cb) => cb());
    });
    assert.ok(document.querySelector('[aria-label="Skip to next speech segment"]'));
    assert.ok(document.querySelector('[aria-label="Stop all speech"]'));
    assert.equal(document.querySelector('[aria-label="Pause speech"]').disabled, true);
    await act(async () => click('Stop all speech'));
    await act(async () => click('End voice conversation'));
    assert.deepEqual(
      calls.map((item) => (Array.isArray(item) ? item[0] : item)),
      [
        'conversation',
        'settings',
        'settings',
        'speak',
        'settings',
        'settings',
        'settings',
        'settings',
        'settings',
        'settings',
        'settings',
        'settings',
        'settings',
        'next',
        'resume',
        'stop',
        'end',
      ],
    );
    await act(async () => click('Close voice settings'));
    assert.equal(calls.at(-1), 'close');
    await act(async () => root.render(React.createElement(MicrophoneButtons, { controller })));
    controller.startConversation = () => {
      throw new Error('Missing local language pack');
    };
    await act(async () => {
      state = {
        ...state,
        conversation: false,
        listening: false,
        recognizing: false,
        capabilities: {
          browser: { supported: true, pause: true, resume: true },
          recognition: { supported: false },
          capture: { supported: true },
        },
      };
      callbacks.forEach((cb) => cb());
    });
    await act(async () => click('Start voice conversation'));
    assert.match(document.querySelector('[role=alert]').textContent, /Missing local language pack/);
    await act(async () => click('Dismiss voice error'));
    assert.equal(document.querySelector('[role=alert]'), null);
  } finally {
    await act(async () => root.unmount());
    assert.equal(callbacks.size, 0);
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('Qwen speech output exposes and persists the selected preset voice', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () =>
    Response.json({
      ok: true,
      value: { baseUrl: 'http://127.0.0.1:8080/', timeoutMs: 300000 },
    });
  const callbacks = new Set();
  const calls = [];
  const state = {
    settings: {
      engine: 'qwen-http',
      recognitionEngine: 'browser',
      voice: 'aiden',
      lang: 'pt-BR',
      mode: 'speaker',
      rate: 1,
    },
    capabilities: { 'qwen-http': { supported: true } },
  };
  const controller = {
    subscribe: (callback) => {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    getSnapshot: () => state,
    updateSettings: (value) => calls.push(value),
    endConversation: () => {},
    refreshCapabilities: () => {},
  };
  const SettingsPanel = withAppLanguage(createLiveVoiceSettings(), EN_LOCALE);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(SettingsPanel, { controller })));
    const label = [...document.querySelectorAll('label')].find((candidate) =>
      candidate.textContent.startsWith('Qwen voice'),
    );
    assert.ok(label);
    const select = document.getElementById(label.htmlFor);
    assert.equal(select.value, 'aiden');
    assert.equal(select.querySelectorAll('option').length, 9);
    await act(async () => {
      select.value = 'ryan';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.deepEqual(calls.at(-1), { voice: 'ryan' });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('recording settings default on, preserve explicit opt-out and explain activity-group versus legacy retention', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  const Panel = withAppLanguage(RecordingSettings, EN_LOCALE);
  const calls = [];
  const render = async (settings) =>
    act(async () =>
      root.render(
        React.createElement(Panel, { settings, updateSettings: (patch) => calls.push(patch) }),
      ),
    );
  try {
    await render({ recognitionEngine: 'whisper-http' });
    const enabled = document.querySelector('input[type=checkbox]');
    const retained = [...document.querySelectorAll('label')].find(
      (label) => label.textContent === 'Retained recordings per source type',
    ).control;
    assert.equal(enabled.checked, true, 'missing preference displays the enabled default');
    assert.equal(enabled.disabled, false);
    assert.equal(retained.value, '1');
    assert.equal(retained.disabled, false);
    assert.match(document.body.textContent, /On by default/);
    assert.match(document.body.textContent, /Turn off to opt out/);
    assert.match(document.body.textContent, /Keep 1–100 ordinary captures per source type/);
    assert.match(document.body.textContent, /Attendee keeps N meeting groups, newest by capture activity/);
    assert.match(document.body.textContent, /every participant and burst while that group is retained/);
    assert.match(document.body.textContent, /Active writers, pending writes and stars protect the whole meeting group without consuming an ordinary slot/);
    assert.match(document.body.textContent, /Silence between bursts does not mean the call ended or reserve its place/);
    assert.match(document.body.textContent, /a newer meeting may expire an older quiet group/);
    assert.match(document.body.textContent, /Legacy microphone.shared recordings keep N captures per type/);
    assert.match(document.body.textContent, /Browser quota or storage eviction can still limit availability/);
    assert.match(document.body.textContent, /browser profile and site/);
    assert.match(document.body.textContent, /lossy compression/);
    assert.match(document.body.textContent, /consent/);
    assert.match(document.body.textContent, /recovery is not guaranteed/);
    await act(async () => enabled.click());
    assert.deepEqual(calls.at(-1), { recordingEnabled: false });
    await render({ recognitionEngine: 'whisper-http', recordingEnabled: false });
    assert.equal(enabled.checked, false, 'explicit opt-out is never treated as missing');
    assert.equal(retained.disabled, true);
    await render({ recognitionEngine: 'whisper-http', recordingEnabled: 'false' });
    assert.equal(enabled.checked, true, 'invalid preferences display the enabled default');
    assert.equal(retained.disabled, false);
    await render({ recognitionEngine: 'browser' });
    assert.equal(enabled.checked, true);
    assert.equal(enabled.disabled, true, 'Browser recognition still cannot use the archive');
    assert.equal(retained.disabled, true);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
