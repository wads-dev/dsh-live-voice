import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingRepository } from '../src/modules/recording/repository.js';
import { createMemoryStore } from '../src/modules/recording/storage.js';

test('concurrent failed store openings share one retry', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {} });
  let rejectFirst!: (reason: Error) => void;
  let resolveRetry!: (store: ReturnType<typeof createMemoryStore>) => void;
  let calls = 0;
  const repo = createRecordingRepository(() => {
    calls++;
    return calls === 1
      ? new Promise((_, reject) => { rejectFirst = reject; })
      : new Promise((resolve) => { resolveRetry = resolve; });
  });
  try {
    const first = repo.list();
    const second = repo.list();
    assert.equal(calls, 1);
    rejectFirst(new Error('transient'));
    await Promise.all([assert.rejects(first, /transient/), assert.rejects(second, /transient/)]);
    const retry = repo.list();
    const concurrent = repo.list();
    assert.equal(calls, 2);
    resolveRetry(createMemoryStore());
    assert.deepEqual(await Promise.all([retry, concurrent]), [[], []]);
    await repo.list();
    assert.equal(calls, 2);
  } finally {
    await repo.dispose();
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else delete (globalThis as any).indexedDB;
  }
});
