// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { TimelineWindow } from '../src/TimelineWindow.js';
import { copyFor } from '../src/i18n/index.js';

test('single-track selector resizes edges, pans fixed width, clamps and releases pointer capture', async (t) => {
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
    Object.assign(globalThis, previous);
    dom.window.close();
  });
  const captured = new Set();
  dom.window.HTMLElement.prototype.setPointerCapture = (id) => captured.add(id);
  dom.window.HTMLElement.prototype.hasPointerCapture = (id) => captured.has(id);
  dom.window.HTMLElement.prototype.releasePointerCapture = (id) => captured.delete(id);
  let state = [0, 1000],
    set,
    total = 1000;
  function Harness() {
    const [value, update] = React.useState(state);
    set = update;
    state = value;
    return (
      <TimelineWindow
        total={total}
        start={value[0]}
        end={value[1]}
        copy={copyFor().recordings}
        format={String}
        onChange={(a, b) => update([a, b])}
        onReset={() => update([0, total])}
      />
    );
  }
  await act(async () => root.render(<Harness />));
  document.querySelector('.dlvd-window-track').getBoundingClientRect = () => ({
    left: 10,
    width: 1000,
  });
  assert.ok(document.body.textContent.includes(copyFor().recordings.start + ':'));
  assert.ok(document.body.textContent.includes(copyFor().recordings.end + ':'));
  assert.equal(document.body.textContent.includes(copyFor().recordings.windowStart + ':'), false);
  assert.equal(document.body.textContent.includes(copyFor().recordings.windowEnd + ':'), false);
  const start = document.querySelector('[data-edge=start]');
  const end = document.querySelector('[data-edge=end]');
  const middle = document.querySelector('.dlvd-window-selection');
  const pointer = async (element, type, x, id = 1, button = 0) =>
    act(async () => {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        pointerId: { value: id },
        clientX: { value: x },
        button: { value: button },
      });
      element.dispatchEvent(event);
    });
  const key = async (element, key, shiftKey = false) =>
    act(async () => {
      element.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
      );
    });
  await pointer(start, 'pointerdown', 10);
  assert.equal(document.activeElement, start);
  assert.ok(captured.has(1));
  await pointer(start, 'pointermove', 210);
  await pointer(start, 'pointerup', 210);
  assert.deepEqual(state, [200, 1000]);
  assert.equal(captured.size, 0);
  await pointer(end, 'pointerdown', 1010);
  await pointer(end, 'pointerup', 810);
  assert.deepEqual(state, [200, 800]);
  await pointer(middle, 'pointerdown', 500);
  await pointer(middle, 'pointermove', 600, 2);
  assert.deepEqual(state, [200, 800], 'other pointer cannot move selection');
  await pointer(middle, 'pointermove', 600);
  assert.deepEqual(state, [300, 900]);
  await pointer(middle, 'pointerup', 5000);
  assert.deepEqual(state, [400, 1000], 'pan clamps without shrinking');
  await pointer(middle, 'pointerdown', 500);
  await pointer(middle, 'pointerup', -5000);
  assert.deepEqual(state, [0, 600]);
  await pointer(start, 'pointerdown', 10);
  await pointer(start, 'pointerup', 5000);
  assert.deepEqual(state, [599, 600], 'edges cannot cross');
  await key(start, 'Home');
  await key(end, 'End');
  await key(end, 'ArrowLeft');
  await key(start, 'ArrowRight', true);
  assert.deepEqual(state, [100, 990]);
  await key(middle, 'Home');
  assert.deepEqual(state, [0, 890]);
  await key(middle, 'End');
  assert.deepEqual(state, [110, 1000]);
  await pointer(middle, 'pointerdown', 500);
  await pointer(middle, 'pointercancel', 500);
  await pointer(middle, 'pointermove', 900);
  assert.deepEqual(state, [110, 1000]);
  assert.equal(captured.size, 0);
  await pointer(start, 'pointerdown', 500, 1, 2);
  await pointer(start, 'pointermove', 700);
  assert.deepEqual(state, [110, 1000], 'right mouse button does not drag');
  await act(async () => document.querySelector('.dlvd-window-reset').click());
  assert.deepEqual(state, [0, 1000]);
  await act(async () => set([200, 800]));
  await pointer(middle, 'pointerdown', 500);
  total = 1200;
  await act(async () => root.render(<Harness />));
  await pointer(middle, 'pointerup', 600);
  assert.deepEqual(state, [300, 900], 'live growth cannot cancel or rescale an active drag');
  await pointer(middle, 'pointerdown', 500);
  total = 0;
  await act(async () => {
    set([0, 0]);
  });
  assert.equal(captured.size, 0, 'disabling capture releases the pointer');
  assert.equal(document.querySelectorAll('[role=slider]:disabled').length, 3);
  assert.equal(start.getAttribute('aria-valuenow'), '0');
  assert.equal(end.getAttribute('aria-valuemax'), '0');
});
