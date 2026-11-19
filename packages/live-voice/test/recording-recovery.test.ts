import test from 'node:test';
import assert from 'node:assert/strict';
import { beginResilientWriter } from '../src/modules/recording/resilientWriter.js';
import { mockRecordingRepository } from './helpers/recording.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.js';

const input = { sourceId: 'microphone', kind: 'microphone' as const, label: 'microphone', sampleRate: 16000,
  policy: { enabled: true, keepPrevious: 1, bitrate: 48000, preRollMs: 800, postRollMs: 800 } };

test('storage begin failure keeps bounded live PCM readable without an archive', async () => {
  const repo = mockRecordingRepository();
  repo.begin = async () => { throw Object.assign(new Error('quota'), { code: 'quota-exceeded' }); };
  let warnings = 0;
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => warnings++);
  const samples = new Float32Array(1600).fill(0.25);
  await writer.append(samples);
  assert.deepEqual(await writer.read(0, samples.length), samples);
  assert.equal(warnings, 1);
  await writer.finish();
  assert.equal(writer.session.capturedSamples, samples.length);
});

test('append failure preserves live transcription and marks archive gap at finish', async () => {
  const repo = mockRecordingRepository();
  const begin = repo.begin.bind(repo);
  let gap: number[] | undefined;
  repo.begin = async (value) => {
    const writer = await begin(value);
    writer.append = async () => { throw new Error('storage failure'); };
    writer.markArchiveGap = async (start, end) => { gap = [start, end]; };
    return writer;
  };
  let ingest: any, classify: any, warning = 0, errors = 0;
  const results: string[] = [];
  const engine = new WhisperHttpRecognitionEngine({ recordings: repo,
    meter: { context: { sampleRate: 16000 }, source: {} }, voiceDetectionEngine: 'silero',
    voiceDetectionPreset: 'short', voiceDetectionMinimumSpeechMs: 50,
    vadAvailable: async () => true,
    vadFactory: (options) => { classify = options.onProbability; return { release() {} }; },
    vadCapture: async (_c, _s, _v, onPcm) => { ingest = onPcm; return { finish: async () => {}, release() {} }; },
    globals: { fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, value: { text: 'recognized' } }) }) },
  });
  await engine.start({ onRecordingWarning: () => warning++, onError: () => errors++, onResult: (value) => results.push(value.final) });
  const frame = (length: number, probability: number) => {
    const pcm = new Float32Array(length).fill(probability ? 0.2 : 0);
    ingest(pcm, 16000); classify({ probability, pcm });
  };
  frame(1600, 0.9); frame(16000, 0);
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(results, ['recognized']);
  assert.equal(warning, 1);
  assert.equal(errors, 0);
  await engine.stop();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(gap, [0, 17600]);
});

test('transient begin failures retry a bounded number of times', async () => {
  const repo = mockRecordingRepository();
  const begin = repo.begin.bind(repo);
  let calls = 0;
  repo.begin = async (value) => {
    if (++calls < 3) throw Object.assign(new Error('temporary'), { code: 'storage-failed' });
    return begin(value);
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(calls, 3);
  await writer.finish();
});

test('stalled begin never blocks PCM or stop and late writer is sealed once', async () => {
  const repo = mockRecordingRepository();
  const begin = repo.begin.bind(repo);
  let release: (value: any) => void = () => {};
  let calls = 0;
  const gate = new Promise<any>((resolve) => { release = resolve; });
  repo.begin = async () => { calls++; return gate; };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array([0.5]));
  assert.equal((await writer.read(0, 1))[0], 0.5);
  await writer.finish();
  assert.equal(calls, 1);
  const archive = await begin(input);
  release(archive);
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(archive.session.state, 'completed');
  assert.equal(archive.session.capturedSamples, 1);
  assert.equal(calls, 1);
});

