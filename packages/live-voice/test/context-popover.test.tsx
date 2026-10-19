// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ContextPopover } from '../src/shared/design-system/feedback/ContextPopover.js';

for (const openOnClick of [false, true]) {
  test(
    'context popover preserves primary action by default; click opt-in ' + openOnClick,
    async (t) => {
      const dom = new JSDOM('<div id="root"></div><button id="outside">Outside</button>');
      const old = { window: globalThis.window, document: globalThis.document };
      Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        IS_REACT_ACT_ENVIRONMENT: true,
      });
      const root = createRoot(document.getElementById('root'));
      t.after(async () => {
        await act(async () => root.unmount());
        dom.window.close();
        Object.assign(globalThis, old);
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      });
      let primary = 0;
      await act(async () =>
        root.render(
          <ContextPopover
            label="Device actions"
            openOnClick={openOnClick}
            trigger={<button onClick={() => primary++}>Trigger</button>}
          >
            <button>First action</button>
            <input aria-label="Field" />
          </ContextPopover>,
        ),
      );
      const trigger = document.querySelector('#root > button');
      await act(async () => trigger.click());
      assert.equal(primary, openOnClick ? 0 : 1);
      assert.equal(!!document.querySelector('[role=dialog]'), openOnClick);
      if (openOnClick) {
        assert.equal(document.activeElement.textContent, 'First action');
        await act(async () =>
          document.dispatchEvent(
            new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          ),
        );
        assert.equal(document.activeElement, trigger);
      }
      await act(async () =>
        trigger.dispatchEvent(
          new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        ),
      );
      assert.ok(document.querySelector('[role=dialog]'));
      assert.equal(trigger.getAttribute('aria-expanded'), 'true');
      await act(async () => document.getElementById('outside').focus());
      assert.equal(document.querySelector('[role=dialog]'), null);
      await act(async () =>
        trigger.dispatchEvent(
          new window.KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }),
        ),
      );
      assert.ok(document.querySelector('[role=dialog]'));
      await act(async () =>
        document
          .getElementById('outside')
          .dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true })),
      );
      assert.equal(document.querySelector('[role=dialog]'), null);
      assert.equal(
        primary,
        openOnClick ? 0 : 1,
        'context and keyboard opening never run primary action',
      );
    },
  );
}

test('expanded meeting forms stay within a narrow viewport and release size observation', async (t) => {
  const dom = new JSDOM('<div id="root"></div>');
  const old = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperties(window, {
    innerWidth: { value: 320, configurable: true },
    innerHeight: { value: 480, configurable: true },
  });
  let resize,
    disconnected = 0,
    height = 80;
  const observed = [];
  window.ResizeObserver = class {
    constructor(callback) {
      resize = callback;
    }
    observe(node) {
      observed.push(node);
    }
    disconnect() {
      disconnected++;
    }
  };
  const rect = window.HTMLElement.prototype.getBoundingClientRect;
  t.mock.method(window.HTMLElement.prototype, 'getBoundingClientRect', function () {
    if (this.getAttribute('role') === 'dialog') {
      return {
        width: 280,
        height: Math.min(height, Number.parseFloat(this.style.maxHeight) || height),
      };
    }
    return { top: 440, right: 310, width: 34, height: 30 };
  });
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, old);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  await act(async () =>
    root.render(
      <ContextPopover label="Meeting actions" openOnClick trigger={<button>Meeting</button>}>
        <button>Join</button>
      </ContextPopover>,
    ),
  );
  const trigger = document.querySelector('#root > button');
  await act(async () => trigger.click());
  const panel = document.querySelector('[role=dialog]');
  assert.deepEqual(observed, [panel, trigger]);
  assert.equal(panel.style.top, '352px');
  assert.equal(panel.style.left, '28px');
  height = 400;
  await act(async () => resize());
  assert.equal(panel.style.top, '32px', 'opening a larger form repositions above the anchor');
  height = 900;
  await act(async () => resize());
  assert.equal(panel.style.top, '12px');
  assert.equal(panel.style.maxHeight, '456px');
  assert.ok(
    Number.parseFloat(panel.style.top) + panel.getBoundingClientRect().height <=
      window.innerHeight - 12,
  );
  await act(async () => trigger.click());
  assert.equal(disconnected, 1);
});
