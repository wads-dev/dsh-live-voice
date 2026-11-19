import { reportVoiceError } from '../core/diagnosticsErrors.js';
import { MAX_RECOVERY_ATTEMPTS, recoveryDelayMs, isRetryableVoiceError } from '../core/recovery.js';
import type { RecordingRepository, RecordingWriter, RecordingSession, RecordingPin, RecordingAttempt } from './types.js';

/** Low-frequency probes after the initial bounded retry burst. */
export const ARCHIVE_RETRY_PROBE_MS = 30_000;
const ARCHIVE_QUEUE_MAX_ITEMS = 512;

type Work =
  | { kind: 'audio'; start: number; data: Float32Array }
  | { kind: 'pin'; pin: RecordingPin }
  | { kind: 'attempt'; attempt: RecordingAttempt }
  | { kind: 'event'; event: import('./types.js').RecordingEventKind; details?: import('./types.js').RecordingEventDetails }
  | { kind: 'read'; start: number; end: number; expired: boolean; resolve: (pcm: Float32Array) => void; reject: (error: unknown) => void };

/** Archive I/O is a separate, single-owner queue: it never gates capture or STT. */
export async function beginResilientWriter(
  repository: RecordingRepository,
  input: Parameters<RecordingRepository['begin']>[0],
  signal: AbortSignal | undefined,
  valid: () => boolean,
  warning: () => void,
): Promise<RecordingWriter> {
  if (!valid() || signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
  const session: RecordingSession = {
    id: crypto.randomUUID(), sourceId: input.sourceId, kind: input.kind, label: input.label,
    participant: input.participant, sampleRate: input.sampleRate, startedAt: new Date(Date.now()).toISOString(),
    state: 'recording', capturedSamples: 0, savedSamples: 0, persistent: false,
    codec: 'unavailable', pins: [], attempts: [],
  };
  const chunks: { start: number; data: Float32Array }[] = [];
  const maxSamples = input.sampleRate * (Math.max(60, input.configuration?.maxUtteranceSeconds ?? 60) + 16);
  const queueLimit = input.sampleRate * 8;
  const queue: Work[] = [];
  const pinIds = new Map<string, string>();
  let queueSamples = 0;
  let archive: RecordingWriter | null = null;
  let archiveAttempted = false;
  let worker: Promise<void> | null = null;
  let sealed = false;
  let finalState: 'completed' | 'interrupted' | 'failed' = 'completed';
  let finalError: string | undefined;
  let warned = false;
  let stopped = false;
  let hadGap = false;
  let retries = 0;
  let cancelBeginWait: (() => void) | undefined;
  let finalized = false;
  let archiveId: string | undefined;
  let cursor = 0;
  let reconcile = false;
  const alive = () => !sealed && valid() && !signal?.aborted;
  const warn = (stage: string, error: unknown, attempt = 0) => {
    reportVoiceError('recording.storage', error, { source: input.kind, recordingId: archive?.session.id, stage, attempt });
    if (!warned && valid() && !signal?.aborted) { warned = true; warning(); }
  };
  // A deadline is only a notification. We continue awaiting the *same* operation;
  // no replacement is started while its result or side effects remain uncertain.
  const observed = async <T>(stage: string, action: () => Promise<T>): Promise<T> => {
    const timer = setTimeout(() => warn(stage, Object.assign(new Error('Storage operation is pending.'), { name: 'TimeoutError' })), 1000);
    try { return await action(); } finally { clearTimeout(timer); }
  };
  const delay = async (attempt: number) => {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, recoveryDelayMs(attempt));
      function done() { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); }
      signal?.addEventListener('abort', done, { once: true });
      if (signal?.aborted || sealed) done();
    });
  };
  const waitForBeginRetry = async (ms: number) => {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', done);
        cancelBeginWait = undefined;
        resolve();
      };
      const timer = setTimeout(done, ms);
      cancelBeginWait = done;
      signal?.addEventListener('abort', done, { once: true });
      if (!alive()) done();
    });
  };
  const enqueue = (work: Work) => {
    if (stopped || (sealed && work.kind !== 'event' && work.kind !== 'attempt' && work.kind !== 'read')) {
      if (work.kind === 'read') work.reject(new Error('Archive unavailable.'));
      return;
    }
    if (work.kind === 'audio') {
      if (work.data.length > queueLimit) {
        const dropped = work.data.length - queueLimit;
        work = { kind: 'audio', start: work.start + dropped, data: work.data.slice(dropped) };
        warn('backpressure', Object.assign(new Error('Archive backlog exceeded its limit.'), { name: 'StorageBackpressure' }));
      }
      if (queue.length >= ARCHIVE_QUEUE_MAX_ITEMS) {
        const index = queue.findIndex((item) => item.kind === 'audio');
        if (index < 0) {
          warn('backpressure', new Error('Archive queue exceeded its item limit.'));
          return;
        }
        const dropped = queue.splice(index, 1)[0] as Extract<Work, { kind: 'audio' }>;
        queueSamples -= dropped.data.length;
        warn('backpressure', new Error('Archive queue exceeded its item limit.'));
      }
      queueSamples += work.data.length;
      queue.push(work);
      while (queueSamples > queueLimit) {
        const index = queue.findIndex((item) => item.kind === 'audio');
        if (index < 0) break;
        const dropped = queue.splice(index, 1)[0] as Extract<Work, { kind: 'audio' }>;
        queueSamples -= dropped.data.length;
        warn('backpressure', Object.assign(new Error('Archive backlog exceeded its limit.'), { name: 'StorageBackpressure' }));
      }
    } else {
      // Metadata is also bounded when storage is stuck. Audio gaps and a warning remain explicit.
      if (queue.length >= ARCHIVE_QUEUE_MAX_ITEMS) {
        if (work.kind === 'read') work.reject(new Error('Archive backlog exceeded its limit.'));
        warn('metadata', new Error('Archive metadata backlog exceeded its limit.')); return;
      }
      queue.push(work);
    }
    kick();
  };
  async function run() {
    while (!archive && (alive() || (!archiveAttempted && !signal?.aborted))) {
      archiveAttempted = true;
      try {
        archive = await observed('begin', () => repository.begin({ ...input, startedAt: session.startedAt }));
        archiveId = archive.session.id;
        session.id = archiveId;
        // The captured sample clock is immutable even if an external
        // repository ignores the requested timestamp. Its archive timestamps
        // will be inconsistent; surface the mismatch rather than rewriting STT.
        if (Date.parse(archive.session.startedAt) !== Date.parse(session.startedAt)) {
          warn('start-clock', new Error('Archive did not preserve the capture start time.'));
        }
        session.persistent = archive.session.persistent;
        session.codec = archive.session.codec;
        session.storage = archive.session.storage;
        cursor = archive.session.archiveEndSample ?? archive.session.savedSamples;
        break;
      } catch (error) {
        warn('begin', error, retries);
        const code = (error as { code?: string })?.code;
        const transient = code === 'storage-failed' || code === 'quota-exceeded' || code === 'memory-limit' || isRetryableVoiceError(error);
        if (!transient || !alive()) { stopped = true; break; }
        retries = Math.min(retries + 1, MAX_RECOVERY_ATTEMPTS + 1);
        await waitForBeginRetry(retries <= MAX_RECOVERY_ATTEMPTS ? recoveryDelayMs(retries) : ARCHIVE_RETRY_PROBE_MS);
      }
    }
    if (!archive) { stopped = true; queue.length = 0; queueSamples = 0; return; }
    let failures = 0;
    if (!archiveId) archiveId = archive.session.id;
    while (queue.length && !stopped) {
      const work = queue.shift()!;
      if (work.kind === 'audio') queueSamples -= work.data.length;
      try {
        if (work.kind === 'audio') {
          if (reconcile || work.start > cursor) {
            if (!archive.markArchiveGap) throw Object.assign(new Error('Sparse archive recovery unavailable.'), { retryable: false });
            await observed('gap', () => archive!.markArchiveGap!(cursor, work.start));
            hadGap = true;
            cursor = archive.session.archiveEndSample ?? work.start;
            reconcile = false;
            if (cursor !== work.start)
              throw Object.assign(new Error('Archive gap exceeded the next audio boundary.'), { retryable: false });
          }
          await observed('append', () => archive!.append(work.data));
          cursor = work.start + work.data.length;
          session.savedSamples = archive.session.savedSamples;
        } else if (work.kind === 'pin') {
          const target = Math.max(cursor, work.pin.confirmedAtSample);
          if (reconcile || target > cursor) {
            if (!archive.markArchiveGap) throw Object.assign(new Error('Sparse archive recovery unavailable.'), { retryable: false });
            await observed('gap', () => archive!.markArchiveGap!(cursor, target));
            cursor = archive.session.archiveEndSample ?? target;
            reconcile = false;
            hadGap = true;
          }
          const p = await observed('pin', () => archive!.pin(work.pin.kind, work.pin.atSample, work.pin.confirmedAtSample));
          pinIds.set(work.pin.id, p.id);
        } else if (work.kind === 'attempt') {
          const mapped = pinIds.get(work.attempt.segmentId);
          if (mapped) await observed('attempt', () => archive!.attempt({ ...work.attempt, segmentId: mapped }));
        } else if (work.kind === 'read') {
          // Retry only after an operation has settled: a timed-out or cancelled
          // caller must never cause a concurrent duplicate archive read.
          for (let attempt = 0; !work.expired; attempt++) {
            try {
              const pcm = await observed('read', () => archive!.read(work.start, work.end));
              if (!work.expired) work.resolve(pcm);
              break;
            } catch (error) {
              const failure = error as { code?: string; archiveWriteFailure?: boolean };
              const code = failure?.code;
              if (failure?.archiveWriteFailure) {
                // A failed read-side flush poisoned the writer and its partial
                // page is ambiguous. Do not retry or fabricate the lost tail.
                warn('read-flush', error, attempt);
                cursor = archive.session.archiveEndSample ?? archive.session.savedSamples;
                reconcile = true;
                if (!work.expired) work.reject(error);
                break;
              }
              if (work.expired) break;
              if (attempt >= MAX_RECOVERY_ATTEMPTS || code === 'archive-gap' || code === 'invalid-range' || code === 'not-found' || code === 'disposed') {
                work.reject(error);
                break;
              }
              await delay(attempt + 1);
            }
          }
        } else {
          const details = work.details ? { ...work.details } : undefined;
          if (details?.segmentId) {
            const mapped = pinIds.get(details.segmentId);
            if (!mapped) continue;
            details.segmentId = mapped;
          }
          await observed('event', () => repository.timeline(archive!.session.id)(work.event, details));
        }
        failures = 0;
      } catch (error) {
        warn(work.kind, error, failures);
        // An append can fail after committing a prefix. Reconcile from committed
        // archiveEndSample, and never replay the uncertain buffer as new audio.
        if (work.kind === 'audio') {
          cursor = archive.session.archiveEndSample ?? archive.session.savedSamples;
          reconcile = true;
        }
        if ((error as { retryable?: boolean })?.retryable === false || ++failures > MAX_RECOVERY_ATTEMPTS) { stopped = true; break; }
        await delay(failures);
      }
    }
    if ((sealed && !finalized) || stopped) {
      const end = session.capturedSamples;
      let gapFailed = false;
      try {
        if (reconcile || cursor < end) {
          if (!archive.markArchiveGap) throw new Error('Sparse archive recovery unavailable.');
          await observed('gap', () => archive!.markArchiveGap!(cursor, end));
          hadGap = true;
        }
      } catch (error) {
        gapFailed = true;
        warn('gap', error);
      }
      // Even if gap metadata cannot be saved, release the writer's lock. Never
      // race a still-pending gap with finish: this runs only after rejection.
      try {
        const incomplete = stopped || hadGap || gapFailed;
        await observed('finish', () => archive!.finish(incomplete ? 'failed' : finalState, incomplete ? 'archive-incomplete' : finalError));
      } catch (error) { warn('finish', error); }
      finalized = true;
      if (stopped) {
        for (const item of queue) if (item.kind === 'read') item.reject(new Error('Archive unavailable.'));
        queue.length = 0;
        queueSamples = 0;
      }
    }
  }
  function kick() {
    if (worker || stopped) return;
    worker = run().catch((error) => { stopped = true; warn('worker', error); }).finally(() => {
      worker = null;
      if (!stopped && (queue.length || (sealed && archive && !finalized))) kick();
    });
  }
  signal?.addEventListener('abort', () => { if (!sealed) void writer.finish('interrupted'); }, { once: true });
  const snapshot = (start: number, end: number): Float32Array | null => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) return null;
    if (start < end && (!chunks.length || chunks[0].start > start || session.capturedSamples < end)) return null;
    const out = new Float32Array(end - start);
    let covered = start;
    for (const chunk of chunks) {
      const from = Math.max(start, chunk.start), to = Math.min(end, chunk.start + chunk.data.length);
      if (to <= from) continue;
      if (from > covered) return null;
      out.set(chunk.data.subarray(from - chunk.start, to - chunk.start), from - start);
      covered = Math.max(covered, to);
      if (covered >= end) return out;
    }
    return covered >= end ? out : null;
  };
  const writer: RecordingWriter & {
    timeline: (kind: import('./types.js').RecordingEventKind, details?: import('./types.js').RecordingEventDetails) => Promise<void>;
    snapshot: typeof snapshot;
  } = {
    snapshot,
    async timeline(event, details) { enqueue({ kind: 'event', event, details }); },
    get session() { return structuredClone(session); },
    async append(pcm) {
      if (sealed) return;
      const start = session.capturedSamples;
      session.capturedSamples += pcm.length;
      const kept = pcm.length > maxSamples ? pcm.subarray(pcm.length - maxSamples) : pcm;
      chunks.push({ start: start + pcm.length - kept.length, data: kept.slice() });
      const earliest = session.capturedSamples - maxSamples;
      while (chunks.length && chunks[0].start + chunks[0].data.length <= earliest) chunks.shift();
      if (chunks.length && chunks[0].start < earliest) {
        const first = chunks[0];
        chunks[0] = { start: earliest, data: first.data.slice(earliest - first.start) };
      }
      enqueue({ kind: 'audio', start, data: pcm.slice() });
    },
    async pin(kind, atSample, confirmedAtSample) {
      const pin: RecordingPin = { id: crypto.randomUUID(), kind, atSample, confirmedAtSample, delaySamples: confirmedAtSample - atSample };
      session.pins.push(pin);
      enqueue({ kind: 'pin', pin });
      return pin;
    },
    async attempt(value) { enqueue({ kind: 'attempt', attempt: structuredClone(value) }); },
    async read(start, end, readSignal) {
      const cancelled = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });
      if (readSignal?.aborted) throw cancelled();
      const available = snapshot(start, end);
      if (available) return available;
      // Old backlogged speech may still be in a healthy archive. Serialize the
      // read behind its writes, but never make recognition wait indefinitely.
      return new Promise<Float32Array>((resolve, reject) => {
        const error = () => Object.assign(new Error('Live transcription audio is unavailable.'), { code: 'audio-gap', retryable: false });
        let settled = false;
        const cleanup = () => { clearTimeout(timer); readSignal?.removeEventListener('abort', abort); };
        const abort = () => {
          if (settled) return;
          settled = true;
          work.expired = true;
          cleanup();
          reject(cancelled());
        };
        const work: Extract<Work, { kind: 'read' }> = {
          kind: 'read', start, end, expired: false,
          resolve: (pcm) => { if (settled) return; settled = true; cleanup(); resolve(pcm); },
          reject: () => { if (settled) return; settled = true; cleanup(); reject(error()); },
        };
        const timer = setTimeout(() => { work.expired = true; work.reject(error()); }, 15000);
        readSignal?.addEventListener('abort', abort, { once: true });
        if (readSignal?.aborted) abort();
        else enqueue(work);
      });
    },
    async finish(state = 'completed', error) {
      if (sealed) return;
      sealed = true;
      cancelBeginWait?.();
      finalState = state;
      finalError = error;
      session.state = state;
      kick();
    },
  };
  kick();
  return writer;
}
