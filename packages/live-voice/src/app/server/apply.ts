// @ts-nocheck
import {
  QwenHttpHost,
  createQwenConfigStore,
  validateQwenConfig,
} from '../../modules/core/qwen/QwenHttpHost.js';
import {
  WhisperHttpHost,
  createWhisperConfigStore,
  validateWhisperConfig,
} from '../../modules/recognition/engines/whisper/whisperRecognitionHost.js';
import { readTranscriptionContextHeader } from '../../modules/recognition/transcriptionContext.js';
import { wavToM4aAac } from '../../modules/speak/engines/audio/M4aAacTranscoder.js';
import { SayEngine } from '../../modules/speak/engines/say/SaySpeakingEngine.js';
import { createSettingsStore } from '../../modules/settings/models/settingsHost.js';
import { registerSettingsRoute } from './registerRoutes.js';
import { registerAttendeeRoutes } from './attendeeRoutes.js';
import { registerVadAssetRoutes } from './vadAssets.js';
import { registerBrowserAsrAssets } from './browserAsrAssets.js';

export const name = 'dsh-live-voice';
export const inject = ['connection', 'systemPrompt'];
export const SAY_CHANNEL = '/api/dsh-live-voice';
export const VOICE_CONTEXT_PATH = SAY_CHANNEL + '/voice-context';

export function createVoiceContextStore() {
  const entries = new Map();
  return {
    get(sessionId) {
      return entries.get(sessionId) || '';
    },
    set(sessionId, text) {
      if (text) entries.set(sessionId, text);
      else entries.delete(sessionId);
    },
    clear() {
      entries.clear();
    },
  };
}
const ok = (value) => ({ ok: true, value });
const fail = (code, message) => ({ ok: false, error: { code, message, details: {} } });
const identity = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

/** One local speaker owner. IDs isolate control races, not authenticated users:
 * Connection owns browser authentication; its RPC handler exposes no user identity.
 */
export function createSayHost({ engine = new SayEngine() } = {}) {
  let active = null;
  let disposed = false;
  async function handle(endpoint, payload, signal) {
    if (disposed) return fail('disposed', 'Speech service is closed.');
    if (signal?.aborted) return fail('cancelled', 'Speech was cancelled.');
    try {
      if (endpoint === 'capabilities') return ok(await engine.getCapabilities());
      if (!['speak', 'stop', 'pause', 'resume'].includes(endpoint))
        return fail('not-found', 'Unknown speech endpoint.');
      if (!payload || !identity(payload.clientId) || !identity(payload.operationId)) {
        return fail('invalid-request', 'Valid client and operation IDs are required.');
      }
      const owns =
        active?.clientId === payload.clientId && active?.operationId === payload.operationId;
      if (endpoint !== 'speak') {
        if (!owns) return ok({ applied: false });
        const operation = active;
        if (endpoint === 'stop') {
          operation.abort.abort();
          // Await this operation, never call a global stop after an await:
          // a new request could already own the speaker by then.
          await operation.done;
          return ok({ applied: true });
        }
        return ok({ applied: Boolean(engine[endpoint]()) });
      }
      if (
        typeof payload.text !== 'string' ||
        !payload.text.trim() ||
        payload.text.length > 100000 ||
        payload.text.includes('\0')
      )
        return fail('invalid-request', 'Speech text must contain 1–100000 characters without NUL.');
      if (
        payload.voice !== undefined &&
        (typeof payload.voice !== 'string' ||
          !payload.voice.trim() ||
          payload.voice.length > 200 ||
          payload.voice.includes('\0'))
      )
        return fail('invalid-request', 'Invalid voice.');
      if (!Number.isFinite(payload.rate) || payload.rate < 18 || payload.rate > 1750)
        return fail('invalid-request', 'Invalid speech rate.');
      if (active && active.clientId !== payload.clientId)
        return fail('busy', 'Another voice client owns the host speaker.');
      if (owns) return fail('duplicate-operation', 'The speech operation is already active.');
      active?.abort.abort();
      const operation = {
        clientId: payload.clientId,
        operationId: payload.operationId,
        abort: new AbortController(),
        done: null,
      };
      active = operation;
      const cancel = () => operation.abort.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
      // Keep the authenticated RPC open until process close and file cleanup.
      // DSH aborts its signal when the browser connection closes prematurely.
      operation.done = Promise.resolve()
        .then(() =>
          engine.speak(payload.text, {
            voice: payload.voice,
            rate: payload.rate,
            signal: operation.abort.signal,
          }),
        )
        .then(
          () => ok({ completed: true }),
          (error) =>
            error?.name === 'AbortError'
              ? fail('cancelled', 'Speech was cancelled.')
              : fail('speech-failed', 'Local speech failed.'),
        );
      try {
        return await operation.done;
      } finally {
        signal?.removeEventListener('abort', cancel);
        if (active === operation) active = null;
      }
    } catch {
      return fail('speech-failed', 'Local speech service failed.');
    }
  }
  async function dispose() {
    disposed = true;
    active?.abort.abort();
    await engine.stop();
    active = null;
  }
  return { handle, dispose, engine };
}

