/** Fixed loopback bridge; callers cannot choose URLs, filesystem paths or arbitrary models. */
export class ChatterboxHttpHost {
  private controllers = new Set<AbortController>();
  private closed = false;
  constructor(private fetchImpl: typeof fetch = globalThis.fetch) {}
  private readonly base = 'http://127.0.0.1:7865';

  private async json(path: string, init: RequestInit = {}) {
    const response = await this.fetchImpl(this.base + path, { ...init, redirect: 'error' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Chatterbox service request failed.');
    return data;
  }
  async voices(signal?: AbortSignal) {
    const data = await this.json('/v1/voices', {
      signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(5000)]),
    });
    if (!Array.isArray(data.voices) || data.voices.length > 1000)
      throw new Error('Invalid Chatterbox voice catalog.');
    return data.voices
      .filter(
        (v: any) =>
          v !== null &&
          typeof v === 'object' &&
          typeof v.id === 'string' &&
          /^[a-f0-9]{24}$/.test(v.id) &&
          typeof v.name === 'string' &&
          v.name.length <= 200,
      )
      .map((v: any) => ({ id: v.id, name: v.name }));
  }
  async capability(signal?: AbortSignal) {
    const data = await this.json('/v1/health', {
      signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(5000)]),
    });
    return {
      supported: data.phase !== 'error',
      local: true,
      location: 'host',
      pause: true,
      resume: true,
      reason: data.phase === 'error' ? 'Chatterbox could not load the local model.' : undefined,
    };
  }
  async synthesize(
    text: unknown,
    { voice, lang, signal }: { voice?: unknown; lang?: unknown; signal?: AbortSignal } = {},
  ) {
    if (typeof text !== 'string' || !text.trim() || text.length > 12000 || text.includes('\0'))
      throw new Error('Speech text must contain 1–12000 characters without NUL.');
    if (
      voice !== undefined &&
      voice !== '' &&
      (typeof voice !== 'string' || !/^[a-f0-9]{24}$/.test(voice))
    )
      throw new Error('Select a Chatterbox voice from the current catalog.');
    if (lang !== undefined && (typeof lang !== 'string' || !/^pt(?:-BR)?$/i.test(lang)))
      throw new Error('This Chatterbox fine-tune supports Portuguese; choose pt-BR.');
    if (this.closed) throw new Error('Chatterbox bridge is closed.');
    const controller = new AbortController();
    this.controllers.add(controller);
    const combined = AbortSignal.any([
      controller.signal,
      signal || new AbortController().signal,
      AbortSignal.timeout(300000),
    ]);
    let id: string | undefined;
    try {
      combined.throwIfAborted();
      // Obtain a job id without client-disconnect cancellation; if the caller aborts meanwhile,
      // the id is still known and can be cancelled rather than leaving an orphaned queued job.
      const job = await this.json('/v1/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-chatterbox-client': 'dsh' },
        body: JSON.stringify({ text, voice: voice || undefined }),
        signal: AbortSignal.timeout(10000),
      });
      if (!/^[a-f0-9]{32}$/.test(job.id)) throw new Error('Invalid Chatterbox job id.');
      id = job.id;
      for (;;) {
        combined.throwIfAborted();
        const result = await this.json('/v1/jobs/' + id, { signal: combined });
        if (result.phase === 'done') break;
        if (['error', 'cancelled'].includes(result.phase))
          throw new Error(result.message || 'Chatterbox synthesis failed.');
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(combined.reason);
          };
          const timer = setTimeout(() => {
            combined.removeEventListener('abort', abort);
            resolve();
          }, 150);
          combined.addEventListener('abort', abort, { once: true });
          if (combined.aborted) abort();
        });
      }
      const response = await this.fetchImpl(this.base + '/v1/audio/' + id, {
        signal: combined,
        redirect: 'error',
      });
      if (!response.ok || response.headers.get('content-type') !== 'audio/wav')
        throw new Error('Invalid Chatterbox audio response.');
      const data = new Uint8Array(await response.arrayBuffer());
      if (
        data.byteLength > 64 * 1024 * 1024 ||
        new TextDecoder().decode(data.subarray(0, 4)) !== 'RIFF'
      )
        throw new Error('Invalid Chatterbox WAV.');
      return data;
    } finally {
      this.controllers.delete(controller);
      if (id) {
        try {
          await this.fetchImpl(this.base + '/v1/jobs/' + id, {
            method: 'DELETE',
            headers: { 'x-chatterbox-client': 'dsh' },
            signal: AbortSignal.timeout(3000),
            redirect: 'error',
          });
        } catch {}
      }
    }
  }
  dispose() {
    this.closed = true;
    for (const controller of this.controllers) controller.abort();
  }
}
