import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSettingsStore } from '../src/modules/settings/models/settingsHost.ts';
import { createSettingsClient } from '../src/modules/settings/models/settingsStorage.ts';
import { registerSettingsRoute } from '../src/app/server/registerRoutes.ts';
import { normalizeSettings } from '../src/modules/core/settings.ts';
import { defaultSpeakingEngine } from '../src/modules/core/engineSelection.ts';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'live-voice-settings-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'settings.json');
  const store = createSettingsStore(path);
  let route,
    cleanup,
    removed = false;
  registerSettingsRoute(
    {
      connection: {
        fetch: {
          register(value) {
            route = value;
            return () => {
              removed = true;
            };
          },
        },
      },
      effect(fn) {
        cleanup = fn();
      },
    },
    store,
  );
  return {
    store,
    path,
    route,
    cleanup,
    removed: () => removed,
    fetch: (url, options) => route.fetch(new Request('http://localhost' + url, options)),
  };
}

test('all normalized preferences survive a host restart and another browser', async (t) => {
  const f = await fixture(t);
  const local = { getItem: () => null, setItem: () => {} };
  const first = createSettingsClient(f.fetch, local);
  await first.ready;
  const expected = normalizeSettings({
    engine: 'say',
    recognitionEngine: 'whisper-http',
    mode: 'headphones',
    voiceCommandSend: 'submit now',
    voiceCommandClear: 'erase draft',
    agentVoiceContext: 'Keep answers short.',
    voiceDetectionPreset: 'custom',
    voiceDetectionCustomSilenceMs: 350,
    voiceDetectionCustomParagraphMs: 12000,
    voiceDetectionThreshold: 0.65,
    voiceDetectionMinimumSpeechMs: 400,
    recordingEnabled: true,
    recordingKeepPrevious: 1,
    recordingBitrate: 64000,
    recordingPreRollMs: 0,
    recordingPostRollMs: 2000,
    assistantSpeechDelaySeconds: 3,
    autoSendDelaySeconds: 6,
    microphoneSourceName: 'Alice',
    sharedSourceName: 'Team',
    inputDeviceId: 'mic',
    outputDeviceId: 'speaker',
    volume: 0.37,
  });
  await first.save(expected);
  const { microphoneSourceName, sharedSourceName, alwaysShowSourceName, ...hostExpected } =
    expected;
  assert.deepEqual(await createSettingsStore(f.path).load(), hostExpected);
  const second = createSettingsClient(f.fetch);
  assert.deepEqual(await second.ready, {
    ...expected,
    microphoneSourceName: 'Me',
    sharedSourceName: 'Them',
    alwaysShowSourceName: false,
  });
  assert.deepEqual(JSON.parse(await readFile(f.path, 'utf8')), hostExpected);
  assert.equal((await stat(f.path)).mode & 0o777, 0o600);
  f.cleanup();
  assert.equal(f.removed(), true);
});

test('clients normalize paragraph preferences without changing raw old files or patches', async (t) => {
  const f = await fixture(t);
  await writeFile(
    f.path,
    JSON.stringify({ voiceDetectionPreset: 'custom', voiceDetectionCustomSilenceMs: 350 }),
  );
  const client = createSettingsClient(f.fetch);
  assert.equal((await client.ready).voiceDetectionCustomParagraphMs, 3000);
  assert.deepEqual(await f.store.load(), {
    voiceDetectionPreset: 'custom',
    voiceDetectionCustomSilenceMs: 350,
  });
  for (const value of [100, 30000]) {
    await client.save({ voiceDetectionCustomParagraphMs: value });
    const saved = await createSettingsStore(f.path).load();
    assert.equal(saved.voiceDetectionCustomParagraphMs, value);
    assert.equal(saved.voiceDetectionCustomSilenceMs, 350);
  }
  for (const value of [null, '4000', 99, 30001, 3000.5]) {
    const response = await f.fetch('/api/dsh-live-voice/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voiceDetectionCustomParagraphMs: value }),
    });
    assert.equal(response.status, 200);
    assert.equal((await createSettingsStore(f.path).load()).voiceDetectionCustomParagraphMs, value);
    const reloaded = createSettingsClient(f.fetch);
    assert.equal((await reloaded.ready).voiceDetectionCustomParagraphMs, 3000);
    assert.equal(reloaded.getSnapshot().voiceDetectionCustomParagraphMs, 3000);
    assert.equal(JSON.parse(await readFile(f.path, 'utf8')).voiceDetectionCustomParagraphMs, value);
  }
});