export function apply(
  ctx,
  {
    settingsStore = createSettingsStore(),
    whisperStore = createWhisperConfigStore(),
    whisperFetch = globalThis.fetch,
    qwenStore = createQwenConfigStore(),
    qwenFetch = globalThis.fetch,
    voiceContextStore = createVoiceContextStore(),
    createSayEngine = () => new SayEngine(),
    encodeHostSpeech = wavToM4aAac,
  } = {},
) {
  registerSettingsRoute(ctx, settingsStore);
  if (typeof ctx.inject === 'function')
    ctx.inject(['webServer'], (webCtx) => registerAttendeeRoutes(webCtx));
  registerVadAssetRoutes(ctx);
  registerBrowserAsrAssets(ctx);
  ctx.systemPrompt.variable('live_voice_context', (assemblyContext) =>
    voiceContextStore.get(String(assemblyContext.agent?.sessionId || '')),
  );
  ctx.systemPrompt.context({
    name: 'dsh-live-voice:spoken-output',
    order: 700,
    text: '{{live_voice_context}}',
  });
  const disposeVoiceContext = ctx.connection.fetch.register({
    path: VOICE_CONTEXT_PATH,
    methods: ['PUT'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json();
        if (
          !identity(body?.sessionId) ||
          typeof body?.context !== 'string' ||
          body.context.length > 4000 ||
          body.context.includes('\0')
        )
          return Response.json(
            fail('invalid-request', 'A valid session ID and voice context are required.'),
            { status: 400 },
          );
        voiceContextStore.set(body.sessionId, body.active === true ? body.context.trim() : '');
        return Response.json(ok({ active: body.active === true && Boolean(body.context.trim()) }));
      } catch {
        return Response.json(fail('invalid-request', 'Invalid voice context request.'), {
          status: 400,
        });
      }
    },
  });
  ctx.effect(
    () => () => {
      disposeVoiceContext();
      voiceContextStore.clear();
    },
    'dsh-live-voice: remove voice context',
  );
  const host = createSayHost();
  const saySyntheses = new Set();
  const sayCapability = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/say/capabilities',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () =>
      Response.json(ok({ ...(await host.engine.getCapabilities()), audioFormat: 'audio/mp4' })),
  });
  const saySpeech = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/say/speech',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json();
        const engine = createSayEngine();
        saySyntheses.add(engine);
        try {
          const wav = await engine.speak(body?.text, {
            voice: body?.voice,
            rate: body?.rate,
            signal: request.signal,
          });
          const bytes = await encodeHostSpeech(wav, { signal: request.signal });
          return new Response(bytes, {
            status: 200,
            headers: { 'content-type': 'audio/mp4', 'cache-control': 'no-store' },
          });
        } finally {
          saySyntheses.delete(engine);
        }
      } catch (error) {
        if (error?.name === 'AbortError')
          return Response.json(fail('cancelled', 'Speech synthesis was cancelled.'), {
            status: 499,
          });
        return Response.json(fail('synthesis-failed', 'Local speech synthesis failed.'), {
          status: 502,
        });
      }
    },
  });
  ctx.effect(
    () => async () => {
      sayCapability();
      saySpeech();
      await Promise.allSettled([...saySyntheses].map((engine) => engine.stop()));
      saySyntheses.clear();
    },
    'dsh-live-voice: remove say audio routes',
  );
  const whisper = new WhisperHttpHost({ store: whisperStore, fetchImpl: whisperFetch });
  const qwen = new QwenHttpHost({ store: qwenStore, fetchImpl: qwenFetch });
  for (const endpoint of ['config', 'test']) {
    const dispose = ctx.connection.fetch.register({
      path: SAY_CHANNEL + '/whisper/' + endpoint,
      methods: endpoint === 'config' ? ['GET', 'PUT'] : ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          if (request.method === 'GET') return Response.json(ok(await whisper.getConfig()));
          let config;
          try {
            config = validateWhisperConfig(await request.json());
          } catch (error) {
            return Response.json(fail('invalid-config', error.message), { status: 400 });
          }
          const value =
            endpoint === 'test'
              ? await whisper.capability(request.signal, config)
              : await whisper.replaceConfig(config);
          return Response.json(ok(value));
        } catch (error) {
          return Response.json(
            fail('config-failed', error.message || 'Whisper settings could not be saved.'),
            { status: 500 },
          );
        }
      },
    });
    ctx.effect(() => () => dispose(), 'dsh-live-voice: remove Whisper ' + endpoint + ' route');
  }
  ctx.effect(() => () => whisper.dispose(), 'dsh-live-voice: cancel Whisper requests');
  const whisperCapability = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/whisper/capabilities',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => Response.json(ok(await whisper.capability(request.signal))),
  });
  const whisperTranscribe = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/whisper/transcribe',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const clientId = request.headers.get('x-dlv-client-id'),
          operationId = request.headers.get('x-dlv-operation-id');
        if (!identity(clientId) || !identity(operationId))
          return Response.json(
            fail('invalid-request', 'Valid client and operation IDs are required.'),
            { status: 400 },
          );
        if (request.headers.get('content-type')?.split(';')[0] !== 'audio/wav')
          return Response.json(
            fail('invalid-audio', 'A mono 16 kHz PCM WAV recording is required.'),
            { status: 400 },
          );
        const length = Number(request.headers.get('content-length') || 0);
        if (length > whisper.maxBytes)
          return Response.json(
            fail('audio-too-large', 'The recording exceeds the configured Whisper limit.'),
            { status: 413 },
          );
        let context;
        try {
          context = readTranscriptionContextHeader(request.headers);
        } catch {
          return Response.json(fail('invalid-context', 'Invalid transcription context.'), {
            status: 400,
          });
        }
        const value = await whisper.transcribe(await request.arrayBuffer(), {
          context,
          lang: request.headers.get('x-dlv-language') || 'auto',
          signal: request.signal,
        });
        return Response.json(ok(value));
      } catch (error) {
        if (error?.name === 'AbortError')
          return Response.json(fail('cancelled', 'Whisper transcription was cancelled.'), {
            status: 499,
          });
        return Response.json(
          fail('transcription-failed', error?.message || 'Whisper transcription failed.'),
          { status: 502 },
        );
      }
    },
  });
  ctx.effect(
    () => async () => {
      await whisperCapability();
      await whisperTranscribe();
    },
    'dsh-live-voice: remove Whisper routes',
  );
  for (const endpoint of ['config', 'test']) {
    const dispose = ctx.connection.fetch.register({
      path: SAY_CHANNEL + '/qwen/' + endpoint,
      methods: endpoint === 'config' ? ['GET', 'PUT'] : ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          if (request.method === 'GET') return Response.json(ok(await qwen.getConfig()));
          let config;
          try {
            config = validateQwenConfig(await request.json());
          } catch (error) {
            return Response.json(fail('invalid-config', error.message), { status: 400 });
          }
          const value =
            endpoint === 'test'
              ? await qwen.capability(request.signal, config)
              : await qwen.replaceConfig(config);
          return Response.json(ok(value));
        } catch (error) {
          return Response.json(
            fail('config-failed', error.message || 'Qwen settings could not be saved.'),
            { status: 500 },
          );
        }
      },
    });
    ctx.effect(() => () => dispose(), 'dsh-live-voice: remove Qwen ' + endpoint + ' route');
  }
  ctx.effect(() => () => qwen.dispose(), 'dsh-live-voice: cancel Qwen requests');
  const qwenCapability = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/qwen/capabilities',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const kind = new URL(request.url).searchParams.get('kind');
      return Response.json(
        ok(
          await qwen.capability(
            request.signal,
            undefined,
            kind === 'asr' || kind === 'tts' ? kind : 'both',
          ),
        ),
      );
    },
  });
  const qwenTranscribe = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/qwen/transcribe',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const clientId = request.headers.get('x-dlv-client-id'),
          operationId = request.headers.get('x-dlv-operation-id');
        if (!identity(clientId) || !identity(operationId))
          return Response.json(
            fail('invalid-request', 'Valid client and operation IDs are required.'),
            { status: 400 },
          );
        if (request.headers.get('content-type')?.split(';')[0] !== 'audio/wav')
          return Response.json(
            fail('invalid-audio', 'A mono 16 kHz PCM WAV recording is required.'),
            { status: 400 },
          );
        const length = Number(request.headers.get('content-length') || 0);
        if (length > qwen.maxBytes)
          return Response.json(
            fail('audio-too-large', 'The recording exceeds the configured Qwen limit.'),
            { status: 413 },
          );
        let context;
        try {
          context = readTranscriptionContextHeader(request.headers);
        } catch {
          return Response.json(fail('invalid-context', 'Invalid transcription context.'), {
            status: 400,
          });
        }
        return Response.json(
          ok(
            await qwen.transcribe(await request.arrayBuffer(), {
              context,
              lang: request.headers.get('x-dlv-language') || 'pt-BR',
              signal: request.signal,
            }),
          ),
        );
      } catch (error) {
        if (error?.name === 'AbortError')
          return Response.json(fail('cancelled', 'Qwen transcription was cancelled.'), {
            status: 499,
          });
        return Response.json(
          fail('transcription-failed', error?.message || 'Qwen transcription failed.'),
          { status: 502 },
        );
      }
    },
  });
  const qwenSpeech = ctx.connection.fetch.register({
    path: SAY_CHANNEL + '/qwen/speech',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json();
        const wav = await qwen.synthesize(body?.text, {
          lang: body?.lang || 'pt-BR',
          voice: body?.voice,
          signal: request.signal,
        });
        const bytes = await encodeHostSpeech(wav, { signal: request.signal });
        return new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'audio/mp4', 'cache-control': 'no-store' },
        });
      } catch (error) {
        if (error?.name === 'AbortError')
          return Response.json(fail('cancelled', 'Qwen synthesis was cancelled.'), { status: 499 });
        return Response.json(fail('synthesis-failed', error?.message || 'Qwen synthesis failed.'), {
          status: 502,
        });
      }
    },
  });
  ctx.effect(
    () => async () => {
      await qwenCapability();
      await qwenTranscribe();
      await qwenSpeech();
    },
    'dsh-live-voice: remove Qwen routes',
  );
  // Existing /api carrier preserves DSH authentication and disconnect signals.
  for (const endpoint of ['capabilities', 'speak', 'stop', 'pause', 'resume']) {
    const dispose = ctx.connection.fetch.register({
      path: `${SAY_CHANNEL}/${endpoint}`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        if (
          body?.type !== 'client-request' ||
          typeof body.rpcId !== 'string' ||
          body.rpcId.length > 128 ||
          body.method !== `dsh-live-voice/${endpoint}`
        )
          return new Response('Invalid RPC envelope', { status: 400 });
        const result = await host.handle(endpoint, body.payload, request.signal);
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result });
      },
    });
    ctx.effect(() => () => dispose(), `dsh-live-voice: remove ${endpoint} route`);
  }
  ctx.effect(() => () => host.dispose(), 'dsh-live-voice: stop host speech');
}
