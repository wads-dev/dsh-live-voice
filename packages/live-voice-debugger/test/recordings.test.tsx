// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import {
  RECORDING_KEY,
  RECORDING_CHANGED,
  recordingSegments,
} from '../../live-voice/src/modules/recording/types.ts';
import { createRecordingInspector } from '../src/recordingInspector.ts';
import { DebuggerPanel } from '../src/DebuggerPanel.tsx';
import { copyFor, dictionaries } from '../src/i18n/index.ts';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((r, fail) => {
    resolve = r;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const session = (id = 'mic', kind = 'microphone', sourceId = id) => ({
  id,
  kind,
  sourceId,
  label: sourceId,
  startedAt: '2026-10-14T12:00:00Z',
  state: 'completed',
  sampleRate: 100,
  capturedSamples: 1000,
  savedSamples: 900,
  persistent: true,
  codec: 'audio/wav',
  pins: [
    { id: 'silence', kind: 'silence-start', atSample: 0, confirmedAtSample: 0, delaySamples: 0 },
    { id: 'speech', kind: 'speech-start', atSample: 200, confirmedAtSample: 210, delaySamples: 10 },
  ],
  attempts: [
    {
      id: 'attempt',
      segmentId: 'speech',
      startSample: 180,
      endSample: 900,
      engine: 'test-engine',
      createdAt: '2026-10-14T12:00:00Z',
      status: 'success',
      text: 'test transcript',
      request: {
        transport: 'http-wav',
        preparedAt: '2026-10-14T12:00:00Z',
        payloadBytes: 230444,
        inputSamples: 720,
        inputSampleRate: 100,
        sampleCount: 115200,
        sampleRate: 16000,
        durationMs: 7200,
        language: 'pt-BR',
        responseStatus: 200,
      },
    },
  ],
});
function service(records) {
  const listeners = new Set();
  return {
    version: 1,
    list: async () => records,
    get: async (id) => records.find((s) => s.id === id) ?? null,
    segments: recordingSegments,
    audio: async () => new Blob(['audio']),
    export: async () => new Blob(['{}']),
    remove: async (id) => {
      const i = records.findIndex((s) => s.id === id);
      records.splice(i, 1);
    },
    setName: async (id, name) => {
      const i = records.findIndex((s) => s.id === id);
      records[i] = { ...records[i], name };
      [...listeners].forEach((f) => f());
    },
    setStarred: async (id, starred) => {
      const i = records.findIndex((s) => s.id === id);
      records[i] = { ...records[i], starred };
      [...listeners].forEach((f) => f());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify: () => [...listeners].forEach((f) => f()),
    listeners,
  };
}

test('recording inspector rejects stale selection/service results and never mutates inspection', async () => {
  const oldList = deferred();
  const old = service([session()]);
  old.list = () => oldList.promise;
  let mutations = 0;
  old.audio =
    old.export =
    old.remove =
    old.setStarred =
      () => {
        mutations++;
      };
  const target = { [RECORDING_KEY]: old };
  let view;
  const inspector = createRecordingInspector(target, (next) => {
    view = next;
  });
  inspector.discover();
  const next = service([session('a'), session('b')]);
  target[RECORDING_KEY] = next;
  inspector.discover();
  await flush();
  assert.equal(view.selected.id, 'a');
  assert.equal(old.listeners.size, 0);
  oldList.resolve([session('obsolete')]);
  await flush();
  assert.equal(view.selected.id, 'a');
  const staleGet = deferred();
  next.get = (id) => (id === 'b' ? staleGet.promise : Promise.resolve(session(id)));
  inspector.select('b');
  await flush();
  inspector.select('a');
  await flush();
  staleGet.resolve(session('b'));
  await flush();
  assert.equal(view.selected.id, 'a');
  assert.equal(mutations, 0);
  inspector.dispose();
  assert.equal(next.listeners.size, 0);
});

test('recording inspector requires the protection service method', async () => {
  const legacy = service([session()]);
  const target = { [RECORDING_KEY]: legacy };
  let view;
  const inspector = createRecordingInspector(target, (next) => {
    view = next;
  });
  inspector.discover();
  await flush();
  assert.equal(view.service, legacy);
  delete legacy.setStarred;
  inspector.discover();
  await flush();
  assert.equal(view.service, null);
  assert.equal(legacy.listeners.size, 0);
  inspector.dispose();
});

test('recording inspector refreshes subscriptions, reports promise failures and releases removed services', async () => {
  const records = [session()];
  const current = service(records);
  const target = { [RECORDING_KEY]: current };
  let view;
  const inspector = createRecordingInspector(target, (next) => {
    view = next;
  });
  inspector.discover();
  await flush();
  records.push(session('shared', 'shared'));
  current.notify();
  await flush();
  assert.equal(view.sessions.length, 2);
  current.list = async () => {
    throw new Error('private raw error');
  };
  current.notify();
  await flush();
  assert.equal(view.failed, true);
  delete target[RECORDING_KEY];
  inspector.discover();
  assert.equal(view.service, null);
  assert.equal(current.listeners.size, 0);
  inspector.dispose();
});

test('integrated primary recordings tab separates sources, plays silence, exports and confirms delete', async (t) => {
  const owner = new JSDOM('<div id="root"></div>');
  const target = new JSDOM('');
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: owner.window,
    document: owner.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    Object.assign(globalThis, previous);
    owner.window.close();
    target.window.close();
  });
  const records = [session(), session('share-a', 'shared'), session('share-b', 'shared')];
  records.forEach((record, index) => {
    record.audioBytes = (index + 1) * 1_000_000;
  });
  records[0].pins.push({
    id: 'second-silence',
    kind: 'silence-start',
    atSample: 500,
    confirmedAtSample: 550,
    delaySamples: 50,
  });
  records[0].starred = true;
  records[0].events = [
    {
      id: 'assistant',
      kind: 'assistant-start',
      occurredAt: '2026-10-14T12:00:09.123Z',
      atSample: 900,
    },
  ];
  const current = service(records);
  target.window[RECORDING_KEY] = current;
  const audioCalls = [],
    urls = [],
    revoked = [],
    exports = [],
    removed = [];
  let downloaded;
  owner.window.URL.createObjectURL = (blob) => {
    const url = 'blob:test-' + urls.length;
    urls.push(url);
    return url;
  };
  owner.window.URL.revokeObjectURL = (url) => revoked.push(url);
  target.window.URL.createObjectURL = () => assert.fail('Must use popup owner');
  owner.window.HTMLMediaElement.prototype.play = async () => {};
  owner.window.HTMLMediaElement.prototype.pause = () => {};
  owner.window.HTMLMediaElement.prototype.load = () => {};
  owner.window.HTMLAnchorElement.prototype.click = function () {
    downloaded = this.download;
  };
  current.audio = async (...args) => {
    audioCalls.push(args);
    return new Blob(['audio']);
  };
  current.export = async (id) => {
    exports.push(id);
    return new Blob(['{}']);
  };
  current.remove = async (id) => {
    removed.push(id);
    records.splice(
      records.findIndex((s) => s.id === id),
      1,
    );
    current.notify();
  };
  const copy = copyFor();
  await act(async () => {
    root.render(<DebuggerPanel copy={copy} target={target.window} onClose={() => {}} />);
    await flush();
  });
  assert.equal(
    document.querySelector('[role=tab][aria-selected=true]').textContent,
    copy.recordings.title,
  );
  const select = document.querySelector('.dlvd-recordings select');
  assert.equal(select.options.length, 4);
  assert.match(document.querySelector('.dlvd-recording-detail').textContent, /test transcript/);
  assert.ok(document.querySelector('.dlvd-request').textContent.includes('230,444 B'));
  assert.ok(document.querySelector('.dlvd-request').textContent.includes('7.200 s'));
  assert.ok(
    document.querySelector('.dlvd-request').textContent.includes(copy.recordings.requestHelp),
  );
  assert.ok(
    document
      .querySelector('.dlvd-recording-events')
      .textContent.includes(copy.recordings.assistantStart),
  );
  assert.equal(document.querySelectorAll('.dlvd-event-pin').length, 1);
  assert.ok(document.querySelector('.dlvd-audio-total').textContent.includes('6.000 MB'));
  assert.ok(document.querySelector('.dlvd-recording-meta').textContent.includes('1.000 MB'));
  const inputValue = async (field, value) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(owner.window.HTMLInputElement.prototype, 'value').set.call(
        field,
        String(value),
      );
      field.dispatchEvent(new owner.window.Event('input', { bubbles: true }));
      await flush();
    });
  const ranges = [...document.querySelectorAll('.dlvd-window-handle')];
  assert.equal(document.querySelectorAll('.dlvd-window-track').length, 1);
  assert.equal(ranges.length, 2);
  const rangeValue = (field) => field.getAttribute('aria-valuenow');
  const key = async (field, name) =>
    act(async () => {
      field.dispatchEvent(new owner.window.KeyboardEvent('keydown', { key: name, bubbles: true }));
      await flush();
    });
  assert.equal(rangeValue(ranges[0]), '0');
  assert.equal(rangeValue(ranges[1]), '900');
  for (let i = 0; i < 3; i++) await key(ranges[0], 'PageUp');
  for (let i = 0; i < 5; i++) await key(ranges[1], 'PageDown');
  assert.equal(document.querySelectorAll('.dlvd-timeline button').length, 1);
  assert.equal(document.querySelector('.dlvd-timeline button').style.width, '100%');
  assert.equal(document.querySelector('.dlvd-timeline button').style.left, '0%');
  assert.equal(document.querySelectorAll('.dlvd-event-pin').length, 0);
  assert.equal(document.querySelectorAll('.dlvd-timeline .dlvd-pin').length, 0);
  await key(ranges[0], 'End');
  assert.equal(rangeValue(ranges[0]), '449', 'handles cannot cross');
  const reset = document.querySelector('.dlvd-window-reset');
  assert.equal(reset.title, copy.recordings.windowReset);
  assert.equal(reset.getAttribute('aria-label'), copy.recordings.windowReset);
  assert.equal(reset.textContent, '');
  await act(async () => reset.click());
  assert.equal(rangeValue(ranges[0]), '0');
  assert.equal(rangeValue(ranges[1]), '900');
  assert.equal(document.querySelectorAll('.dlvd-timeline button').length, 3);
  const search = document.querySelector('input[type=search]');
  await inputValue(search, 'test transcript');
  assert.equal(
    document.querySelectorAll('.dlvd-segments tbody > tr').length,
    2,
    'only transcribed speech remains',
  );
  assert.equal(document.querySelector('.dlvd-segments details').open, true);
  await inputValue(search, 'unrelated text');
  assert.equal(document.querySelectorAll('.dlvd-segments tbody > tr').length, 0);
  assert.ok(
    document
      .querySelector('.dlvd-recording-detail')
      .textContent.includes(copy.recordings.searchEmpty),
  );
  await inputValue(search, '');
  assert.equal(document.querySelectorAll('.dlvd-segments tbody > tr').length, 4);
  await act(async () => {
    const field = document.querySelector('.dlvd-recording-detail input');
    Object.getOwnPropertyDescriptor(owner.window.HTMLInputElement.prototype, 'value').set.call(
      field,
      'Problem X / Y / Z',
    );
    field.dispatchEvent(new owner.window.Event('input', { bubbles: true }));
    field.dispatchEvent(new owner.window.Event('change', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    document
      .querySelector('.dlvd-recording-detail form')
      .dispatchEvent(new owner.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
  });
  assert.equal(records[0].name, 'Problem X / Y / Z');
  assert.ok(document.querySelector('.dlvd-session-list').textContent.includes('Problem X / Y / Z'));
  const button = (label) =>
    [...document.querySelectorAll('.dlvd-recordings button')].find(
      (b) => b.textContent === label || b.getAttribute('aria-label')?.startsWith(label + ' · '),
    );
  await act(async () => {
    button(copy.recordings.play).click();
    await flush();
  });
  assert.deepEqual(audioCalls[0], ['mic', 0, 200]);
  await act(async () => {
    button(copy.recordings.playSession).click();
    await flush();
  });
  assert.deepEqual(audioCalls[1], ['mic', undefined, undefined]);
  assert.deepEqual(revoked, [urls[0]]);
  await act(async () => {
    button(copy.recordings.export).click();
    await flush();
  });
  assert.deepEqual(exports, ['mic']);
  assert.equal(downloaded, 'recording-mic.json');
  const action = (key) =>
    [...document.querySelectorAll('.dlvd-segments button')].find((b) =>
      b.getAttribute('aria-label')?.startsWith(copy.recordings[key] + ' · '),
    );
  assert.equal(action('play').textContent, '', 'play is an icon with an accessible label');
  await act(async () => {
    action('download').click();
    await flush();
  });
  assert.deepEqual(audioCalls.at(-1), ['mic', 0, 200]);
  assert.equal(downloaded, 'recording-mic-0-200.wav');
  let playCount = 0;
  owner.window.HTMLMediaElement.prototype.play = async () => {
    playCount++;
  };
  for (const kind of ['speech', 'silence']) {
    await act(async () => {
      document.querySelector('.dlvd-timeline button[data-kind=' + kind + ']').click();
      await flush();
    });
    assert.ok(document.querySelector('audio').src.startsWith('blob:test-'));
    assert.deepEqual(audioCalls.at(-1), kind === 'speech' ? ['mic', 200, 500] : ['mic', 0, 200]);
  }
  assert.equal(playCount, 0, 'timeline loads the exact segment without automatic playback');
  const retried = deferred();
  let retryArgs;
  current.retranscribe = (...args) => {
    retryArgs = args;
    return retried.promise;
  };
  current.notify();
  await act(async () => {
    current.notify();
    await flush();
  });
  await act(async () => {
    action('retranscribe').click();
    await flush();
  });
  assert.deepEqual(retryArgs.slice(0, 2), ['mic', 'speech']);
  assert.equal(action('retranscribe').disabled, true);
  assert.ok(document.body.textContent.includes(copy.recordings.retranscribing));
  records[0].attempts.push({
    ...records[0].attempts[0],
    id: 'retried',
    text: 'complete transcript',
  });
  await act(async () => {
    retried.resolve();
    await flush();
  });
  assert.equal(document.querySelectorAll('.dlvd-attempt').length, 2);
  assert.equal(action('retranscribe').disabled, false);
  current.retranscribe = async () => {
    throw new Error('private retry failure');
  };
  await act(async () => {
    action('retranscribe').click();
    await flush();
  });
  assert.equal(
    document.querySelector('[role=alert]').textContent,
    copy.recordings.retranscribeError,
  );
  assert.equal(document.body.textContent.includes('private retry failure'), false);
  await act(async () => button(copy.recordings.delete).click());
  assert.deepEqual(removed, []);
  await act(async () => button(copy.recordings.cancel).click());
  assert.deepEqual(removed, []);
  await act(async () => button(copy.recordings.delete).click());
  await act(async () => {
    document.querySelector('.dlvd-delete-confirm button').click();
    await flush();
  });
  assert.deepEqual(removed, ['mic']);
  assert.ok(revoked.includes(urls[1]));
  assert.ok(revoked.includes(urls[2]));
  await act(async () => {
    select.value = select.options[2].value;
    select.dispatchEvent(new owner.window.Event('change', { bubbles: true }));
    await flush();
  });
  assert.ok(document.querySelector('.dlvd-recording-detail').textContent.includes('share-b'));
  await act(async () => {
    delete target.window[RECORDING_KEY];
    target.window.dispatchEvent(new target.window.Event(RECORDING_CHANGED));
  });
  assert.ok(
    document.querySelector('.dlvd-recordings').textContent.includes(copy.recordings.unavailable),
  );
  assert.equal(current.listeners.size, 0);
});

test('recording actions localize errors and reject late playback after selection or disposal', async (t) => {
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
  t.after(() => {
    Object.assign(globalThis, previous);
    dom.window.close();
  });
  const current = service([session()]);
  dom.window[RECORDING_KEY] = current;
  const urls = [],
    revoked = [];
  let pauses = 0;
  dom.window.URL.createObjectURL = () => {
    const url = 'blob:' + urls.length;
    urls.push(url);
    return url;
  };
  dom.window.URL.revokeObjectURL = (url) => revoked.push(url);
  dom.window.HTMLMediaElement.prototype.play = async () => {};
  dom.window.HTMLMediaElement.prototype.pause = () => {
    pauses++;
  };
  dom.window.HTMLMediaElement.prototype.load = () => {};
  const copy = copyFor('pt-BR');
  await act(async () => {
    root.render(<DebuggerPanel copy={copy} onClose={() => {}} />);
    await flush();
  });
  const button = (label) =>
    [...document.querySelectorAll('.dlvd-recordings button')].find(
      (b) => b.textContent === label || b.getAttribute('aria-label')?.startsWith(label + ' · '),
    );
  current.audio = async () => {
    throw new Error('private failure');
  };
  await act(async () => {
    button(copy.recordings.play).click();
    await flush();
  });
  assert.ok(
    document.querySelector('[role=alert]').textContent.includes(copy.recordings.audioError),
  );
  assert.ok(!document.body.textContent.includes('private failure'));
  const obsolete = deferred();
  current.audio = () => obsolete.promise;
  await act(async () => {
    button(copy.recordings.play).click();
  });
  current.audio = async () => {
    throw new Error('selection failed');
  };
  await act(async () => document.querySelector('.dlvd-timeline button').click());
  await act(async () => {
    obsolete.resolve(new Blob(['obsolete']));
    await flush();
  });
  assert.equal(urls.length, 0);
  current.audio = async () => new Blob(['audio']);
  await act(async () => {
    button(copy.recordings.playSession).click();
    await flush();
  });
  assert.equal(urls.length, 1);
  const late = deferred();
  current.audio = () => late.promise;
  await act(async () => {
    button(copy.recordings.play).click();
  });
  assert.equal(pauses, 1);
  assert.deepEqual(revoked, urls);
  await act(async () => root.unmount());
  await act(async () => {
    late.resolve(new Blob(['late']));
    await flush();
  });
  assert.equal(urls.length, 1);
  assert.equal(current.listeners.size, 0);
});

test('recording protection toggles, persists on reload, and leaves storage and manual deletion independent', async (t) => {
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
  const records = [{ ...session(), storage: 'indexeddb', persistent: false }];
  const current = service(records);
  dom.window[RECORDING_KEY] = current;
  const copy = copyFor();
  const render = async () => {
    await act(async () => {
      root.render(<DebuggerPanel copy={copy} target={dom.window} onClose={() => {}} />);
      await flush();
    });
  };
  const star = () => document.querySelector('.dlvd-recording-detail button[aria-pressed]');
  const button = (label) =>
    [...document.querySelectorAll('.dlvd-recordings button')].find(
      (b) => b.textContent === label || b.getAttribute('aria-label')?.startsWith(label + ' · '),
    );
  await render();
  assert.equal(star().textContent, '☆');
  assert.equal(star().getAttribute('aria-label'), 'Keep indefinitely');
  assert.equal(star().getAttribute('aria-pressed'), 'false');
  assert.equal(star().title, copy.recordings.starHelp);
  assert.ok(
    document.querySelector('.dlvd-session-list').textContent.includes(copy.recordings.persistent),
  );
  assert.ok(
    !document.querySelector('.dlvd-session-list').textContent.includes(copy.recordings.memory),
  );

  const pending = deferred();
  const setStarred = current.setStarred;
  let calls = 0;
  current.setStarred = async (id, starred) => {
    calls++;
    await pending.promise;
    await setStarred(id, starred);
  };
  await act(async () => star().click());
  assert.equal(star().disabled, true);
  assert.equal(button(copy.recordings.delete).disabled, true);
  assert.equal(star().getAttribute('aria-pressed'), 'false');
  await act(async () => star().click());
  assert.equal(calls, 1);
  await act(async () => {
    pending.resolve();
    await flush();
  });
  assert.equal(records[0].starred, true);
  assert.equal(records[0].persistent, false);
  assert.equal(records[0].storage, 'indexeddb');
  assert.equal(star().textContent, '★');
  assert.equal(star().getAttribute('aria-label'), 'Remove protection');
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  assert.equal(star().title, copy.recordings.unstarHelp);
  assert.equal(
    document.querySelector('.dlvd-session-list [aria-label="' + copy.recordings.starred + '"]')
      .textContent,
    '★',
  );
  assert.equal(button(copy.recordings.delete).disabled, false);

  await act(async () => root.render(null));
  await render();
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  current.setStarred = async () => {
    throw new Error('private protection failure');
  };
  await act(async () => {
    star().click();
    await flush();
  });
  assert.equal(document.querySelector('[role=alert]').textContent, copy.recordings.starError);
  assert.ok(!document.body.textContent.includes('private protection failure'));
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  assert.equal(star().disabled, false);
  current.setStarred = setStarred;
  await act(async () => {
    star().click();
    await flush();
  });
  assert.equal(records[0].starred, false);
  assert.equal(records[0].persistent, false);
  assert.equal(star().textContent, '☆');
  assert.equal(
    document.querySelector('.dlvd-session-list [aria-label="' + copy.recordings.starred + '"]'),
    null,
  );
  assert.equal(document.querySelector('[role=alert]'), null);

  await act(async () => {
    star().click();
    await flush();
  });
  await act(async () => button(copy.recordings.delete).click());
  await act(async () => {
    document.querySelector('.dlvd-delete-confirm button').click();
    await flush();
  });
  assert.equal(records.length, 0, 'Protected recordings still permit confirmed manual deletion');
});

test('protection actions ignore late results after selection, service replacement, page hiding, and disposal', async (t) => {
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
  const records = [session('a'), session('b')];
  const current = service(records);
  dom.window[RECORDING_KEY] = current;
  const copy = copyFor('pt-BR');
  await act(async () => {
    root.render(<DebuggerPanel copy={copy} target={dom.window} onClose={() => {}} />);
    await flush();
  });
  const star = () => document.querySelector('.dlvd-recording-detail button[aria-pressed]');
  const lateSelection = deferred();
  current.setStarred = () => lateSelection.promise;
  await act(async () => star().click());
  await act(async () => {
    document.querySelectorAll('.dlvd-session-list button')[1].click();
    await flush();
  });
  await act(async () => {
    lateSelection.reject(new Error('private stale failure'));
    await flush();
  });
  assert.equal(document.querySelector('[role=alert]'), null);
  assert.equal(star().disabled, false);
  assert.equal(star().getAttribute('aria-pressed'), 'false');

  const lateService = deferred();
  current.setStarred = () => lateService.promise;
  await act(async () => star().click());
  const nextRecords = [{ ...session('b'), starred: true }];
  const next = service(nextRecords);
  let lists = 0;
  next.list = async () => {
    lists++;
    return nextRecords;
  };
  await act(async () => {
    dom.window[RECORDING_KEY] = next;
    dom.window.dispatchEvent(new dom.window.Event(RECORDING_CHANGED));
    await flush();
  });
  const baseline = lists;
  await act(async () => {
    lateService.resolve();
    await flush();
  });
  assert.equal(lists, baseline, 'A stale completion must not refresh a replacement service');
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  assert.equal(star().disabled, false);

  const lateHidden = deferred();
  next.setStarred = () => lateHidden.promise;
  await act(async () => star().click());
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('pagehide')));
  await act(async () => {
    lateHidden.reject(new Error('private hidden failure'));
    await flush();
  });
  assert.equal(document.querySelector('[role=alert]'), null);
  await act(async () => root.render(null));
  await act(async () => {
    root.render(<DebuggerPanel copy={copy} target={dom.window} onClose={() => {}} />);
    await flush();
  });
  const lateDisposed = deferred();
  next.setStarred = () => lateDisposed.promise;
  await act(async () => star().click());
  await act(async () => root.render(null));
  const disposedLists = lists;
  await act(async () => {
    lateDisposed.resolve();
    await flush();
  });
  assert.equal(lists, disposedLists);
  assert.equal(next.listeners.size, 0);
});