test('concurrent browser patches preserve unrelated preferences and rapid saves stay ordered', async (t) => {
  const f = await fixture(t);
  const a = createSettingsClient(f.fetch),
    b = createSettingsClient(f.fetch);
  await Promise.all([a.ready, b.ready]);
  await Promise.all([
    a.save({ voiceCommandSend: 'send it' }),
    b.save({ assistantSpeechDelaySeconds: 4 }),
    a.save({ voiceDetectionCustomSilenceMs: 400 }),
    a.save({ voiceDetectionCustomSilenceMs: 500 }),
    a.save({ futureA: { options: [null, false] } }),
    b.save({ futureB: { version: 2 } }),
  ]);
  const saved = await f.store.load();
  assert.equal(saved.voiceCommandSend, 'send it');
  assert.equal(saved.assistantSpeechDelaySeconds, 4);
  assert.equal(saved.voiceDetectionCustomSilenceMs, 500);
  assert.deepEqual(saved.futureA, { options: [null, false] });
  assert.deepEqual(saved.futureB, { version: 2 });
  const reopened = createSettingsClient(f.fetch);
  await reopened.ready;
  assert.deepEqual(reopened.getSnapshot().futureA, { options: [null, false] });
  assert.deepEqual(reopened.getSnapshot().futureB, { version: 2 });
});

test('route rejects malformed requests and reports disk errors without claiming success', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.route.methods, ['GET', 'PUT']);
  for (const body of ['null', '[]', '{', JSON.stringify('x'.repeat(64001))]) {
    assert.equal(
      (await f.fetch('/api/dsh-live-voice/settings', { method: 'PUT', body })).status,
      400,
    );
  }
  const response = await f.fetch('/api/dsh-live-voice/settings', { method: 'GET' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  await f.store.save({ rate: 999 });
  assert.equal((await f.store.load()).rate, 999);
  await writeFile(f.path, '{broken');
  assert.equal((await f.fetch('/api/dsh-live-voice/settings', { method: 'GET' })).status, 500);
  assert.equal(
    (await f.fetch('/api/dsh-live-voice/settings', { method: 'PUT', body: '{}' })).status,
    500,
  );
  const failing = createSettingsClient(async () => Response.json({ ok: false }, { status: 500 }));
  await assert.rejects(failing.ready);
  await assert.rejects(failing.save({ mode: 'headphones' }));
});

test('host retains malformed known fields verbatim while clients apply current normalization', async (t) => {
  const f = await fixture(t);
  const invalid = {
    recordingEnabled: 'true',
    recordingKeepPrevious: 0,
    recordingBitrate: 16000,
    recordingPreRollMs: -1,
    recordingPostRollMs: 2001,
    voiceDetectionThreshold: 1,
    voiceDetectionMinimumSpeechMs: 49,
  };
  const response = await f.fetch('/api/dsh-live-voice/settings', {
    method: 'PUT',
    body: JSON.stringify(invalid),
  });
  assert.equal(response.status, 200);
  const saved = await createSettingsStore(f.path).load();
  assert.deepEqual(saved, invalid);
  assert.deepEqual(JSON.parse(await readFile(f.path, 'utf8')), invalid);
  const client = createSettingsClient(f.fetch);
  assert.deepEqual(
    await client.ready,
    normalizeSettings({ ...invalid, engine: defaultSpeakingEngine(process.platform) }),
  );
  assert.deepEqual(
    client.getSnapshot(),
    normalizeSettings({ ...invalid, engine: defaultSpeakingEngine(process.platform) }),
  );
  await client.save({ volume: 0.25 });
  assert.deepEqual(await f.store.load(), { ...invalid, volume: 0.25 });
  const reopened = createSettingsClient(f.fetch);
  assert.deepEqual(
    await reopened.ready,
    normalizeSettings({
      ...invalid,
      volume: 0.25,
      engine: defaultSpeakingEngine(process.platform),
    }),
  );
});

