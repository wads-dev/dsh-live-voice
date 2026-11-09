// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.js';
import { InactivitySettings } from '../src/modules/settings/sections/conversation/InactivitySettings.js';
import { normalizeSettings } from '../src/modules/core/settings.js';

test('inactivity fields persist on blur, reject invalid lead times and allow fractional minutes', async (t) => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = {};
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const key of Object.keys(previous)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else delete globalThis[key];
    }
  });
  let settings = normalizeSettings({});
  const patches = [];
  const render = async () =>
    act(async () =>
      root.render(
        <LiveVoiceTranslationProvider>
          <InactivitySettings
            settings={settings}
            updateSettings={(patch) => {
              patches.push(patch);
              settings = normalizeSettings({ ...settings, ...patch });
            }}
          />
        </LiveVoiceTranslationProvider>,
      ),
    );
  await render();
  const inputs = [...document.querySelectorAll('input[type=number]')];
  assert.equal(inputs[0].value, '5');
  assert.equal(inputs[1].value, '1');
  assert.equal(inputs[1].max, '2.5');
  assert.equal(document.querySelectorAll('.dlv-hint-trigger').length, 1);
  assert.equal(document.querySelectorAll('p').length, 0);
  const commit = async (input, raw) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        input,
        raw,
      );
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const count = patches.length;
    await act(async () =>
      input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })),
    );
    return patches.length - count;
  };
  assert.equal(await commit(inputs[1], '4'), 0);
  assert.equal(await commit(inputs[1], '0'), 0);
  assert.equal(await commit(inputs[1], '-1'), 0);
  assert.equal(await commit(inputs[1], '2.5'), 1);
  await render();
  assert.equal(settings.autoEndWarningMinutes, 2.5);
  assert.equal(await commit(inputs[0], '3'), 1);
  await render();
  assert.equal(settings.autoEndWarningMinutes, 1.5);
  assert.equal(inputs[1].max, '1.5');
  assert.equal(await commit(inputs[0], '60'), 1);
  await render();
  assert.equal(await commit(inputs[1], '25'), 1);
  await render();
  assert.equal(settings.autoEndWarningMinutes, 25);
  await act(async () => document.querySelector('input[type=checkbox]').click());
  assert.equal(settings.autoEndEnabled, false);
});
