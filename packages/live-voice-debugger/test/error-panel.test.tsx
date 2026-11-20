// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { DebuggerPanel } from '../src/DebuggerPanel.tsx';
import { dictionaries } from '../src/i18n/index.ts';

test('error tab renders only structured fields, updates, paginates and unsubscribes', async (t) => {
  const dom = new JSDOM('<div id="root"></div>');
  const old = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  t.after(() => { Object.assign(globalThis, old); dom.window.close(); });
  let listener, offset = -1, persistent = false;
  const journal = {
    subscribe(fn) { listener = fn; return () => { listener = null; }; },
    async list(query) { offset = query.offset; return { persistent, dropped: 3, nextOffset: offset ? null : 20, items: [{ id: '1', at: 1700000000000, operation: 'voice.capture', context: { recordingId: 'secret-recording', stage: 'encode', attempt: 2, status: 503 }, exception: { name: 'TypeError', code: 'ENCODE_FAILED', message: 'secret message', frames: ['12:34', '/secret/path:56:78', 'secret frame'], cause: { name: 'AbortError', message: 'secret cause' } } }] }; },
  };
  const root = createRoot(document.getElementById('root'));
  for (const [locale, copy] of Object.entries(dictionaries)) {
    await act(async () => root.render(<DebuggerPanel copy={copy} locale={locale} journal={journal} onClose={() => {}} />));
    const tab = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent === copy.commons.errorJournalTitle);
    await act(async () => { tab.click(); await Promise.resolve(); });
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    assert.equal(panel.getAttribute('aria-labelledby'), tab.id);
    assert.equal(panel.hidden, false);
    assert.match(panel.textContent, /TypeError/); assert.match(panel.textContent, /AbortError/); assert.match(panel.textContent, /voice.capture/);
    assert.ok(panel.textContent.includes(copy.commons.errorNonPersistent));
    assert.ok(panel.textContent.includes(copy.commons.errorDropped + ": 3"));
    assert.doesNotMatch(panel.textContent, /secret/);
    for (const [label, value] of [[copy.commons.errorCode, 'ENCODE_FAILED'], [copy.commons.errorStage, 'encode'], [copy.commons.errorAttempt, '2'], [copy.commons.errorStatus, '503'], [copy.commons.errorFrames, '12:34']]) {
      const dt = [...panel.querySelectorAll('dt')].find(node => node.textContent === label);
      assert.equal(dt.nextElementSibling.textContent, value);
    }
    assert.equal(panel.querySelector('time').dateTime, '2023-11-14T22:13:20.000Z');
  }
  const copy = dictionaries['pt-BR'];
  await act(async () => document.querySelector('[id$="-errors"] button:last-child').click());
  assert.equal(offset, 20);
  persistent = true;
  await act(async () => { listener(); await Promise.resolve(); });
  assert.ok(!document.querySelector('[id$="-errors"]').textContent.includes(copy.commons.errorNonPersistent));
  await act(async () => root.unmount());
  assert.equal(listener, null);
});