test('recording defaults on for old settings while saved opt-out survives reloads and patches', async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, JSON.stringify({ rate: 1.2 }));
  const client = createSettingsClient(f.fetch);
  const initial = await client.ready;
  assert.equal(initial.recordingEnabled, true);
  assert.equal(initial.recordingKeepPrevious, 1);
  assert.deepEqual(await f.store.load(), { rate: 1.2 }, 'new defaults are client policy only');
  assert.deepEqual(JSON.parse(await readFile(f.path, 'utf8')), { rate: 1.2 });
  await client.save({ recordingEnabled: false, recordingKeepPrevious: 3 });
  assert.equal((await createSettingsStore(f.path).load()).recordingEnabled, false);
  const reloaded = createSettingsClient(f.fetch);
  assert.equal((await reloaded.ready).recordingEnabled, false);
  await reloaded.save({ volume: 0.5 });
  const saved = await createSettingsStore(f.path).load();
  assert.equal(saved.recordingEnabled, false);
  assert.equal(saved.recordingKeepPrevious, 3, 'valid explicit retention is not reset');
});

test('missing host settings stay empty and nested unknown JSON survives unrelated writes and reopen', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.store.load(), {});
  const initialResponse = await f.fetch('/api/dsh-live-voice/settings', { method: 'GET' });
  assert.deepEqual((await initialResponse.json()).value, {});
  const future = {
    schema: 42,
    options: { enabled: false, label: '日本語 🎙️', empty: {}, nullable: null },
    entries: [null, true, false, 1.5, 'text', [], { nested: [0, null] }],
  };
  await f.store.save({ futureFeature: future, deprecatedField: 'keep me', rate: 1.2 });
  const client = createSettingsClient(f.fetch);
  const initial = await client.ready;
  assert.deepEqual(initial.futureFeature, future);
  assert.equal(initial.deprecatedField, 'keep me');
  assert.equal(initial.recordingEnabled, true, 'a newer client supplies its own default');
  const saved = await client.save({ volume: 0.25 });
  assert.deepEqual(saved.futureFeature, future);
  assert.deepEqual(client.getSnapshot().futureFeature, future);
  const expected = { futureFeature: future, deprecatedField: 'keep me', rate: 1.2, volume: 0.25 };
  assert.deepEqual(await createSettingsStore(f.path).load(), expected);
  assert.deepEqual(JSON.parse(await readFile(f.path, 'utf8')), expected);
  const reopened = createSettingsClient(f.fetch);
  assert.deepEqual((await reopened.ready).futureFeature, future);
  assert.equal(reopened.getSnapshot().deprecatedField, 'keep me');
  await reopened.save({ futureFeature: { replacement: [null, { active: true }] } });
  assert.deepEqual(
    (await f.store.load()).futureFeature,
    { replacement: [null, { active: true }] },
    'nested values are replaced atomically, never deep merged',
  );
});

test('host snapshots mutable queued patches and serializes generic top-level merges', async (t) => {
  const f = await fixture(t);
  const patch = { futureFeature: { values: [null, 'original'] }, flag: false };
  const first = f.store.save(patch);
  patch.futureFeature.values[1] = 'mutated';
  patch.flag = true;
  const second = f.store.save({ anotherFutureFeature: { count: 2 } });
  const third = f.store.save({ futureFeature: { last: true } });
  assert.deepEqual(await first, { futureFeature: { values: [null, 'original'] }, flag: false });
  await Promise.all([second, third]);
  const expected = {
    futureFeature: { last: true },
    flag: false,
    anotherFutureFeature: { count: 2 },
  };
  assert.deepEqual(await f.store.load(), expected);
  const loaded = await f.store.load();
  loaded.anotherFutureFeature.count = 99;
  assert.deepEqual(await f.store.load(), expected, 'load returns a detached document');
});

