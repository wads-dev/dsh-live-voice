import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIVE_RETRY_PROBE_MS, beginResilientWriter } from '../src/modules/recording/resilientWriter.js';
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
  const gaps: number[][] = [];
  repo.begin = async (value) => {
    const writer = await begin(value);
    writer.append = async () => { throw new Error('storage failure'); };
    writer.markArchiveGap = async (start, end) => { gaps.push([start, end]); };
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
  assert.deepEqual(gaps, [[0, 1600], [1600, 17600]]);
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

test('periodic archive probes recover after initial retry budget with initial gap', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let calls = 0, active = 0, peak = 0, archiveInput: any;
  const gaps: number[][] = [], writes: number[] = [];
  repo.begin = async (value) => {
    calls++; active++; peak = Math.max(peak, active);
    try {
      if (calls <= 4) throw Object.assign(new Error('temporary'), { code: 'storage-failed' });
      archiveInput = value;
      const archive = await begin(value);
      archive.markArchiveGap = async (start, end) => { gaps.push([start, end]); };
      archive.append = async (pcm) => { writes.push(pcm.length); };
      return archive;
    } finally { active--; }
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  const originalStart = writer.session.startedAt;
  await writer.append(new Float32Array(16000 * 10));
  for (const ms of [250, 500, 1000]) {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    t.mock.timers.tick(ms);
  }
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(calls, 4);
  t.mock.timers.tick(ARCHIVE_RETRY_PROBE_MS - 1);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(calls, 4);
  t.mock.timers.tick(1);
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(calls, 5);
  assert.equal(peak, 1);
  assert.equal(archiveInput.startedAt, originalStart);
  assert.equal(writer.session.startedAt, originalStart);
  assert.deepEqual(gaps, [[0, 32000]]);
  assert.deepEqual(writes, [128000]);
  await writer.finish();
});

test('late third-party begin cannot change the capture clock', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: (value: any) => void = () => {}, warnings = 0;
  const gate = new Promise<any>((resolve) => { release = resolve; });
  repo.begin = async () => gate;
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => warnings++);
  const start = writer.session.startedAt;
  await writer.append(new Float32Array([0.5]));
  t.mock.timers.tick(5000);
  const legacy = await begin({ ...input, startedAt: undefined });
  assert.notEqual(legacy.session.startedAt, start);
  release(legacy);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(writer.session.startedAt, start);
  assert.equal(warnings, 1);
  await writer.finish();
});

test('finish or cancellation stops periodic probes immediately', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const stop of ['finish', 'abort']) {
    const repo = mockRecordingRepository();
    let calls = 0;
    repo.begin = async () => { calls++; throw Object.assign(new Error('temporary'), { code: 'storage-failed' }); };
    const controller = new AbortController();
    const writer = await beginResilientWriter(repo, input, controller.signal, () => true, () => {});
    for (const ms of [250, 500, 1000]) {
      for (let i = 0; i < 8; i++) await Promise.resolve();
      t.mock.timers.tick(ms);
    }
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(calls, 4);
    if (stop === 'abort') controller.abort(); else await writer.finish();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    t.mock.timers.tick(ARCHIVE_RETRY_PROBE_MS * 2);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(calls, stop === 'abort' ? 4 : 5);
  }
});

test('permanent archive failure is not retried periodically', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const repo = mockRecordingRepository();
  let calls = 0;
  repo.begin = async () => { calls++; throw Object.assign(new Error('unsupported'), { code: 'codec-unsupported' }); };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  for (let i = 0; i < 8; i++) await Promise.resolve();
  t.mock.timers.tick(ARCHIVE_RETRY_PROBE_MS * 2);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(calls, 1);
  await writer.finish();
});

test('normal finish during pending begin retries once after settled rejection', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let rejectFirst: (reason: unknown) => void = () => {}, calls = 0, active = 0, peak = 0;
  let finished: () => void = () => {};
  const done = new Promise<void>((resolve) => { finished = resolve; });
  const pending = new Promise<any>((_resolve, reject) => { rejectFirst = reject; });
  repo.begin = async (value) => {
    calls++; active++; peak = Math.max(active, peak);
    try {
      if (calls === 1) return await pending;
      const archive = await begin(value), finish = archive.finish.bind(archive);
      archive.finish = async (...args) => { await finish(...args); finished(); };
      return archive;
    } finally { active--; }
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array([0.5]));
  await writer.finish();
  assert.equal(calls, 1);
  rejectFirst(Object.assign(new Error('temporary'), { code: 'storage-failed' }));
  await done;
  assert.equal(calls, 2);
  assert.equal(peak, 1);
  assert.equal((await repo.list())[0].capturedSamples, 1);
});

