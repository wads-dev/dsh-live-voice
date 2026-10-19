import type { RecordingSession } from './types.js';
import type { AudioPage } from './codec.js';
import { RecordingRepositoryError, audioPageBytes } from './codec.js';

export interface StoredSession extends RecordingSession {
  keepPrevious: number;
  createdOrder?: number;
}
export interface PageStore {
  list(): Promise<StoredSession[]>;
  get(id: string): Promise<StoredSession | null>;
  create(session: StoredSession): Promise<void>;
  update(
    id: string,
    change: (session: StoredSession) => StoredSession,
    page?: AudioPage,
  ): Promise<StoredSession>;
  nextPage(id: string, start: number, end: number): Promise<AudioPage | null>;
  audioBytes(id: string): Promise<number>;
  remove(id: string): Promise<void>;
  removeGroup(groupId: string, expectedIds: string[]): Promise<boolean>;
  close(): void;
}
export function storageError(error: unknown): RecordingRepositoryError {
  if (error instanceof RecordingRepositoryError) return error;
  const quota =
    error && typeof error === 'object' && 'name' in error && error.name === 'QuotaExceededError';
  return new RecordingRepositoryError(
    quota ? 'quota-exceeded' : 'storage-failed',
    quota ? 'Browser recording storage quota was exceeded.' : 'Browser recording storage failed.',
    { cause: error },
  );
}
/** Fail closed if a group changed or any member became protected since selection. */
export function removableGroup(
  sessions: StoredSession[],
  groupId: string,
  expectedIds: string[],
): boolean {
  const members = sessions.filter(
    (s) => s.participant?.provider === 'attendee' && s.participant.groupId === groupId,
  );
  const ids = new Set(expectedIds);
  return (
    ids.size > 0 &&
    ids.size === expectedIds.length &&
    members.length === ids.size &&
    members.every(
      (s) =>
        ids.has(s.id) &&
        !s.starred &&
        s.state !== 'recording' &&
        !s.attempts.some((a) => a.status === 'pending'),
    )
  );
}
export async function openRecordingStore(): Promise<PageStore> {
  if (!globalThis.indexedDB)
    throw new RecordingRepositoryError(
      'storage-unavailable',
      'IndexedDB recording storage is unavailable.',
    );
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('dsh-live-voice.recordings.v1', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('sessions', { keyPath: 'id' });
      const pages = db.createObjectStore('pages', { keyPath: ['recordingId', 'startSample'] });
      pages.createIndex('recordingId', 'recordingId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () =>
      reject(
        new RecordingRepositoryError(
          'storage-unavailable',
          'Another browser tab is blocking the recording database upgrade.',
        ),
      );
  });
  db.onversionchange = () => db.close();
  function transact<T>(
    mode: IDBTransactionMode,
    run: (tx: IDBTransaction, result: (value: T) => void, fail: (error: unknown) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(
          ['sessions', 'pages'],
          mode,
          mode === 'readwrite' ? { durability: 'strict' } : undefined,
        );
      } catch (error) {
        reject(storageError(error));
        return;
      }
      let value: T;
      let failure: unknown;
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => {
        failure ??= tx.error;
      };
      tx.onabort = () => reject(storageError(failure ?? tx.error));
      try {
        run(
          tx,
          (result) => {
            value = result;
          },
          (error) => {
            failure = error;
            tx.abort();
          },
        );
      } catch (error) {
        failure = error;
        tx.abort();
      }
    });
  }
  return {
    list: () =>
      transact('readonly', (tx, result) => {
        const request = tx.objectStore('sessions').getAll();
        request.onsuccess = () => result(request.result);
      }),
    get: (id) =>
      transact('readonly', (tx, result) => {
        const request = tx.objectStore('sessions').get(id);
        request.onsuccess = () => result(request.result ?? null);
      }),
    create: (session) =>
      transact('readwrite', (tx, result) => {
        tx.objectStore('sessions').add(session);
        result(undefined);
      }),
    update: (id, change, page) =>
      transact('readwrite', (tx, result, fail) => {
        const sessions = tx.objectStore('sessions');
        const request = sessions.get(id);
        request.onsuccess = () => {
          try {
            if (!request.result)
              throw new RecordingRepositoryError('not-found', 'The recording no longer exists.');
            // Read/modify/write in the SAME transaction; a late page must not erase attempts or pins.
            const next = change(request.result);
            if (page) tx.objectStore('pages').add(page);
            sessions.put(next);
            result(next);
          } catch (error) {
            // IDB callback exceptions otherwise leave a transaction alive with partial writes.
            fail(error);
          }
        };
      }),
    audioBytes: (id) =>
      transact('readonly', (tx, result) => {
        let bytes = 0;
        const request = tx
          .objectStore('pages')
          .index('recordingId')
          .openCursor(IDBKeyRange.only(id));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            result(bytes);
            return;
          }
          bytes += audioPageBytes(cursor.value);
          cursor.continue();
        };
      }),
    nextPage: (id, start, end) =>
      transact('readonly', (tx, result) => {
        if (end <= start) {
          result(null);
          return;
        }
        const pages = tx.objectStore('pages');
        const previous = pages.openCursor(IDBKeyRange.bound([id, 0], [id, start]), 'prev');
        previous.onsuccess = () => {
          const page = previous.result?.value as AudioPage | undefined;
          if (page && page.startSample + page.sampleCount > start) {
            result(page);
            return;
          }
          const next = pages.openCursor(IDBKeyRange.bound([id, start], [id, end], false, true));
          next.onsuccess = () => result(next.result?.value ?? null);
        };
      }),
    remove: (id) =>
      transact('readwrite', (tx, result) => {
        tx.objectStore('sessions').delete(id);
        const request = tx
          .objectStore('pages')
          .index('recordingId')
          .openCursor(IDBKeyRange.only(id));
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else result(undefined);
        };
      }),
    removeGroup: (groupId, expectedIds) =>
      transact('readwrite', (tx, result, fail) => {
        const sessions = tx.objectStore('sessions');
        const request = sessions.getAll();
        request.onsuccess = () => {
          try {
            if (!removableGroup(request.result, groupId, expectedIds)) {
              result(false);
              return;
            }
            const ids = new Set(expectedIds);
            for (const id of ids) sessions.delete(id);
            const pages = tx.objectStore('pages').openCursor();
            pages.onsuccess = () => {
              const cursor = pages.result;
              if (!cursor) {
                result(true);
                return;
              }
              if (ids.has(cursor.value.recordingId)) cursor.delete();
              cursor.continue();
            };
          } catch (error) {
            fail(error);
          }
        };
      }),
    close: () => db.close(),
  };
}
/** Opt-out audio never reaches browser persistence, including private-window IndexedDB. */
export function createMemoryStore(maxBytes = 32 * 1024 * 1024): PageStore {
  const sessions = new Map<string, StoredSession>();
  const pages = new Map<string, AudioPage[]>();
  let used = 0;
  const size = (page: AudioPage) =>
    256 +
    (page.decoderConfig?.description?.byteLength ?? 0) +
    page.packets.reduce((total, packet) => total + packet.data.byteLength + 64, 0);
  return {
    audioBytes: async (id) =>
      (pages.get(id) ?? []).reduce((sum, page) => sum + audioPageBytes(page), 0),
    list: async () => structuredClone([...sessions.values()]),
    get: async (id) => structuredClone(sessions.get(id) ?? null),
    create: async (session) => {
      sessions.set(session.id, structuredClone(session));
    },
    update: async (id, change, page) => {
      const current = sessions.get(id);
      if (!current)
        throw new RecordingRepositoryError('not-found', 'The recording no longer exists.');
      const next = change(structuredClone(current));
      if (page && used + size(page) > maxBytes)
        throw new RecordingRepositoryError(
          'memory-limit',
          'The non-persistent compressed recording reached its memory limit.',
        );
      if (page) {
        const list = pages.get(id) ?? [];
        list.push(structuredClone(page));
        pages.set(id, list);
        used += size(page);
      }
      sessions.set(id, structuredClone(next));
      return structuredClone(next);
    },
    nextPage: async (id, start, end) =>
      structuredClone(
        (pages.get(id) ?? []).find(
          (page) => page.startSample + page.sampleCount > start && page.startSample < end,
        ) ?? null,
      ),
    remove: async (id) => {
      for (const page of pages.get(id) ?? []) used -= size(page);
      pages.delete(id);
      sessions.delete(id);
    },
    removeGroup: async (groupId, expectedIds) => {
      if (!removableGroup([...sessions.values()], groupId, expectedIds)) return false;
      // No await between revalidation and deletion: one indivisible memory-store mutation.
      for (const id of expectedIds) {
        for (const page of pages.get(id) ?? []) used -= size(page);
        pages.delete(id);
        sessions.delete(id);
      }
      return true;
    },
    close: () => {
      sessions.clear();
      pages.clear();
      used = 0;
    },
  };
}
