// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  stat,
  readFile,
  writeFile,
  chmod,
  symlink,
  mkdir,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAttendeeCredentialStore } from '../src/app/server/attendeeCredentials.js';
import { registerAttendeeRoutes } from '../src/app/server/attendeeRoutes.js';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
const origin = 'http://localhost:8000';
const key = 'synthetic-fixture-key-only';
async function storage(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-attendee-credential-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'private', 'credentials.json');
  return { dir, path, store: createAttendeeCredentialStore(path) };
}
test('host credentials reopen in owner-only files and serialize multiple instances without lost origins', async (t) => {
  const { dir, path, store } = await storage(t);
  assert.deepEqual(await store.metadata(origin), { hasSavedKey: false });
  await assert.rejects(store.get(origin), /credential-missing/);
  await Promise.all([
    store.save(origin + '/', key),
    createAttendeeCredentialStore(path).save('http://127.0.0.1:8001', 'synthetic-second-key'),
  ]);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(dir, 'private'))).mode & 0o777, 0o700);
  assert.equal(await createAttendeeCredentialStore(path).get(origin), key);
  assert.equal(await store.get('http://127.0.0.1:8001'), 'synthetic-second-key');
  for (const other of ['http://localhost:8001', 'http://127.0.0.1:8000', 'https://localhost:8000'])
    assert.deepEqual(await store.metadata(other), { hasSavedKey: false });
  await store.save(origin, 'synthetic-replacement-key');
  assert.equal(await store.get(origin), 'synthetic-replacement-key');
  assert.deepEqual(await store.remove(origin), { hasSavedKey: false });
  assert.deepEqual(await createAttendeeCredentialStore(path).metadata(origin), {
    hasSavedKey: false,
  });
  assert.equal(await store.get('http://127.0.0.1:8001'), 'synthetic-second-key');
  assert.deepEqual(await readdir(join(dir, 'private')), ['credentials.json']);
});
test('invalid origins keys corrupt documents permissions symlinks and oversized files fail closed with redacted errors', async (t) => {
  const { dir, path, store } = await storage(t);
  for (const bad of [
    'https://attendee.example',
    'http://localhost.evil',
    'file:///tmp/a',
    'http://user:pass@localhost:8000',
    origin + '/api',
    origin + '?key=bad',
  ])
    await assert.rejects(store.save(bad, key), /invalid-api/);
  for (const bad of [
    '',
    'short',
    'x'.repeat(513),
    'bad' + String.fromCharCode(10) + 'key-value',
    'bad key-value',
  ])
    await assert.rejects(store.save(origin, bad), /invalid-api/);
  await store.save(origin, key);
  const valid = await readFile(path, 'utf8');
  for (const data of [
    '{bad-json-' + key,
    JSON.stringify({ version: 1, origins: {}, extra: key }),
    JSON.stringify({ version: 1, origins: { __invalid_origin__: key } }),
    'x'.repeat(65537),
  ]) {
    await writeFile(path, data, { mode: 0o600 });
    await assert.rejects(store.metadata(origin), { message: 'credential-storage-invalid' });
  }
  await writeFile(path, valid);
  await chmod(path, 0o644);
  await assert.rejects(store.get(origin), { message: 'credential-storage-invalid' });
  await chmod(path, 0o600);
  await rm(path);
  await symlink(join(dir, 'target'), path);
  await assert.rejects(store.save(origin, key), { message: 'credential-storage-invalid' });
  await rm(path);
  await mkdir(path);
  await assert.rejects(store.metadata(origin), { message: 'credential-storage-invalid' });
  await writeFile(join(dir, 'not-directory'), 'fixture');
  await assert.rejects(
    createAttendeeCredentialStore(join(dir, 'not-directory', 'child')).save(origin, key),
    { message: 'credential-storage-unavailable' },
  );
});
test('storage permits at most 32 origins and preserves existing parent permissions', async (t) => {
  const { dir, path, store } = await storage(t);
  await mkdir(join(dir, 'private'), { mode: 0o755 });
  for (let n = 0; n < 32; n++) await store.save('http://localhost:' + (8000 + n), key);
  await assert.rejects(store.save('http://localhost:9000', key), /credential-storage-invalid/);
  assert.equal((await stat(join(dir, 'private'))).mode & 0o777, 0o755);
  assert.equal(Object.keys(JSON.parse(await readFile(path, 'utf8')).origins).length, 32);
});
function routes(
  store,
  fetcher = async () => Response.json({ results: [], next: null, previous: null }),
) {
  let route, dispose;
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register(r) {
            route = r;
            return () => {};
          },
        },
      },
      webServer: { getOrigin: () => 'https://fixture', registerUpgrade: () => () => {} },
      effect(f) {
        dispose = f();
      },
    },
    async () => ({
      WebSocketServer: class {
        close() {}
      },
    }),
    fetcher,
    store,
  );
  const url = 'https://fixture/api/dsh-live-voice/attendee';
  const request = (path, options) => route.fetch(new Request(new URL(path, url), options));
  const post = async (body) =>
    (await request(url, { method: 'POST', body: JSON.stringify(body) })).json();
  return { request, post, dispose, url };
}
test('one Connect autosaves before verification and a fresh host reconnects without a browser key; deleting does not revoke live bot control', async (t) => {
  const { path, store } = await storage(t);
  const calls = [];
  const api = async (url, options) => {
    calls.push({ url, options });
    return Response.json(
      url.endsWith('/bots')
        ? { id: 'bot_Test', state: 'joining' }
        : url.endsWith('/leave')
          ? { state: 'leaving' }
          : { results: [], next: null, previous: null },
    );
  };
  let host = routes(store, api);
  const first = await host.post({ action: 'open', apiUrl: origin, apiKey: key, verify: true });
  assert.equal(first.ok, true);
  assert.equal(first.value.hasSavedKey, true);
  assert.equal(calls[0].options.headers.Authorization, 'Token ' + key);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(await store.get(origin), key);
  assert.equal(JSON.stringify(first).includes(key), false);
  const metadata = await (
    await host.request(host.url + '?action=credential&apiUrl=' + encodeURIComponent(origin))
  ).json();
  assert.deepEqual(metadata, { ok: true, value: { hasSavedKey: true } });
  await host.dispose();
  host = routes(createAttendeeCredentialStore(path), api);
  const second = await host.post({ action: 'open', apiUrl: origin, verify: true });
  assert.equal(second.ok, true);
  const owner = second.value.owner;
  assert.equal(
    (
      await host.post({
        action: 'join',
        owner,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        botName: 'Synthetic bot',
      })
    ).ok,
    true,
  );
  assert.deepEqual(await host.post({ action: 'credential-remove', apiUrl: origin }), {
    ok: true,
    value: { hasSavedKey: false },
  });
  assert.equal((await host.post({ action: 'leave', owner })).ok, true);
  assert.equal(calls.at(-1).options.headers.Authorization, 'Token ' + key);
  assert.deepEqual(await store.metadata(origin), { hasSavedKey: false });
  await host.dispose();
});
test('save failures prevent networking; failed API verification still preserves the configured key and never leaks it', async (t) => {
  const { store } = await storage(t);
  let network = 0;
  const host = routes(store, async () => {
    network++;
    throw Error('raw-' + key);
  });
  const result = await host.post({ action: 'open', apiUrl: origin, apiKey: key, verify: true });
  assert.equal(result.error.code, 'invalid-api');
  assert.equal(JSON.stringify(result).includes(key), false);
  assert.deepEqual(await store.metadata(origin), { hasSavedKey: true });
  const before = network;
  assert.equal(
    (await host.post({ action: 'open', apiUrl: 'http://localhost:8001' })).error.code,
    'credential-missing',
  );
  await host.dispose();
  const failed = routes(
    {
      ...store,
      save: async () => {
        throw Error('credential-storage-unavailable');
      },
    },
    async () => {
      network++;
      return Response.json({});
    },
  );
  assert.equal(
    (await failed.post({ action: 'open', apiUrl: origin, apiKey: key })).error.code,
    'credential-storage-unavailable',
  );
  assert.equal(network, before);
  await failed.dispose();
});
test('client credential methods expose only metadata and never store a secret in snapshots', async () => {
  const requests = [];
  const client = new AttendeeClient(
    {},
    () => {},
    (s) => s,
    async (url, options) => {
      requests.push({ url, options });
      return Response.json({
        ok: true,
        value: {
          hasSavedKey: !options || JSON.parse(options.body).action !== 'credential-remove',
          apiKey: 'unexpected-server-secret',
        },
      });
    },
  );
  assert.deepEqual(await client.credentialMetadata(origin), { hasSavedKey: true });
  assert.deepEqual(await client.saveCredential(origin, key), { hasSavedKey: true });
  assert.deepEqual(await client.removeCredential(origin), { hasSavedKey: false });
  assert.equal(JSON.stringify(client.getSnapshot()).includes(key), false);
  assert.ok(requests[0].url.includes('action=credential&apiUrl='));
  assert.equal(requests[0].url.includes(key), false);
});
test('credential endpoints validate origins and mutations return only booleans; racing opens cannot replace ownership', async (t) => {
  const { store } = await storage(t); const host = routes(store);
  assert.deepEqual(await host.post({ action: 'credential-save', apiUrl: origin, apiKey: key }), { ok: true, value: { hasSavedKey: true } });
  const denied = await (await host.request(host.url + '?action=credential&apiUrl=' + encodeURIComponent('https://public.example'))).json();
  assert.equal(denied.ok, false); assert.equal(JSON.stringify(denied).includes(key), false);
  const results = await Promise.all([host.post({ action: 'open', apiUrl: origin }), host.post({ action: 'open', apiUrl: origin, apiKey: 'synthetic-other-racing-key' })]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.find((r) => !r.ok).error.code, 'busy');
  assert.equal(JSON.stringify(results).includes(key), false);
  await host.dispose();
  assert.deepEqual(await store.metadata(origin), { hasSavedKey: true });
});
