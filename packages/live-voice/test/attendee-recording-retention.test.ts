// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingRepository } from '../src/modules/recording/repository.js';
import { createMemoryStore, removableGroup } from '../src/modules/recording/storage.js';
// Fake codecs exercise repository ownership/persistence boundaries, not Opus fidelity.
function fakeCodecs() {
  const keys = ['AudioEncoder', 'AudioDecoder', 'AudioData', 'EncodedAudioChunk'] as const;
  const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const counts = { encoded: 0, decoded: 0 };
  class Frame {
    sampleRate: number;
    numberOfFrames: number;
    timestamp: number;
    numberOfChannels = 1;
    data: Float32Array;
    constructor(options: any) {
      Object.assign(this, options);
      this.data = new Float32Array(options.data);
    }
    copyTo(output: Float32Array) {
      output.set(this.data);
    }
    close() {}
  }
  class Encoder {
    config: any;
    constructor(public options: any) {}
    static async isConfigSupported() {
      return { supported: true };
    }
    configure(config: any) {
      this.config = config;
    }
    encode(frame: Frame) {
      counts.encoded++;
      const bytes = new Uint8Array(frame.data.buffer);
      this.options.output(
        {
          type: 'key',
          timestamp: frame.timestamp,
          duration: (frame.numberOfFrames * 1e6) / frame.sampleRate,
          byteLength: bytes.length,
          copyTo: (out: Uint8Array) => out.set(bytes),
        },
        { decoderConfig: { codec: 'opus', sampleRate: frame.sampleRate, numberOfChannels: 1 } },
      );
    }
    async flush() {}
    close() {}
  }
  class Decoder {
    config: any;
    constructor(public options: any) {}
    static async isConfigSupported() {
      return { supported: true };
    }
    configure(config: any) {
      this.config = config;
    }
    decode(chunk: any) {
      counts.decoded++;
      this.options.output(
        new Frame({
          sampleRate: this.config.sampleRate,
          numberOfFrames: chunk.data.length / 4,
          timestamp: chunk.timestamp,
          data: new Float32Array(
            chunk.data.buffer.slice(
              chunk.data.byteOffset,
              chunk.data.byteOffset + chunk.data.byteLength,
            ),
          ),
        }),
      );
    }
    async flush() {}
    close() {}
  }
  class Chunk {
    constructor(options: any) {
      Object.assign(this, options);
    }
  }
  [Encoder, Decoder, Frame, Chunk].forEach((value, i) =>
    Object.defineProperty(globalThis, keys[i], { value, configurable: true }),
  );
  return {
    counts,
    restore: () =>
      keys.forEach((key, i) => {
        if (descriptors[i]) Object.defineProperty(globalThis, key, descriptors[i]!);
        else delete (globalThis as any)[key];
      }),
  };
}
function input(groupId, person = 'a', keep = 1, enabled = false) {
  return {
    sourceId: groupId ? 'arbitrary/source:with:colons/' + person : person,
    kind: person === 'microphone' ? 'microphone' : 'shared',
    label: 'Person ' + person,
    ...(groupId
      ? {
          participant: {
            provider: 'attendee',
            groupId,
            participantId: person,
            originalName: 'Original ' + person,
          },
        }
      : {}),
    sampleRate: 16000,
    policy: { enabled, keepPrevious: keep, bitrate: 24000, preRollMs: 100, postRollMs: 100 },
  };
}
async function capture(repo, groupId, person = 'a', keep = 1, enabled = false) {
  const w = await repo.begin(input(groupId, person, keep, enabled));
  await w.append(new Float32Array(128).fill(0.25));
  await w.finish();
  return w;
}
const groups = async (repo) => (await repo.list()).map((s) => s.participant?.groupId || s.sourceId);
function fixtures() {
  const codecs = fakeCodecs(),
    repo = createRecordingRepository();
  return {
    repo,
    async dispose() {
      await repo.dispose();
      codecs.restore();
    },
  };
}
test('N=1 retains every participant and burst in a group, then evicts the whole older group', async () => {
  const f = fixtures();
  try {
    for (const person of ['a', 'b', 'a', 'c']) await capture(f.repo, 'A', person);
    assert.deepEqual(await groups(f.repo), ['A', 'A', 'A', 'A']);
    const b = await f.repo.begin(input('B'));
    assert.equal((await f.repo.list()).length, 5);
    await b.finish();
    assert.deepEqual(await groups(f.repo), ['B']);
    // Quiet A was not pinned by remote call lifecycle. Resuming creates new history, not a backup restore.
    await capture(f.repo, 'A', 'resumed');
    const resumed = await f.repo.list();
    assert.equal(resumed.length, 1);
    assert.equal(resumed[0].participant.participantId, 'resumed');
  } finally {
    await f.dispose();
  }
});
test('N=2 applies globally across bot IDs; microphone/shared legacy remain independently retained', async () => {
  const f = fixtures();
  try {
    const mic = await capture(f.repo, null, 'microphone', 2),
      shared = await capture(f.repo, null, 'shared', 2);
    for (const group of ['A', 'B', 'C']) {
      await capture(f.repo, group, 'a', 2);
      await capture(f.repo, group, 'b', 2);
    }
    const list = await f.repo.list();
    assert.deepEqual(
      new Set(list.filter((s) => s.participant).map((s) => s.participant.groupId)),
      new Set(['B', 'C']),
    );
    assert.ok(list.some((s) => s.id === mic.session.id));
    assert.ok(list.some((s) => s.id === shared.session.id));
    const legacy = await f.repo.begin({
      ...input(null, 'attendee:old:uuid', 1),
      participant: undefined,
    });
    await legacy.finish();
    assert.equal((await f.repo.get(legacy.session.id)).participant, undefined);
  } finally {
    await f.dispose();
  }
});
test('one starred, active or pending member protects every sibling and does not consume ordinary slots', async () => {
  const f = fixtures();
  try {
    const a = await capture(f.repo, 'A', 'a');
    await capture(f.repo, 'A', 'b');
    await f.repo.setStarred(a.session.id, true);
    await capture(f.repo, 'B');
    await capture(f.repo, 'C');
    assert.deepEqual(new Set(await groups(f.repo)), new Set(['A', 'C']));
    assert.equal((await f.repo.list()).filter((s) => s.participant.groupId === 'A').length, 2);
    await f.repo.setStarred(a.session.id, false);
    assert.deepEqual(await groups(f.repo), ['C']);
    const active = await f.repo.begin(input('D', 'active'));
    await capture(f.repo, 'D', 'sibling');
    await capture(f.repo, 'E');
    assert.ok((await groups(f.repo)).includes('D'));
    await active.append(new Float32Array(1));
    const attempt = {
      id: 'pending',
      segmentId: 'speech',
      startSample: 0,
      endSample: 1,
      engine: 'test',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    await active.attempt(attempt);
    await active.finish();
    await capture(f.repo, 'F');
    assert.equal((await f.repo.list()).filter((s) => s.participant.groupId === 'D').length, 2);
    await active.attempt({ ...attempt, status: 'success' });
    assert.deepEqual(await groups(f.repo), ['F']);
  } finally {
    await f.dispose();
  }
});
function stored(id, groupId, extra = {}) {
  return {
    id,
    participant: { provider: 'attendee', groupId, participantId: id, originalName: id },
    kind: 'shared',
    sourceId: id,
    label: id,
    startedAt: new Date().toISOString(),
    state: 'completed',
    sampleRate: 16000,
    capturedSamples: 1,
    savedSamples: 1,
    persistent: false,
    codec: 'opus',
    pins: [],
    attempts: [],
    keepPrevious: 1,
    ...extra,
  };
}
test('conditional group removal rejects changed membership or any new protection without deleting a sibling', async () => {
  const store = createMemoryStore();
  await store.create(stored('a', 'A'));
  await store.create(stored('b', 'A'));
  assert.equal(await store.removeGroup('A', ['a']), false);
  await store.update('b', (s) => ({ ...s, starred: true }));
  assert.equal(await store.removeGroup('A', ['a', 'b']), false);
  assert.equal((await store.list()).length, 2);
  await store.update('b', (s) => ({ ...s, starred: false }));
  assert.equal(removableGroup(await store.list(), 'A', ['a', 'a']), false);
  assert.equal(await store.removeGroup('A', ['a', 'b']), true);
  assert.deepEqual(await store.list(), []);
  store.close();
});
function locksFixture() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const idb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const held = new Set(),
    calls = [];
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        async request(name, options, run) {
          calls.push({ name, options });
          if (held.has(name)) return run(null);
          held.add(name);
          try {
            return await run({ name });
          } finally {
            held.delete(name);
          }
        },
      },
    },
  });
  return {
    held,
    calls,
    restore() {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else delete globalThis.navigator;
      if (idb) Object.defineProperty(globalThis, 'indexedDB', idb);
      else delete globalThis.indexedDB;
    },
  };
}
test('persisted-store surrogate reopens captured metadata, recovers interrupted sessions, and skips locked groups whole', async () => {
  const codecs = fakeCodecs(),
    locks = locksFixture(),
    store = createMemoryStore();
  const open = async () => ({ ...store, close() {} });
  let repo = createRecordingRepository(open);
  try {
    const a = await capture(repo, 'A', 'a', 1, true);
    await capture(repo, 'A', 'b', 1, true);
    // Simulate another tab holding a recording lock after this instance closes its writer.
    locks.held.add('dsh-live-voice.recording.' + a.session.id);
    await capture(repo, 'B', 'a', 1, true);
    assert.equal((await store.list()).filter((s) => s.participant.groupId === 'A').length, 2);
    locks.held.clear();
    await repo.dispose();
    await store.update(a.session.id, (s) => ({ ...s, state: 'recording' }));
    repo = createRecordingRepository(open);
    const saved = await repo.get(a.session.id);
    assert.equal(saved.state, 'interrupted');
    assert.equal(saved.participant.groupId, 'A');
    assert.equal(saved.participant.participantId, 'a');
    const exported = JSON.parse(await (await repo.export(a.session.id)).text());
    assert.deepEqual(exported.recording.participant, saved.participant);
    await capture(repo, 'C', 'a', 1, true);
    assert.equal(
      (await store.list()).some((s) => s.participant.groupId === 'A'),
      false,
    );
    assert.ok(
      locks.calls.some(
        (c) => c.name.startsWith('dsh-live-voice.recording-group:') && !c.options.ifAvailable,
      ),
    );
  } finally {
    await repo.dispose();
    store.close();
    locks.restore();
    codecs.restore();
  }
});
test('membership changes, group locks, and failed commits never delete only part of a meeting', async () => {
  const codecs = fakeCodecs(),
    locks = locksFixture(),
    store = createMemoryStore();
  let mode = 'normal';
  const open = async () => ({
    ...store,
    close() {},
    async removeGroup(id, expected) {
      if (id === 'A' && mode === 'change') {
        await store.create(stored('late-member', 'A'));
        mode = 'normal';
      }
      if (id === 'A' && mode === 'abort') throw Error('synthetic atomic commit abort');
      return store.removeGroup(id, expected);
    },
  });
  const repo = createRecordingRepository(open);
  try {
    await capture(repo, 'A', 'a', 1, true);
    await capture(repo, 'A', 'b', 1, true);
    locks.held.add('dsh-live-voice.recording-group:' + JSON.stringify(['attendee', 'A']));
    await capture(repo, 'B', 'a', 1, true);
    assert.equal((await store.list()).filter((s) => s.participant.groupId === 'A').length, 2);
    locks.held.clear();
    mode = 'change';
    const c = await repo.begin(input('C', 'a', 1, true));
    // A new member invalidates the expected membership; deletion must skip all A members.
    assert.equal((await store.list()).filter((s) => s.participant.groupId === 'A').length, 3);
    mode = 'abort';
    await assert.rejects(c.finish(), /synthetic atomic commit abort/);
    assert.equal((await store.list()).filter((s) => s.participant.groupId === 'A').length, 3);
    mode = 'normal';
    await capture(repo, 'D', 'a', 1, true);
    assert.equal(
      (await store.list()).some((s) => s.participant.groupId === 'A'),
      false,
    );
  } finally {
    mode = 'normal';
    await repo.dispose();
    store.close();
    locks.restore();
    codecs.restore();
  }
});
test('whole-group deletion removes its payload pages but leaves unrelated pages intact', async () => {
  const store = createMemoryStore();
  const page = (recordingId) => ({
    recordingId,
    index: 0,
    startSample: 0,
    sampleCount: 1,
    sampleRate: 16000,
    decoderConfig: { codec: 'opus', sampleRate: 16000, numberOfChannels: 1 },
    packets: [{ type: 'key', timestamp: 0, duration: 1, data: Uint8Array.of(1, 2, 3) }],
  });
  for (const id of ['a', 'b', 'other']) {
    await store.create(stored(id, id === 'other' ? 'B' : 'A'));
    await store.update(id, (s) => s, page(id));
  }
  assert.ok((await store.audioBytes('a')) > 0);
  assert.equal(await store.removeGroup('A', ['a', 'b']), true);
  assert.equal(await store.audioBytes('a'), 0);
  assert.equal(await store.audioBytes('b'), 0);
  assert.ok((await store.audioBytes('other')) > 0);
  store.close();
});
test('legacy capture mutations do not unexpectedly shrink the Attendee group pool', async () => {
  const f = fixtures();
  try {
    await capture(f.repo, 'A', 'a', 2);
    await capture(f.repo, 'B', 'b', 2);
    await capture(f.repo, null, 'microphone', 1);
    await capture(f.repo, null, 'shared', 1);
    assert.deepEqual(
      new Set((await f.repo.list()).filter((s) => s.participant).map((s) => s.participant.groupId)),
      new Set(['A', 'B']),
    );
  } finally {
    await f.dispose();
  }
});
