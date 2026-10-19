// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_VOICE_LANGUAGES,
  LIVE_VOICE_LOCALE_NAMESPACE,
  createFallbackTranslator,
  liveVoiceDictionaries,
  registerLiveVoiceLocales,
} from '../src/app/client/i18n/index.ts';

test('ships complete typed dictionaries for DSH built-ins and contributed languages', async () => {
  const baseSource = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../src/app/client/i18n/catalogs/base.ts', import.meta.url), 'utf8'),
  );
  assert.match(baseSource, /export interface LiveVoiceTranslation/);
  for (const locale of ['en', 'zh', 'pt-BR', 'fr', 'es', 'hi']) {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(
        new URL('../src/app/client/i18n/catalogs/' + locale + '.ts', import.meta.url),
        'utf8',
      ),
    );
    assert.match(
      source,
      new RegExp('const ' + (locale === 'pt-BR' ? 'ptBR' : locale) + ': LiveVoiceTranslation ='),
    );
    assert.doesNotMatch(source, /\.\.\.en/);
  }
  const locales = ['en', 'zh', 'pt-BR', 'fr', 'es', 'hi'];
  const englishKeys = Object.keys(liveVoiceDictionaries.en).sort();
  assert.deepEqual(Object.keys(liveVoiceDictionaries).sort(), locales.sort());
  for (const locale of locales)
    assert.deepEqual(
      Object.keys(liveVoiceDictionaries[locale]).sort(),
      englishKeys,
      locale + ' dictionary',
    );
  assert.deepEqual(
    LIVE_VOICE_LANGUAGES.map((language) => language.id),
    ['pt-BR', 'fr', 'es', 'hi'],
  );
  assert.equal(
    createFallbackTranslator('pt-BR')('dsh-live-voice.commons.conversation.start'),
    'Iniciar conversa por voz',
  );
  assert.equal(
    createFallbackTranslator('zh')('dsh-live-voice.commons.conversation.start'),
    '开始语音对话',
  );
  assert.equal(
    createFallbackTranslator('fr')('dsh-live-voice.commons.conversation.start'),
    'Démarrer une conversation vocale',
  );
  assert.equal(
    createFallbackTranslator('es')('dsh-live-voice.commons.conversation.start'),
    'Iniciar conversación por voz',
  );
  assert.equal(
    createFallbackTranslator('hi')('dsh-live-voice.commons.conversation.start'),
    'वॉइस बातचीत शुरू करें',
  );
  assert.equal(
    createFallbackTranslator('pt-BR')('dsh-live-voice.settings.autoSend.countdown', {
      remaining: 3,
    }),
    'Enviando em 3',
  );
});

test('catalogs preserve placeholders and contain no unreviewed English copies', () => {
  // Product names, interpolation-only templates, and genuine shared words may match English.
  const shared = new Set([
    // The user-requested ASR context example stays in English in every UI locale.
    'dsh-live-voice.recognition.context.placeholder',
    'dsh-live-voice.commons.device.numberedLabel',
    'dsh-live-voice.commons.engine.failure',
    'dsh-live-voice.commons.milliseconds',
    'dsh-live-voice.meeting.microphone',
    'dsh-live-voice.meeting.timestampsBadge',
    'dsh-live-voice.speak.macos.name',
    'dsh-live-voice.recognition.qwen.label',
    'dsh-live-voice.recognition.whisper.label',
  ]);
  const sharedWords = {
    'pt-BR': new Set([
      'dsh-live-voice.commons.manual',
      'dsh-live-voice.recognition.presets.natural.label',
      'dsh-live-voice.speak.qwen.name',
    ]),
    fr: new Set([
      // Participant is also the correct French noun.
      'dsh-live-voice.meeting.attendee.participant',
      'dsh-live-voice.debugger.label',
      'dsh-live-voice.recognition.microphone.label',
      'dsh-live-voice.settings.tabs.conversation',
      'dsh-live-voice.speak.qwen.name',
    ]),
    es: new Set([
      'dsh-live-voice.commons.manual',
      'dsh-live-voice.recognition.presets.natural.label',
      'dsh-live-voice.settings.general.title',
      'dsh-live-voice.speak.qwen.name',
    ]),
    zh: new Set(),
    hi: new Set(),
  };
  const placeholders = (value) =>
    [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [locale, dictionary] of Object.entries(liveVoiceDictionaries)) {
    assert.deepEqual(
      Object.keys(dictionary),
      Object.keys(dictionary).sort(),
      locale + ' key order',
    );
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.trim(), locale + ': ' + key);
      assert.ok(!value.startsWith('dsh-live-voice.'), locale + ': key rendered as copy');
      assert.deepEqual(
        placeholders(value),
        placeholders(liveVoiceDictionaries.en[key]),
        locale + ': ' + key,
      );
      if (locale !== 'en' && !shared.has(key) && !sharedWords[locale].has(key)) {
        assert.notEqual(value, liveVoiceDictionaries.en[key], locale + ': untranslated ' + key);
      }
    }
  }
});

test('localizes the plugin display name and every visible reference', () => {
  const names = {
    en: 'Live Voice',
    'pt-BR': 'Voz ao Vivo',
    es: 'Voz en vivo',
    fr: 'Voix en direct',
    hi: 'लाइव वॉइस',
    zh: '实时语音',
  };
  for (const [locale, name] of Object.entries(names)) {
    const t = createFallbackTranslator(locale);
    assert.equal(t('dsh-live-voice.commons.pluginName'), name);
    for (const key of [
      'dsh-live-voice.settings.title',
      'dsh-live-voice.commons.repository.starLink',
      'dsh-live-voice.commons.version.label',
      'dsh-live-voice.commons.version.link',
      'dsh-live-voice.speak.output.testPhrase',
    ]) {
      assert.ok(t(key, { version: '1.0.0' }).includes(name), locale + ': ' + key);
    }
    if (locale !== 'en') {
      for (const value of Object.values(liveVoiceDictionaries[locale]))
        assert.ok(!value.includes('Live Voice'), locale + ': untranslated plugin name');
    }
  }
});

test('registers language packs and dictionaries through DSH-owned effects', () => {
  const effects = [];
  const calls = { language: [], dictionary: [], bound: [] };
  const ctx = {
    effect(effect, label) {
      effects.push({ effect, label });
    },
    locale: {
      addLanguage(language) {
        calls.language.push(language);
        return () => {};
      },
      register(namespace, locale, dictionary) {
        calls.dictionary.push({ namespace, locale, dictionary });
        return () => {};
      },
      bind(namespace) {
        calls.bound.push(namespace);
        return createFallbackTranslator();
      },
    },
  };
  const t = registerLiveVoiceLocales(ctx);
  for (const entry of effects) entry.effect();
  assert.equal(calls.bound[0], LIVE_VOICE_LOCALE_NAMESPACE);
  assert.deepEqual(
    calls.language.map((language) => language.id),
    ['pt-BR', 'fr', 'es', 'hi'],
  );
  assert.deepEqual(calls.dictionary.map((entry) => entry.locale).sort(), [
    'en',
    'es',
    'fr',
    'hi',
    'pt-BR',
    'zh',
  ]);
  assert.ok(calls.dictionary.every((entry) => entry.namespace === LIVE_VOICE_LOCALE_NAMESPACE));
  assert.equal(t('dsh-live-voice.commons.pluginName'), 'Live Voice');
});