test('all six recording catalogs contain the same nonempty localized keys', () => {
  const keys = Object.keys(dictionaries.en.recordings);
  for (const copy of Object.values(dictionaries)) {
    assert.deepEqual(Object.keys(copy), Object.keys(copy).sort(), 'Catalog keys must be sorted');
    assert.deepEqual(Object.keys(copy.recordings), keys);
    for (const key of keys) assert.ok(copy.recordings[key].trim());
  }
});
test('participant sources stay visible beside custom titles and label each segment without inferring identity from source IDs', async () => {
  const records = ['a', 'b', 'c'].map((id, index) => ({
    ...session(id, 'shared', 'opaque/source:' + id),
    label: 'Same display',
    name: index === 0 ? 'Custom highlighted take' : '',
    participant: {
      provider: 'attendee',
      groupId: 'bot_Test',
      participantId: 'device/' + id + ':uuid',
      originalName: 'Original ' + id,
      alias: 'Same display',
    },
  }));
  records.push(session('legacy', 'shared', 'legacy-attendee-looking:source'));
  const current = service(records);
  const owner = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  owner.window[RECORDING_KEY] = current;
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    flag: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = owner.window;
  globalThis.document = owner.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  const copy = copyFor('en-US');
  try {
    await act(async () => {
      root.render(React.createElement(DebuggerPanel, { copy, target: owner.window, onClose() {} }));
      await flush();
    });
    const filter = document.querySelector('.dlvd-recordings select');
    const participantOptions = [...filter.options].filter((o) =>
      o.textContent.startsWith(copy.recordings.participant + ' · Same display'),
    );
    assert.equal(participantOptions.length, 3);
    assert.equal(new Set(participantOptions.map((o) => o.value)).size, 3);
    const header = [...document.querySelectorAll('h3')].find((h) =>
      h.textContent.startsWith(copy.recordings.participant),
    );
    assert.ok(header);
    assert.equal(header.textContent.includes('opaque/source'), false);
    assert.ok(document.body.textContent.includes('Custom highlighted take'));
    assert.ok(document.body.textContent.includes('Original a'));
    assert.ok(document.body.textContent.includes('device/a:uuid'));
    const segments = [...document.querySelectorAll('.dlvd-segments tbody tr')].filter((r) =>
      r.querySelector('button'),
    );
    assert.ok(segments.length > 0);
    for (const row of segments) {
      assert.ok(row.textContent.includes('Same display'));
      assert.ok(
        row
          .querySelector('button')
          .getAttribute('aria-label')
          .includes(copy.recordings.participant + ' · Same display'),
      );
    }
    assert.ok(
      [...filter.options].some((o) =>
        o.textContent.includes(copy.recordings.shared + ' · legacy-attendee-looking:source'),
      ),
    );
  } finally {
    await act(async () => root.unmount());
    owner.window.close();
    if (previous.window === undefined) delete globalThis.window;
    else globalThis.window = previous.window;
    if (previous.document === undefined) delete globalThis.document;
    else globalThis.document = previous.document;
    if (previous.flag === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else globalThis.IS_REACT_ACT_ENVIRONMENT = previous.flag;
  }
});
