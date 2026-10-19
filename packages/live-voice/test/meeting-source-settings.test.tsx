// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.ts';
import { defaultSettings } from '../src/modules/core/settings.ts';
import { MeetingSourceSettings } from '../src/modules/settings/sections/conversation/MeetingSourceSettings.tsx';

test('meeting source names have labelled fields and persist only on blur', async (t) => {
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
  await act(async () =>
    root.render(
      <LiveVoiceTranslationProvider>
        <MeetingSourceSettings
          settings={defaultSettings}
          updateSettings={(patch) => calls.push(patch)}
        />
      </LiveVoiceTranslationProvider>,
    ),
  );
  const inputs = [...document.querySelectorAll('input')].filter((input) =>
    /Microphone source name|Shared-audio source name/.test(input.closest('label').textContent),
  );
  assert.deepEqual(
    inputs.map((input) => input.value),
    ['Me', 'Them'],
  );
  assert.ok(inputs[0].closest('label').textContent.includes('Microphone source name'));
  assert.ok(inputs[1].closest('label').textContent.includes('Shared-audio source name'));
  assert.equal(inputs[0].maxLength, 80);
  assert.equal(document.querySelector('details').open, false);
  for (const [index, name] of [' Alice ', ''].entries()) {
    await act(async () => {
      inputs[index].value = name;
      inputs[index].dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(calls.length, index);
    await act(async () =>
      inputs[index].dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })),
    );
    assert.deepEqual(calls[index], {
      [index === 0 ? 'microphoneSourceName' : 'sharedSourceName']: name,
    });
  }
});
