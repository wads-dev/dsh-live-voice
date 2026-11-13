import test from 'node:test';
import assert from 'node:assert/strict';
import { spokenInactivityWarning } from '../src/app/client/i18n/spokenWarning.js';
import { VoiceCoordinator } from '../src/modules/core/coordinator.js';
test('spoken warning follows TTS language independently from English UI', () => {
  const warning = spokenInactivityWarning('pt-BR', 'en', 60);
  assert.match(warning.text, /Nenhuma transcrição/);
  assert.ok(warning.text.includes('60'));
  assert.equal(warning.lang, 'pt-BR');
  assert.match(spokenInactivityWarning('en-US', 'pt-BR', 60).text, /No transcription/);
  assert.equal(spokenInactivityWarning('ja-JP', 'pt-BR', 60).lang, 'pt-BR');
  assert.match(spokenInactivityWarning('ja-JP', 'pt-BR', 60).text, /Nenhuma transcrição/);
  assert.equal(spokenInactivityWarning('PT_br', 'en', 60).lang, 'PT-br');
});
test('speech language override reaches preparation without persisting or changing subsequent speech', async () => {
  const calls: any[] = [];
  const c = new VoiceCoordinator({
    recognition: { stop: async () => {} },
    meter: { stop: async () => {} },
    engines: {
      browser: {
        prepare: async (text: any, options: any) => {
          calls.push([text, options.lang]);
          return { dispose() {} };
        },
        playPrepared: async () => {},
        stop: async () => {},
      },
    },
    composer: { getDraft: () => '', setDraft: () => {} },
    settings: { lang: 'en-US', mode: 'headphones' },
  });
  await c.play('aviso', null, true, { lang: 'pt-BR' });
  assert.equal(c.getSnapshot().settings.lang, 'en-US');
  await c.play('normal', null, true);
  assert.deepEqual(calls, [
    ['aviso', 'pt-BR'],
    ['normal', 'en-US'],
  ]);
  await c.dispose();
});
