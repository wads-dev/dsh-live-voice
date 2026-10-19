// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.ts';
import { defaultSettings } from '../src/modules/core/settings.ts';
import { LiveVoiceSettings } from '../src/modules/settings/index.ts';
import { publishDeveloperExtension } from '../src/modules/core/developerExtension.ts';
import { RecognitionEngineSettings } from '../src/modules/settings/sections/recognition/RecognitionEngineSettings.tsx';

test('all recognition engines remain selectable regardless of server or local processing availability', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dsh.local/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const calls = [];
  for (const recognitionEngine of ['qwen-http', 'whisper-http', 'browser']) {
    await act(async () =>
      root.render(
        <LiveVoiceTranslationProvider>
          <RecognitionEngineSettings
            controller={{}}
            settings={{ ...defaultSettings, recognitionEngine, recognitionLang: 'auto' }}
            capabilities={{
              recognition: { supported: false },
              'qwen-http-recognition': { supported: false },
              'whisper-http': { supported: false },
            }}
            updateSettings={(next) => calls.push(next)}
          />
        </LiveVoiceTranslationProvider>,
      ),
    );
    const select = document.querySelector('select');
    assert.equal(select.querySelector('option[value="browser"]').disabled, false);
    assert.equal(select.querySelector('option[value="qwen-http"]').disabled, false);
    assert.equal(select.querySelector('option[value="whisper-http"]').disabled, false);
    await act(async () => {
      select.value = 'browser';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.deepEqual(calls.at(-1), { recognitionEngine: 'browser', recognitionLang: 'pt-BR' });
    if (recognitionEngine === 'browser') {
      const localProcessing = document.querySelector('input[type="checkbox"]');
      assert.ok(localProcessing);
      await act(async () => localProcessing.click());
      assert.deepEqual(calls.at(-1), { recognitionProcessLocally: false });
    }
  }
});

test('modular settings composes speech, recognition, and conversation tabs', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dsh.local/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    settings: { ...defaultSettings },
    capabilities: {
      browser: { supported: true },
      recognition: { supported: true },
      capture: { supported: true },
    },
  };
  const listeners = new Set();
  const calls = [];
  const controller = {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    updateSettings: (next) => calls.push(next),
    clearError() {},
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      <LiveVoiceTranslationProvider>
        <LiveVoiceSettings controller={controller} />
      </LiveVoiceTranslationProvider>,
    ),
  );
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  assert.deepEqual(
    tabs.map((tab) => tab.textContent),
    ['Speech', 'Speech recognition', 'Conversation'],
  );
  assert.equal(document.querySelectorAll('[role="tabpanel"]')[0].hidden, true);
  assert.equal(document.querySelectorAll('[role="tabpanel"]')[2].hidden, false);
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
  assert.equal(
    tabs[2].getAttribute('aria-controls'),
    document.querySelectorAll('[role="tabpanel"]')[2].id,
  );
  assert.equal(
    document.querySelectorAll('[role="tabpanel"]')[2].getAttribute('aria-labelledby'),
    tabs[2].id,
  );
  await act(async () =>
    tabs[2].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true })),
  );
  assert.equal(document.querySelectorAll('[role="tabpanel"]')[0].hidden, false);
  await act(async () => tabs[2].click());
  assert.equal(document.querySelectorAll('[role="tabpanel"]')[2].hidden, false);
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  for (const panel of panels) {
    const section = panel.querySelector('.dlv-settings-section');
    assert.ok(section, 'primary settings are visible without opening a disclosure');
    assert.ok(section.querySelector('h4 svg'), 'section headings show a semantic icon');
    assert.equal(section.tagName, 'DETAILS');
    assert.equal(section.open, true, 'essential sections start expanded');
  }
  const conversation = panels[2];
  assert.ok(conversation.textContent.includes('Meeting mode'));
  assert.equal(panels[1].textContent.includes('Meeting mode'), false);
  const responseDelay = [...conversation.querySelectorAll('select')].find(
    (select) => [...select.options].map((option) => option.value).join(',') === '0.6,1.5,2,3,4,5',
  );
  assert.ok(responseDelay);
  assert.equal(responseDelay.value, '1.5');
  assert.equal(responseDelay.options[1].textContent, '1.5 seconds');
  await act(async () => {
    responseDelay.value = '0.6';
    responseDelay.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.deepEqual(calls.at(-1), { assistantSpeechDelaySeconds: 0.6 });
  calls.length = 0;
  const shortcuts = conversation
    .querySelector('.dlv-shortcut-field')
    .closest('.dlv-settings-section');
  assert.equal(shortcuts.querySelectorAll('[role="tooltip"]').length, 1);
  assert.equal(
    shortcuts.querySelectorAll('.dlv-section-content p, .dlv-shortcut-field small').length,
    0,
  );
  const shortcutHelp = shortcuts.querySelector('[role="tooltip"]');
  assert.equal(shortcutHelp.hidden, true);
  assert.match(shortcutHelp.textContent, /press the new keys together/);
  await act(async () => shortcuts.querySelector('.dlv-hint-trigger').click());
  assert.equal(shortcutHelp.hidden, false);
  assert.equal(shortcuts.open, true, 'opening help must not collapse the section');
  const general = conversation.querySelector('.dlv-settings-section');
  const delivery = general.querySelector('select');
  assert.ok(delivery);
  await act(async () => {
    delivery.value = 'queue';
    delivery.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.deepEqual(calls, [{ sendingMode: 'queue' }]);
  const policyLabel = [...general.querySelectorAll('label')].find((label) =>
    label.textContent.includes('In your DSH, what does Enter do when the agent is busy?'),
  );
  const policy = document.getElementById(policyLabel.htmlFor);
  assert.equal(policy.value, 'queue');
  assert.deepEqual(
    [...policy.options].map((option) => option.value),
    ['steer', 'queue'],
  );
  const help = document.getElementById(policy.getAttribute('aria-describedby'));
  assert.match(help.textContent, /uses your answer to choose the correct action/);
  assert.match(help.textContent, /does not change DSH settings/);
  await act(async () => {
    policy.value = 'steer';
    policy.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.deepEqual(calls.at(-1), { dshBusyEnterBehavior: 'steer' });
  let removeDeveloper;
  await act(async () => {
    removeDeveloper = publishDeveloperExtension(window, {
      version: 1,
      label: () => 'Developer',
      component: () => <p>Developer controls</p>,
    });
  });
  assert.equal(document.querySelectorAll('[role="tab"]').length, 3);
  const footer = document.querySelector('.dlv-settings-footer');
  assert.ok(footer.textContent.includes('Developer controls'));
  assert.equal(footer.closest('.dlv-settings-scroll'), null);
  await act(async () => removeDeveloper());
  assert.ok(document.querySelector('.dlv-settings-footer .dlv-diagnostics-button'));
  assert.match(document.querySelector('.dlv-settings-footer').textContent, /Diagnostics/);
  assert.equal(document.querySelectorAll('[role="tab"]').length, 3);
  assert.equal(document.querySelectorAll('[role="tabpanel"]')[2].hidden, false);
});
