import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingRepository } from '../src/modules/recording/repository.js';

// Zero pages avoid codec execution; capability probes are faked, not real WebCodecs.
test('sparse archive keeps absolute positions and rejects gaps', async () => {
  const keys = ['AudioEncoder', 'AudioDecoder', 'AudioData', 'EncodedAudioChunk'] as const;
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  class Codec { static async isConfigSupported() { return { supported: true }; } }
  keys.forEach(key => Object.defineProperty(globalThis, key, { value: Codec, configurable: true }));
  const repo = createRecordingRepository();
  try {
    const writer = await repo.begin({ sourceId: 'x', kind: 'microphone', label: 'x', sampleRate: 8000,
      policy: { enabled: false, keepPrevious: 1, bitrate: 24000, preRollMs: 0, postRollMs: 0 } });
    await writer.append(new Float32Array(8000));
    await writer.append(new Float32Array(1000));
    await writer.markArchiveGap!(8000, 10000);
    await writer.markArchiveGap!(8000, 10000);
    await writer.append(new Float32Array(8000));
    assert.equal(writer.session.savedSamples, 17000);
    assert.equal(writer.session.archiveEndSample, 18000);
    assert.equal(writer.session.capturedSamples, 18000);
    assert.deepEqual(writer.session.archiveGaps, [{ startSample: 9000, endSample: 10000 }]);
    assert.equal((await writer.read(10000, 18000)).length, 8000);
    await assert.rejects(writer.read(7999, 10001), { code: 'archive-gap' });
    await writer.finish();
    await assert.rejects(repo.audio(writer.session.id), { code: 'archive-gap' });
    assert.equal((await repo.audio(writer.session.id, 10000, 18000)).size, 16044);
    const archive = JSON.parse(await (await repo.export(writer.session.id)).text());
    assert.deepEqual(archive.recording.archiveGaps, [{ startSample: 9000, endSample: 10000 }]);
    assert.deepEqual(archive.pages.map((page: any) => page.startSample), [0, 8000, 10000]);
    assert.deepEqual(repo.segments(writer.session), []);
  } finally {
    await repo.dispose();
    keys.forEach((key, i) => old[i] ? Object.defineProperty(globalThis, key, old[i]!) : delete (globalThis as any)[key]);
  }
});
