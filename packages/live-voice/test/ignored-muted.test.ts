// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceCoordinator } from '../src/modules/core/coordinator.js';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
function coordinator() {
  return new VoiceCoordinator({
    recognition: { stop: async () => {} },
    meter: { stop: async () => {} },
    engines: {},
    composer: { getDraft: () => '', setDraft: () => assert.fail('muted text must not write') },
    settings: { recognitionFilterEnabled: false },
  });
}
test('only nonempty muted non-command finals acknowledge ignored speech', async () => {
  const c = coordinator();
  c.patch({ listening: true, muted: true });
  let ignored = 0,
    commands = 0;
  const callbacks = { onIgnoredMuted: () => ignored++, onCommandRecognized: () => commands++ };
  c.onResult({ final: 'words while muted', ...callbacks });
  assert.equal(ignored, 1);
  c.onResult({ final: 'send', ...callbacks });
  assert.equal(ignored, 1);
  assert.equal(commands, 1);
  c.onResult({ final: ' ', ...callbacks });
  c.onResult({ interim: 'pending words', ...callbacks });
  assert.equal(ignored, 1);
  await c.dispose();
});
for (const source of ['shared', 'attendee:person'])
  test(source + ' forwards ignored and command acknowledgement to original recording', async () => {
    let cb;
    let ignored = 0,
      commands = 0;
    const m = new MeetingController({
      composer: { getDraft: () => '', setDraft: () => assert.fail('ignored draft') },
      settings: () => ({ recognitionFilterEnabled: false }),
      translate: (x) => x,
      createSource: () => ({
        meter: {
          provide() {},
          start: async () => true,
          stop: async () => {},
          stream: { getTracks: () => [] },
        },
        engine: {
          capability: async () => ({ supported: true }),
          start: async (options) => {
            cb = options;
          },
          stop: async () => {},
        },
      }),
    });
    await m.start(source);
    m.input(source).patch({ muted: true });
    cb.onResult({ final: 'ignored words', onIgnoredMuted: () => ignored++ });
    cb.onResult({ final: 'send', onCommandRecognized: () => commands++ });
    assert.equal(ignored, 1);
    assert.equal(commands, 1);
    await m.dispose();
  });
