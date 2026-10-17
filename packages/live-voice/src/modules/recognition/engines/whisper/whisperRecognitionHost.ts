// @ts-nocheck
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { transcriptionContext } from '../../transcriptionContext.js';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export function validateWhisperConfig(value) {
  if (!value || typeof value.url !== 'string' || typeof value.healthUrl !== 'string')
    throw new Error('Endpoint URL and health URL/path are required.');
  const url = resolveWhisperUrl(value.url.trim());
  const health = value.healthUrl.trim();
  if (!health) throw new Error('Health URL/path is required.');
  resolveWhisperUrl(new URL(health, url).href);
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 100 || value.timeoutMs > 300000)
    throw new Error('Request timeout must be an integer between 100 and 300000 ms.');
  return { url: url.href, healthUrl: health, timeoutMs: value.timeoutMs };
}
export function createWhisperConfigStore(
  path = join(homedir(), '.dsh', 'dsh-live-voice-whisper.json'),
) {
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw new Error('Cannot read persisted Whisper settings: ' + error.message);
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
const clean = (value) => String(value ?? '').trim();
export function resolveWhisperUrl(
  value = process.env.DSH_LIVE_VOICE_WHISPER_URL || 'http://127.0.0.1:8080/inference',
) {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !LOOPBACK.has(url.hostname) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Whisper HTTP URL must be an unauthenticated loopback http URL.');
  return url;
}
export function validateMonoPcm16Wav(input, { maxBytes = 2_000_000 } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 44 || bytes.byteLength > maxBytes)
    throw new Error('Invalid or oversized WAV recording.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    ascii = (at, n) => String.fromCharCode(...bytes.subarray(at, at + n));
  if (
    ascii(0, 4) !== 'RIFF' ||
    ascii(8, 4) !== 'WAVE' ||
    view.getUint32(4, true) + 8 !== bytes.byteLength
  )
    throw new Error('Invalid WAV container.');
  let at = 12,
    fmt = null,
    data = null;
  while (at + 8 <= bytes.byteLength) {
    const id = ascii(at, 4),
      size = view.getUint32(at + 4, true),
      start = at + 8,
      end = start + size;
    if (end > bytes.byteLength) throw new Error('Invalid WAV chunk.');
    if (id === 'fmt ') fmt = { start, size };
    if (id === 'data') {
      if (data) throw new Error('Multiple WAV data chunks are unsupported.');
      data = { start, size };
    }
    at = end + (size & 1);
  }
  if (!fmt || fmt.size < 16 || !data || at !== bytes.byteLength)
    throw new Error('Incomplete WAV recording.');
  const f = fmt.start;
  if (
    view.getUint16(f, true) !== 1 ||
    view.getUint16(f + 2, true) !== 1 ||
    view.getUint32(f + 4, true) !== 16000 ||
    view.getUint32(f + 8, true) !== 32000 ||
    view.getUint16(f + 12, true) !== 2 ||
    view.getUint16(f + 14, true) !== 16 ||
    data.size < 2 ||
    data.size % 2
  )
    throw new Error('WAV must be mono 16 kHz PCM16.');
  return bytes;
}
export class WhisperHttpHost {
  constructor({
    url,
    healthUrl = '/health',
    timeoutMs = 30000,
    fetchImpl = globalThis.fetch,
    maxBytes = 2_000_000,
    store,
  } = {}) {
    this.config = validateWhisperConfig({ url: resolveWhisperUrl(url).href, healthUrl, timeoutMs });
    this.fetch = fetchImpl;
    this.maxBytes = maxBytes;
    this.store = store;
    this.active = new AbortController();
    this.queue = Promise.resolve();
    this.ready = Promise.resolve()
      .then(async () => {
        const saved = await store?.load();
        if (saved) this.config = validateWhisperConfig(saved);
      })
      .catch((error) => {
        this.loadError = error;
      });
  }
  get url() {
    return new URL(this.config.url);
  }
  async getConfig() {
    await this.ready;
    if (this.loadError) throw this.loadError;
    return { ...this.config };
  }
  replaceConfig(value) {
    const next = validateWhisperConfig(value);
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
  async request(url, options, config, consume = (response) => response) {
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const signal = AbortSignal.any([
      timeout,
      this.active.signal,
      ...(options.signal ? [options.signal] : []),
    ]);
    const response = await this.fetch(url, { ...options, signal, redirect: 'error' });
    const value = await consume(response);
    signal.throwIfAborted();
    return value;
  }
  async capability(signal, configuration) {
    try {
      const config = configuration ? validateWhisperConfig(configuration) : await this.getConfig();
      const response = await this.request(
        new URL(config.healthUrl, config.url),
        { signal },
        config,
      );
      return response.ok
        ? { supported: true, local: true, streaming: false, maxBytes: this.maxBytes }
        : {
            supported: false,
            local: true,
            streaming: false,
            reason: 'Whisper HTTP health check failed (' + response.status + ').',
          };
    } catch (error) {
      return {
        supported: false,
        local: true,
        streaming: false,
        reason: 'Whisper HTTP server is unreachable: ' + (error?.message || error),
      };
    }
  }
  async transcribe(input, { lang = 'auto', context = '', signal } = {}) {
    const bytes = validateMonoPcm16Wav(input, { maxBytes: this.maxBytes }),
      form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'utterance.wav');
    form.append('response_format', 'json');
    form.append('language', lang.startsWith('pt') ? 'pt' : lang.startsWith('en') ? 'en' : 'auto');
    const prompt = transcriptionContext(context);
    if (prompt) form.append('prompt', prompt);
    const config = await this.getConfig();
    return this.request(
      new URL(config.url),
      { method: 'POST', body: form, signal },
      config,
      async (response) => {
        if (!response.ok)
          throw new Error('Whisper HTTP transcription failed (' + response.status + ').');
        const json = await response.json();
        return { text: clean(json?.text) };
      },
    );
  }
}
