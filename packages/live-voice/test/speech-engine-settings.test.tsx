// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.ts';
import { defaultSettings } from '../src/modules/core/settings.ts';
import { SpeechEngineSettings } from '../src/modules/settings/sections/speak/SpeechEngineSettings.tsx';
import { SpeakSettingsSection } from '../src/modules/settings/sections/speak/SpeakSettingsSection.tsx';

function setup(t, Component = SpeechEngineSettings, controller = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dsh.local/' });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  const calls = [];
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
  });
  function element(settings, capabilities) {
    return (
      <LiveVoiceTranslationProvider>
        <Component
          controller={controller}
          settings={settings}
          hostPlatform={controller.hostPlatform}
          capabilities={capabilities}
          updateSettings={(patch) => {
            calls.push(patch);
            root.render(element({ ...settings, ...patch }, capabilities));
          }}
          invoke={() => {}}
        />
      </LiveVoiceTranslationProvider>
    );
  }
  async function render(settings, capabilities) {
    await act(async () => root.render(element(settings, capabilities)));
    return document.querySelector('select');
  }
  return { calls, render, dom };
}

async function selectEngine(select, engine) {
  await act(async () => {
    select.value = engine;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}

test('speech engine volume slider changes output preference only for every engine', async (t) => {
  const { calls, render } = setup(t);
  for (const engine of ['browser', 'say', 'qwen-http']) {
    await render({ ...defaultSettings, engine }, {});
    const slider = document.querySelector('input[type="range"]');
    assert.equal(slider.getAttribute('aria-label'), 'Speech volume');
    assert.equal(slider.min, '0');
    assert.equal(slider.max, '1');
    assert.equal(slider.step, '0.01');
    assert.equal(slider.value, '1');
    for (const volume of [0, 0.42, 1]) {
      await act(async () => {
        slider.value = String(volume);
        slider.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
      assert.deepEqual(calls.at(-1), { volume });
      assert.match(slider.closest('label').textContent, new RegExp(Math.round(volume * 100) + '%'));
    }
  }
});

test('Browser defaults use client language, not UI locale, and never override on discovery', async (t) => {
  const { calls, render, dom } = setup(t);
  Object.defineProperty(dom.window.navigator, 'language', { value: 'pt-BR', configurable: true });
  const voices = [
    { name: 'A (Natural)', voiceURI: 'en', lang: 'en-US' },
    { name: 'Z (Natural)', voiceURI: 'pt', lang: 'pt-BR' },
    { name: 'Manual', voiceURI: 'manual', lang: 'pt-PT' },
  ];
  const capabilities = { browser: { voices } };
  const engine = await render({ ...defaultSettings, engine: 'say' }, capabilities);
  await selectEngine(engine, 'browser');
  assert.deepEqual(calls, [{ engine: 'browser', voice: 'pt' }]);
  const voiceSelect = document.querySelectorAll('select')[1];
  assert.deepEqual(
    [...voiceSelect.options].map((v) => v.value),
    ['', 'pt', 'manual', 'en'],
  );
  assert.equal(voiceSelect.options[1].textContent, 'Z (Natural) (default)');
  assert.equal(voiceSelect.options[2].textContent, 'Manual');
  assert.equal(voiceSelect.options[3].textContent, 'A (Natural)');
  assert.deepEqual(
    [...voiceSelect.querySelectorAll('optgroup')].map((group) => group.label),
    ['pt', 'en'],
  );
  await selectEngine(voiceSelect, 'manual');
  calls.length = 0;
  await render(
    { ...defaultSettings, engine: 'browser', voice: 'manual' },
    { browser: { voices: [...voices].reverse() } },
  );
  assert.deepEqual(calls, []);
  assert.equal(document.querySelectorAll('select')[1].value, 'manual');
  assert.equal(document.querySelector('option[value="pt"]').textContent, 'Z (Natural) (default)');
});

test('late Browser discovery reorders options without retroactive selection', async (t) => {
  const { calls, render } = setup(t);
  const settings = { ...defaultSettings, engine: 'say', voice: '' };
  const engine = await render(settings, { browser: { voices: [] } });
  await selectEngine(engine, 'browser');
  assert.deepEqual(calls, [{ engine: 'browser' }]);
  calls.length = 0;
  await render(
    { ...settings, engine: 'browser' },
    { browser: { voices: [{ name: 'Natural', voiceURI: 'late', lang: 'en' }] } },
  );
  assert.deepEqual(calls, []);
  assert.equal(document.querySelectorAll('select')[1].value, '');
});

for (const reason of [
  'Qwen speech server is unreachable: connect ECONNREFUSED 127.0.0.1:8080',
  'Qwen health check did not report TTS ready (200).',
]) {
  test('Qwen remains configurable while unavailable: ' + reason, async (t) => {
    const { calls, render } = setup(t);
    const capability = Object.freeze({ supported: false, reason });
    const capabilities = Object.freeze({
      'qwen-http': capability,
      qwen: { supported: false, reason: 'Wrong capability key' },
      browser: { supported: true },
      say: { supported: false },
    });
    const select = await render({ ...defaultSettings, engine: 'browser' }, capabilities);
    assert.equal(select.querySelector('option[value="qwen-http"]').disabled, false);
    assert.equal(select.querySelector('option[value="say"]').disabled, false);
    assert.deepEqual(calls, []);
    await selectEngine(select, 'qwen-http');
    assert.deepEqual(calls, [{ engine: 'qwen-http' }]);
    assert.equal(select.value, 'qwen-http');
    assert.equal(document.querySelector('[role="status"]').textContent, reason);
    assert.equal(capabilities['qwen-http'], capability);
    assert.equal(capability.supported, false);
  });
}

test('Qwen selection stays enabled for unknown and healthy capabilities without status claims', async (t) => {
  const { calls, render } = setup(t);
  for (const capabilities of [undefined, {}, { 'qwen-http': { supported: true } }]) {
    calls.length = 0;
    const select = await render({ ...defaultSettings, engine: 'browser' }, capabilities);
    assert.equal(select.querySelector('option[value="qwen-http"]').disabled, false);
    assert.deepEqual(calls, []);
    await selectEngine(select, 'qwen-http');
    assert.deepEqual(calls, [{ engine: 'qwen-http' }]);
    assert.equal(document.querySelector('[role="status"]'), null);
  }
});

test('saved unavailable Qwen selection retains its real status across capability refresh', async (t) => {
  const { calls, render } = setup(t);
  const settings = { ...defaultSettings, engine: 'qwen-http', voice: 'ryan' };
  const select = await render(settings, {
    'qwen-http': { supported: false, reason: 'Service not started' },
  });
  assert.equal(select.value, 'qwen-http');
  assert.equal(document.querySelectorAll('select')[1].value, 'ryan');
  assert.equal(document.querySelector('[role="status"]').textContent, 'Service not started');
  await render(settings, { 'qwen-http': { supported: true } });
  assert.equal(document.querySelector('[role="status"]'), null);
  assert.deepEqual(calls, []);
});

test('unavailable Qwen without a reason uses the existing translated failure message', async (t) => {
  const { calls, render } = setup(t);
  const select = await render(
    { ...defaultSettings, engine: 'qwen-http' },
    {
      'qwen-http': { supported: false },
    },
  );
  assert.equal(select.querySelector('option[value="qwen-http"]').disabled, false);
  const status = document.querySelector('[role="status"]');
  assert.ok(status);
  assert.ok(status.textContent.length > 0);
  assert.deepEqual(calls, []);
});

test('all speech engines stay selectable while retaining last operational failure reason', async (t) => {
  const { render } = setup(t);
  const capabilities = {
    browser: { supported: false, reason: 'Browser synthesis unavailable' },
    say: { supported: false, reason: 'Host say unavailable' },
    'qwen-http': { supported: false, reason: 'Qwen unavailable' },
  };
  for (const engine of ['browser', 'say']) {
    const select = await render({ ...defaultSettings, engine }, capabilities);
    assert.equal(select.querySelector('option[value="browser"]').disabled, false);
    assert.equal(select.querySelector('option[value="say"]').disabled, false);
    assert.equal(
      document.querySelector('[role="status"]').textContent,
      capabilities[engine].reason,
    );
  }
});

for (const hostPlatform of ['darwin', 'linux', 'win32']) {
  test(
    'speaking options follow host ordering without disabling unavailable engines on ' +
      hostPlatform,
    async (t) => {
      const { render } = setup(t, SpeechEngineSettings, { hostPlatform });
      const select = await render(
        { ...defaultSettings, engine: 'browser' },
        {
          browser: { supported: false },
          say: { supported: false },
          'qwen-http': { supported: false },
        },
      );
      assert.deepEqual(
        [...select.options].map((option) => option.value),
        hostPlatform === 'darwin'
          ? ['say', 'browser', 'qwen-http', 'chatterbox-http']
          : ['browser', 'qwen-http', 'say', 'chatterbox-http'],
      );
      assert.equal(
        [...select.options].some((option) => option.disabled),
        false,
      );
      assert.equal(select.value, 'browser', 'display order never overrides a saved choice');
    },
  );
}

test('selecting unavailable Qwen exposes an editable endpoint without requiring service health', async (t) => {
  const requests = [];
  const config = { baseUrl: 'http://127.0.0.1:8080/', timeoutMs: 300000 };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options });
    assert.equal(url, '/api/dsh-live-voice/qwen/config');
    assert.equal(options.credentials, 'same-origin');
    return Response.json({ ok: true, value: options.body ? JSON.parse(options.body) : config });
  });
  let refreshes = 0;
  const { calls, render } = setup(t, SpeakSettingsSection, {
    endConversation() {},
    refreshCapabilities() {
      refreshes++;
    },
  });
  const capabilities = Object.freeze({
    'qwen-http': Object.freeze({ supported: false, reason: 'Qwen service is stopped' }),
    browser: { supported: true },
  });
  const select = await render({ ...defaultSettings, engine: 'browser' }, capabilities);
  assert.equal(
    [...document.querySelectorAll('input')].some((input) => input.value === config.baseUrl),
    false,
  );
  assert.equal(select.querySelector('option[value="qwen-http"]').disabled, false);
  await selectEngine(select, 'qwen-http');
  const endpoint = document.querySelector('input[type="text"]');
  assert.ok(endpoint);
  assert.equal(endpoint.disabled, false);
  assert.equal(endpoint.value, config.baseUrl);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
      endpoint,
      'http://127.0.0.1:9090/',
    );
    endpoint.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await act(async () =>
    endpoint.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })),
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[1].method, 'PUT');
  assert.deepEqual(JSON.parse(requests[1].body), { ...config, baseUrl: 'http://127.0.0.1:9090/' });
  assert.equal(refreshes, 0, 'saving configuration must not trigger provider health probes');
  assert.deepEqual(calls, [{ engine: 'qwen-http' }]);
  assert.equal(capabilities['qwen-http'].supported, false);
  assert.ok(
    [...document.querySelectorAll('[role="status"]')].some(
      (status) => status.textContent === 'Qwen service is stopped',
    ),
  );
});

test('Chatterbox loads only the voice catalog and preserves missing preferences', async (t) => {
  const requests = [];
  const id = 'a'.repeat(24);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options });
    assert.equal(url, '/api/dsh-live-voice/chatterbox/voices');
    return Response.json({ ok: true, value: [{ id, name: 'Authorized reference' }] });
  });
  const { calls, render } = setup(t, SpeechEngineSettings);
  await render({ ...defaultSettings, engine: 'chatterbox-http', voice: 'missing' });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const select = document.querySelectorAll('select')[1];
  assert.equal(select.value, 'missing');
  assert.equal(calls.length, 0, 'discovery never rewrites preferences');
  assert.equal(requests.length, 1);
  await selectEngine(select, id);
  assert.deepEqual(calls, [{ voice: id }]);
});
