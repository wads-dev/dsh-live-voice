// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.js';
import { defaultSettings } from '../src/modules/core/settings.js';
import { RecognitionEngineSettings } from '../src/modules/settings/sections/recognition/RecognitionEngineSettings.js';

test('HTTP engines share one empty context field in Connection settings, including shared Qwen connection', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dsh.test/' });
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
  const render = async (recognitionEngine, engine = 'browser', recognitionContext = '') =>
    act(async () =>
      root.render(
        <LiveVoiceTranslationProvider>
          <RecognitionEngineSettings
            controller={{}}
            settings={{ ...defaultSettings, recognitionEngine, engine, recognitionContext }}
            updateSettings={(patch) => calls.push(patch)}
          />
        </LiveVoiceTranslationProvider>,
      ),
    );
  for (const [recognitionEngine, engine] of [
    ['whisper-http', 'browser'],
    ['qwen-http', 'browser'],
    ['qwen-http', 'qwen-http'],
  ]) {
    await render(recognitionEngine, engine);
    const field = document.querySelector('textarea');
    assert.ok(field);
    assert.equal(document.querySelectorAll('textarea').length, 1);
    assert.equal(field.value, '');
    assert.equal(
      field.placeholder,
      'Native Brazilian Portuguese speaker who frequently uses technical terms in English.',
    );
    assert.equal(field.maxLength, 1000);
    assert.ok(
      document
        .querySelector('label[for="' + field.id + '"]')
        .textContent.includes('Transcription context'),
    );
    assert.ok(
      field.closest('details').querySelector('summary').textContent.includes('Connection settings'),
    );
    assert.equal(calls.length, 0, 'placeholder must never be saved');
  }
  const field = document.querySelector('textarea');
  const context = 'Português e English\nTypeScript, deploy';
  await act(async () => {
    field.value = context;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  assert.equal(calls.length, 0);
  await act(async () => field.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })));
  assert.deepEqual(calls.pop(), { recognitionContext: context });
  await render('whisper-http', 'browser', context);
  assert.equal(document.querySelector('textarea').value, context);
  await act(async () => {
    const input = document.querySelector('textarea');
    input.value = '';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await act(async () =>
    document
      .querySelector('textarea')
      .dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })),
  );
  assert.deepEqual(calls.pop(), { recognitionContext: '' });
  await render('browser');
  assert.equal(
    document.querySelector('textarea'),
    null,
    'native Browser does not accept this HTTP hint',
  );
});
