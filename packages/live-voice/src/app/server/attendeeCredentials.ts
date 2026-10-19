import { open, mkdir, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateAttendeeApi } from './attendeeConnection.js';

const queues = new Map<string, Promise<unknown>>();
const invalid = () => new Error('credential-storage-invalid');
export function validateAttendeeKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 8 ||
    value.length > 512 ||
    /[\x00-\x20\x7f]/.test(value)
  )
    throw new Error('invalid-api');
  return value;
}
/** Host-only plaintext credentials. File permissions are not encryption or OS-keychain protection. */
export function createAttendeeCredentialStore(
  path = join(homedir(), '.dsh', 'dsh-live-voice.attendee-credentials.json'),
) {
  path = resolve(path);
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = (queues.get(path) ?? Promise.resolve()).then(run);
    const tail = next.then(
      () => {},
      () => {},
    );
    queues.set(path, tail);
    void tail.then(() => {
      if (queues.get(path) === tail) queues.delete(path);
    });
    return next;
  };
  async function load(): Promise<Record<string, string>> {
    let file;
    try {
      file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.size > 65536 ||
        (stat.mode & 0o777) !== 0o600 ||
        (process.getuid && stat.uid !== process.getuid())
      )
        throw invalid();
      const buffer = Buffer.alloc(65537);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 65536) throw invalid();
      const doc = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
      if (
        !doc ||
        typeof doc !== 'object' ||
        Array.isArray(doc) ||
        Object.keys(doc).sort().join(',') !== 'origins,version' ||
        doc.version !== 1 ||
        !doc.origins ||
        typeof doc.origins !== 'object' ||
        Array.isArray(doc.origins)
      )
        throw invalid();
      const entries = Object.entries(doc.origins);
      if (entries.length > 32) throw invalid();
      const origins = Object.create(null);
      for (const [origin, key] of entries) {
        try {
          if (origin.length > 256 || validateAttendeeApi(origin) !== origin) throw invalid();
          origins[origin] = validateAttendeeKey(key);
        } catch {
          throw invalid();
        }
      }
      return origins;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return Object.create(null);
      if (
        (error as Error).message === 'credential-storage-invalid' ||
        error instanceof SyntaxError ||
        (error as Error).message === 'invalid-api' ||
        (error as NodeJS.ErrnoException).code === 'ELOOP'
      )
        throw invalid();
      throw new Error('credential-storage-unavailable');
    } finally {
      await file?.close().catch(() => {});
    }
  }
  function origin(value: string) {
    try {
      const normalized = validateAttendeeApi(value);
      if (normalized.length > 256) throw Error();
      return normalized;
    } catch {
      throw new Error('invalid-api');
    }
  }
  async function mutate(apiUrl: string, key?: string) {
    const normalized = origin(apiUrl);
    const validated = key === undefined ? undefined : validateAttendeeKey(key);
    return serial(async () => {
      const origins = await load();
      if (validated === undefined) delete origins[normalized];
      else origins[normalized] = validated;
      if (Object.keys(origins).length > 32) throw invalid();
      const data = JSON.stringify({ version: 1, origins }) + '\n';
      if (Buffer.byteLength(data) > 65536) throw invalid();
      const temporary = path + '.' + randomUUID() + '.tmp';
      try {
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(data);
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, path);
      } catch {
        throw new Error('credential-storage-unavailable');
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
      return { hasSavedKey: validated !== undefined };
    });
  }
  return {
    metadata(apiUrl: string) {
      const normalized = origin(apiUrl);
      return serial(async () => ({ hasSavedKey: Object.hasOwn(await load(), normalized) }));
    },
    get(apiUrl: string) {
      const normalized = origin(apiUrl);
      return serial(async () => {
        const key = (await load())[normalized];
        if (!key) throw new Error('credential-missing');
        return key;
      });
    },
    save: (apiUrl: string, key: string) => mutate(apiUrl, key),
    remove: (apiUrl: string) => mutate(apiUrl),
  };
}
