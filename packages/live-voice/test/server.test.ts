// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apply,
  createSayHost,
  createVoiceContextStore,
  SAY_CHANNEL,
  VOICE_CONTEXT_PATH,
  inject,
} from '../src/server.ts';
import { SayClientEngine } from '../src/modules/speak/engines/say/sayClient.ts';
import { VAD_ASSET_TYPES } from '../src/app/server/vadAssets.ts';

test('shared API route adapter validates envelopes and disposes every registration', async () => {
  const routes = new Map(),
    cleanup = [];
  const contexts = [],
    variables = new Map();
  const sayBytes = Buffer.from('RIFF-test-WAVE');
  const m4aBytes = Buffer.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
  const sayEngines = [];
  const encoded = [];
  apply(
    {
      systemPrompt: {
        context(value) {
          contexts.push(value);
        },
        variable(name, provider) {
          variables.set(name, provider);
        },
      },
      connection: {
        fetch: {
          register(route) {
            routes.set(route.path, route);
            return () => routes.delete(route.path);
          },
        },
      },
      effect(fn) {
        cleanup.push(fn());
      },
    },
    {
      async encodeHostSpeech(wav) {
        encoded.push(Buffer.from(wav));
        return m4aBytes;
      },
      createSayEngine() {
        const engine = {
          async getCapabilities() {
            return { supported: true, audioFormat: 'audio/wav' };
          },
          async speak(text, options) {
            engine.call = { text, options };
            return sayBytes;
          },
          async stop() {},
        };
        sayEngines.push(engine);
        return engine;
      },
    },
  );
  assert.equal(routes.size, 32 + Object.keys(VAD_ASSET_TYPES).length);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].text, '{{live_voice_context}}');
  assert.equal(variables.get('live_voice_context')({ agent: { sessionId: 'one' } }), '');
  const voiceContext = routes.get(VOICE_CONTEXT_PATH);
  assert.equal(voiceContext.requestBody, 'buffered');
  const contextResponse = await voiceContext.fetch(
    new Request('http://localhost' + VOICE_CONTEXT_PATH, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'one', active: true, context: 'Speak concisely.' }),
    }),
  );
  assert.equal(contextResponse.status, 200);
  assert.equal(
    variables.get('live_voice_context')({ agent: { sessionId: 'one' } }),
    'Speak concisely.',
  );
  assert.equal(variables.get('live_voice_context')({ agent: { sessionId: 'two' } }), '');
  assert.equal(routes.get(SAY_CHANNEL + '/whisper/transcribe').requestBody, 'buffered');
  assert.equal(routes.get(SAY_CHANNEL + '/qwen/transcribe').requestBody, 'buffered');
  assert.equal(routes.get(SAY_CHANNEL + '/qwen/speech').requestBody, 'buffered');
  const sayAudio = await routes.get(SAY_CHANNEL + '/say/speech').fetch(
    new Request('http://localhost' + SAY_CHANNEL + '/say/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', voice: 'Samantha', rate: 175 }),
    }),
  );
  assert.equal(sayAudio.headers.get('content-type'), 'audio/mp4');
  assert.deepEqual(Buffer.from(await sayAudio.arrayBuffer()), m4aBytes);
  assert.deepEqual(encoded, [sayBytes]);
  assert.equal(sayEngines.at(-1).call.text, 'Hello');
  assert.equal(sayEngines.at(-1).call.options.rate, 175);
  const invalidAudio = await routes.get(SAY_CHANNEL + '/whisper/transcribe').fetch(
    new Request('http://localhost' + SAY_CHANNEL + '/whisper/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'audio/wav', 'x-dlv-client-id': 'a', 'x-dlv-operation-id': 'b' },
      body: new Uint8Array(44),
    }),
  );
  assert.equal(invalidAudio.status, 502);
  const route = routes.get(SAY_CHANNEL + '/stop');
  const request = (body) =>
    new Request('http://localhost' + route.path, { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await route.fetch(request({ type: 'wrong' }))).status, 400);
  const response = await route.fetch(
    request({
      type: 'client-request',
      rpcId: 'test',
      method: 'dsh-live-voice/stop',
      payload: { clientId: 'a', operationId: 'b' },
    }),
  );
  assert.deepEqual(await response.json(), {
    type: 'server-response',
    rpcId: 'test',
    result: { ok: true, value: { applied: false } },
  });
  for (const dispose of cleanup.reverse()) await dispose();
  assert.equal(routes.size, 0);
});

