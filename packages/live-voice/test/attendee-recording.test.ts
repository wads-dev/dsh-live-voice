// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingRepository } from '../src/modules/recording/repository.js';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.js';
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
const identity = (participantId = 'device/one:with:colon') => ({
  provider: 'attendee',
  groupId: 'bot_Test',
  participantId,
  originalName: 'Original person',
});
const input = (participant = identity()) => ({
  sourceId: 'do:not:parse/source',
  kind: 'shared',
  label: participant?.alias || participant?.originalName || 'Legacy',
  participant,
  sampleRate: 16000,
  policy: { enabled: false, keepPrevious: 100, bitrate: 24000, preRollMs: 100, postRollMs: 100 },
});
const tick = () => new Promise((r) => setImmediate(r));
test('participant metadata is validated, cloned at begin and preserved through ranges and v1 export', async () => {
  const codecs = fakeCodecs(),
    repo = createRecordingRepository();
  try {
    const participant = { ...identity(), alias: 'Display alias' };
    const pending = repo.begin(input(participant));
    participant.originalName = 'Mutated caller';
    const writer = await pending;
    const id = writer.session.id;
    await writer.append(new Float32Array(1024).fill(0.25));
    await writer.pin('speech-start', 0, 0);
    await writer.pin('silence-start', 512, 512);
    await writer.finish();
    const saved = await repo.get(id);
    assert.equal(saved.label, 'Display alias');
    assert.deepEqual(saved.participant, { ...identity(), alias: 'Display alias' });
    saved.participant.originalName = 'Mutated consumer';
    assert.equal((await repo.get(id)).participant.originalName, 'Original person');
    const archive = JSON.parse(await (await repo.export(id)).text());
    assert.equal(archive.version, 1);
    assert.deepEqual(archive.recording.participant, { ...identity(), alias: 'Display alias' });
    assert.equal(archive.recording.sourceId, 'do:not:parse/source');
    assert.deepEqual(
      repo.segments(archive.recording).map((s) => [s.startSample, s.endSample]),
      [
        [0, 512],
        [512, 1024],
      ],
    );
    const reopened = JSON.parse(JSON.stringify(archive.recording));
    reopened.state = 'interrupted';
    assert.deepEqual(reopened.participant, { ...identity(), alias: 'Display alias' });
    const legacy = await repo.begin({ ...input(), participant: undefined });
    await legacy.finish();
    assert.equal(legacy.session.participant, undefined);
    for (const invalid of [
      null,
      {},
      { ...identity(), provider: 'other' },
      { ...identity(), groupId: '' },
      { ...identity(), participantId: 'x'.repeat(257) },
      { ...identity(), originalName: 'x'.repeat(81) },
      { ...identity(), alias: '' },
      { ...identity(), extra: 'not public metadata' },
      { ...identity(), originalName: 'bad' + String.fromCharCode(10) + 'name' },
    ]) {
      await assert.rejects(repo.begin(input(invalid)), { code: 'invalid-range' });
    }
  } finally {
    await repo.dispose();
    codecs.restore();
  }
});
test('three UUID recordings remain distinct with duplicate names and capture-start alias snapshots', async () => {
  const codecs = fakeCodecs(),
    repo = createRecordingRepository(),
    labels = new Map();
  const meeting = {
    transcript: { setLabel: (id, name) => labels.set(id, name), forget() {} },
    states: {},
    getSnapshot() {
      return this.states;
    },
    async start(source, _options, { meter, engine }) {
      await meter.start();
      this.states[source] = { listening: true };
      await engine.start({
        onError(e) {
          throw e;
        },
      });
    },
    async removeParticipant(source) {
      delete this.states[source];
    },
  };
  const client = new AttendeeClient(
    meeting,
    (source, meter, name) =>
      new WhisperHttpRecognitionEngine({
        meter,
        recordings: repo,
        recordingEnabled: false,
        recordingKeepPrevious: 100,
        inputSource: 'shared',
        sourceId: source,
        sourceLabel: name,
        vadAvailable: async () => true,
        vadFactory: () => ({
          ingest() {},
          flush: async () => {},
          release() {},
          process: async () => {},
        }),
        globals: {
          fetch: async () => Response.json({ ok: true, value: { text: 'synthetic phrase' } }),
        },
      }),
    (k) => k,
  );
  const event = (participantId, name = 'Same original') => ({
    botId: 'bot_Test',
    participantId,
    name,
    sampleRate: 16000,
    timestamp: Date.now(),
    chunk: Buffer.from(new Int16Array(128).fill(8192).buffer).toString('base64'),
  });
  try {
    const a = 'attendee:bot_Test:device/a:uuid',
      b = 'attendee:bot_Test:device/b',
      c = 'attendee:bot_Test:device/c';
    client.discovered.set(a, { originalName: 'Same original' });
    client.rename(a, 'Alias at begin');
    for (const id of ['device/a:uuid', 'device/b', 'device/c'])
      await client.audio(event(id), client.generation);
    await tick();
    const rows = [...client.rows.values()];
    const ids = rows.map((r) => r.engine.session.writer.session.id);
    assert.equal(new Set(ids).size, 3);
    assert.deepEqual(
      rows.map((r) => r.engine.session.writer.session.participant.participantId),
      ['device/a:uuid', 'device/b', 'device/c'],
    );
    const first = client.rows.get(a);
    const initial = first.engine.session.writer.session;
    assert.equal(initial.label, 'Alias at begin');
    assert.equal(initial.participant.alias, 'Alias at begin');
    client.rename(a, 'Future alias');
    assert.equal(first.engine.session.writer.session.label, 'Alias at begin');
    assert.equal(first.engine.session.writer.session.participant.alias, 'Alias at begin');
    assert.equal(first.engine.sourceLabel, 'Future alias');
    await first.engine.finish();
    first.finished = true;
    await client.audio(event('device/a:uuid', 'Refreshed original'), client.generation);
    await tick();
    const next = first.engine.session.writer.session;
    assert.notEqual(next.id, initial.id);
    assert.equal(next.label, 'Future alias');
    assert.deepEqual(next.participant, {
      provider: 'attendee',
      groupId: 'bot_Test',
      participantId: 'device/a:uuid',
      originalName: 'Refreshed original',
      alias: 'Future alias',
    });
    client.rename(a, '');
    await first.engine.finish();
    first.finished = true;
    client.syncParticipant(first, 'API refreshed original');
    await client.audio(event('device/a:uuid', ''), client.generation);
    assert.equal(first.engine.session.writer.session.label, 'API refreshed original');
    assert.equal(first.engine.session.writer.session.participant.alias, undefined);
    assert.equal((await repo.get(initial.id)).label, 'Alias at begin');
    assert.equal(labels.get(b), 'Same original');
    assert.equal(labels.get(c), 'Same original');
  } finally {
    for (const row of client.rows.values()) await row.engine.stop();
    await client.stop();
    await repo.dispose();
    codecs.restore();
  }
});
