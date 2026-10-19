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
  assert.throws(() => recordingTranscriber({ recognitionEngine: 'browser' }));
});

test('archive retry propagates HTTP and structured provider errors', async () => {
  const transcriber = recordingTranscriber({ recognitionEngine: 'whisper-http' }, (async () => ({
    ok: false,
    json: async () => ({ ok: false, error: { message: 'provider failure' } }),
  })) as any);
  await assert.rejects(transcriber.transcribe(new Float32Array(16000), 16000), /provider failure/);
});
