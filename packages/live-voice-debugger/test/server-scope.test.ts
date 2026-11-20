import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, name } from '../src/server.ts';

test('host entry fails closed instead of registering unscoped debugger tools', () => {
  const registered: unknown[] = [];
  const ctx = { tools: { register: (tool: unknown) => registered.push(tool) } };
  assert.equal(name, 'dsh-live-voice-debugger');
  (apply as (...args: unknown[]) => void)(ctx);
  assert.deepEqual(registered, []);
});
