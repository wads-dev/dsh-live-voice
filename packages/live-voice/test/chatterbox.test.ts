// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatterboxHttpHost } from '../src/modules/speak/engines/chatterbox/ChatterboxHttpHost.ts';
import { ChatterboxSpeakingEngine } from '../src/modules/speak/engines/chatterbox/ChatterboxSpeakingEngine.ts';
import { registerChatterboxRoutes } from '../src/app/server/chatterboxRoutes.ts';
import { normalizeSettings } from '../src/modules/core/settings.ts';
import { speechEngineSelectionPatch } from '../src/modules/settings/models/browserVoiceSelection.ts';

const id = 'a'.repeat(32),
  voice = 'b'.repeat(24);
const wav = new Uint8Array(48);
wav.set(new TextEncoder().encode('RIFF'));

test('Chatterbox bridge discovers voices without health probes and preserves explicit preferences', async () => {
  const calls = [];
  const host = new ChatterboxHttpHost(async (url) => {
    calls.push(url);
    return Response.json({
      voices: [
        { id: voice, name: 'Local reference' },
        { id: '../../bad', name: 'Invalid' },
        null,
        { name: 'Missing ID' },
      ],
    });
  });
  assert.deepEqual(await host.voices(), [{ id: voice, name: 'Local reference' }]);
  assert.deepEqual(speechEngineSelectionPatch('chatterbox-http', 'qwen-http', []), {
    engine: 'qwen-http',
    voice: 'aiden',
  });
  assert.deepEqual(speechEngineSelectionPatch('chatterbox-http', 'browser', []), {
    engine: 'browser',
    voice: '',
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('127.0.0.1:7865/v1/voices'));
  assert.equal(normalizeSettings({ engine: 'chatterbox-http', voice }).engine, 'chatterbox-http');
  assert.deepEqual(speechEngineSelectionPatch('say', 'chatterbox-http', []), {
    engine: 'chatterbox-http',
    voice: '',
  });
});

test('Chatterbox bridge returns WAV and cleans up transient jobs without arbitrary URLs', async () => {
  const calls = [];
  const host = new ChatterboxHttpHost(async (url, init = {}) => {
    calls.push([url, init]);
    if (init.method === 'DELETE') return Response.json({ cancelled: true });
    if (url.endsWith('/v1/jobs')) return Response.json({ id });
    if (url.includes('/v1/jobs/')) return Response.json({ phase: 'done' });
    return new Response(wav, { headers: { 'content-type': 'audio/wav' } });
  });
  assert.deepEqual(await host.synthesize('Olá', { voice, lang: 'pt-BR' }), wav);
  assert.equal(calls.at(-1)[1].method, 'DELETE');
  assert.equal(JSON.parse(calls[0][1].body).voice, voice);
  for (const url of calls.map((c) => c[0])) assert.ok(url.startsWith('http://127.0.0.1:7865/'));
  await assert.rejects(host.synthesize('Olá', { voice: '../../secret' }));
  await assert.rejects(host.synthesize('Olá', { lang: 'en-US' }));
});

test('Chatterbox cancellation during admission still cancels the admitted job', async () => {
  const controller = new AbortController();
  const calls = [];
  const host = new ChatterboxHttpHost(async (url, init = {}) => {
    calls.push([url, init.method]);
    if (init.method === 'DELETE') return Response.json({ cancelled: true });
    controller.abort();
    return Response.json({ id });
  });
  await assert.rejects(host.synthesize('Olá', { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(calls.at(-1)[1], 'DELETE');
});

test('Chatterbox client reuses host-audio format and neutral synthesis rate', async () => {
  let request;
  const engine = new ChatterboxSpeakingEngine({
    globals: {
      fetch: async (url, init) => {
        request = { url, body: JSON.parse(init.body) };
        return new Response(new Blob(['audio'], { type: 'audio/mp4' }));
      },
      URL: { createObjectURL: () => 'blob:audio', revokeObjectURL() {} },
      Audio: class {},
    },
  });
  const prepared = await engine.prepare('Olá', { voice, rate: 1.5 });
  assert.equal(request.body.rate, 1);
  assert.equal(request.body.voice, voice);
  assert.ok(request.url.endsWith('/chatterbox/speech'));
  prepared.dispose();
});

test('Chatterbox routes preserve authenticated carrier, abort signal, compact format and cleanup', async () => {
  const routes = [],
    cleanup = [];
  let received;
  const ctx = {
    connection: {
      fetch: {
        register: (route) => {
          routes.push(route);
          return () => cleanup.push(route.path);
        },
      },
    },
    effect: (fn) => {
      ctx.dispose = fn();
    },
  };
  const host = {
    voices: async () => [{ id: voice, name: 'Reference' }],
    capability: async () => ({ supported: true }),
    synthesize: async (text, opts) => {
      received = { text, ...opts };
      return wav;
    },
    dispose() {
      cleanup.push('host');
    },
  };
  registerChatterboxRoutes(ctx, { host, encode: async () => new Uint8Array([1, 2, 3]) });
  assert.equal(routes.length, 3);
  const route = routes.find((r) => r.path.endsWith('/speech'));
  const request = new Request('https://dsh.local/api/dsh-live-voice/chatterbox/speech', {
    method: 'POST',
    body: JSON.stringify({ text: 'Olá', voice, lang: 'pt-BR' }),
  });
  const result = await route.fetch(request);
  assert.equal(result.headers.get('content-type'), 'audio/mp4');
  assert.equal(received.signal, request.signal);
  assert.equal(
    (await route.fetch(new Request(request.url, { method: 'POST', body: '{' }))).status,
    400,
  );
  ctx.dispose();
  assert.equal(cleanup.length, 4);
});
