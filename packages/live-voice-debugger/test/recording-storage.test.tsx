// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { RecordingPanel } from '../src/RecordingPanel.js';
import { RecordingStorage, recordingStorage } from '../src/RecordingStorage.js';
import { copyFor } from '../src/i18n/index.js';
import { RECORDING_KEY, recordingSegments } from '../../live-voice/src/modules/recording/types.js';
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const recording = (id, extra = {}) => ({
  id,
  sourceId: id,
  kind: 'microphone',
  label: id,
  startedAt: '2026-10-19T14:00:00Z',
  state: 'completed',
  sampleRate: 16000,
  capturedSamples: 16000,
  savedSamples: 16000,
  audioBytes: 1_000_000,
  pins: [],
  attempts: [],
  ...extra,
});
async function setup(t, initial) {
  const dom = new JSDOM('<div id="root"></div>');
  const prev = {
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
    Object.assign(globalThis, prev);
    dom.window.close();
  });
  const calls = [];
  let records = [...initial];
  const listeners = new Set();
  const service = {
    version: 1,
    list: async () => [...records],
    get: async (id) => records.find((s) => s.id === id) ?? null,
    segments: recordingSegments,
    audio: async () => new Blob(),
    export: async () => new Blob(),
    setStarred: async () => {},
    subscribe: (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    remove: async (id) => {
      calls.push(id);
      records = records.filter((s) => s.id !== id);
      [...listeners].forEach((f) => f());
    },
  };
  const copy = copyFor('pt-BR');
  let refreshes = 0;
  const busy = [];
  const render = async (overrides = {}) => {
    await act(async () => {
      root.render(
        <RecordingStorage
          service={service}
          sessions={records}
          loading={false}
          failed={false}
          copy={copy.recordings}
          refresh={() => refreshes++}
          onBusy={(b) => busy.push(b)}
          {...overrides}
        />,
      );
      await flush();
    });
  };
  const click = async (selector) => {
    await act(async () => {
      document.querySelector(selector).click();
      await flush();
    });
  };
  return {
    dom,
    root,
    service,
    copy,
    calls,
    render,
    click,
    busy,
    get records() {
      return records;
    },
    set records(v) {
      records = v;
    },
    get refreshes() {
      return refreshes;
    },
  };
}
test('storage measurement retains global known bytes and exposes incomplete legacy sessions', () => {
  assert.deepEqual(
    recordingStorage([
      recording('known'),
      recording('old', { audioBytes: undefined }),
      recording('invalid', { audioBytes: NaN }),
    ]),
    { bytes: 1_000_000, unknown: 2, count: 3 },
  );
  assert.deepEqual(recordingStorage([]), { bytes: 0, unknown: 0, count: 0 });
});
test('global storage card remains independent of source filtering and confirms all sources without inspection mutations', async (t) => {
  const f = await setup(t, [
    recording('mic', { starred: true }),
    recording('shared', { kind: 'shared', audioBytes: 2_000_000 }),
  ]);
  const target = new f.dom.window.EventTarget();
  target[RECORDING_KEY] = f.service;
  await act(async () => {
    f.root.render(<RecordingPanel target={target} copy={f.copy} />);
    await flush();
  });
  assert.ok(document.querySelector('.dlvd-audio-total').textContent.includes('3.000 MB'));
  const select = document.querySelector('.dlvd-toolbar select');
  await act(async () => {
    select.value = JSON.stringify(['microphone', 'mic']);
    select.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
    await flush();
  });
  assert.ok(document.querySelector('.dlvd-audio-total').textContent.includes('3.000 MB'));
  await f.click('.dlvd-storage-overview button');
  assert.ok(document.querySelector('.dlvd-delete-all-confirm').textContent.includes('2 sessão'));
  assert.ok(
    document.querySelector('.dlvd-delete-all-confirm').textContent.includes('1 com estrela'),
  );
  assert.equal(document.activeElement.textContent, f.copy.recordings.cancel);
  assert.deepEqual(f.calls, []);
  await act(async () =>
    document.activeElement.dispatchEvent(
      new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    ),
  );
  assert.equal(document.querySelector('.dlvd-delete-all-confirm'), null);
  assert.deepEqual(f.calls, []);
  await f.click('.dlvd-storage-overview button');
  await f.click('.dlvd-delete-all-confirm .dlvd-delete-all');
  assert.deepEqual(f.calls, ['mic', 'shared']);
  assert.equal(f.records.length, 0);
  assert.ok(document.querySelector('.dlvd-audio-total').textContent.includes('0.000 MB'));
  assert.ok(document.querySelector('.dlvd-storage-result').textContent.includes('Apagadas: 2'));
});
test('bulk deletion uses confirmed snapshot, rechecks pending work and reports partial failures', async (t) => {
  const f = await setup(t, [
    recording('star', { starred: true }),
    recording('later-busy'),
    recording('failed'),
    recording('active', { state: 'recording' }),
    recording('pending', { attempts: [{ status: 'pending' }] }),
  ]);
  await f.render();
  await f.click('.dlvd-storage-overview button');
  f.records.find((s) => s.id === 'later-busy').attempts = [{ status: 'pending' }];
  f.records.push(recording('new-after-preview'));
  const remove = f.service.remove;
  f.service.remove = async (id) => {
    if (id === 'failed') throw Error('storage failed');
    return remove(id);
  };
  await f.click('.dlvd-delete-all-confirm .dlvd-delete-all');
  assert.deepEqual(f.calls, ['star']);
  const text = document.querySelector('.dlvd-storage-result').textContent;
  assert.ok(text.includes('Apagadas: 1'));
  assert.ok(text.includes('Preservadas ou já ausentes: 3'));
  assert.ok(text.includes('Falhas: 1'));
  assert.equal(document.querySelector('.dlvd-storage-result').getAttribute('role'), 'alert');
  assert.ok(f.records.some((s) => s.id === 'new-after-preview'));
  assert.equal(f.refreshes, 1);
  assert.deepEqual(f.busy, [false, true, false]);
});
for (const cancel of ['replacement', 'pagehide', 'unmount'])
  test('bulk deletion stops before next request after ' + cancel, async (t) => {
    const f = await setup(t, [recording('first'), recording('second')]);
    await f.render();
    await f.click('.dlvd-storage-overview button');
    const pending = deferred();
    f.service.remove = async (id) => {
      f.calls.push(id);
      await pending.promise;
    };
    await f.click('.dlvd-delete-all-confirm .dlvd-delete-all');
    assert.deepEqual(f.calls, ['first']);
    // A double activation must not launch a second batch.
    await f.click('.dlvd-delete-all-confirm .dlvd-delete-all');
    assert.deepEqual(f.calls, ['first']);
    if (cancel === 'replacement') await f.render({ service: { ...f.service } });
    else if (cancel === 'pagehide')
      await act(async () => f.dom.window.dispatchEvent(new f.dom.window.Event('pagehide')));
    else await act(async () => f.root.unmount());
    await act(async () => {
      pending.resolve();
      await flush();
    });
    assert.deepEqual(f.calls, ['first']);
    assert.equal(f.refreshes, 0);
  });
test('partial storage is not zero and loading or failed enumeration cannot authorize deletion', async (t) => {
  const f = await setup(t, [recording('known'), recording('legacy', { audioBytes: undefined })]);
  await f.render();
  assert.ok(
    document.querySelector('.dlvd-audio-total').textContent.includes('Pelo menos 1.000 MB'),
  );
  assert.ok(document.querySelector('.dlvd-audio-total').textContent.includes('1 sessão'));
  await f.render({ loading: true });
  assert.equal(document.querySelector('.dlvd-storage-overview button').disabled, true);
  assert.ok(!document.querySelector('.dlvd-audio-total').textContent.includes('0.000'));
  await f.render({ failed: true });
  assert.equal(document.querySelector('.dlvd-storage-overview button').disabled, true);
  assert.ok(
    document
      .querySelector('.dlvd-audio-total')
      .textContent.includes(f.copy.recordings.storageUnknown),
  );
});
