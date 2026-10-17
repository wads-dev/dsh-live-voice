// @ts-nocheck
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { transcriptionContext } from '../../recognition/transcriptionContext.js';
import { defaultQwenVoice, isQwenVoice } from '../settings.js';
import { validateMonoPcm16Wav } from '../../recognition/engines/whisper/whisperRecognitionHost.js';

const clean = (value) => String(value ?? '').trim();
export function resolveQwenBaseUrl(
  value = process.env.DSH_LIVE_VOICE_QWEN_URL || 'http://127.0.0.1:8080/',
) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Qwen API URL must use HTTP or HTTPS.');
  url.pathname = url.pathname.replace(/\/*$/, '/');
  url.search = '';
  url.hash = '';
  return url;
}
export function validateQwenConfig(value) {
  if (!value || typeof value.baseUrl !== 'string')
    throw new Error('Qwen API base URL is required.');
  const baseUrl = resolveQwenBaseUrl(value.baseUrl.trim());
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 600000)
    throw new Error('Request timeout must be an integer between 1000 and 600000 ms.');
  return { baseUrl: baseUrl.href, timeoutMs: value.timeoutMs };
}
export function createQwenConfigStore(path = join(homedir(), '.dsh', 'dsh-live-voice-qwen.json')) {
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw new Error('Cannot read persisted Qwen settings: ' + error.message);
      }
    },
    async save(config) {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = path + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temporary, JSON.stringify(config, null, 2) + '\n', {
          mode: 0o600,
          flag: 'wx',
        });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
const language = (value) =>
  value === 'auto'
    ? undefined
    : value?.toLowerCase().startsWith('pt')
      ? 'portuguese'
      : value?.toLowerCase().startsWith('en')
        ? 'english'
        : value;
export class QwenHttpHost {
  constructor({
    baseUrl,
    timeoutMs = 300000,
    fetchImpl = globalThis.fetch,
    maxBytes = 50_000_000,
    maxSpeechBytes = 50_000_000,
    store,
  } = {}) {
    this.config = validateQwenConfig({ baseUrl: resolveQwenBaseUrl(baseUrl).href, timeoutMs });
    this.fetch = fetchImpl;
    this.maxBytes = maxBytes;
    this.maxSpeechBytes = maxSpeechBytes;
    this.store = store;
    this.active = new AbortController();
    this.queue = Promise.resolve();
    this.ready = Promise.resolve()
      .then(async () => {
        const saved = await store?.load();
        if (saved) this.config = validateQwenConfig(saved);
      })
      .catch((error) => {
        this.loadError = error;
      });
  }
  async getConfig() {
    await this.ready;
    if (this.loadError) throw this.loadError;
    return { ...this.config };
  }
  replaceConfig(value) {
    const next = validateQwenConfig(value);
    const operation = this.queue.then(async () => {
      await this.ready;
      await this.store?.save(next);
      this.active.abort();
      this.active = new AbortController();
      this.config = next;
      this.loadError = null;
      return { ...next };
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  dispose() {
    this.active.abort();
  }
  async request(path, options, configuration, consume = (response) => response) {
    const config = configuration ? validateQwenConfig(configuration) : await this.getConfig();
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const signal = AbortSignal.any([
      timeout,
      this.active.signal,
      ...(options.signal ? [options.signal] : []),
    ]);
    const response = await this.fetch(new URL(path, config.baseUrl), {
      ...options,
      signal,
      redirect: 'error',
    });
    const value = await consume(response);
    signal.throwIfAborted();
    return value;
  }
  async serverInfo(signal, configuration) {
    const response = await this.request('health', { signal }, configuration, async (response) => ({
      ok: response.ok,
      status: response.status,
      body: response.ok ? await response.json() : null,
    }));
    return { ...response, ominix: response.body?.service === 'ominix-api' };
  }
  async capability(signal, configuration, kind = 'both') {
    try {
      const config = configuration ? validateQwenConfig(configuration) : await this.getConfig();
      const health = await this.serverInfo(signal, config);
      let models = health.body?.models;
      if (health.ominix && health.ok) {
        const status = await this.request(
          'v1/models/status',
          { signal },
          config,
          async (response) => ({
            ok: response.ok,
            status: response.status,
            body: response.ok ? await response.json() : null,
          }),
        );
        models = {
          asr: status.body?.models?.asr === 'qwen3-asr',
          tts: status.body?.models?.qwen3_tts === 'customvoice',
        };
      }
      const ready =
        kind === 'asr'
          ? models?.asr === true
          : kind === 'tts'
            ? models?.tts === true
            : models?.asr === true && models?.tts === true;
      return health.ok && ready
        ? { supported: true, local: true, location: 'host', streaming: false, models }
        : {
            supported: false,
            local: true,
            location: 'host',
            streaming: false,
            reason: `Qwen health check did not report ${kind === 'both' ? 'both ASR and TTS' : kind.toUpperCase()} ready (${health.status}).`,
          };
    } catch (error) {
      return {
        supported: false,
        local: true,
        location: 'host',
        streaming: false,
        reason: 'Qwen speech server is unreachable: ' + (error?.message || error),
      };
    }
  }
  async transcribe(input, { lang = 'pt-BR', context = '', signal } = {}) {
    const bytes = validateMonoPcm16Wav(input, { maxBytes: this.maxBytes }),
      prompt = transcriptionContext(context),
      resolved = language(lang),
      health = await this.serverInfo(signal);
    let body, headers;
    if (health.ominix) {
      headers = { 'content-type': 'application/json' };
      body = JSON.stringify({
        file: Buffer.from(bytes).toString('base64'),
        language: resolved,
        response_format: 'json',
        ...(prompt ? { prompt } : {}),
      });
    } else {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'utterance.wav');
      form.append('response_format', 'json');
      if (resolved) form.append('language', resolved);
      if (prompt) form.append('prompt', prompt);
      body = form;
    }
    return this.request(
      'v1/audio/transcriptions',
      { method: 'POST', headers, body, signal },
      undefined,
      async (response) => {
        if (!response.ok) throw new Error('Qwen transcription failed (' + response.status + ').');
        const json = await response.json();
        return { text: clean(json?.text) };
      },
    );
  }
  async synthesize(text, { lang = 'pt-BR', signal, voice = defaultQwenVoice } = {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > 100000 || text.includes('\0'))
      throw new Error('Speech text must contain 1–100000 characters without NUL.');
    if (!isQwenVoice(voice)) throw new Error('Unsupported Qwen voice.');
    return this.request(
      'v1/audio/speech',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3-tts',
          input: text,
          voice,
          language: language(lang) || 'portuguese',
          response_format: 'wav',
        }),
        signal,
      },
      undefined,
      async (response) => {
        if (!response.ok) throw new Error('Qwen synthesis failed (' + response.status + ').');
        const length = Number(response.headers.get('content-length') || 0);
        if (length > this.maxSpeechBytes) throw new Error('Qwen speech response is too large.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 44 || bytes.byteLength > this.maxSpeechBytes)
          throw new Error('Qwen returned invalid or oversized speech audio.');
        return bytes;
      },
    );
  }
}
