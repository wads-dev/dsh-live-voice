// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPluginUpdate } from '../src/modules/settings/services/pluginUpdate.ts';
const bundle = {
  name: 'dsh-live-voice',
  installed: true,
  availability: 'profile',
  enabled: true,
  update: 'registry',
  source: 'dsh-live-voice@^0.4.1',
  version: '0.4.1',
};
function fixture(
  overrides = {},
  reply = { application: 'restart-required', bundle: 'dsh-live-voice', version: '9.0.0' },
) {
  const calls = [];
  const api = {
    listBundles: async () => ({ ok: true, value: [{ ...bundle, ...overrides }] }),
    listVersions: async () => ({
      ok: true,
      value: {
        status: 'listed',
        registry: 'https://registry.npmjs.org/',
        versions: [{ version: '9.0.0', bundle: true, tags: ['latest'], prerelease: false }],
      },
    }),
    updateBundle: async (...args) => {
      calls.push(args);
      return { ok: true, value: { from: '0.4.1', to: '9.0.0', step: 'install', result: reply } };
    },
  };
  return { api, calls, updater: createPluginUpdate({ manager: () => api }) };
}
test('requires explicit confirmation, installs exact release and preserves enablement', async () => {
  const f = fixture({ enabled: false });
  await f.updater.confirm();
  assert.equal(f.calls.length, 0);
  await f.updater.prepare('v9.0.0');
  assert.equal(f.updater.getSnapshot().phase, 'confirm');
  assert.equal(f.calls.length, 0);
  await Promise.all([f.updater.confirm(), f.updater.confirm()]);
  assert.equal(f.calls[0][0], 'dsh-live-voice');
  assert.equal(f.calls[0][1], '9.0.0');
  assert.equal(f.calls[0][2].registry, 'https://registry.npmjs.org/');
  assert.match(f.calls[0][2].requestId, /^[0-9a-f-]{36}$/);
  assert.equal(f.updater.getSnapshot().phase, 'restart');
  await f.updater.prepare('v9.1.0');
  assert.equal(f.calls.length, 1);
});
test('registry preflight blocks unavailable and incompatible releases before mutation', async () => {
  for (const [versions, problem] of [
    [[], 'delayed'],
    [[{ version: '9.0.0', bundle: true, incompatible: {} }], 'incompatible'],
    [[{ version: '9.0.0', bundle: false }], 'unavailable'],
  ]) {
    const f = fixture();
    f.api.listVersions = async () => ({
      ok: true,
      value: { status: 'listed', registry: null, versions },
    });
    await f.updater.prepare('v9.0.0');
    assert.equal(f.updater.getSnapshot().problem, problem);
    assert.equal(f.calls.length, 0);
  }
});

test('restoration outcomes remain distinct and lock automatic retries', async () => {
  for (const application of ['applied', 'restart-required', 'failed']) {
    const f = fixture();
    f.api.updateBundle = async () => ({
      ok: true,
      value: {
        from: '0.4.1',
        to: '9.0.0',
        step: 'install',
        result: { application: 'failed' },
        restore: { application },
      },
    });
    await f.updater.prepare('v9.0.0');
    await f.updater.confirm();
    assert.equal(f.updater.getSnapshot().phase, 'uncertain');
    assert.equal(
      f.updater.getSnapshot().problem,
      application === 'failed' ? 'restoreFailed' : 'restored',
    );
  }
});

test('registry-tag sources use host eligibility and older managers fail safely', async () => {
  const f = fixture({ source: 'latest' });
  await f.updater.prepare('v9.0.0');
  await f.updater.confirm();
  assert.equal(f.calls.length, 1);
  const legacy = fixture();
  legacy.api.updateBundle = undefined;
  await legacy.updater.prepare('v9.0.0');
  assert.equal(legacy.updater.getSnapshot().problem, 'unavailable');
});

