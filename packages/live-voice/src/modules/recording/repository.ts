import type {
  RecordingAttempt,
  RecordingEvent,
  RecordingPin,
  RecordingRepository,
  RecordingSession,
  RecordingParticipant,
  RecordingWriter,
  RecordingRequestMetadata,
} from './types.js';
import { recordingSegments } from './types.js';
import {
  assertCodec,
  audioPageBytes,
  decodePage,
  encodePage,
  RecordingRepositoryError,
  wavBlob,
} from './codec.js';
import type { AudioPage } from './codec.js';
import { createMemoryStore, openRecordingStore, storageError } from './storage.js';
import type { PageStore, StoredSession } from './storage.js';
export { RecordingRepositoryError } from './codec.js';

const lockName = (id: string) => 'dsh-live-voice.recording.' + id;
const localActive = new Set<string>();
let creationSequence = 0;
const cloneSession = (value: StoredSession): RecordingSession => {
  const { keepPrevious, createdOrder, ...session } = value;
  return structuredClone(session);
};
const now = () => new Date().toISOString();
function range(start: number, end: number, length: number): void {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    end > length
  )
    throw new RecordingRepositoryError(
      'invalid-range',
      'The requested sample range is outside the saved recording.',
    );
}
async function holdLock(id: string, name = lockName(id), wait = false): Promise<() => void> {
  if (!globalThis.navigator?.locks)
    throw new RecordingRepositoryError(
      'storage-unavailable',
      'Browser Web Locks are required to protect active persisted recordings.',
    );
  return new Promise((resolve, reject) => {
    navigator.locks
      .request(name, wait ? {} : { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(
            new RecordingRepositoryError(
              'active-recording',
              'The recording is active in another browser context.',
            ),
          );
          return;
        }
        await new Promise<void>((release) => resolve(release));
      })
      .catch(reject);
  });
}
function base64(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}