test('route rejects unsafe JSON as invalid-settings and preserves the previous document', async (t) => {
  const f = await fixture(t);
  const original = { futureFeature: { retain: [null, true] } };
  await f.store.save(original);
  const deep = (count) => {
    let value = null;
    for (let i = 0; i < count; i++) value = { next: value };
    return value;
  };
  const attacks = [
    '{',
    'null',
    '[]',
    'true',
    '42',
    '"text"',
    '{"__proto__":{"polluted":true}}',
    '{"safe":{"constructor":{"polluted":true}}}',
    '{"safe":[null,{"prototype":{"polluted":true}}]}',
    '{"future":{"number":1e400}}',
    JSON.stringify({ future: deep(20) }),
    JSON.stringify({ future: 'é'.repeat(32000) }),
  ];
  for (const body of attacks) {
    const response = await f.fetch('/api/dsh-live-voice/settings', { method: 'PUT', body });
    assert.equal(response.status, 400, body.slice(0, 80));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: false, error: { code: 'invalid-settings' } });
    assert.deepEqual(await f.store.load(), original);
  }
  assert.equal({}.polluted, undefined);
  const valid = await f.fetch('/api/dsh-live-voice/settings', {
    method: 'PUT',
    body: JSON.stringify({ future: { array: [null, {}, []] } }),
  });
  assert.equal(valid.status, 200, 'a rejected write does not poison the store queue');
  assert.equal(valid.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await valid.json()).value.future, { array: [null, {}, []] });
});

