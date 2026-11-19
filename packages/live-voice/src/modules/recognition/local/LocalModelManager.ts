import { reportVoiceError } from '../../core/diagnosticsErrors.js';
import { browserAsrModels, findBrowserAsrModel, type BrowserAsrDevice } from './modelCatalog.js';
import {
  BrowserAsrError,
  cachedModelBytes,
  downloadBrowserModel,
  modelDownloaded,
  removeBrowserModel,
} from './modelCache.js';
import { browserAsrAssetBase } from './assets.js';
import { browserAsrRuntimeId, browserAsrVersions } from './runtimeIdentity.js';
import { RuntimeDiagnostics } from './RuntimeDiagnostics.js';
export type LocalModelState = {
  phase: 'absent' | 'checking' | 'downloading' | 'loading' | 'ready' | 'downloaded' | 'error';
  loaded: number;
  total: number;
  file?: string;
  error?: string;
  device?: BrowserAsrDevice;
  cached?: boolean;
};
export type LocalModelSnapshot = {
  models: Record<string, LocalModelState>;
  gpu: 'checking' | 'available' | 'unavailable';
  storage: boolean;
  shaderF16?: boolean;
  availableBytes?: number;
  busy: boolean;
};
/** Browser-profile lifetime. Discovery never downloads a model or initializes inference. */
export class LocalModelManager {
  private state: LocalModelSnapshot = {
    models: Object.fromEntries(
      browserAsrModels.map((m) => [m.key, { phase: 'checking', loaded: 0, total: m.bytes }]),
    ),
    gpu: 'checking',
    storage: typeof caches !== 'undefined',
    busy: false,
  };
  private telemetry = new RuntimeDiagnostics();
  /** Passive projection: never probes adapters, reads weights, loads a worker or exposes content. */
  readDiagnostics = () => {
    const snapshot = this.telemetry.read();
    const memory = this.globals.performance?.memory;
    const used = memory?.usedJSHeapSize;
    return {
      runtimeId: browserAsrRuntimeId,
      versions: { ...browserAsrVersions },
      gpu: this.state.gpu,
      shaderF16: this.state.shaderF16 ?? null,
      storageAvailableBytes: this.state.availableBytes ?? null,
      pageJsHeapBytes: typeof used === 'number' && Number.isFinite(used) && used >= 0 ? used : null,
      modelRamBytes: null,
      modelVramBytes: null,
      models: browserAsrModels
        .filter((model) => snapshot.models[model.key]?.loadAttempted)
        .map((model) => {
          const state = this.state.models[model.key];
          const metrics = snapshot.models[model.key];
          return {
            key: model.key,
            name: model.name,
            repository: model.repository,
            revision: model.revision,
            family: model.family,
            encoderDtype: 'encoderDtype' in model ? model.encoderDtype : 'fp32',
            decoderDtype: 'decoderDtype' in model ? model.decoderDtype : 'q4',
            modelBytes: model.bytes,
            cachedBytes: state.loaded,
            cached: !!state.cached,
            phase: state.phase,
            device: state.device ?? null,
            workerActive: this.workers.has(model.key),
            leases: this.leases.get(model.key) ?? 0,
            pendingRequests: this.workers.get(model.key)?.pending.size ?? 0,
            ...metrics,
          };
        }),
      events: snapshot.events,
    };
  };
  private listeners = new Set<() => void>();
  private workers = new Map<
    string,
    {
      worker: Worker;
      pending: Map<number, { resolve(value: any): void; reject(error: Error): void }>;
    }
  >();
  private downloads = new Map<string, AbortController>();
  private ids = 0;
  private disposed = false;
  private leases = new Map<string, number>();
  private tail = Promise.resolve();
  private generation = 0;
  constructor(private globals: any = globalThis) {
    this.state = { ...this.state, storage: !!globals.caches };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish() {
    if (this.disposed) return;
    this.state = { ...this.state, models: { ...this.state.models }, busy: this.leases.size > 0 };
    for (const fn of this.listeners) fn();
  }
  private patch(key: string, next: Partial<LocalModelState>) {
    this.state.models[key] = { ...this.state.models[key], ...next };
    this.publish();
  }
  async refresh() {
    const revision = ++this.generation;
    let gpu = false,
      shaderF16 = false;
    try {
      const adapter = await this.globals.navigator?.gpu?.requestAdapter();
      gpu = !!adapter;
      shaderF16 = !!adapter?.features?.has('shader-f16');
    } catch {}
    let estimate;
    try {
      estimate = await this.globals.navigator?.storage?.estimate?.();
    } catch {}
    if (this.disposed || revision !== this.generation) return;
    this.state = {
      ...this.state,
      gpu: gpu ? 'available' : 'unavailable',
      shaderF16,
      storage: !!this.globals.caches,
      availableBytes:
        estimate?.quota !== undefined
          ? Math.max(0, estimate.quota - (estimate.usage ?? 0))
          : undefined,
    };
    for (const model of browserAsrModels) {
      if (this.downloads.has(model.key) || this.workers.has(model.key)) continue;
      const previous = this.state.models[model.key];
      try {
        const loaded = await cachedModelBytes(model.key, this.globals.caches);
        const installed = loaded === model.bytes;
        if (this.disposed || revision !== this.generation) return;
        if (
          this.state.models[model.key] === previous &&
          !this.downloads.has(model.key) &&
          !this.workers.has(model.key)
        )
          this.patch(model.key, {
            phase: installed ? 'downloaded' : 'absent',
            cached: installed,
            loaded,
            error: undefined,
          });
      } catch {
        if (this.disposed || revision !== this.generation) return;
        if (this.state.models[model.key] === previous) {
          this.state = { ...this.state, storage: false };
          this.patch(model.key, { phase: 'error', error: 'storage-unavailable' });
        }
      }
    }
    this.publish();
  }
  async download(key: string) {
    ++this.generation;
    const model = findBrowserAsrModel(key);
    if (!model || this.disposed) throw new BrowserAsrError('invalid-model');
    if (this.downloads.has(key)) return;
    if (!this.state.storage) {
      this.patch(key, { phase: 'error', error: 'storage-unavailable' });
      return;
    }
    const remaining = model.bytes - (await cachedModelBytes(key, this.globals.caches));
    if (this.disposed) return;
    if (this.state.availableBytes !== undefined && this.state.availableBytes < remaining * 1.1) {
      this.patch(key, { phase: 'error', error: 'storage-full' });
      return;
    }
    if (this.downloads.has(key)) return;
    const abort = new AbortController();
    this.downloads.set(key, abort);
    this.patch(key, { phase: 'downloading', loaded: 0, cached: false, error: undefined });
    try {
      await downloadBrowserModel(key, {
        signal: abort.signal,
        storage: this.globals.caches,
        fetch: this.globals.fetch?.bind(this.globals),
        progress: (value) => this.patch(key, value),
      });
      this.patch(key, { phase: 'downloaded', loaded: model.bytes, cached: true });
    } catch (error) {
      if (!abort.signal.aborted) reportVoiceError('browser-local.download', error, { source: 'browser-local', stage: 'download' });
      this.patch(key, {
        phase: abort.signal.aborted ? 'absent' : 'error',
        error: abort.signal.aborted
          ? undefined
          : (error as any)?.name === 'QuotaExceededError'
            ? 'storage-full'
            : typeof (error as any)?.code === 'string'
              ? (error as any).code
              : 'download-failed',
      });
    } finally {
      this.downloads.delete(key);
      this.publish();
    }
  }
  cancel(key: string) {
    this.downloads.get(key)?.abort();
    if (this.state.models[key]?.phase === 'loading') {
      this.retire(key);
      this.patch(key, { phase: 'downloaded', error: undefined });
    }
  }
  async remove(key: string) {
    ++this.generation;
    if (
      this.leases.size > 0 ||
      this.downloads.has(key) ||
      this.state.models[key]?.phase === 'loading'
    )
      throw new BrowserAsrError('model-busy');
    this.retire(key);
    await removeBrowserModel(key, this.globals.caches);
    this.patch(key, { phase: 'absent', loaded: 0, cached: false, error: undefined });
  }
  private retire(key: string, code = 'cancelled') {
    const item = this.workers.get(key);
    if (!item) return;
    this.workers.delete(key);
    if (code !== 'cancelled') this.telemetry.get(key).error = this.telemetry.code({ code });
    if (this.state.models[key]?.phase === 'ready') this.patch(key, { phase: 'downloaded' });
    this.telemetry.event(key, 'worker', 'released', null, code === 'cancelled' ? null : code);
    item.worker.terminate();
    for (const pending of item.pending.values()) pending.reject(new BrowserAsrError(code));
    item.pending.clear();
  }
  private request(key: string, message: any, signal?: AbortSignal): Promise<any> {
    if (this.disposed || signal?.aborted) return Promise.reject(new BrowserAsrError('cancelled'));
    let item = this.workers.get(key);
    if (!item) {
      const worker = new this.globals.Worker(
        browserAsrAssetBase() + 'asr.worker.js?runtime=' + encodeURIComponent(browserAsrRuntimeId),
        {
          type: 'module',
        },
      );
      item = { worker, pending: new Map() };
      this.workers.set(key, item);
      worker.onmessage = ({ data }: any) => {
        if (this.workers.get(key) !== item) return;
        const pending = item!.pending.get(data.id);
        if (!pending) return;
        item!.pending.delete(data.id);
        if (data.runtimeId !== browserAsrRuntimeId) {
          pending.reject(new BrowserAsrError('runtime-outdated'));
          this.retire(key, 'runtime-outdated');
          return;
        }
        data.ok
          ? pending.resolve(data)
          : pending.reject(new BrowserAsrError(data.code || 'inference-failed'));
      };
      worker.onerror = () => {
        if (this.workers.get(key) !== item) return;
        this.retire(key, 'runtime-unavailable');
        this.patch(key, { phase: 'error', error: 'runtime-unavailable' });
      };
    }
    const current = item,
      id = ++this.ids;
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.retire(key);
        this.patch(key, { phase: 'downloaded' });
      };
      const complete = (fn: any) => (value: any) => {
        signal?.removeEventListener('abort', abort);
        fn(value);
      };
      current.pending.set(id, { resolve: complete(resolve), reject: complete(reject) });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }
      try {
        current.worker.postMessage({ id, ...message }, message.pcm ? [message.pcm.buffer] : []);
      } catch {
        current.pending.delete(id);
        signal?.removeEventListener('abort', abort);
        this.retire(key, 'runtime-unavailable');
        reject(new BrowserAsrError('runtime-unavailable'));
      }
    });
  }
  async prepare(key: string, device: BrowserAsrDevice, signal?: AbortSignal) {
    ++this.generation;
    const model = findBrowserAsrModel(key);
    if (this.disposed || signal?.aborted) throw new BrowserAsrError('cancelled');
    if (!model || !model.devices.some((item) => item === device))
      throw new BrowserAsrError('gpu-unavailable');
    if (device === 'webgpu' && this.state.gpu !== 'available')
      throw new BrowserAsrError('gpu-unavailable');
    if ('requiresF16' in model && model.requiresF16 && !this.state.shaderF16)
      throw new BrowserAsrError('f16-unavailable');
    if (!(await modelDownloaded(key, this.globals.caches)))
      throw new BrowserAsrError('model-missing');
    if (this.disposed || signal?.aborted) throw new BrowserAsrError('cancelled');
    if (this.state.models[key].phase === 'ready' && this.state.models[key].device === device)
      return;
    if ([...this.leases.keys()].some((active) => active !== key))
      throw new BrowserAsrError('model-busy');
    for (const active of [...this.workers.keys()])
      if (active !== key) {
        this.retire(active);
        this.patch(active, { phase: 'downloaded' });
      }
    const metrics = this.telemetry.get(key);
    metrics.loadAttempted = true;
    metrics.error = null;
    metrics.loadMs = null;
    metrics.workerLoadMs = null;
    const started = this.telemetry.clock();
    this.telemetry.event(key, 'load', 'started');
    this.patch(key, { phase: 'loading', device, cached: true, error: undefined });
    try {
      const result = await this.request(key, { type: 'load', key, device }, signal);
      metrics.loadMs = this.telemetry.clock() - started;
      metrics.workerLoadMs = this.telemetry.duration(result.elapsedMs);
      this.telemetry.event(key, 'load', 'success', metrics.loadMs);
      this.patch(key, { phase: 'ready', device });
    } catch (error) {
      if (!signal?.aborted && (error as any)?.code !== 'cancelled')
        reportVoiceError('browser-local.load', error, { source: 'browser-local', stage: 'load' });
      metrics.error = this.telemetry.code(error);
      metrics.loadMs = this.telemetry.clock() - started;
      this.telemetry.event(
        key,
        'load',
        metrics.error === 'cancelled' ? 'cancelled' : 'error',
        metrics.loadMs,
        metrics.error,
      );
      this.retire(key);
      if (!this.disposed)
        this.patch(key, {
          phase: (error as any).code === 'cancelled' ? 'downloaded' : 'error',
          error:
            (error as any).code === 'cancelled'
              ? undefined
              : ((error as any).code ?? 'inference-failed'),
        });
      throw error;
    }
  }
  acquire(key: string) {
    this.leases.set(key, (this.leases.get(key) ?? 0) + 1);
    this.publish();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.leases.get(key) ?? 1) - 1;
      count ? this.leases.set(key, count) : this.leases.delete(key);
      this.publish();
    };
  }
  transcribe(
    key: string,
    pcm: Float32Array,
    language: string,
    signal?: AbortSignal,
  ): Promise<string> {
    // One bounded inference at a time across independent microphone and meeting capture.
    const metrics = this.telemetry.get(key),
      bytes = pcm.byteLength,
      audioMs = pcm.length / 16;
    metrics.queued++;
    metrics.pcmBytes += bytes;
    this.publish();
    const work = this.tail.then(async () => {
      metrics.queued--;
      metrics.active++;
      metrics.audioMs = audioMs;
      metrics.error = null;
      metrics.workerInferenceMs = null;
      metrics.lastMs = null;
      this.publish();
      const started = this.telemetry.clock();
      this.telemetry.event(key, 'transcribe', 'started');
      try {
        if (signal?.aborted) throw new BrowserAsrError('cancelled');
        if (this.state.models[key]?.phase !== 'ready')
          await this.prepare(key, this.state.models[key]?.device ?? 'webgpu', signal);
        const result = await this.request(key, { type: 'transcribe', pcm, language }, signal);
        metrics.lastMs = this.telemetry.clock() - started;
        metrics.workerInferenceMs = this.telemetry.duration(result.elapsedMs);
        metrics.completed++;
        this.telemetry.event(key, 'transcribe', 'success', metrics.lastMs);
        return result.text as string;
      } catch (error) {
        if (!signal?.aborted && (error as any)?.code !== 'cancelled')
          reportVoiceError('browser-local.transcribe', error, { source: 'browser-local', stage: 'transcription' });
        metrics.failed++;
        metrics.error = this.telemetry.code(error);
        this.telemetry.event(
          key,
          'transcribe',
          metrics.error === 'cancelled' ? 'cancelled' : 'error',
          this.telemetry.clock() - started,
          metrics.error,
        );
        throw error;
      } finally {
        metrics.active--;
        metrics.pcmBytes -= bytes;
        this.publish();
      }
    });
    this.tail = work.then(
      () => {},
      () => {},
    );
    return work;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    for (const abort of this.downloads.values()) abort.abort();
    for (const key of this.workers.keys()) this.retire(key);
    this.listeners.clear();
  }
}
