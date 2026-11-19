// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createVoiceErrorJournal } from '../src/errorJournal.ts';
import { apply } from '../src/apply.tsx';
import {
  reportVoiceError,
  VOICE_ERROR_SINK,
} from '../../live-voice/src/modules/core/diagnosticsErrors.ts';

// Minimal asynchronous IndexedDB model: sorted keys, request callbacks and transaction completion.
function storage() {
  const rows = new Map();
  let unavailable = false;
  let closed = 0;
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        if (unavailable) {
          request.onerror?.();
          return;
        }
        const connection = {
          createObjectStore() {},
          close() {
            closed++;
          },
          transaction() {
            const tx = {};
            let scheduled = false;
            const work = (fn) => {
              if (!scheduled) {
                scheduled = true;
                setTimeout(() => tx.oncomplete?.(), 0);
              }
              const req = {};
              queueMicrotask(() => {
                req.result = fn();
                req.onsuccess?.();
              });
              return req;
            };
            const store = {
              put: (row) => work(() => rows.set(row.id, structuredClone(row))),
              delete: (key) => work(() => rows.delete(key)),
              getAllKeys: () => work(() => [...rows.keys()].sort()),
              getAll: () =>
                work(() => [...rows.keys()].sort().map((key) => structuredClone(rows.get(key)))),
            };
            tx.objectStore = () => store;
            tx.abort = () => tx.onabort?.();
            return tx;
          },
        };
        request.result = connection;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return {
    indexedDB,
    rows,
    set unavailable(value) {
      unavailable = value;
    },
    get closed() {
      return closed;
    },
  };
}
const event = (target, operation = 'test.op', recordingId = 'rec-1') =>
  reportVoiceError(operation, new Error('private text'), { recordingId }, {}, target);
const targetFor = (db) => ({ indexedDB: db.indexedDB, crypto: { randomUUID: () => 'test-id' } });

test('persists, orders, filters and paginates sanitized errors', async (t) => {
  const db = storage(),
    target = targetFor(db),
    journal = createVoiceErrorJournal(target);
  t.after(() => journal.dispose());
  event(target, 'first', 'rec-1');
  event(target, 'second', 'rec-2');
  const page = await journal.list({ limit: 1 });
  assert.equal(page.persistent, true);
  assert.equal(page.items[0].operation, 'second');
  assert.equal(page.nextOffset, 1);
  assert.equal((await journal.list({ offset: 1, limit: 1 })).items[0].operation, 'first');
  assert.equal((await journal.list({ operation: 'first', recordingId: 'rec-1' })).items.length, 1);
  assert.equal((await journal.list({ operation: 'first', recordingId: 'rec-2' })).items.length, 0);
  assert.equal(page.items[0].exception.message, undefined);
  assert.equal((await journal.list({ limit: 0 })).items.length, 1);
});

test('bounds persisted history at 500 and removes oldest keys', async (t) => {
  const db = storage();
  for (let n = 1; n <= 500; n++) {
    const id = String(n).padStart(16, '0') + ':seed:000000000001';
    db.rows.set(id, { id, at: n, operation: 'old', context: {}, exception: { name: 'Error' } });
  }
  const target = targetFor(db),
    journal = createVoiceErrorJournal(target);
  t.after(() => journal.dispose());
  event(target);
  const page = await journal.list({ limit: 999 });
  assert.equal(db.rows.size, 500);
  assert.equal(page.items.length, 50);
  assert.equal(page.nextOffset, 50);
  assert.equal(
    [...db.rows.values()].some((row) => row.at === 1),
    false,
  );
});

test('unavailable storage retains only 64 newest pending entries and recovers', async (t) => {
  const db = storage();
  db.unavailable = true;
  const target = targetFor(db),
    journal = createVoiceErrorJournal(target);
  t.after(() => journal.dispose());
  event(target, 'first');
  await journal.list();
  for (let n = 0; n < 70; n++) event(target, 'e' + n);
  const page = await journal.list({ limit: 50 });
  assert.equal(page.persistent, false);
  assert.equal(page.dropped, 7);
  assert.equal(page.items.length, 50);
  assert.equal((await journal.list({ offset: 50, limit: 50 })).items.length, 14);
  assert.equal((await journal.list({ operation: 'first' })).items.length, 0);
  db.unavailable = false;
  // Advance the retry clock without waiting for the retry timer.
  const originalNow = Date.now;
  Date.now = () => originalNow() + 3000;
  try {
    const recovered = await journal.list({ limit: 50 });
    assert.equal(recovered.persistent, true);
    assert.equal(db.rows.size, 64);
  } finally {
    Date.now = originalNow;
  }
});

test('disposal unbinds only its own sink and closes storage', async () => {
  const db = storage(),
    target = targetFor(db),
    journal = createVoiceErrorJournal(target);
  event(target);
  await journal.list();
  const replacement = () => {};
  target[VOICE_ERROR_SINK] = replacement;
  journal.dispose();
  assert.equal(target[VOICE_ERROR_SINK], replacement);
  assert.equal(db.closed, 1);
});

test('apply installs journal without opening a popup and removes it on effect disposal', async (t) => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test' });
  const previous = globalThis.window;
  globalThis.window = dom.window;
  t.after(() => {
    globalThis.window = previous;
    dom.window.close();
  });
  const db = storage();
  Object.defineProperty(dom.window, 'indexedDB', { value: db.indexedDB });
  const disposers = [];
  const ctx = {
    locale: {
      addLanguage: () => () => {},
      register: () => () => {},
      bind: () => () => '',
      subscribe: () => () => {},
      getSnapshot: () => ({ active: 'en' }),
    },
    effect: (fn) => {
      const dispose = fn();
      if (dispose) disposers.push(dispose);
    },
  };
  apply(ctx);
  assert.equal(typeof dom.window[VOICE_ERROR_SINK], 'function');
  event(dom.window);
  // Wait for the asynchronous write, not for popup creation.
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(db.rows.size, 1);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(dom.window[VOICE_ERROR_SINK], undefined);
  event(dom.window);
  assert.equal(db.rows.size, 1);
  assert.equal(db.closed, 1);
});
