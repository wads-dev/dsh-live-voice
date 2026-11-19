import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingRepository } from '../src/modules/recording/repository.js';

test('failed partial flush is recorded as unavailable, never fabricated', async () => {
  const keys = ['AudioEncoder', 'AudioDecoder', 'AudioData', 'EncodedAudioChunk'] as const;
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  class Codec {
    static async isConfigSupported() { return { supported: true }; }
    configure() { throw new Error('transient encoder failure'); }
    close() {}
  }
  keys.forEach(key => Object.defineProperty(globalThis, key, { value: Codec, configurable: true }));
  const repo = createRecordingRepository();
  try {
    const writer = await repo.begin({ sourceId: 'x', kind: 'microphone', label: 'x', sampleRate: 8000,
      policy: { enabled: false, keepPrevious: 1, bitrate: 24000, preRollMs: 0, postRollMs: 0 } });
    await writer.append(new Float32Array(1000).fill(0.5));
    await writer.markArchiveGap!(1000, 2000);
    assert.equal(writer.session.savedSamples, 0);
    assert.equal(writer.session.archiveEndSample, 2000);
    assert.deepEqual(writer.session.archiveGaps, [{ startSample: 0, endSample: 2000 }]);
    await writer.append(new Float32Array(8000));
    assert.equal((await writer.read(2000, 10000)).length, 8000);
    await assert.rejects(writer.read(0, 1000), { code: 'archive-gap' });
    await writer.finish();
  } finally {
    await repo.dispose();
    keys.forEach((key, i) => old[i] ? Object.defineProperty(globalThis, key, old[i]!) : delete (globalThis as any)[key]);
  }
});
