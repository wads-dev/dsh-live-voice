// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { RecoveryFeedback } from '../src/modules/conversation/components/RecoveryFeedback.js';
import { withAppLanguage } from '../src/app/client/i18n/index.js';

test('recovery feedback identifies independent source, attempts, cause and manual recovery', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const snapshot = { active: 'en', revision: 0 };
  const locale = { subscribe: () => () => {}, getSnapshot: () => snapshot };
  const Feedback = withAppLanguage(RecoveryFeedback, locale);
  const root = createRoot(dom.window.document.getElementById('root'));
  let retries = 0;
  try {
    await act(async () =>
      root.render(
        <Feedback
          source="shared"
          recovery={{ attempt: 2, maxAttempts: 3, retrying: true, reason: 'NetworkError' }}
          onRetry={() => retries++}
        />,
      ),
    );
    assert.match(
      dom.window.document.body.textContent,
      /Shared-audio transcription: retrying \(2\/3\).*NetworkError/,
    );
    assert.equal(dom.window.document.querySelector('button'), null);
    assert.equal(
      dom.window.document.querySelector('[role=status]').getAttribute('aria-live'),
      'polite',
    );
    await act(async () =>
      root.render(
        <Feedback
          source="speech"
          recovery={{ attempt: 3, maxAttempts: 3, retrying: false, reason: 'NotAllowedError' }}
          onRetry={() => retries++}
        />,
      ),
    );
    assert.match(dom.window.document.body.textContent, /Assistant speech: recovery stopped/);
    assert.match(dom.window.document.body.textContent, /queue is retained/);
    await act(async () => dom.window.document.querySelector('button').click());
    assert.equal(retries, 1);
    await act(async () => root.render(<Feedback source="microphone" recovery={null} />));
    assert.equal(dom.window.document.querySelector('[role=status]'), null);
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, previous);
    dom.window.close();
  }
});
