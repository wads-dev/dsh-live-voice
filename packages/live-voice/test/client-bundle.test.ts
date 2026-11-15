// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import React from 'react';
test('built bundle registers independently in the DSH lazy module loader', async () => {
  let registration;
  const context = {
    window: {
      __ModuleLoader__: {
        load: (r) => {
          registration = r;
        },
      },
    },
  };
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), context);
  assert.equal(registration.id, 'dsh-live-voice');
  const plugin = registration.factory((id) => {
    if (id === 'react') return React;
    if (id === 'react-dom') return { createPortal() {} };
    assert.fail('unexpected module: ' + id);
  });
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual(
    [...plugin.inject],
    ['slots', 'connection', 'uiConversation', 'uiSession', 'locale'],
  );
  const slots = [];
  const effects = [];
  plugin.apply({
    slots: {
      inject(name, fn) {
        fn();
      },
      register(meta, component) {
        slots.push({ meta, component });
      },
    },
    effect: (fn) => effects.push(fn),
  });
  assert.deepEqual(
    slots.map((s) => s.meta.name),
    [
      'settings.section',
      'settings.section.icon',
      'conversation.input.right',
      'conversation.input.dock',
      'conversation.session.header.utilities',
      'conversation.chat.assistant-actions',
    ],
  );
  assert.equal(effects.length, 5);
});