test('cancel and invalid or old releases never install', async () => {
  const f = fixture();
  for (const tag of ['--help', '9.0.0;echo bad', 'https://example.com', 'v0.0.1'])
    await f.updater.prepare(tag);
  assert.equal(f.updater.getSnapshot().phase, 'idle');
  await f.updater.prepare('v9.0.0');
  f.updater.cancel();
  await f.updater.confirm();
  assert.equal(f.calls.length, 0);
});
test('refuses local/custom dependencies and unavailable profiles', async () => {
  for (const source of [
    'link:/tmp/plugin',
    'file:../plugin',
    'git+https://example.com',
    'latest',
    'https://example.com/archive.tgz',
  ]) {
    const f = fixture({ source, update: undefined });
    await f.updater.prepare('v9.0.0');
    await f.updater.confirm();
    assert.equal(f.updater.getSnapshot().problem, 'local');
    assert.equal(f.calls.length, 0);
  }
  const u = createPluginUpdate({ manager: () => undefined });
  await u.prepare('v9.0.0');
  assert.equal(u.getSnapshot().problem, 'unavailable');
});
test('rechecks source and voice activity at confirmation', async () => {
  const f = fixture();
  let busy = false;
  const u = createPluginUpdate({ manager: () => f.api, isBusy: () => busy });
  await u.prepare('v9.0.0');
  busy = true;
  await u.confirm();
  assert.equal(u.getSnapshot().problem, 'busy');
  assert.equal(f.calls.length, 0);
  busy = false;
  await u.prepare('v9.0.0');
  f.api.listBundles = async () => ({
    ok: true,
    value: [{ ...bundle, source: 'link:/tmp/dev', update: undefined }],
  });
  await u.confirm();
  assert.equal(u.getSnapshot().problem, 'local');
  assert.equal(f.calls.length, 0);
});
test('failed installs never approve scripts or report success', async () => {
  const f = fixture({}, { application: 'failed', pendingBuilds: ['untrusted'] });
  await f.updater.prepare('v9.0.0');
  await f.updater.confirm();
  assert.equal(f.updater.getSnapshot().problem, 'scripts');
  assert.equal(f.calls[0][2].approvedBuilds, undefined);
});
test('lost replies and mismatched results stay uncertain without retry', async () => {
  for (const reply of [
    { application: 'applied', bundle: 'other', version: '9.0.0' },
    { application: 'applied', bundle: 'dsh-live-voice', version: '8.0.0' },
  ]) {
    const f = fixture({}, reply);
    await f.updater.prepare('v9.0.0');
    await f.updater.confirm();
    assert.equal(f.updater.getSnapshot().phase, 'uncertain');
  }
  const f = fixture();
  f.api.updateBundle = async () => {
    f.calls.push('attempt');
    throw new Error('connection lost');
  };
  await f.updater.prepare('v9.0.0');
  await f.updater.confirm();
  await f.updater.prepare('v9.0.0');
  await f.updater.confirm();
  assert.equal(f.updater.getSnapshot().phase, 'uncertain');
  assert.equal(f.calls.length, 1);
});

test('alpha3 installer failure kinds produce actionable blockers without approval or retry', async () => {
  for (const [details, problem] of [
    [{ packageResult: { kind: 'build-blocked' } }, 'scripts'],
    [{ packageResult: { kind: 'no-matching-version' } }, 'delayed'],
    [{ packageResult: { kind: 'not-found' } }, 'delayed'],
    [{ error: { code: 'incompatible-version' } }, 'incompatible'],
    [{ packageResult: { incompatible: [{ name: 'plugin' }] } }, 'incompatible'],
    [{ packageResult: { kind: 'network' } }, 'failed'],
  ]) {
    const f = fixture({}, { application: 'failed', ...details });
    await f.updater.prepare('v9.0.0');
    await f.updater.confirm();
    assert.equal(f.updater.getSnapshot().problem, problem);
    assert.equal(f.updater.getSnapshot().phase, 'failed');
    assert.equal(f.calls.length, 1);
    assert.deepEqual(Object.keys(f.calls[0][2]).sort(), ['registry', 'requestId']);
  }
});
