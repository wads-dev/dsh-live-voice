// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useConversationActions } from '../src/modules/conversation/hooks/useConversationActions.js';
import { installVoiceErrorSink } from '../src/modules/core/diagnosticsErrors.js';

test('conversation actions report sync and async failures without their content', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const events = [];
  const unbind = installVoiceErrorSink(globalThis, event => events.push(event));
  const root = createRoot(document.getElementById('root'));
  let actions;
  const error = () => Object.assign(new Error('private transcript'), { code: 'http_503' });
  const controller = { sync: () => { throw error(); }, async: async () => { throw error(); } };
  function Fixture() { actions = useConversationActions(controller); return null; }
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => actions.invoke('sync'));
    await act(async () => actions.invoke('async'));
    assert.deepEqual(events.map(e => [e.operation, e.context.stage, e.exception.code]), [['conversation.action', 'sync', 'http_503'], ['conversation.action', 'async', 'http_503']]);
    assert.doesNotMatch(JSON.stringify(events), /private/);
  } finally {
    await act(async () => root.unmount()); unbind(); dom.window.close();
    globalThis.window = previous.window; globalThis.document = previous.document; globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});
