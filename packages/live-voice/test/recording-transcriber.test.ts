import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingTranscriber } from '../src/modules/recognition/recordingTranscriber.js';

test('archive HTTP retry snapshots settings, sends all PCM at 16k, and preserves cancellation/context', async () => {
  const settings = {
    recognitionEngine: 'qwen-http',
    recognitionLang: 'pt-BR',
    recognitionContext: 'Vocabulary',
  };
  const controller = new AbortController();
  let request: any;
  const metadata: any[] = [];
  const transcriber = recordingTranscriber(settings, (async (url, options) => {
    request = { url, ...options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, value: { text: ' Complete result ' } }),
    };
  }) as any);
  settings.recognitionEngine = 'whisper-http';
  settings.recognitionLang = 'en';
  assert.equal(
    await transcriber.transcribe(
      new Float32Array(48000 * 38),
      48000,
      controller.signal,
      async (m) => {
        metadata.push(structuredClone(m));
      },
    ),
    'Complete result',
  );
  assert.equal(request.url, '/api/dsh-live-voice/qwen/transcribe');
  assert.equal(request.signal, controller.signal);
  assert.equal(request.credentials, 'same-origin');
  assert.equal(request.headers['x-dlv-language'], 'pt-BR');
  assert.equal(request.headers['x-dlv-transcription-context'], 'Vocabulary');
  const wav = new DataView(request.body);
  assert.equal(wav.getUint32(24, true), 16000);
  assert.equal(wav.getUint32(40, true), 38 * 16000 * 2);
  assert.equal(request.body.byteLength, 44 + 38 * 16000 * 2);
  assert.equal(metadata.length, 2);
  assert.equal(metadata[0].payloadBytes, request.body.byteLength);
  assert.equal(metadata[0].sampleCount, 38 * 16000);
  assert.equal(metadata[0].inputSamples, 38 * 48000);
  assert.equal(metadata[0].durationMs, 38000);
  assert.equal(metadata[0].responseStatus, undefined);
  assert.equal(metadata[1].responseStatus, 200);
  assert.ok(Number.isFinite(Date.parse(metadata[0].preparedAt)));
  assert.throws(() => recordingTranscriber({ recognitionEngine: 'unknown' }));
});

test('archive retry propagates HTTP and structured provider errors', async () => {
  const transcriber = recordingTranscriber({ recognitionEngine: 'whisper-http' }, (async () => ({
    ok: false,
    json: async () => ({ ok: false, error: { message: 'provider failure' } }),
  })) as any);
  await assert.rejects(transcriber.transcribe(new Float32Array(16000), 16000), /provider failure/);
});

const noHttp = (async () => {
  throw new Error('unexpected HTTP fallback');
}) as typeof fetch;

for (const engine of ['whisper-browser', 'qwen-browser']) {
  test(
    'archive ' +
      engine +
      ' snapshots model/device/language and processes the complete long range locally',
    async () => {
      const settings = {
        recognitionEngine: engine,
        recognitionLang: 'pt-BR',
        browserWhisperModel: 'whisper-tiny',
        browserQwenModel: 'qwen-0.6b',
        browserAsrDevice: 'wasm' as const,
      };
      const calls: any[] = [];
      let disposed = 0;
      const controller = new AbortController();
      const transcriber = recordingTranscriber(settings, noHttp, {
        createLocalModels: () => ({
          refresh: async () => {
            calls.push('refresh');
          },
          prepare: async (...args) => {
            calls.push(args);
          },
          transcribe: async (key, pcm, lang, signal) => {
            calls.push({ key, pcm: pcm.slice(), lang, signal });
            structuredClone(pcm, { transfer: [pcm.buffer] });
            return ' part ';
          },
          dispose: () => {
            disposed++;
          },
        }),
      });
      settings.recognitionLang = 'en';
      settings.browserWhisperModel = 'whisper-base';
      const input = new Float32Array(48000 * 60);
      for (let i = 0; i < input.length; i++) input[i] = i / input.length;
      const requests: any[] = [];
      assert.equal(
        await transcriber.transcribe(input, 48000, controller.signal, async (m) => {
          requests.push(m);
        }),
        'part part part',
      );
      const key = engine === 'whisper-browser' ? 'whisper-tiny' : 'qwen-0.6b';
      assert.equal(transcriber.engine, 'browser-local/' + key);
      assert.deepEqual(calls[1], [
        key,
        engine === 'whisper-browser' ? 'wasm' : 'webgpu',
        controller.signal,
      ]);
      const chunks = calls.slice(2);
      assert.deepEqual(
        chunks.map((c) => c.pcm.length),
        [25 * 16000, 25 * 16000, 13.2 * 16000],
      );
      assert.ok(
        chunks.every((c) => c.key === key && c.lang === 'pt-BR' && c.signal === controller.signal),
      );
      assert.ok(Math.abs(chunks[1].pcm[0] - 23.4 / 60) < 0.0001);
      assert.ok(chunks[2].pcm.at(-1) > 0.9999);
      assert.equal(input.length, 60 * 48000);
      assert.equal(requests.length, 0, 'local inference must not invent HTTP measurements');
      assert.equal(disposed, 1);
    },
  );
}

test('archive local retry disposes on missing model and does not fall back', async () => {
  let disposed = false;
  const transcriber = recordingTranscriber(
    { recognitionEngine: 'whisper-browser', browserWhisperModel: 'whisper-tiny' },
    noHttp,
    {
      createLocalModels: () => ({
        refresh: async () => {},
        prepare: async () => {
          throw new Error('model-missing');
        },
        transcribe: async () => {
          throw new Error('unexpected inference');
        },
        dispose: () => {
          disposed = true;
        },
      }),
    },
  );
  await assert.rejects(transcriber.transcribe(new Float32Array(16000), 16000), /model-missing/);
  assert.equal(disposed, true);
});

test('archive local retry cancels long ranges without accepting late text or starting another chunk', async () => {
  const controller = new AbortController();
  let calls = 0,
    disposed = 0;
  const transcriber = recordingTranscriber(
    { recognitionEngine: 'whisper-browser', browserWhisperModel: 'whisper-tiny' },
    noHttp,
    {
      createLocalModels: () => ({
        refresh: async () => {},
        prepare: async () => {},
        transcribe: async () => {
          calls++;
          controller.abort();
          return 'late result';
        },
        dispose: () => {
          disposed++;
        },
      }),
    },
  );
  await assert.rejects(
    transcriber.transcribe(new Float32Array(16000 * 60), 16000, controller.signal),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
  assert.ok(disposed >= 1);
  await assert.rejects(transcriber.transcribe(new Float32Array(16000), 16000, controller.signal), {
    name: 'AbortError',
  });
  assert.equal(calls, 1);
});

test('archive native Browser retries use saved PCM and snapshot privacy options without HTTP', async () => {
  const settings = {
    recognitionEngine: 'browser',
    recognitionLang: 'pt-BR',
    recognitionProcessLocally: false,
    recognitionAutoInstall: false,
  };
  let request: any;
  const transcriber = recordingTranscriber(settings, noHttp, {
    transcribeBrowser: async (...args) => {
      request = args;
      return 'saved audio';
    },
  });
  settings.recognitionProcessLocally = true;
  const pcm = new Float32Array(16000),
    controller = new AbortController();
  assert.equal(await transcriber.transcribe(pcm, 16000, controller.signal), 'saved audio');
  assert.deepEqual(request, [
    pcm,
    16000,
    {
      lang: 'pt-BR',
      processLocally: false,
      autoInstallLocalPack: false,
      signal: controller.signal,
    },
  ]);
});
