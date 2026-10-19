// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { normalizeProjectConfig } from '@wads.dev/i18n-ts/config';
import {
  Langs,
  dictionaries,
  copyFor,
  normalizeDebuggerLocale,
  registerDshLocales,
  withDebuggerLanguage,
  useDebuggerLanguage,
} from '../src/i18n/index.ts';
const root = 'packages/live-voice-debugger/';
const hashes = {
  en: '6693ae07ff53f806580f8adb9d5efa978dae68b3d63f37f76013425630cbbce0',
  'pt-BR': 'e60c031bb1a59198869145b6489eb4bc1bb99d3cf895ed61e6744ed970f995eb',
  es: '1c7e59525295612dfbb64d53d554e8108961529fc0f3affadcaabe0ff1a3cdc0',
  fr: '4400c9cd28adf74084947b8080a8e7d7804fb86b13f17826690d4dc6e68b64e5',
  hi: 'f5516f93cdc0ddd4a986f10b28f569fd14103f7ac2a59ec5c79e7e2762efa08b',
  zh: '6d14f717d9b9b5314b671e48fa8c176ec35223a17f778da0f54f6ab27534382a',
};
function flatten(tree) {
  return Object.entries(tree)
    .flatMap(([group, entries]) =>
      Object.entries(entries).map(([key, value]) => [
        group === 'commons'
          ? key
          : (group === 'recordings' ? 'recording' : 'runtime') +
            key[0].toUpperCase() +
            key.slice(1),
        value,
      ]),
    )
    .sort(([a], [b]) => (a < b ? -1 : 1));
}
test('all 696 translated messages are preserved exactly in typed per-module per-locale catalogs', async () => {
  assert.deepEqual(Object.keys(dictionaries), ['en', 'es', 'fr', 'hi', 'pt-BR', 'zh']);
  for (const [locale, tree] of Object.entries(dictionaries)) {
    assert.equal(
      createHash('sha256')
        .update(
          JSON.stringify(
            flatten(tree).filter(
              ([key]) =>
                ![
                  'recordingAliasAtCapture',
                  'recordingMeetingId',
                  'recordingOriginalName',
                  'recordingParticipant',
                  'recordingParticipantDetails',
                  'recordingParticipantId',
                  'recordingAssistantEnd',
                  'recordingAssistantPause',
                  'recordingAssistantResume',
                  'recordingAssistantStart',
                  'recordingCaptureEnd',
                  'recordingCaptureGated',
                  'recordingCaptureStart',
                  'recordingEvents',
                  'recordingEventsHelp',
                  'recordingEventTime',
                  'recordingName',
                  'recordingNameError',
                  'recordingSaveName',
                  'recordingStorageAudio',
                  'recordingStorageTotal',
                  'recordingStorageUnknown',
                  'recordingSearch',
                  'recordingSearchEmpty',
                  'recordingWindow',
                  'recordingWindowEnd',
                  'recordingWindowReset',
                  'recordingWindowStart',
                ].includes(key),
            ),
          ),
        )
        .digest('hex'),
      hashes[locale],
      locale + ' copy changed',
    );
    assert.ok(Object.isFrozen(tree));
    assert.deepEqual((await Langs[locale].lang()).default, tree);
    for (const group of ['commons', 'recordings', 'runtimes']) {
      const entries = tree[group];
      assert.ok(Object.isFrozen(entries));
      assert.deepEqual(Object.keys(entries), Object.keys(entries).sort());
      assert.ok(existsSync(root + 'src/i18n/' + group + '/' + locale + '.ts'));
      for (const [key, value] of Object.entries(entries)) {
        assert.equal(typeof value, 'string');
        assert.deepEqual(
          value.match(/\{[^}]+\}/g) ?? [],
          dictionaries.en[group][key].match(/\{[^}]+\}/g) ?? [],
        );
      }
    }
  }
  const config = JSON.parse(readFileSync(root + 'i18n.config.json', 'utf8'));
  assert.deepEqual(normalizeProjectConfig(config), config);
  assert.equal(config.levelCount, 1);
  assert.equal(config.levelImports[0].path, 'src/i18n');
  assert.equal(config.levelImports[1].path, '{value}');
  assert.equal(config.languageFileTemplate, '{language}.ts');
  assert.ok(!existsSync(root + 'src/locales.ts'));
  assert.equal(normalizeDebuggerLocale('fr-CA'), 'fr');
  assert.equal(normalizeDebuggerLocale('xx'), 'en');
  assert.equal(copyFor('pt-BR').recordings.title, dictionaries['pt-BR'].recordings.title);
});
test('DSH dictionary registration uses scoped keys, six languages and disposable effects', () => {
  const added = [],
    registered = [],
    disposed = [];
  const ctx = {
    locale: {
      getSnapshot: () => ({ locales: [{ id: 'en' }] }),
      addLanguage: (l) => {
        assert.equal(l.fallback, 'en', 'DSH requires a registered fallback language');
        added.push(l);
        return () => disposed.push(l.id);
      },
      register: (namespace, locale, dict) => {
        registered.push({ namespace, locale, dict });
        return () => disposed.push(locale);
      },
      bind: (namespace) => (key) => namespace + '.' + key,
    },
    effect: (fn) => disposers.push(fn()),
  };
  const disposers = [];
  const t = registerDshLocales(ctx);
  assert.equal(added.length, 5);
  assert.equal(registered.length, 6);
  assert.equal(t('commons.developer'), 'dsh-live-voice-debugger.commons.developer');
  for (const record of registered) {
    assert.equal(record.dict['recordings.title'], dictionaries[record.locale].recordings.title);
    assert.equal(record.dict['runtimes.title'], dictionaries[record.locale].runtimes.title);
    assert.equal(record.dict.recordingTitle, undefined);
  }
  for (const dispose of disposers) dispose();
  assert.equal(disposed.length, 11);
});
test('scoped React translations follow DSH locale changes without resetting mounted view state', async (t) => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>');
  const old = {};
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    old[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  t.after(() => {
    for (const key of Object.keys(old)) {
      if (old[key]) Object.defineProperty(globalThis, key, old[key]);
      else delete globalThis[key];
    }
    dom.window.close();
  });
  let state = { active: 'pt-BR', revision: 0 };
  const listeners = new Set();
  const locale = {
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => state,
  };
  let mounts = 0;
  function View() {
    const { scoped: recordings } = useDebuggerLanguage((tree) => tree.recordings);
    const [count, setCount] = React.useState(0);
    React.useEffect(() => {
      mounts++;
      return () => mounts--;
    }, []);
    return (
      <button onClick={() => setCount((n) => n + 1)}>
        {recordings.title}:{count}
      </button>
    );
  }
  const Local = withDebuggerLanguage(View, locale);
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(<Local />));
  await act(async () => document.querySelector('button').click());
  for (const active of ['fr', 'zh', 'en', 'es', 'hi', 'pt-BR']) {
    await act(async () => {
      state = { active, revision: state.revision + 1 };
      for (const fn of listeners) fn();
      await Promise.resolve();
    });
    assert.equal(
      document.querySelector('button').textContent,
      dictionaries[active].recordings.title + ':1',
    );
    assert.equal(mounts, 1);
  }
  await act(async () => root.unmount());
  assert.equal(listeners.size, 0);
  assert.equal(mounts, 0);
});
