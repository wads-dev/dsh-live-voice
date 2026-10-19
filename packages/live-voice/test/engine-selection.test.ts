import test from 'node:test';
import assert from 'node:assert/strict';
import {
  speakingEngineOrder,
  defaultSpeakingEngine,
  recognitionEngineOrder,
} from '../src/modules/core/engineSelection.ts';
import { createSettingsStore } from '../src/modules/settings/models/settingsHost.ts';
import { createSettingsClient } from '../src/modules/settings/models/settingsStorage.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

for (const platform of ['darwin', 'linux', 'win32', undefined]) {
  test('selection order and fresh preferences use host platform ' + platform, async (t) => {
    const mac = platform === 'darwin';
    assert.deepEqual(
      speakingEngineOrder(platform),
      mac ? ['say', 'browser', 'qwen-http', 'chatterbox-http'] : ['browser', 'qwen-http', 'say', 'chatterbox-http'],
    );
    assert.equal(defaultSpeakingEngine(platform), mac ? 'say' : 'browser');
    assert.deepEqual(recognitionEngineOrder, [
      'browser',
      'whisper-browser',
      'qwen-browser',
      'qwen-http',
      'whisper-http',
    ]);
    const dir = await mkdtemp(join(tmpdir(), 'voice-engine-order-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const path = join(dir, 'preferences.json');
    const store = createSettingsStore(path);
    assert.deepEqual(await store.load(), {}, 'the host does not choose or persist an engine');
    const client = createSettingsClient(async (_url, options) => {
      const value =
        options.method === 'PUT' ? await store.save(JSON.parse(options.body)) : await store.load();
      return Response.json({ ok: true, value, hostPlatform: platform });
    });
    assert.equal((await client.ready).engine, mac ? 'say' : 'browser');
    assert.equal(client.getSnapshot().engine, mac ? 'say' : 'browser');
    await client.save({ rate: 1.2 });
    assert.deepEqual(
      await store.load(),
      { rate: 1.2 },
      'unrelated writes do not persist client defaults',
    );
    for (const engine of ['browser', 'say', 'qwen-http']) {
      await writeFile(path, JSON.stringify({ engine }));
      assert.deepEqual(await store.load(), { engine }, 'raw saved selection is unchanged');
      const reopened = createSettingsClient(async () =>
        Response.json({
          ok: true,
          value: await store.load(),
          hostPlatform: platform,
        }),
      );
      assert.equal(
        (await reopened.ready).engine,
        engine,
        'explicit saved selection wins client policy',
      );
      await store.save({ rate: 1.2 });
      assert.equal((await store.load()).engine, engine);
    }
  });
}

test('host platform metadata does not change or persist the explicit engine selection', async () => {
  const requests = [];
  const client = createSettingsClient(async (_url, options) => {
    requests.push(options);
    return Response.json({ ok: true, value: { engine: 'qwen-http' }, hostPlatform: 'darwin' });
  });
  await client.ready;
  assert.equal(client.getHostPlatform(), 'darwin');
  assert.equal(client.getSnapshot().engine, 'qwen-http');
  await client.save({ rate: 1.1 });
  assert.deepEqual(JSON.parse(requests[1].body), { rate: 1.1 });
});

test('malformed raw engine selections normalize on the client without rewriting host data', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'voice-engine-policy-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'preferences.json');
  const store = createSettingsStore(path);
  for (const engine of ['future-engine', null, false, 12, { version: 2 }]) {
    await writeFile(path, JSON.stringify({ engine, futureFeature: { enabled: true } }));
    const client = createSettingsClient(async (_url, options) =>
      Response.json({
        ok: true,
        value:
          options.method === 'PUT'
            ? await store.save(JSON.parse(options.body))
            : await store.load(),
        hostPlatform: 'darwin',
      }),
    );
    assert.equal(
      (await client.ready).engine,
      'browser',
      'malformed explicit values use known-field normalization',
    );
    await client.save({ volume: 0.5 });
    assert.deepEqual(await store.load(), { engine, futureFeature: { enabled: true }, volume: 0.5 });
  }
});
