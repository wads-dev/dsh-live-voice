import {
  installVoiceErrorSink,
  sanitizeVoiceErrorEvent,
  type VoiceErrorEvent,
} from '../../live-voice/src/modules/core/diagnosticsErrors.js';
export type { VoiceErrorEvent };
const DATABASE = 'dsh-live-voice-debugger.errors.v1';
const STORE = 'errors';
const RETAIN = 500;
const PENDING = 64;
const DEADLINE = 1800;
type Row = VoiceErrorEvent & { id: string };
export interface VoiceErrorQuery {
  limit?: number;
  offset?: number;
  operation?: string;
  recordingId?: string;
}
export function createVoiceErrorJournal(target: Window) {
  let disposed = false;
  let terminated = false;
  let inFlight = new Set<string>();
  let evictedInFlight = new Set<string>();
  let db: IDBDatabase | null = null;
  let dbOpening: Promise<IDBDatabase> | null = null;
  // A rejected blocked/timed-out open remains live until IndexedDB finishes it.
  let openOutstanding = false;
  let retryAt = 0;
  let sequence = 0;
  let dropped = 0;
  const pending = new Map<string, Row>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const cb of listeners) {
      try {
        cb();
      } catch {
        /* Ignore viewer errors. */
      }
    }
  };
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<void> | null = null;
  const journalId = target.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  function open(): Promise<IDBDatabase> {
    if (terminated) return Promise.reject(new Error('Journal disposed.'));
    if (db) return Promise.resolve(db);
    if (!dbOpening) {
      if (openOutstanding) return Promise.reject(new Error('Error journal storage unavailable.'));
      dbOpening = new Promise<IDBDatabase>((resolve, reject) => {
        const req = target.indexedDB.open(DATABASE, 2);
        openOutstanding = true;
        let abandoned = false;
        const timer = setTimeout(() => fail(), DEADLINE);
        const fail = () => {
          if (abandoned) return;
          abandoned = true;
          try { req.transaction?.abort(); } catch {}
          clearTimeout(timer);
          reject(new Error('Error journal storage unavailable.'));
        };
        req.onupgradeneeded = (event) => {
          const tx = req.transaction!;
          if (abandoned || terminated) {
            tx.abort();
            return;
          }
          if (event.oldVersion === 0) {
            req.result.createObjectStore(STORE, { keyPath: 'id' });
            return;
          }
          // A versionchange transaction excludes every other connection and commits the
          // replacement as a unit. Never discard a row we cannot safely interpret.
          const store = tx.objectStore(STORE);
          const read = store.getAll();
          read.onsuccess = () => {
            try {
              const rows = read.result.map((row: unknown) => {
                const safe = sanitizeVoiceErrorEvent(row);
                if (!safe) throw new Error('Unrecognized error journal row.');
                return safe;
              });
              // An invalid row aborts the whole upgrade: it remains untouched and the
              // journal reports storage unavailable rather than guessing its contents.
              // getAll follows primary-key order; stable sorting preserves that order
              // for equal timestamps without retaining potentially sensitive keys.
              rows.sort((a, b) => a.at - b.at);
              store.clear();
              rows.forEach((row, index) => {
                const id = String(row.at).padStart(16, '0') + ':!migration:' +
                  String(index).padStart(16, '0');
                store.add({ ...row, id });
              });
            } catch {
              tx.abort();
            }
          };
        };
        req.onerror = () => {
          openOutstanding = false;
          const retryAbandoned = abandoned && !disposed;
          fail();
          // An abandoned blocked request cannot be cancelled until IndexedDB
          // delivers its terminal event. Retry once after that request is gone.
          if (retryAbandoned) queueMicrotask(() => {
            if (!disposed) void open().then(notify, notify);
          });
        };
        req.onblocked = fail;
        req.onsuccess = () => {
          openOutstanding = false;
          clearTimeout(timer);
          if (terminated || abandoned) {
            req.result.close();
            fail();
            if (abandoned && !disposed) queueMicrotask(() => {
              if (!disposed) void open().then(notify, notify);
            });
            return;
          }
          db = req.result;
          const connection = db;
          const close = () => {
            connection.close();
            if (db === connection) db = null;
          };
          connection.onversionchange = close;
          connection.onclose = close;
          resolve(connection);
        };
      }).finally(() => {
        dbOpening = null;
      });
    }
    return dbOpening;
  }
  function transact<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore, result: (value: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value: T;
      const timer = setTimeout(() => {
        try {
          tx.abort();
        } catch {}
        reject(new Error('Error journal storage timed out.'));
      }, DEADLINE);
      const fail = () => {
        clearTimeout(timer);
        reject(tx.error ?? new Error('Error journal storage failed.'));
      };
      tx.onabort = fail;
      tx.oncomplete = () => {
        clearTimeout(timer);
        resolve(value);
      };
      try {
        run(tx.objectStore(STORE), (next) => {
          value = next;
        });
      } catch (error) {
        clearTimeout(timer);
        try {
          tx.abort();
        } catch {}
        reject(error);
      }
    });
  }
  function flush(final = false): Promise<void> | null {
    if ((disposed && !final) || flushing || !pending.size || (!final && retryAt > Date.now()))
      return flushing;
    const rows = [...pending.values()];
    inFlight = new Set(rows.map((row) => row.id));
    evictedInFlight = new Set();
    flushing = open()
      .then((connection) =>
        transact<void>(connection, 'readwrite', (store) => {
          for (const row of rows) store.put(row);
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            for (const key of keys.result.slice(0, Math.max(0, keys.result.length - RETAIN)))
              store.delete(key);
          };
        }),
      )
      .then(
        () => {
          retryAt = 0;
          for (const row of rows) pending.delete(row.id);
        },
        () => {
          dropped += evictedInFlight.size;
          retryAt = Date.now() + 2000;
          if (!disposed && retryTimer === null)
            retryTimer = setTimeout(() => {
              retryTimer = null;
              flush();
            }, 2000);
        },
      )
      .finally(() => {
        inFlight.clear();
        evictedInFlight.clear();
        flushing = null;
        if (!disposed) {
          notify();
          flush();
        }
      });
    return flushing;
  }
  const unbind = installVoiceErrorSink(target as unknown as { [key: symbol]: unknown }, (event) => {
    if (disposed) return;
    const safe = sanitizeVoiceErrorEvent(event);
    if (!safe) return;
    const id =
      String(safe.at).padStart(16, '0') +
      ':' +
      journalId +
      ':' +
      String(++sequence).padStart(12, '0');
    if (pending.size >= PENDING) {
      const oldest = pending.keys().next().value!;
      pending.delete(oldest);
      if (inFlight.has(oldest)) evictedInFlight.add(oldest);
      else dropped++;
    }
    pending.set(id, { ...safe, id });
    notify();
    flush();
  });
  // Start migration even if no event is reported and nobody opens the viewer.
  void open().then(() => { if (!disposed) notify(); }, () => { if (!disposed) notify(); });
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async list(query: VoiceErrorQuery = {}) {
      await flush();
      let rows: Row[] = [];
      let readable = false;
      try {
        rows = await transact<Row[]>(await open(), 'readonly', (store, result) => {
          const req = store.getAll();
          req.onsuccess = () => result(req.result);
        });
        readable = true;
      } catch {
        /* Recent entries remain available in bounded memory. */
      }
      const limit = Number.isSafeInteger(query.limit)
        ? Math.max(1, Math.min(50, query.limit!))
        : 20;
      const offset = Number.isSafeInteger(query.offset) ? Math.max(0, query.offset!) : 0;
      // IDs are storage keys, not trusted display data. Never expose a legacy key.
      const all = [
        ...new Map(
          [...rows, ...pending.values()]
            .filter((row) => row && typeof row.id === 'string')
            .map((row) => [row.id, row]),
        ).values(),
      ]
        .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
        .flatMap((row, index) => {
          const safe = sanitizeVoiceErrorEvent(row);
          return safe ? [{ ...safe, id: String(index) }] : [];
        })
        .filter(
          (row) =>
            (!query.operation || row.operation === query.operation) &&
            (!query.recordingId || row.context.recordingId === query.recordingId),
        );
      return {
        items: all.slice(offset, offset + limit),
        nextOffset: offset + limit < all.length ? offset + limit : null,
        persistent: readable && retryAt === 0,
        dropped,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unbind();
      listeners.clear();
      if (retryTimer !== null) clearTimeout(retryTimer);
      // Best effort: let an in-flight batch settle, then try the remaining bounded queue once.
      // Disposal is synchronous to callers and cannot guarantee completion on page termination.
      void (async () => {
        await flushing;
        await flush(true);
        pending.clear();
        terminated = true;
        db?.close();
        db = null;
      })();
    },
  };
}
export type VoiceErrorJournal = ReturnType<typeof createVoiceErrorJournal>;
