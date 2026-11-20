// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PluginUpdateAction } from '../src/modules/settings/components/PluginUpdateAction.tsx';
import { createPluginUpdate } from '../src/modules/settings/services/pluginUpdate.ts';
import { withAppLanguage, liveVoiceDictionaries } from '../src/app/client/i18n/index.ts';

test('every locale offers an explicit confirmation and retains install state across Settings remounts', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  try {
    for (const locale of Object.keys(liveVoiceDictionaries)) {
      let calls = 0;
      let settle;
      const manager = {
        listBundles: async () => ({
          ok: true,
          value: [
            {
              name: 'dsh-live-voice',
              version: '0.4.1',
              installed: true,
              availability: 'profile',
              update: 'registry',
              enabled: true,
              source: 'dsh-live-voice@^0.4.1',
            },
          ],
        }),
        listVersions: async () => ({
          ok: true,
          value: {
            status: 'listed',
            registry: 'https://registry.npmjs.org/',
            versions: [{ version: '9.0.0', bundle: true }],
          },
        }),
        updateBundle: () => {
          calls++;
          return new Promise((resolve) => {
            settle = resolve;
          });
        },
      };
      const updater = createPluginUpdate({ manager: () => manager });
      const snapshot = { active: locale, revision: 0 };
      const Action = withAppLanguage(PluginUpdateAction, {
        subscribe: () => () => {},
        getSnapshot: () => snapshot,
      });
      const render = () => root.render(<Action updater={updater} tag="v9.0.0" />);
      await act(async () => render());
      assert.equal(calls, 0);
      await act(async () => document.querySelector('button').click());
      assert.equal(updater.getSnapshot().phase, 'confirm');
      assert.equal(calls, 0);
      const text = liveVoiceDictionaries[locale];
      assert.ok(document.body.textContent.includes(text['dsh-live-voice.commons.update.cancel']));
      await act(async () => [...document.querySelectorAll('button')].at(-1).click());
      assert.equal(updater.getSnapshot().phase, 'idle');
      await act(async () => document.querySelector('button').click());
      await act(async () => document.querySelector('.dlv-plugin-update-panel button').click());
      assert.equal(calls, 1);
      assert.equal(updater.getSnapshot().phase, 'installing');
      await act(async () => root.render(null));
      await act(async () => render());
      assert.equal(document.querySelector('button').disabled, true);
      assert.equal(calls, 1);
      await act(async () =>
        settle({
          ok: true,
          value: {
            from: '0.4.1',
            to: '9.0.0',
            step: 'install',
            result: { application: 'restart-required', bundle: 'dsh-live-voice', version: '9.0.0' },
          },
        }),
      );
      assert.ok(document.querySelector('[role="status"]').textContent.includes('9.0.0'));
      assert.ok(!document.body.textContent.includes('dsh-live-voice.'));
      await act(async () => root.render(null));
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});
