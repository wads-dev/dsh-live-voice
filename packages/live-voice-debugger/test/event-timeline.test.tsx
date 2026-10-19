// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { EventTimeline } from '../src/EventTimeline.js';
import { eventCategory, groupTimelineEvents } from '../src/eventTimelineModel.js';
import { copyFor } from '../src/i18n/index.js';
const event = (id, atSample, kind = 'assistant-start') => ({
  id,
  atSample,
  kind,
  occurredAt: '2026-10-19T14:00:00.123Z',
});

test('timeline groups nearby events by semantic category without losing real times or changing input', () => {
  const events = [
    event('a', 0),
    event('b', 1),
    event('c', 1000),
    event('d', 1000, 'voice-command-recognized'),
    event('outside', 1001),
  ];
  const before = structuredClone(events);
  const groups = groupTimelineEvents(events, 0, 1000, 360);
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups
      .flatMap((g) => g.events)
      .map((e) => e.id)
      .sort(),
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(events, before);
  assert.ok(groups.every((g) => g.fraction > 0 && g.fraction < 1));
  assert.equal(eventCategory('assistant-wait-end'), 'waiting');
  assert.equal(eventCategory('capture-gate-failed'), 'attention');
  assert.equal(eventCategory('voice-command-recognized'), 'command');
  assert.equal(groupTimelineEvents(events, 0, 1000, 10).length, 2);
  assert.deepEqual(groupTimelineEvents(events, 400, 500, 360), []);
  assert.equal(groupTimelineEvents([event('end', 0)], 0, 0, 0).length, 1);
});

test('event marker has immediate nonblocking tooltip, keyboard dismissal and full group selection', async (t) => {
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
  const events = Array.from({ length: 8 }, (_, i) => ({
    ...event('event-' + i, 1000),
    occurredAt: '2026-10-19T14:00:0' + i + '.123Z',
  }));
  let selected;
  const copy = copyFor('pt-BR').recordings;
  const render = (start = 0, end = 1000) =>
    root.render(
      <EventTimeline
        events={events}
        start={start}
        end={end}
        copy={copy}
        format={(n) => n + ' samples'}
        name={(k) => k}
        details={() => 'reason'}
        onSelect={(e) => (selected = e)}
      />,
    );
  await act(async () => render());
  const marker = document.querySelector('.dlvd-event-marker');
  assert.equal(marker.dataset.count, '8');
  assert.equal(marker.title, '');
  await act(async () =>
    marker.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })),
  );
  const tooltip = document.querySelector('[role=tooltip]');
  assert.ok(tooltip, 'no dwell timer');
  assert.equal(tooltip.style.pointerEvents, 'none');
  assert.ok(tooltip.textContent.includes('Mais 3'));
  assert.ok(tooltip.textContent.includes('14:00:00') || tooltip.textContent.includes('11:00:00'));
  assert.equal(marker.getAttribute('aria-describedby'), tooltip.id);
  await act(async () =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    ),
  );
  assert.equal(document.querySelector('[role=tooltip]'), null);
  await act(async () => marker.focus());
  assert.ok(document.querySelector('[role=tooltip]'));
  await act(async () => marker.click());
  assert.equal(selected.length, 8);
  assert.equal(document.querySelector('[role=tooltip]'), null);
  await act(async () => {
    marker.blur();
    marker.focus();
  });
  assert.ok(document.querySelector('[role=tooltip]'));
  await act(async () => render(500, 1000));
  assert.equal(document.querySelector('[role=tooltip]'), null);
  await act(async () => {
    marker.blur();
    document.querySelector('.dlvd-event-marker').focus();
  });
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('scroll')));
  assert.ok(document.querySelector('[role=tooltip]'), 'scroll repositions a focused tooltip');
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('resize')));
  assert.equal(document.querySelector('[role=tooltip]'), null);
});
