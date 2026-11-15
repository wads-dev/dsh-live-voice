import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerSettingsSlot, LiveVoiceSettingsIcon } from '../src/app/client/registerSlots.tsx';
import { CLIENT_SLOT_DEFINITIONS, SETTINGS_SLOT } from '../src/app/client/slotDefinitions.ts';

test('app client preserves every established DSH slot contract', () => {
  assert.deepEqual(SETTINGS_SLOT, { name: 'settings.section', id: 'dsh-live-voice', order: 65 });
  assert.deepEqual(CLIENT_SLOT_DEFINITIONS, [
    { name: 'conversation.input.right', id: 'live-voice-controls', order: 6, component: 'Buttons' },
    { name: 'conversation.input.dock', id: 'live-voice-status', order: -100, component: 'Dock' },
    {
      name: 'conversation.session.header.utilities',
      id: 'live-voice-question-status',
      order: 100,
      component: 'QuestionStatus',
    },
    {
      name: 'conversation.chat.assistant-actions',
      id: 'live-voice-speak',
      order: 5,
      component: 'Action',
    },
  ]);
});

test('settings menu icon uses the official optional slot and matching section identity', () => {
  const registrations: any[] = [];
  const injected: string[] = [];
  const ctx = {
    slots: {
      inject(name: string, callback: () => unknown) {
        injected.push(name);
        return callback();
      },
      register(options: unknown, component: unknown) {
        registrations.push({ options, component });
      },
    },
  };
  registerSettingsSlot(
    ctx,
    () => null,
    () => 'Live Voice',
  );
  assert.deepEqual(injected, ['settings.section', 'settings.section.icon']);
  assert.equal(registrations[0].options.order, 65);
  assert.deepEqual(registrations[1].options, {
    name: 'settings.section.icon',
    id: SETTINGS_SLOT.id,
  });
  assert.equal(registrations[1].component, LiveVoiceSettingsIcon);
  const markup = renderToStaticMarkup(
    React.createElement(LiveVoiceSettingsIcon, { size: 24, active: true }),
  );
  assert.match(markup, /width="24"/);
  assert.match(markup, /height="24"/);
  assert.match(markup, /stroke="currentColor"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /focusable="false"/);
});
