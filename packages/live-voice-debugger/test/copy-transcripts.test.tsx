// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { CopyTranscripts, segmentTranscripts } from '../src/CopyTranscripts.js';
import { copyFor } from '../src/i18n/index.js';
const row = (texts) => ({ attempts: texts.map((text) => ({ status: 'success', text })) });
test('copies latest successful text once per displayed segment, excluding empty/error attempts', () => {
  assert.equal(
    segmentTranscripts([
      row(['old', 'new']),
      row([]),
      {
        attempts: [
          { status: 'success', text: 'ignored speech' },
          { status: 'error', text: 'bad' },
        ],
      },
      row(['new']),
    ]),
    'new\n\nignored speech\n\nnew',
  );
});
test('clipboard uses owner window, reports success/failure and disables empty lists', async (t) => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
  });
  let written;
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text) => {
        written = text;
      },
    },
  });
  const render = async (segments) =>
    act(async () =>
      root.render(<CopyTranscripts segments={segments} copy={copyFor().recordings} />),
    );
  await render([row(['one']), row(['two'])]);
  await act(async () => document.querySelector('button').click());
  assert.equal(written, 'one\n\ntwo');
  assert.ok(document.querySelector('[role=status]'));
  await render([]);
  assert.equal(document.querySelector('button').disabled, true);
  assert.equal(document.querySelector('[role=status]'), null);
  await render([row(['three'])]);
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: undefined });
  await act(async () => document.querySelector('button').click());
  assert.ok(document.querySelector('[role=alert]'));
});