test('SayClient sends valid SDK targets and envelopes to actual registered routes', async () => {
  const routes = new Map(),
    cleanup = [];
  const contexts = [],
    variables = new Map();
  apply({
    systemPrompt: {
      context(value) {
        contexts.push(value);
      },
      variable(name, provider) {
        variables.set(name, provider);
      },
    },
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route);
          return () => routes.delete(route.path);
        },
      },
    },
    effect(fn) {
      cleanup.push(fn());
    },
  });
  const seen = [];
  const client = new SayClientEngine({
    rpc: {
      async call(channel, endpoint, payload, signal) {
        assert.match(channel, /^\/[A-Za-z0-9._~-]+$/);
        const path = channel + '/' + endpoint;
        seen.push(path);
        const route = routes.get(path);
        assert.ok(route);
        const rpcId = crypto.randomUUID();
        const response = await route.fetch(
          new Request('http://localhost' + path, {
            method: 'POST',
            body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload }),
            signal,
          }),
        );
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.rpcId, rpcId);
        return body.result;
      },
    },
  });
  try {
    assert.deepEqual(await client.request('stop', { clientId: 'test', operationId: 'inactive' }), {
      applied: false,
    });
    assert.deepEqual(seen, ['/api/dsh-live-voice/stop']);
  } finally {
    for (const dispose of cleanup.reverse()) await dispose();
  }
});

function fixture() {
  const jobs = [];
  const engine = {
    getCapabilities: async () => ({ supported: true, pause: true, resume: true }),
    speak(text, options) {
      return new Promise((resolve, reject) => {
        const job = { text, options, resolve, reject, aborted: false };
        jobs.push(job);
        const abort = () => {
          job.aborted = true;
          reject(Object.assign(new Error(), { name: 'AbortError' }));
        };
        options.signal.addEventListener('abort', abort, { once: true });
        if (options.signal.aborted) abort();
      });
    },
    pause: () => true,
    resume: () => true,
    stop: async () => {},
  };
  const host = createSayHost({ engine });
  return {
    host,
    jobs,
    engine,
    rpc: {
      call(channel, endpoint, payload, signal) {
        assert.match(channel, /^\/[A-Za-z0-9._~-]+$/);
        assert.equal(channel, '/api');
        assert.ok(endpoint.startsWith('dsh-live-voice/'));
        return host.handle(endpoint.slice('dsh-live-voice/'.length), payload, signal);
      },
    },
  };
}
const payload = (operationId, clientId = 'client') => ({
  clientId,
  operationId,
  text: 'Private text',
  rate: 175,
});
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('authenticated service injection and capability response', async () => {
  assert.deepEqual(inject, ['connection', 'systemPrompt']);
  const { host } = fixture();
  assert.equal((await host.handle('capabilities')).value.supported, true);
  assert.equal((await host.handle('speak', {})).error.code, 'invalid-request');
});

test('speak stays pending until process completion; disconnect cancels', async () => {
  const { host, jobs } = fixture();
  const abort = new AbortController();
  let finished = false;
  const speech = host.handle('speak', payload('first'), abort.signal).then((value) => {
    finished = true;
    return value;
  });
  await tick();
  assert.equal(finished, false);
  abort.abort();
  assert.equal((await speech).error.code, 'cancelled');
  assert.equal(jobs[0].aborted, true);
});

test('ownership rejects competing clients and ignores stale stop', async () => {
  const { host, jobs } = fixture();
  const first = host.handle('speak', payload('one'));
  await tick();
  assert.equal((await host.handle('speak', payload('other', 'another'))).error.code, 'busy');
  const second = host.handle('speak', payload('two'));
  await tick();
  assert.equal((await first).error.code, 'cancelled');
  assert.equal((await host.handle('stop', payload('one'))).value.applied, false);
  assert.equal(jobs[1].aborted, false);
  assert.equal((await host.handle('pause', payload('two'))).value.applied, true);
  assert.equal((await host.handle('resume', payload('two'))).value.applied, true);
  jobs[1].resolve();
  assert.equal((await second).value.completed, true);
});

test('client maps rate and waits for host close', async () => {
  const { rpc, jobs } = fixture();
  const client = new SayClientEngine({ rpc });
  assert.equal((await client.capability()).location, 'host');
  const speech = client.speak('hello', { rate: 1.2 });
  await tick();
  assert.equal(jobs[0].options.rate, 210);
  jobs[0].resolve();
  await speech;
  assert.equal(client.current, null);
});

test('client stop aborts operation and host disposal closes admission', async () => {
  const { rpc, host, jobs, engine } = fixture();
  const client = new SayClientEngine({ rpc });
  const speech = client.speak('hello');
  const rejected = assert.rejects(speech, { name: 'AbortError' });
  await tick();
  await client.stop();
  await rejected;
  assert.equal(jobs[0].aborted, true);
  let stopped = false;
  engine.stop = async () => {
    stopped = true;
  };
  await host.dispose();
  assert.equal(stopped, true);
  assert.equal((await host.handle('capabilities')).error.code, 'disposed');
});

test('failed engines return sanitized errors without transcript details', async () => {
  const host = createSayHost({
    engine: {
      speak: async () => {
        throw new Error('secret text');
      },
    },
  });
  const result = await host.handle('speak', payload('one'));
  assert.equal(result.error.code, 'speech-failed');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