test('stalled append does not block engine transcription or stop', async () => {
  const repo = mockRecordingRepository();
  const begin = repo.begin.bind(repo);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  repo.begin = async (value) => {
    const archive = await begin(value), append = archive.append.bind(archive);
    archive.append = async (pcm) => { await gate; await append(pcm); };
    return archive;
  };
  let ingest: any, classify: any;
  const results: string[] = [];
  const engine = new WhisperHttpRecognitionEngine({ recordings: repo,
    meter: { context: { sampleRate: 16000 }, source: {} }, voiceDetectionEngine: 'silero',
    voiceDetectionPreset: 'short', voiceDetectionMinimumSpeechMs: 50,
    vadAvailable: async () => true,
    vadFactory: (options) => { classify = options.onProbability; return { release() {} }; },
    vadCapture: async (_c, _s, _v, onPcm) => { ingest = onPcm; return { finish: async () => {}, release() {} }; },
    globals: { fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, value: { text: 'live' } }) }) },
  });
  await engine.start({ onResult: (value) => results.push(value.final) });
  for (const [count, probability] of [[1600, 0.9], [16000, 0]]) {
    const pcm = new Float32Array(count).fill(probability ? 0.1 : 0);
    ingest(pcm, 16000); classify({ probability, pcm });
  }
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(results, ['live']);
  await engine.stop();
  release();
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
});

test('successful append after failure uses original absolute sample offsets', async () => {
  const repo = mockRecordingRepository();
  const begin = repo.begin.bind(repo);
  const writes: number[] = [];
  const gaps: number[][] = [];
  repo.begin = async (value) => {
    const archive = await begin(value);
    let calls = 0;
    archive.append = async (pcm) => { if (++calls === 1) throw new Error('disk failure'); writes.push(pcm[0]); };
    archive.markArchiveGap = async (start, end) => { gaps.push([start, end]); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array([1, 1, 1]));
  await writer.append(new Float32Array([2, 2]));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(gaps, [[0, 3]]);
  assert.deepEqual(writes, [2]);
  await writer.finish();
});

test('drop followed by retained audio does not mark a false tail gap', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const gaps: number[][] = [];
  repo.begin = async (value) => {
    const archive = await begin(value);
    let offset = 0;
    archive.markArchiveGap = async (start, end) => { gaps.push([start, end]); offset = end; };
    archive.append = async (pcm) => { if (!offset) await gate; offset += pcm.length; };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(16000));
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
  await writer.append(new Float32Array(128000));
  await writer.append(new Float32Array(16000));
  await writer.finish();
  release();
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(gaps, [[16000, 144000]]);
});

test('late attempts remain writable after archive finish', async () => {
  const repo = mockRecordingRepository();
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  const pin = await writer.pin('speech-start', 0, 0);
  await writer.append(new Float32Array(1));
  await writer.finish();
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve));
  await writer.attempt({ id: 'late', segmentId: pin.id, startSample: 0, endSample: 1,
    engine: 'test', createdAt: new Date().toISOString(), status: 'success', text: 'ok' });
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await repo.list())[0].attempts[0]?.status, 'success');
});

test('old PCM is read from healthy archive after rolling window eviction', async () => {
  const repo = mockRecordingRepository();
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(16000).fill(0.5));
  for (let i = 0; i < 80; i++) {
    await writer.append(new Float32Array(16000));
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal((await writer.read(0, 1))[0], 0.5);
  await writer.finish();
});

