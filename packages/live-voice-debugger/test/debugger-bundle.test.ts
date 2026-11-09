import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import React from 'react';

test('optional debugger bundle loads independently without bundling the voice coordinator', async () => {
  const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let registration: any;
  vm.runInNewContext(code, {
    window: {
      __ModuleLoader__: {
        load: (value) => {
          registration = value;
        },
      },
    },
  });
  assert.equal(registration.id, 'dsh-live-voice-debugger');
  const plugin = registration.factory((id: string) => {
    if (id === 'react') return React;
    if (id === 'react-dom') return { createPortal() {} };
    if (id === 'react-dom/client') return { createRoot() {} };
    assert.fail('Unexpected bundled dependency: ' + id);
  });
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual([...plugin.inject], ['locale']);
  assert.doesNotMatch(code, /class VoiceCoordinator/);
  const main = await readFile(new URL('../../live-voice/lib/client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /dlvd-panel|Show floating debugger/);
});