test('abort during pending begin never starts replacement or writes late writer', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: (value: any) => void = () => {}, calls = 0, writes = 0, finishes = 0;
  const pending = new Promise<any>((resolve) => { release = resolve; });
  repo.begin = async () => { calls++; return pending; };
  const controller = new AbortController();
  const writer = await beginResilientWriter(repo, input, controller.signal, () => true, () => {});
  await writer.append(new Float32Array([0.5]));
  controller.abort();
  const archive = await begin(input), finish = archive.finish.bind(archive);
  archive.append = async () => { writes++; };
  archive.markArchiveGap = async () => { writes++; };
  archive.finish = async (...args) => { finishes++; await finish(...args); };
  release(archive);
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(writes, 0);
  assert.equal(finishes, 1);
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

test('abort drains capture boundary before archive finish without accepting later PCM', { timeout: 10000 }, async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let ingest: any, drainStarted: () => void = () => {}, releaseDrain: () => void = () => {}, archiveFinished: () => void = () => {};
  const started = new Promise<void>((resolve) => { drainStarted = resolve; });
  const drain = new Promise<void>((resolve) => { releaseDrain = resolve; });
  const ended = new Promise<void>((resolve) => { archiveFinished = resolve; });
  let boundary: any, finishCalls = 0, appendsAfterAbort = 0, gapCalls = 0;
  const controller = new AbortController();
  repo.begin = async (value) => {
    const archive = await begin(value), append = archive.append.bind(archive), finish = archive.finish.bind(archive);
    archive.append = async (pcm) => { if (controller.signal.aborted) appendsAfterAbort++; await append(pcm); };
    archive.markArchiveGap = async () => { gapCalls++; };
    archive.finish = async (state, error, metadata) => { boundary = metadata; finishCalls++; await finish(state, error); archiveFinished(); };
    return archive;
  };
  const engine = new WhisperHttpRecognitionEngine({ recordings: repo,
    meter: { context: { sampleRate: 16000 }, source: {} }, voiceDetectionEngine: 'silero',
    vadAvailable: async () => true,
    vadFactory: () => ({ release() {} }),
    vadCapture: async (_c, _s, _v, onPcm) => {
      ingest = onPcm;
      return { finish: async () => { drainStarted(); await drain; onPcm(new Float32Array(3).fill(0.5), 16000); }, release() {} };
    },
  });
  await engine.start({ signal: controller.signal });
  ingest(new Float32Array(2), 16000);
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await started;
  // This callback races the abort but is not delivered by capture.finish.
  // The capture owns the drain window, so the producer must not send new input after stopping.
  assert.equal(finishCalls, 0);
  releaseDrain();
  await ended;
  assert.equal(boundary.atSample, 5);
  assert.equal(boundary.markMissingTail, true);
  assert.equal(finishCalls, 1);
  assert.equal(appendsAfterAbort, 0);
  assert.equal(gapCalls, 0);
  ingest(new Float32Array(10), 16000);
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(boundary.atSample, 5);
  await engine.stop();
});

test('abort drain yields to timers with queued audio and pending append', { timeout: 10000 }, async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let releaseAppend: () => void = () => {}, appendStarted: () => void = () => {}, releaseCapture: () => void = () => {};
  let captureStarted: () => void = () => {}, archiveFinished: () => void = () => {};
  const appendGate = new Promise<void>((resolve) => { releaseAppend = resolve; });
  const started = new Promise<void>((resolve) => { appendStarted = resolve; });
  const captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
  const draining = new Promise<void>((resolve) => { captureStarted = resolve; });
  const finished = new Promise<void>((resolve) => { archiveFinished = resolve; });
  let ingest: any, appendCalls = 0, finishCalls = 0;
  repo.begin = async (value) => {
    const archive = await begin(value), finish = archive.finish.bind(archive);
    archive.append = async () => { appendCalls++; appendStarted(); await appendGate; };
    archive.finish = async (...args) => { finishCalls++; await finish(...args); archiveFinished(); };
    return archive;
  };
  const controller = new AbortController();
  const engine = new WhisperHttpRecognitionEngine({ recordings: repo,
    meter: { context: { sampleRate: 16000 }, source: {} }, voiceDetectionEngine: 'silero',
    vadAvailable: async () => true, vadFactory: () => ({ release() {} }),
    vadCapture: async (_c, _s, _v, onPcm) => {
      ingest = onPcm;
      return { finish: async () => { captureStarted(); await captureGate; onPcm(new Float32Array(2), 16000); }, release() {} };
    },
  });
  await engine.start({ signal: controller.signal });
  ingest(new Float32Array(2), 16000);
  await started;
  ingest(new Float32Array(2), 16000);
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await draining;
  releaseAppend();
  // A macrotask must run while capture.finish is still awaiting its drain.
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(appendCalls, 1);
  assert.equal(finishCalls, 0);
  releaseCapture();
  await finished;
  assert.equal(appendCalls, 1);
  assert.equal(finishCalls, 1);
  await engine.stop();
});

