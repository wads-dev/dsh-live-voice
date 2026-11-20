import test from 'node:test';
import assert from 'node:assert/strict';
import { readCoordinatorDiagnostics } from '../src/modules/core/diagnostics.ts';
test('recording queue diagnostics project range lengths without exposing snapshot PCM', () => {
  const pcm = new Float32Array([0.25, 0.75]);
  const d: any = readCoordinatorDiagnostics({
    getSnapshot: () => ({ settings: {} }),
    meter: { context: { sampleRate: 16000 } },
    recognition: { session: { sampleRate: 16000, transcriptionQueue: [
      { attempt: { startSample: 3200, endSample: 19200, text: 'private' }, pcm },
      { startSample: 0, endSample: 8000 },
    ] } },
  });
  assert.deepEqual(d.recognition.queue, [
    { samples: 16000, durationMs: 1000 },
    { samples: 8000, durationMs: 500 },
  ]);
  assert.equal(JSON.stringify(d).includes('private'), false);
  assert.equal(JSON.stringify(d).includes('0.75'), false);
});

test('Silero diagnostics use resampled rate and probability thresholds, never legacy RMS', () => {
  const d: any = readCoordinatorDiagnostics({
    getSnapshot: () => ({
      settings: { recognitionEngine: 'qwen-http', voiceDetectionEngine: 'silero' },
    }),
    meter: { context: { sampleRate: 48000 } },
    recognition: {
      session: {
        detector: 'silero',
        sampleRate: 16000,
        chunks: [],
        samples: 16000,
        silence: 8000,
        probability: 0.8,
        transcriptionQueue: [{ samples: new Float32Array(16000) }],
      },
    },
  });
  assert.equal(d.vad.threshold, null);
  assert.equal(d.vad.positiveSpeechThreshold, 0.5);
  assert.equal(d.vad.silenceMs, 500);
  assert.equal(d.recognition.queue[0].durationMs, 1000);
  assert.equal(d.vad.probability, 0.8);
  assert.equal(d.chunker.accountedPcmBytes, 64000);
});
