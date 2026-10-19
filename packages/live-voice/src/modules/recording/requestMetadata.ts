import type { RecordingRequestMetadata } from './types.js';

/** Measure the actual encoded body, not the requested archive range. No audio is retained. */
export function transcriptionRequestMetadata(
  body: ArrayBuffer,
  inputSamples: number,
  inputSampleRate: number,
  language: string,
): RecordingRequestMetadata {
  const header = new DataView(body);
  // The shared encoder produces a fixed 44-byte mono PCM16 WAV header.
  if (body.byteLength < 44 || header.getUint16(22, true) !== 1 || header.getUint16(34, true) !== 16)
    throw new Error('Invalid transcription WAV metadata.');
  const sampleRate = header.getUint32(24, true);
  const dataBytes = header.getUint32(40, true);
  if (!sampleRate || dataBytes !== body.byteLength - 44 || dataBytes % 2)
    throw new Error('Incomplete transcription WAV body.');
  const sampleCount = dataBytes / 2;
  return {
    transport: 'http-wav',
    preparedAt: new Date().toISOString(),
    payloadBytes: body.byteLength,
    inputSamples,
    inputSampleRate,
    sampleCount,
    sampleRate,
    durationMs: (sampleCount * 1000) / sampleRate,
    language,
  };
}