test('abort during archive gap backoff does not resume queued audio', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let appendCalls = 0, gapCalls = 0, finishes = 0;
  repo.begin = async (value) => {
    const archive = await begin(value);
    archive.append = async () => { appendCalls++; throw Object.assign(new Error('quota'), { code: 'quota-exceeded' }); };
    archive.markArchiveGap = async () => { gapCalls++; };
    archive.finish = async () => { finishes++; };
    return archive;
  };
  const controller = new AbortController();
  const writer = await beginResilientWriter(repo, input, controller.signal, () => true, () => {});
  await writer.append(new Float32Array([1]));
  await writer.append(new Float32Array([2]));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(appendCalls, 1);
  controller.abort();
  for (let i = 0; i < 30; i++) await Promise.resolve();
  t.mock.timers.tick(ARCHIVE_RETRY_PROBE_MS);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(appendCalls, 1);
  assert.equal(gapCalls, 0);
  assert.equal(finishes, 1);
});

for (const kind of ['audio', 'pin'] as const) test('abort while gap is pending never starts ' + kind, { timeout: 10000 }, async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let releaseGap: () => void = () => {}, gapStarted: () => void = () => {}, finishDone: () => void = () => {};
  const gate = new Promise<void>((resolve) => { releaseGap = resolve; });
  const started = new Promise<void>((resolve) => { gapStarted = resolve; });
  const done = new Promise<void>((resolve) => { finishDone = resolve; });
  let appends = 0, pins = 0, gaps = 0, finishes = 0;
  repo.begin = async (value) => {
    const archive = await begin(value);
    archive.append = async () => { appends++; throw Object.assign(new Error('quota'), { code: 'quota-exceeded' }); };
    archive.markArchiveGap = async () => { gaps++; gapStarted(); await gate; };
    archive.pin = async (pinKind, atSample, confirmedAtSample) => {
      pins++;
      return { id: 'p', kind: pinKind, atSample, confirmedAtSample, delaySamples: 0 };
    };
    archive.finish = async () => { finishes++; finishDone(); };
    return archive;
  };
  const controller = new AbortController();
  const writer = await beginResilientWriter(repo, input, controller.signal, () => true, () => {});
  await writer.append(new Float32Array([1]));
  if (kind === 'audio') await writer.append(new Float32Array([2]));
  else await writer.pin('speech-start', 1, 1);
  await started;
  controller.abort();
  releaseGap();
  await done;
  assert.equal(appends, 1);
  assert.equal(pins, 0);
  assert.equal(gaps, 1);
  assert.equal(finishes, 1);
});

test('stop during gap backoff gives retained PCM one final archive attempt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let appendCalls = 0, gapCalls = 0, finished = '', finishDone: () => void = () => {};
  const done = new Promise<void>((resolve) => { finishDone = resolve; });
  const writes: number[] = [], gaps: number[][] = [];
  repo.begin = async (value) => {
    const archive = await begin(value);
    archive.append = async (pcm) => {
      if (++appendCalls === 1) throw Object.assign(new Error('quota'), { code: 'quota-exceeded' });
      writes.push(pcm[0]);
    };
    archive.markArchiveGap = async (start, end) => {
      if (++gapCalls === 1) throw Object.assign(new Error('quota'), { code: 'quota-exceeded' });
      gaps.push([start, end]);
    };
    archive.finish = async (state) => { finished = state ?? ''; finishDone(); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array([1, 1, 1]));
  await writer.append(new Float32Array([2, 2]));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  t.mock.timers.tick(250);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(gapCalls, 1);
  await writer.finish();
  await done;
  assert.equal(appendCalls, 2);
  assert.deepEqual(gaps, [[0, 3]]);
  assert.deepEqual(writes, [2]);
  assert.equal(finished, 'failed');
});