test('archive read exceeding one second retains and returns old PCM', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: () => void = () => {}, started: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reading = new Promise<void>((resolve) => { started = resolve; });
  repo.begin = async (value) => {
    const archive = await begin(value), read = archive.read.bind(archive);
    archive.read = async (start, end) => { started(); await gate; return read(start, end); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(16000).fill(0.5));
  for (let i = 0; i < 80; i++) {
    await writer.append(new Float32Array(16000));
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  const pending = writer.read(0, 1);
  await reading;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  release();
  assert.equal((await pending)[0], 0.5);
  await writer.finish();
});

test('cancelled pending archive read never retries or delivers its late result', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: () => void = () => {}, started: () => void = () => {}, calls = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reading = new Promise<void>((resolve) => { started = resolve; });
  repo.begin = async (value) => {
    const archive = await begin(value), read = archive.read.bind(archive);
    archive.read = async (start, end) => { calls++; started(); await gate; return read(start, end); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(16000).fill(0.5));
  for (let i = 0; i < 80; i++) {
    await writer.append(new Float32Array(16000));
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  const controller = new AbortController();
  const pending = writer.read(0, 1, controller.signal);
  await reading;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  release();
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  await writer.finish();
});

test('resolved transient archive reads retry without concurrent operations', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let calls = 0;
  repo.begin = async (value) => {
    const archive = await begin(value), read = archive.read.bind(archive);
    archive.read = async (start, end) => { if (++calls < 3) throw new Error('temporary'); return read(start, end); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(16000).fill(0.5));
  for (let i = 0; i < 80; i++) {
    await writer.append(new Float32Array(16000));
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal((await writer.read(0, 1))[0], 0.5);
  assert.equal(calls, 3);
  await writer.finish();
});

test('dropped PCM is reconciled before pin metadata', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const gaps: number[][] = [], pins: number[] = [];
  repo.begin = async (value) => {
    const archive = await begin(value);
    let cursor = 0;
    archive.append = async (pcm) => { if (!cursor) await gate; cursor += pcm.length; };
    archive.markArchiveGap = async (start, end) => { gaps.push([start, end]); cursor = end; };
    archive.pin = async (kind, atSample, confirmedAtSample) => {
      assert.ok(confirmedAtSample <= cursor);
      pins.push(atSample);
      return { id: 'pin', kind, atSample, confirmedAtSample, delaySamples: 0 };
    };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(16000));
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
  await writer.append(new Float32Array(128000));
  await writer.pin('speech-start', 144000, 144000);
  await writer.append(new Float32Array(16000));
  release();
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(gaps, [[16000, 144000]]);
  assert.deepEqual(pins, [144000]);
  await writer.finish();
});

test('gap write rejection still finishes and releases the archive writer', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let finishCalls = 0, gapCalls = 0;
  repo.begin = async (value) => {
    const archive = await begin(value), finish = archive.finish.bind(archive);
    archive.append = async () => { throw new Error('write failed'); };
    archive.markArchiveGap = async () => { gapCalls++; throw new Error('gap failed'); };
    archive.finish = async (...args) => { finishCalls++; await finish(...args); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array(4));
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
  await writer.finish();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(gapCalls, 1);
  assert.equal(finishCalls, 1);
  assert.equal((await repo.list())[0].state, 'failed');
});

test('queued speech survives rolling-window eviction while archive is unavailable', { timeout: 10000 }, async (t) => {
  const repo = mockRecordingRepository();
  let releaseArchive: (value: any) => void = () => {};
  const gate = new Promise<any>((resolve) => { releaseArchive = resolve; });
  const begin = repo.begin.bind(repo);
  repo.begin = async () => gate;
  let ingest: any, classify: any, releaseFirst: (value: string) => void = () => {};
  let firstStarted: () => void = () => {}, delivered: () => void = () => {};
  const firstRequest = new Promise<void>((resolve) => { firstStarted = resolve; });
  const secondResult = new Promise<void>((resolve) => { delivered = resolve; });
  const results: string[] = [];
  let requests = 0, gaps = 0;
  const engine = new WhisperHttpRecognitionEngine({ recordings: repo,
    meter: { context: { sampleRate: 16000 }, source: {} }, voiceDetectionEngine: 'silero',
    voiceDetectionPreset: 'short', voiceDetectionMinimumSpeechMs: 50,
    vadAvailable: async () => true,
    vadFactory: (options) => { classify = options.onProbability; return { release() {} }; },
    vadCapture: async (_c, _s, _v, onPcm) => { ingest = onPcm; return { finish: async () => {}, release() {} }; },
  });
  t.after(async () => { releaseFirst('cleanup'); await engine.stop(); releaseArchive(await begin(input)); });
  engine.transcribePcm = async () => ++requests === 1
    ? new Promise<string>((resolve) => { releaseFirst = resolve; firstStarted(); }) : 'second';
  await engine.start({ onTranscriptionGap: () => gaps++, onResult: (result) => {
    results.push(result.final); if (results.length === 2) delivered();
  } });
  const frame = (seconds: number, p: number) => {
    const pcm = new Float32Array(seconds * 16000).fill(p ? 0.1 : 0);
    ingest(pcm, 16000); classify({ probability: p, pcm });
  };
  frame(0.1, 0.9); frame(1, 0);
  await firstRequest;
  frame(0.1, 0.9); frame(1, 0);
  for (let i = 0; i < 80; i++) {
    frame(1, 0);
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  releaseFirst('first');
  await secondResult;
  assert.deepEqual(results, ['first', 'second']);
  assert.equal(gaps, 0);
});

test('unavailable evicted audio surfaces a nonfatal transcription gap', { timeout: 10000 }, async (t) => {
  const repo = mockRecordingRepository();
  let release: (value: any) => void = () => {};
  const gate = new Promise<any>((resolve) => { release = resolve; });
  const begin = repo.begin.bind(repo);
  repo.begin = async () => gate;
  let ingest: any, classify: any, gaps = 0, errors = 0, releaseFirst: (value: string) => void = () => {};
  let gapObserved: () => void = () => {}, firstStarted: () => void = () => {};
  const gapEvent = new Promise<void>((resolve) => { gapObserved = resolve; });
  const firstRequest = new Promise<void>((resolve) => { firstStarted = resolve; });
  let requestCount = 0;
  const engine = new WhisperHttpRecognitionEngine({ recordings: repo,
    meter: { context: { sampleRate: 16000 }, source: {} }, voiceDetectionEngine: 'silero',
    voiceDetectionPreset: 'short', voiceDetectionMinimumSpeechMs: 50, maxUtteranceSeconds: 1,
    vadAvailable: async () => true,
    vadFactory: (options) => { classify = options.onProbability; return { release() {} }; },
    vadCapture: async (_c, _s, _v, onPcm) => { ingest = onPcm; return { finish: async () => {}, release() {} }; },
  });
  t.after(async () => { releaseFirst('cleanup'); await engine.stop(); });
  engine.transcribePcm = async () => ++requestCount === 1
    ? new Promise<string>((resolve) => { releaseFirst = resolve; firstStarted(); }) : 'later';
  let bufferWarnings = 0;
  await engine.start({ onTranscriptionGap: () => { gaps++; gapObserved(); }, onError: () => errors++, onTranscriptionBufferWarning: () => bufferWarnings++ });
  const frame = (seconds: number, p: number) => {
    const pcm = new Float32Array(seconds * 16000).fill(p ? 0.1 : 0);
    ingest(pcm, 16000); classify({ probability: p, pcm });
  };
  frame(0.1, 0.9); frame(1, 0);
  await firstRequest;
  assert.equal(requestCount, 1);
  frame(0.1, 0.9); frame(1, 0);
  for (let i = 0; i < 80; i++) {
    frame(1, 0);
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  // Force overflow of the bounded snapshot queue so at least one range uses
  // archive fallback after the rolling window has advanced.
  for (let i = 0; i < 70; i++) {
    frame(0.1, 0.9); frame(1, 0);
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  for (let i = 0; i < 80; i++) {
    frame(1, 0);
    for (let j = 0; j < 2; j++) await new Promise((resolve) => setImmediate(resolve));
  }
  releaseFirst('first');
  // Once the archive appears it has a real gap for the evicted speech.
  const archive = await begin(input);
  archive.markArchiveGap = async () => {};
  archive.append = async () => {};
  archive.pin = async (kind, atSample, confirmedAtSample) => ({ id: crypto.randomUUID(), kind, atSample, confirmedAtSample, delaySamples: confirmedAtSample - atSample });
  archive.attempt = async () => {};
  archive.read = async () => { throw Object.assign(new Error('gap'), { code: 'archive-gap' }); };
  release(archive);
  await gapEvent;
  assert.equal(gaps, 1);
  assert.equal(bufferWarnings, 1);
  assert.equal(errors, 0);
  await engine.stop();
});

test('cancelled storage retry cannot open a replacement writer', async () => {
  const repo = mockRecordingRepository();
  let calls = 0;
  repo.begin = async () => { calls++; throw Object.assign(new Error('temporary'), { code: 'storage-failed' }); };
  const controller = new AbortController();
  const writer = await beginResilientWriter(repo, input, controller.signal, () => true, () => {});
  controller.abort();
  await writer.finish('interrupted');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(calls, 1);
});