export interface RecordingTranscriber {
  engine: string;
  transcribe(
    pcm: Float32Array,
    rate: number,
    signal?: AbortSignal,
    onRequest?: (metadata: RecordingRequestMetadata) => Promise<void>,
  ): Promise<string>;
}
export function createRecordingRepository(
  openStore: () => Promise<PageStore> = openRecordingStore,
  getTranscriber?: () => RecordingTranscriber,
): RecordingRepository {
  const memory = createMemoryStore();
  let retryLifetime: AbortController | undefined;
  const retryJobs = new Set<Promise<void>>();
  const listeners = new Set<() => void>();
  const writers = new Map<
    string,
    {
      writer: RecordingWriter;
      idle: () => Promise<void>;
      setStarred(value: boolean): Promise<void>;
      setName(value: string): Promise<void>;
      event(value: RecordingEvent): Promise<void>;
    }
  >();
  let opening: Promise<PageStore> | undefined;
  let disposed = false;
  let disposing = false;
  let lifecycle: Promise<unknown> = Promise.resolve();
  const check = () => {
    if (disposed || disposing)
      throw new RecordingRepositoryError('disposed', 'The recording repository has been disposed.');
  };
  const emit = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* Observers cannot break a committed recording. */
      }
    }
  };
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = lifecycle.then(run);
    lifecycle = next.catch(() => {});
    return next;
  };
  async function persistentStore(): Promise<PageStore> {
    if (!opening)
      opening = (async () => {
        const store = await openStore();
        try {
          // One recovery pass per repository lifetime, never on each list/get.
          for (const session of await store.list()) {
            if (
              localActive.has(session.id) ||
              (session.state !== 'recording' &&
                !session.attempts.some((a) => a.status === 'pending'))
            )
              continue;
            if (!globalThis.navigator?.locks)
              throw new RecordingRepositoryError(
                'storage-unavailable',
                'Browser Web Locks are required for safe recording recovery.',
              );
            await navigator.locks.request(
              lockName(session.id),
              { ifAvailable: true },
              async (lock) => {
                if (!lock || localActive.has(session.id)) return;
                await store.update(session.id, (current) =>
                  current.state === 'recording' ||
                  current.attempts.some((a) => a.status === 'pending')
                    ? {
                        ...current,
                        ...(current.state === 'recording'
                          ? {
                              state: 'interrupted' as const,
                              endedAt: now(),
                              pins: current.pins.filter(
                                (pin) => pin.atSample <= current.savedSamples,
                              ),
                            }
                          : {}),
                        attempts: current.attempts.map((attempt) =>
                          attempt.status === 'pending'
                            ? {
                                ...attempt,
                                status: 'error' as const,
                                error: 'interrupted',
                                finishedAt: now(),
                              }
                            : attempt,
                        ),
                      }
                    : current,
                );
              },
            );
          }
          return store;
        } catch (error) {
          store.close();
          throw error;
        }
      })();
    return opening;
  }
  async function locate(id: string): Promise<{ store: PageStore; session: StoredSession }> {
    check();
    const ephemeral = await memory.get(id);
    if (ephemeral) return { store: memory, session: ephemeral };
    if (!globalThis.indexedDB)
      throw new RecordingRepositoryError('not-found', 'The recording no longer exists.');
    const store = await persistentStore();
    const session = await store.get(id);
    if (!session)
      throw new RecordingRepositoryError('not-found', 'The recording no longer exists.');
    return { store, session };
  }
  async function all(): Promise<StoredSession[]> {
    const disk = globalThis.indexedDB ? await (await persistentStore()).list() : [];
    return [...disk, ...(await memory.list())].sort(
      (a, b) =>
        b.startedAt.localeCompare(a.startedAt) ||
        (b.createdOrder ?? 0) - (a.createdOrder ?? 0) ||
        b.id.localeCompare(a.id),
    );
  }
  async function deleteInactive(store: PageStore, id: string, strict: boolean): Promise<void> {
    const activeError = () =>
      new RecordingRepositoryError('active-recording', 'An active recording cannot be removed.');
    if (localActive.has(id)) {
      if (strict) throw activeError();
      return;
    }
    if (store === memory) {
      const latest = await store.get(id);
      if (
        !strict &&
        (latest?.starred || latest?.attempts.some((attempt) => attempt.status === 'pending'))
      )
        return;
      await store.remove(id);
      return;
    }
    if (!globalThis.navigator?.locks)
      throw new RecordingRepositoryError(
        'storage-unavailable',
        'Browser Web Locks are required for safe recording removal.',
      );
    await navigator.locks.request(lockName(id), { ifAvailable: true }, async (lock) => {
      if (!lock || localActive.has(id)) {
        if (strict) throw activeError();
        return;
      }
      const latest = await store.get(id);
      if (
        !strict &&
        (latest?.starred ||
          latest?.state === 'recording' ||
          latest?.attempts.some((attempt) => attempt.status === 'pending'))
      )
        return;
      await store.remove(id);
    });
  }
  const groupName = (groupId: string) =>
    'dsh-live-voice.recording-group:' + JSON.stringify(['attendee', groupId]);
  async function deleteGroup(store: PageStore, groupId: string, members: StoredSession[]) {
    if (members.some((s) => localActive.has(s.id))) return;
    const releases: (() => void)[] = [];
    try {
      if (store !== memory) {
        releases.push(await holdLock(groupId, groupName(groupId)));
        for (const member of [...members].sort((a, b) => a.id.localeCompare(b.id)))
          releases.push(await holdLock(member.id));
      }
      await store.removeGroup(
        groupId,
        members.map((s) => s.id),
      );
    } catch (error) {
      if (!(error instanceof RecordingRepositoryError) || error.code !== 'active-recording')
        throw error;
      // A concurrent writer/protection operation owns a member: never remove siblings alone.
    } finally {
      for (const release of releases.reverse()) release();
    }
  }
  async function prune(
    kind: RecordingSession['kind'],
    keepPrevious: number,
    target?: PageStore,
    participantRetention = false,
  ): Promise<void> {
    const stores = target
      ? [target]
      : [memory, ...(globalThis.indexedDB ? [await persistentStore()] : [])];
    for (const store of participantRetention ? stores : []) {
      const groups = new Map<string, StoredSession[]>();
      for (const session of await store.list()) {
        if (session.participant?.provider !== 'attendee') continue;
        const id = session.participant.groupId;
        groups.set(id, [...(groups.get(id) ?? []), session]);
      }
      const ordinary = [...groups].filter(([, members]) =>
        members.every(
          (s) =>
            !s.starred &&
            s.state !== 'recording' &&
            !localActive.has(s.id) &&
            !s.attempts.some((a) => a.status === 'pending'),
        ),
      );
      const latest = (members: StoredSession[]) =>
        [...members].sort(
          (a, b) =>
            b.startedAt.localeCompare(a.startedAt) || (b.createdOrder ?? 0) - (a.createdOrder ?? 0),
        )[0];
      ordinary.sort(([aid, a], [bid, b]) => {
        const x = latest(a),
          y = latest(b);
        return (
          y.startedAt.localeCompare(x.startedAt) ||
          (y.createdOrder ?? 0) - (x.createdOrder ?? 0) ||
          bid.localeCompare(aid)
        );
      });
      for (const [id, members] of ordinary.slice(Math.max(1, keepPrevious)))
        await deleteGroup(store, id, members);
    }
    const available = target
      ? (await target.list()).sort(
          (a, b) =>
            b.startedAt.localeCompare(a.startedAt) ||
            (b.createdOrder ?? 0) - (a.createdOrder ?? 0) ||
            b.id.localeCompare(a.id),
        )
      : await all();
    const sessions = available.filter(
      (session) =>
        session.kind === kind &&
        session.participant?.provider !== 'attendee' &&
        !session.starred &&
        !session.attempts.some((attempt) => attempt.status === 'pending') &&
        session.state !== 'recording' &&
        !localActive.has(session.id),
    );
    const keep = Math.max(1, keepPrevious);
    // Retain exactly the newest N ordinary finished sessions per type.
    // Active, unsettled and starred sessions neither expire nor consume slots.
    const retained = new Set(sessions.slice(0, keep).map((session) => session.id));
    for (const session of sessions) {
      if (
        retained.has(session.id) ||
        session.attempts.some((attempt) => attempt.status === 'pending')
      )
        continue;
      const store = target ?? ((await memory.get(session.id)) ? memory : await persistentStore());
      await deleteInactive(store, session.id, false);
    }
  }
  async function readRange(
    store: PageStore,
    session: RecordingSession,
    start: number,
    end: number,
  ): Promise<Float32Array> {
    range(start, end, session.savedSamples);
    const result = new Float32Array(end - start);
    let position = start;
    while (position < end) {
      const page = await store.nextPage(session.id, position, end);
      if (!page || page.startSample > position)
        throw new RecordingRepositoryError(
          'storage-failed',
          'The recording contains a missing audio page.',
        );
      const data = await decodePage(page);
      const until = Math.min(end, page.startSample + page.sampleCount);
      result.set(
        data.subarray(position - page.startSample, until - page.startSample),
        position - start,
      );
      position = until;
    }
    return result;
  }
  async function settled(id: string): Promise<{ store: PageStore; session: StoredSession }> {
    const active = writers.get(id);
    if (active) {
      await active.idle();
      await active.writer.read(0, 0);
    }
    return locate(id);
  }
  const measured = new Map<string, { samples: number; bytes: number }>();
  async function withAudioBytes(session: RecordingSession) {
    if (session.audioBytes !== undefined) return session;
    let cached = measured.get(session.id);
    if (!cached || cached.samples !== session.savedSamples) {
      const { store } = await locate(session.id);
      cached = { samples: session.savedSamples, bytes: await store.audioBytes(session.id) };
      measured.set(session.id, cached);
    }
    return { ...session, audioBytes: cached.bytes };
  }
  const repository: RecordingRepository = {
    version: 1,
    segments: recordingSegments,
    subscribe(listener) {
      check();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async list() {
      check();
      const sessions = await all();
      const ids = new Set(sessions.map((session) => session.id));
      for (const id of measured.keys()) if (!ids.has(id)) measured.delete(id);
      return Promise.all(
        sessions.map((session) =>
          withAudioBytes(writers.get(session.id)?.writer.session ?? cloneSession(session)),
        ),
      );
    },
    async get(id) {
      check();
      try {
        return await withAudioBytes(
          writers.get(id)?.writer.session ?? cloneSession((await locate(id)).session),
        );
      } catch (error) {
        if (error instanceof RecordingRepositoryError && error.code === 'not-found') return null;
        throw error;
      }
    },
    async audio(id, startSample = 0, endSample) {
      const { store, session } = await settled(id);
      const end = endSample ?? session.savedSamples;
      range(startSample, end, session.savedSamples);
      const count = end - startSample;
      if (count * 2 > 0xffffffff - 36)
        throw new RecordingRepositoryError(
          'invalid-range',
          'The requested audio exceeds the WAV size limit. Export the session archive instead.',
        );
      const header = await wavBlob(new Float32Array(0), session.sampleRate).arrayBuffer();
      const view = new DataView(header);
      view.setUint32(4, 36 + count * 2, true);
      view.setUint32(40, count * 2, true);
      const parts: BlobPart[] = [header];
      for (let position = startSample; position < end; position += session.sampleRate * 10) {
        const pcm = await readRange(
          store,
          session,
          position,
          Math.min(end, position + session.sampleRate * 10),
        );
        const encoded = await wavBlob(pcm, session.sampleRate).arrayBuffer();
        parts.push(encoded.slice(44));
      }
      return new Blob(parts, { type: 'audio/wav' });
    },
    ...(getTranscriber
      ? {
          retranscribe(id: string, segmentId: string, requestedSignal?: AbortSignal) {
            retryLifetime ??= new AbortController();
            const signal = requestedSignal
              ? AbortSignal.any([requestedSignal, retryLifetime.signal])
              : retryLifetime.signal;
            const task = (async () => {
              check();
              signal?.throwIfAborted();
              const transcriber = getTranscriber();
              // Hold the recording lock across inference. Retention/removal cannot delete its audit.
              const { store, session } = await locate(id);
              if (localActive.has(id) || session.state === 'recording')
                throw new RecordingRepositoryError(
                  'active-recording',
                  'Finish capture before retranscribing.',
                );
              const release = store === memory ? () => {} : await holdLock(id);
              if (localActive.has(id)) {
                release();
                throw new RecordingRepositoryError('active-recording', 'The recording is busy.');
              }
              localActive.add(id);
              try {
                const current = await store.get(id);
                if (!current)
                  throw new RecordingRepositoryError('not-found', 'The recording was removed.');
                const segment = recordingSegments(current).find((s) => s.id === segmentId);
                if (
                  !segment ||
                  segment.kind !== 'speech' ||
                  segment.open ||
                  segment.endSample <= segment.startSample
                )
                  throw new RecordingRepositoryError(
                    'invalid-range',
                    'A closed speech segment is required.',
                  );
                if (
                  current.attempts.some((a) => a.segmentId === segmentId && a.status === 'pending')
                )
                  throw new RecordingRepositoryError(
                    'active-recording',
                    'This segment already has a pending transcription.',
                  );
                const margin = (value?: number) =>
                  Math.round((Math.max(800, value ?? 0) * current.sampleRate) / 1000);
                const attempt: RecordingAttempt = {
                  id: crypto.randomUUID(),
                  segmentId,
                  engine: transcriber.engine,
                  startSample: Math.max(
                    0,
                    segment.startSample - margin(current.configuration?.preRollMs),
                  ),
                  endSample: Math.min(
                    current.savedSamples,
                    segment.endSample + margin(current.configuration?.postRollMs),
                  ),
                  speechStartSample: segment.startSample,
                  paragraphBefore: segment.attempts[0]?.paragraphBefore,
                  createdAt: now(),
                  status: 'pending',
                };
                const save = async (value: RecordingAttempt) => {
                  await store.update(id, (latest) => ({
                    ...latest,
                    attempts: [...latest.attempts.filter((a) => a.id !== value.id), value],
                  }));
                  emit();
                };
                await save(attempt);
                try {
                  signal?.throwIfAborted();
                  const pcm = await readRange(
                    store,
                    current,
                    attempt.startSample,
                    attempt.endSample,
                  );
                  signal?.throwIfAborted();
                  const text = await transcriber.transcribe(
                    pcm,
                    current.sampleRate,
                    signal,
                    async (metadata) => {
                      attempt.request = metadata;
                      await save(attempt);
                    },
                  );
                  signal?.throwIfAborted();
                  await save({ ...attempt, status: 'success', text, finishedAt: now() });
                } catch (error) {
                  await save({
                    ...attempt,
                    status: 'error',
                    error: signal?.aborted
                      ? 'cancelled'
                      : error instanceof Error
                        ? error.message
                        : String(error),
                    finishedAt: now(),
                  });
                  throw error;
                }
              } finally {
                localActive.delete(id);
                release();
              }
            })();
            retryJobs.add(task);
            void task.finally(() => retryJobs.delete(task)).catch(() => {});
            return task;
          },
        }
      : {}),
    async export(id) {
      const { store, session } = await settled(id);
      const parts: BlobPart[] = [
        '{"format":"dsh-live-voice-recording","version":1,"recording":',
        JSON.stringify(cloneSession(session)),
        ',"pages":[',
      ];
      let position = 0;
      let first = true;
      while (position < session.savedSamples) {
        const page = await store.nextPage(id, position, session.savedSamples);
        if (!page || page.startSample !== position)
          throw new RecordingRepositoryError(
            'storage-failed',
            'The recording contains a missing audio page.',
          );
        const encoded = {
          ...page,
          decoderConfig: page.decoderConfig
            ? {
                ...page.decoderConfig,
                description: page.decoderConfig.description
                  ? base64(page.decoderConfig.description)
                  : undefined,
              }
            : undefined,
          packets: page.packets.map((packet) => ({ ...packet, data: base64(packet.data) })),
        };
        if (!first) parts.push(',');
        parts.push(JSON.stringify(encoded));
        first = false;
        position += page.sampleCount;
      }
      parts.push(']}');
      return new Blob(parts, { type: 'application/json' });
    },
    async remove(id) {
      check();
      return serial(async () => {
        const { store, session } = await locate(id);
        if (localActive.has(id) || session.state === 'recording')
          throw new RecordingRepositoryError(
            'active-recording',
            'An active recording cannot be removed.',
          );
        await deleteInactive(store, id, true);
        emit();
      });
    },
    async setStarred(id, starred) {
      check();
      if (typeof starred !== 'boolean')
        throw new RecordingRepositoryError(
          'invalid-range',
          'Recording protection must be a boolean.',
        );
      const active = writers.get(id);
      if (active) {
        await active.setStarred(starred);
        return;
      }
      return serial(async () => {
        const { store } = await locate(id);
        const release = store === memory ? () => {} : await holdLock(id);
        let updated: StoredSession;
        try {
          updated = await store.update(id, (current) => ({ ...current, starred }));
        } finally {
          release();
        }
        emit();
        if (!starred) await prune(updated.kind, updated.keepPrevious, store, !!updated.participant);
        emit();
      });
    },
    async setName(id, value) {
      check();
      if (
        typeof value !== 'string' ||
        value.trim().length > 120 ||
        /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)
      )
        throw new RecordingRepositoryError(
          'invalid-range',
          'Recording names must be a single line of at most 120 characters.',
        );
      const name = value.trim();
      const active = writers.get(id);
      if (active) return active.setName(name);
      await serial(async () => {
        const { store } = await locate(id);
        const release = store === memory ? () => {} : await holdLock(id);
        try {
          await store.update(id, (current) => {
            if (!current.starred)
              throw new RecordingRepositoryError(
                'invalid-range',
                'Star a recording before naming it.',
              );
            return { ...current, name };
          });
        } finally {
          release();
        }
        emit();
      });
    },
    timeline(recordingId) {
      // Bind before speaker gating seals microphone capture. Never attach to unrelated later runs.
      const targets = [...writers.entries()].filter(([id]) => !recordingId || id === recordingId);
      return async (kind, details) => {
        const occurredAt = now();
        const context = details ? structuredClone(details) : undefined;
        await Promise.all(
          targets.map(async ([id, active]) => {
            const value: RecordingEvent = {
              id: crypto.randomUUID(),
              kind,
              ...(context ? { details: context } : {}),
              occurredAt,
              atSample: active.writer.session.capturedSamples,
            };
            if (writers.get(id) === active) return active.event(value);
            await serial(async () => {
              const { store } = await locate(id);
              const release = store === memory ? () => {} : await holdLock(id);
              try {
                await store.update(id, (current) => ({
                  ...current,
                  events: [...(current.events ?? []), value],
                }));
              } finally {
                release();
              }
              emit();
            });
          }),
        );
      };
    },
    async begin(input) {
      check();
      let participant: RecordingParticipant | undefined;
      if (input.participant !== undefined) {
        const source = input.participant;
        const text = (value: unknown, max: number, nonempty = true) =>
          typeof value === 'string' &&
          (!nonempty || value.length > 0) &&
          value.length <= max &&
          !/[\x00-\x1f]/.test(value);
        if (
          !source ||
          Object.keys(source).some(
            (key) =>
              !['provider', 'groupId', 'participantId', 'originalName', 'alias'].includes(key),
          ) ||
          source.provider !== 'attendee' ||
          !text(source.groupId, 128) ||
          !text(source.participantId, 256) ||
          !text(source.originalName, 80, false) ||
          (source.alias !== undefined && !text(source.alias, 80)) ||
          input.kind !== 'shared'
        )
          throw new RecordingRepositoryError(
            'invalid-range',
            'The recording participant metadata is invalid.',
          );
        participant = {
          provider: 'attendee',
          groupId: source.groupId,
          participantId: source.participantId,
          originalName: source.originalName,
          ...(source.alias !== undefined ? { alias: source.alias } : {}),
        };
      }
      return serial(async () => {
        check();
        const { sampleRate, policy } = input;
        if (
          !Number.isSafeInteger(sampleRate) ||
          sampleRate < 8000 ||
          sampleRate > 48000 ||
          !Number.isFinite(policy.bitrate) ||
          policy.bitrate < 6000 ||
          policy.bitrate > 256000 ||
          !Number.isFinite(policy.keepPrevious)
        )
          throw new RecordingRepositoryError(
            'invalid-range',
            'The recording sample rate, bitrate or retention policy is invalid.',
          );
        await assertCodec(sampleRate, policy.bitrate);
        const store = policy.enabled ? await persistentStore() : memory;
        let persistent = false;
        if (policy.enabled && globalThis.navigator?.storage) {
          try {
            persistent = await navigator.storage.persisted();
            if (!persistent && navigator.storage.persist)
              persistent = await navigator.storage.persist();
          } catch {
            persistent = false;
          } // A denied durability request is not a failed IDB write.
        }
        await prune(input.kind, Math.max(1, Math.floor(policy.keepPrevious)), store, !!participant);
        const id = crypto.randomUUID();
        const release = policy.enabled ? await holdLock(id) : () => {};
        let session: StoredSession = {
          id,
          sourceId: input.sourceId,
          kind: input.kind,
          label: input.label,
          ...(participant ? { participant } : {}),
          sampleRate,
          startedAt: now(),
          createdOrder: ++creationSequence,
          state: 'recording',
          capturedSamples: 0,
          savedSamples: 0,
          audioBytes: 0,
          persistent,
          codec: 'opus',
          storage: policy.enabled ? 'indexeddb' : 'memory',
          configuration: input.configuration,
          pins: [],
          attempts: [],
          events: [
            { id: crypto.randomUUID(), kind: 'capture-start', occurredAt: now(), atSample: 0 },
          ],
          keepPrevious: Math.max(1, Math.floor(policy.keepPrevious)),
        };
        let releaseGroup: (() => void) | undefined;
        try {
          if (participant && policy.enabled)
            releaseGroup = await holdLock(
              participant.groupId,
              groupName(participant.groupId),
              true,
            );
          await store.create(session);
        } catch (error) {
          release();
          throw storageError(error);
        } finally {
          releaseGroup?.();
        }
        localActive.add(id);
        let tail: Promise<unknown> = Promise.resolve();
        let pending = new Float32Array(sampleRate);
        let pendingCount = 0;
        let index = 0;
        let queuedSamples = 0;
        let sealed = false;
        let finishPromise: Promise<void> | undefined;
        let fatal: RecordingRepositoryError | undefined;
        const publish = () => emit();
        const update = async (
          change: (current: StoredSession) => StoredSession,
          page?: AudioPage,
        ) => {
          const captured = session.capturedSamples;
          session = await store.update(
            id,
            (current) => ({
              ...change(current),
              capturedSamples: Math.max(current.capturedSamples, captured),
            }),
            page,
          );
          publish();
        };
        const enqueue = <T>(run: () => Promise<T>): Promise<T> => {
          const next = tail.then(run);
          tail = next.catch(() => {});
          return next;
        };
        const ensureAudioOpen = () => {
          if (fatal) throw fatal;
          if (sealed)
            throw new RecordingRepositoryError('sealed', 'The recording has been sealed.');
        };
        const flush = async () => {
          if (!pendingCount) return;
          const count = pendingCount;
          const encoded = await encodePage(pending.subarray(0, count), sampleRate, policy.bitrate);
          const page: AudioPage = {
            recordingId: id,
            index,
            startSample: session.savedSamples,
            sampleCount: count,
            sampleRate,
            ...encoded,
          };
          await update(
            (current) => ({
              ...current,
              savedSamples: page.startSample + count,
              audioBytes: (current.audioBytes ?? 0) + audioPageBytes(page),
            }),
            page,
          );
          pendingCount = 0;
          index++;
        };
        const fail = async (error: unknown) => {
          fatal = error instanceof RecordingRepositoryError ? error : storageError(error);
          pendingCount = 0;
          try {
            await update((current) => ({
              ...current,
              state: 'failed',
              error: fatal.code,
              endedAt: now(),
            }));
          } catch {
            session = { ...session, state: 'failed', error: fatal.code, endedAt: now() };
            publish();
          }
          throw fatal;
        };
        const writer: RecordingWriter = {
          get session() {
            return cloneSession(session);
          },
          append(pcm) {
            try {
              check();
              ensureAudioOpen();
              if (queuedSamples + pcm.length > sampleRate * 8)
                throw new RecordingRepositoryError(
                  'memory-limit',
                  'Recording append backpressure exceeded eight seconds of queued audio.',
                );
              const copy = pcm.slice();
              queuedSamples += copy.length;
              return enqueue(async () => {
                try {
                  if (fatal) throw fatal;
                  session.capturedSamples += copy.length;
                  let offset = 0;
                  while (offset < copy.length) {
                    const count = Math.min(pending.length - pendingCount, copy.length - offset);
                    pending.set(copy.subarray(offset, offset + count), pendingCount);
                    pendingCount += count;
                    offset += count;
                    if (pendingCount === pending.length) await flush();
                  }
                  publish();
                } catch (error) {
                  return fail(error);
                } finally {
                  queuedSamples -= copy.length;
                }
              });
            } catch (error) {
              return Promise.reject(error);
            }
          },
          pin(kind, atSample, confirmedAtSample) {
            try {
              check();
              ensureAudioOpen();
            } catch (error) {
              return Promise.reject(error);
            }
            return enqueue(async () => {
              if (fatal) throw fatal;
              range(atSample, confirmedAtSample, session.capturedSamples);
              const pin: RecordingPin = {
                id: crypto.randomUUID(),
                kind,
                atSample,
                confirmedAtSample,
                delaySamples: confirmedAtSample - atSample,
              };
              await update((current) => ({ ...current, pins: [...current.pins, pin] }));
              return pin;
            });
          },
          attempt(value: RecordingAttempt) {
            try {
              check();
            } catch (error) {
              return Promise.reject(error);
            }
            const copy = structuredClone(value);
            return enqueue(async () => {
              range(copy.startSample, copy.endSample, session.capturedSamples);
              await update((current) => ({
                ...current,
                attempts: [...current.attempts.filter((attempt) => attempt.id !== copy.id), copy],
              }));
              if (sealed && copy.status !== 'pending') {
                await serial(() => prune(input.kind, session.keepPrevious, store, !!participant));
                emit();
              }
            });
          },
          read(start, end) {
            try {
              check();
            } catch (error) {
              return Promise.reject(error);
            }
            return enqueue(async () => {
              if (!fatal) {
                try {
                  await flush();
                } catch (error) {
                  return fail(error);
                }
              }
              return readRange(store, session, start, end);
            });
          },
          finish(state = 'completed', error) {
            if (finishPromise) return finishPromise;
            sealed = true;
            finishPromise = enqueue(async () => {
              try {
                if (!fatal) {
                  try {
                    await flush();
                  } catch (failure) {
                    await fail(failure);
                  }
                }
                await update((current) => ({
                  ...current,
                  state: fatal ? 'failed' : state,
                  error: fatal?.code ?? error,
                  endedAt: now(),
                  events: [
                    ...(current.events ?? []),
                    {
                      id: crypto.randomUUID(),
                      kind: 'capture-end',
                      occurredAt: now(),
                      atSample: current.capturedSamples,
                    },
                  ],
                }));
              } finally {
                pending = new Float32Array(0);
                localActive.delete(id);
                writers.delete(id);
                release();
              }
              await serial(() => prune(input.kind, session.keepPrevious, store, !!participant));
              emit();
            });
            return finishPromise;
          },
        };
        writers.set(id, {
          writer,
          setStarred: (value) =>
            enqueue(async () => {
              await update((current) => ({ ...current, starred: value }));
            }),
          setName: (name) =>
            enqueue(async () => {
              await update((current) => {
                if (!current.starred)
                  throw new RecordingRepositoryError(
                    'invalid-range',
                    'Star a recording before naming it.',
                  );
                return { ...current, name };
              });
            }),
          event: (value) =>
            enqueue(async () => {
              await update((current) => ({
                ...current,
                events: [
                  ...(current.events ?? []),
                  { ...value, atSample: current.capturedSamples },
                ],
              }));
            }),
          idle: async () => {
            await tail;
          },
        });
        emit();
        return writer;
      });
    },
    async dispose() {
      if (disposed) return;
      disposing = true;
      retryLifetime?.abort();
      await Promise.allSettled([...retryJobs]);
      await lifecycle;
      const results = await Promise.allSettled(
        [...writers.values()].map((active) => active.writer.finish('interrupted')),
      );
      listeners.clear();
      memory.close();
      if (opening) {
        try {
          (await opening).close();
        } catch {
          /* Open failure was already reported. */
        }
      }
      disposed = true;
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    },
  };
  return repository;
}