test('stop during begin backoff makes one final bounded open attempt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let calls = 0, finishDone: () => void = () => {};
  const done = new Promise<void>((resolve) => { finishDone = resolve; });
  repo.begin = async (value) => {
    if (++calls === 1) throw Object.assign(new Error('quota'), { code: 'quota-exceeded' });
    const archive = await begin(value), finish = archive.finish.bind(archive);
    archive.finish = async (...args) => { await finish(...args); finishDone(); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array([0.5]));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await writer.finish();
  await done;
  assert.equal(calls, 2);
  assert.equal((await repo.list())[0].capturedSamples, 1);
});

test('gap outage beyond retry burst resumes without replaying failed PCM', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let appendCalls = 0, gapCalls = 0, active = 0, peak = 0, finished = '';
  const gaps: number[][] = [], writes: number[] = [];
  repo.begin = async (value) => {
    const archive = await begin(value);
    archive.append = async (pcm) => {
      active++; peak = Math.max(peak, active);
      try { if (++appendCalls === 1) throw Object.assign(new Error('quota'), { code: 'quota-exceeded' }); writes.push(pcm[0]); }
      finally { active--; }
    };
    archive.markArchiveGap = async (start, end) => {
      active++; peak = Math.max(peak, active);
      try { if (++gapCalls <= 4) throw Object.assign(new Error('quota'), { code: 'quota-exceeded' }); gaps.push([start, end]); }
      finally { active--; }
    };
    archive.finish = async (state) => { finished = state ?? ''; };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {});
  await writer.append(new Float32Array([1, 1, 1]));
  await writer.append(new Float32Array([2, 2]));
  for (const ms of [250, 500, 1000, ARCHIVE_RETRY_PROBE_MS]) {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    t.mock.timers.tick(ms);
  }
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(gapCalls, 4);
  t.mock.timers.tick(ARCHIVE_RETRY_PROBE_MS);
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(gapCalls, 5);
  assert.equal(appendCalls, 2);
  assert.equal(peak, 1);
  assert.deepEqual(gaps, [[0, 3]]);
  assert.deepEqual(writes, [2]);
  await writer.finish();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(finished, 'failed');
});

test('metadata write failure warns and makes finished archive incomplete', async () => {
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let warnings = 0, finished = '', finishDone: () => void = () => {};
  const done = new Promise<void>((resolve) => { finishDone = resolve; });
  repo.begin = async (value) => {
    const archive = await begin(value);
    archive.pin = async () => { throw Object.assign(new Error('metadata failed'), { code: 'storage-failed' }); };
    archive.finish = async (state) => { finished = state ?? ''; finishDone(); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => warnings++);
  await writer.pin('silence-start', 0, 0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await writer.finish();
  await done;
  assert.equal(warnings, 1);
  assert.equal(finished, 'failed');
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

test('backlogged and post-finish events retain occurrence time and sample boundary', { timeout: 10000 }, async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  const repo = mockRecordingRepository(), begin = repo.begin.bind(repo);
  let release: () => void = () => {}, start: () => void = () => {}, ended: () => void = () => {}, lateDone: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const pending = new Promise<void>((resolve) => { start = resolve; });
  const finished = new Promise<void>((resolve) => { ended = resolve; });
  const late = new Promise<void>((resolve) => { lateDone = resolve; });
  const events: any[] = [];
  let end: any, calls = 0;
  repo.begin = async (value) => {
    const archive = await begin(value);
    archive.append = async () => { if (++calls === 1) { start(); await gate; } };
    archive.recordEvent = async (event) => { events.push(event); if (events.length === 2) lateDone(); };
    archive.finish = async (_state, _error, metadata) => { end = metadata; ended(); };
    return archive;
  };
  const writer = await beginResilientWriter(repo, input, undefined, () => true, () => {}) as any;
  await writer.append(new Float32Array(3));
  await pending;
  t.mock.timers.tick(1000);
  await writer.timeline('assistant-start');
  await writer.append(new Float32Array(2));
  t.mock.timers.tick(1000);
  await writer.finish();
  t.mock.timers.tick(5000);
  release();
  await finished;
  assert.deepEqual(end, { occurredAt: new Date(102000).toISOString(), atSample: 5 });
  assert.equal(events[0].occurredAt, new Date(101000).toISOString());
  assert.equal(events[0].atSample, 3);
  t.mock.timers.tick(1000);
  await writer.timeline('assistant-end');
  await late;
  assert.equal(events[1].occurredAt, new Date(108000).toISOString());
  assert.equal(events[1].atSample, 5);
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