test('merged document size is bounded even when each incoming patch is individually small', async (t) => {
  const f = await fixture(t);
  await f.store.save({ first: 'a'.repeat(33000) });
  const response = await f.fetch('/api/dsh-live-voice/settings', {
    method: 'PUT',
    body: JSON.stringify({ second: 'b'.repeat(33000) }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: { code: 'invalid-settings' } });
  assert.deepEqual(await f.store.load(), { first: 'a'.repeat(33000) });
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('client snapshots mutable patches before waiting for ready or preceding saves', async () => {
  const getResponse = deferred();
  const requests = [];
  let raw = { futureFeature: { previous: true } };
  const client = createSettingsClient(async (_url, options) => {
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    if (options.method === 'GET') {
      await getResponse.promise;
    } else {
      const patch = JSON.parse(options.body);
      requests.push(patch);
      raw = { ...raw, ...patch };
    }
    return Response.json({ ok: true, value: raw, hostPlatform: 'linux' });
  });
  const patch = { futureFeature: { values: [null, 'original'] }, volume: 0.2 };
  const first = client.save(patch);
  const later = { futureOther: { value: 'queued' } };
  const second = client.save(later);
  patch.futureFeature.values[1] = 'mutated';
  patch.volume = 0.9;
  later.futureOther.value = 'mutated too';
  getResponse.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(requests, [
    { futureFeature: { values: [null, 'original'] }, volume: 0.2 },
    { futureOther: { value: 'queued' } },
  ]);
  assert.deepEqual(client.getSnapshot().futureFeature, { values: [null, 'original'] });
  assert.deepEqual(client.getSnapshot().futureOther, { value: 'queued' });
});

test('successful responses retain newer ordered pending overlays including unknown nested values', async () => {
  const entered = [deferred(), deferred()];
  const release = [deferred(), deferred()];
  const requests = [];
  let raw = { futureFeature: { original: true }, volume: 0.8 };
  const client = createSettingsClient(async (_url, options) => {
    if (options.method === 'PUT') {
      const index = requests.length;
      requests.push(JSON.parse(options.body));
      entered[index].resolve();
      await release[index].promise;
      raw = { ...raw, ...requests[index] };
    }
    return Response.json({ ok: true, value: raw, hostPlatform: 'linux' });
  });
  await client.ready;
  const first = client.save({ futureFeature: { first: true }, volume: 0.2 });
  const second = client.save({ futureFeature: { second: [null, 'last'] }, volume: 0.4 });
  await entered[0].promise;
  release[0].resolve();
  const firstResult = await first;
  assert.deepEqual(firstResult.futureFeature, { second: [null, 'last'] });
  assert.equal(firstResult.volume, 0.4);
  assert.deepEqual(client.getSnapshot().futureFeature, { second: [null, 'last'] });
  await entered[1].promise;
  release[1].resolve();
  await second;
  assert.deepEqual(raw, { futureFeature: { second: [null, 'last'] }, volume: 0.4 });
});

test('failed client save rolls back only its patch and retains later pending patches and unknown keys', async () => {
  const entered = [deferred(), deferred()];
  const release = [deferred(), deferred()];
  const requests = [];
  const originalFuture = { retained: [null, { enabled: false }] };
  let raw = {
    futureFeature: originalFuture,
    unrelatedFuture: { version: 9 },
    volume: 0.8,
    rate: 1,
  };
  const client = createSettingsClient(async (_url, options) => {
    if (options.method === 'PUT') {
      const index = requests.length;
      requests.push(JSON.parse(options.body));
      entered[index].resolve();
      await release[index].promise;
      if (index === 0) return Response.json({ ok: false }, { status: 500 });
      raw = { ...raw, ...requests[index] };
    }
    return Response.json({ ok: true, value: raw, hostPlatform: 'linux' });
  });
  await client.ready;
  const first = client.save({ futureFeature: { failed: true }, volume: 0.2 });
  const rejection = assert.rejects(first);
  const second = client.save({ rate: 1.2, futureOther: [null, 'pending'] });
  await entered[0].promise;
  release[0].resolve();
  await rejection;
  await entered[1].promise;
  const snapshot = client.getSnapshot();
  assert.deepEqual(snapshot.futureFeature, originalFuture);
  assert.deepEqual(snapshot.unrelatedFuture, { version: 9 });
  assert.equal(snapshot.volume, 0.8);
  assert.equal(snapshot.rate, 1.2);
  assert.deepEqual(snapshot.futureOther, [null, 'pending']);
  release[1].resolve();
  await second;
  assert.deepEqual(client.getSnapshot().futureFeature, originalFuture);
  assert.deepEqual(client.getSnapshot().futureOther, [null, 'pending']);
});

test('unsafe stored documents report storage failure rather than a bad browser request', async (t) => {
  const f = await fixture(t);
  for (const body of ['[]', '{"constructor":{"unsafe":true}}', '{"future":1e400}']) {
    await writeFile(f.path, body);
    for (const method of ['GET', 'PUT']) {
      const response = await f.fetch('/api/dsh-live-voice/settings', {
        method,
        ...(method === 'PUT' ? { body: '{}' } : {}),
      });
      assert.equal(response.status, 500);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), {
        ok: false,
        error: { code: 'settings-unavailable' },
      });
    }
    assert.equal(await readFile(f.path, 'utf8'), body, 'invalid disk data is never silently reset');
  }
});

test('client save returns normalized known fields while retaining raw invalid fields and unknown JSON on disk', async (t) => {
  const f = await fixture(t);
  await f.store.save({ futureFeature: { entries: [null, false] } });
  const client = createSettingsClient(f.fetch);
  await client.ready;
  const patch = { rate: 999, recordingEnabled: 'false', voiceDetectionCustomParagraphMs: null };
  const saved = await client.save(patch);
  const expected = normalizeSettings({ ...patch, engine: defaultSpeakingEngine(process.platform) });
  for (const key of Object.keys(patch)) {
    assert.equal(saved[key], expected[key], key);
    assert.equal(client.getSnapshot()[key], expected[key], key);
  }
  assert.deepEqual(saved.futureFeature, { entries: [null, false] });
  assert.deepEqual(await f.store.load(), { futureFeature: { entries: [null, false] }, ...patch });
});

test('client rejects unsafe patches before transport and later valid writes still succeed', async () => {
  const requests = [];
  let raw = { future: { preserved: true } };
  const client = createSettingsClient(async (_url, options) => {
    requests.push(options.method);
    if (options.method === 'PUT') raw = { ...raw, ...JSON.parse(options.body) };
    return Response.json({ ok: true, value: raw, hostPlatform: 'linux' });
  });
  await client.ready;
  for (const patch of [
    null,
    [],
    { future: undefined },
    { future: Infinity },
    JSON.parse('{"future":{"prototype":true}}'),
  ]) {
    await assert.rejects(client.save(patch));
  }
  assert.deepEqual(requests, ['GET']);
  assert.deepEqual(client.getSnapshot().future, { preserved: true });
  await client.save({ futureOther: [null, false] });
  assert.deepEqual(requests, ['GET', 'PUT']);
  assert.deepEqual(client.getSnapshot().future, { preserved: true });
  assert.deepEqual(client.getSnapshot().futureOther, [null, false]);
});
