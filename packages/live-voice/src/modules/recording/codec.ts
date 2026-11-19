/** Browser-native codecs only: PCM is never an archive format. */
export type RecordingErrorCode =
  | 'codec-unsupported'
  | 'codec-failed'
  | 'storage-unavailable'
  | 'storage-failed'
  | 'quota-exceeded'
  | 'memory-limit'
  | 'not-found'
  | 'active-recording'
  | 'sealed'
  | 'archive-gap'
  | 'invalid-range'
  | 'disposed';
export class RecordingRepositoryError extends Error {
  constructor(
    public readonly code: RecordingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RecordingRepositoryError';
  }
}
export interface DecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: Uint8Array;
}
export interface EncodedPacket {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: Uint8Array;
}
export interface AudioPage {
  recordingId: string;
  index: number;
  startSample: number;
  sampleCount: number;
  sampleRate: number;
  zero: boolean;
  decoderConfig?: DecoderConfig;
  /** Decoder input timestamps are retained, including negative encoder lookahead. */
  preSkipSamples: number;
  packets: EncodedPacket[];
}
/** Encoded audio payload only; excludes database/metadata overhead and transient PCM. */
export const audioPageBytes = (page: AudioPage) =>
  (page.decoderConfig?.description?.byteLength ?? 0) +
  page.packets.reduce((total, packet) => total + packet.data.byteLength, 0);
// Audio WebCodecs is not yet declared by every TypeScript DOM version.
interface CodecFrame {
  timestamp: number;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  copyTo(destination: Float32Array, options: { planeIndex: number; format: string }): void;
  close(): void;
}
interface CodecInstance {
  configure(config: object): void;
  encode?(data: CodecFrame): void;
  decode?(chunk: object): void;
  flush(): Promise<void>;
  close(): void;
}
interface CodecConstructor {
  new (options: { output: (...args: any[]) => void; error: (error: Error) => void }): CodecInstance;
  isConfigSupported(config: object): Promise<{ supported: boolean }>;
}
interface CodecGlobals {
  AudioEncoder?: CodecConstructor;
  AudioDecoder?: CodecConstructor;
  AudioData?: new (options: object) => CodecFrame;
  EncodedAudioChunk?: new (options: object) => object;
}
const globals = () => globalThis as unknown as CodecGlobals;
function unsupported(cause?: unknown): RecordingRepositoryError {
  return new RecordingRepositoryError(
    'codec-unsupported',
    'Native Opus audio encoding and decoding are unavailable in this browser.',
    { cause },
  );
}
export async function assertCodec(sampleRate: number, bitrate: number): Promise<void> {
  const { AudioEncoder, AudioDecoder, AudioData, EncodedAudioChunk } = globals();
  if (!AudioEncoder || !AudioDecoder || !AudioData || !EncodedAudioChunk) throw unsupported();
  try {
    const [encoder, decoder] = await Promise.all([
      AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate, numberOfChannels: 1, bitrate }),
      AudioDecoder.isConfigSupported({ codec: 'opus', sampleRate, numberOfChannels: 1 }),
    ]);
    if (!encoder.supported || !decoder.supported) throw unsupported();
  } catch (error) {
    throw unsupported(error);
  }
}
export async function encodePage(
  pcm: Float32Array,
  sampleRate: number,
  bitrate: number,
): Promise<Pick<AudioPage, 'zero' | 'decoderConfig' | 'preSkipSamples' | 'packets'>> {
  if (pcm.every((value) => value === 0)) return { zero: true, preSkipSamples: 0, packets: [] };
  const { AudioEncoder, AudioData } = globals();
  if (!AudioEncoder || !AudioData) throw unsupported();
  const packets: EncodedPacket[] = [];
  let decoderConfig: DecoderConfig | undefined;
  let failure: Error | undefined;
  const encoder = new AudioEncoder({
    output(chunk, metadata) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      packets.push({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration,
        data,
      });
      if (metadata?.decoderConfig) {
        const config = metadata.decoderConfig;
        const description = config.description;
        decoderConfig = {
          codec: config.codec,
          sampleRate: config.sampleRate,
          numberOfChannels: config.numberOfChannels,
          ...(description
            ? {
                description: ArrayBuffer.isView(description)
                  ? new Uint8Array(
                      description.buffer,
                      description.byteOffset,
                      description.byteLength,
                    ).slice()
                  : new Uint8Array(description).slice(),
              }
            : {}),
        };
      }
    },
    error(error) {
      failure = error;
    },
  });
  try {
    encoder.configure({
      codec: 'opus',
      sampleRate,
      numberOfChannels: 1,
      bitrate,
      opus: { frameDuration: 20000 },
    });
    // Include a bounded drain tail. A flush must never truncate the real page's final samples.
    const frameSize = Math.round(sampleRate / 50);
    const paddedSamples =
      Math.ceil((pcm.length + Math.ceil(sampleRate * 0.12)) / frameSize) * frameSize;
    for (let offset = 0; offset < paddedSamples; offset += frameSize) {
      const data = new Float32Array(frameSize);
      data.set(pcm.subarray(offset, Math.min(offset + frameSize, pcm.length)));
      const frame = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameSize,
        numberOfChannels: 1,
        timestamp: Math.round((offset * 1e6) / sampleRate),
        data,
      });
      try {
        encoder.encode!(frame);
      } finally {
        frame.close();
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    if (!packets.length) throw new Error('The Opus encoder produced no packets.');
    decoderConfig ??= { codec: 'opus', sampleRate, numberOfChannels: 1 };
    const description = decoderConfig.description;
    const opusHead =
      description &&
      description.length >= 12 &&
      String.fromCharCode(...description.subarray(0, 8)) === 'OpusHead';
    // Native WebCodecs describes delay in its configured output sample units
    // (this is decoder configuration, not an Ogg Opus archive header).
    const headSkip = opusHead
      ? ((description[10] | (description[11] << 8)) * sampleRate) / decoderConfig.sampleRate
      : 0;
    const timestampSkip = Math.max(0, (-packets[0].timestamp * sampleRate) / 1e6);
    const preSkipSamples = Math.round(Math.max(headSkip, timestampSkip));
    return { zero: false, decoderConfig, preSkipSamples, packets };
  } catch (error) {
    throw new RecordingRepositoryError(
      'codec-failed',
      'The browser could not encode an Opus audio page.',
      { cause: error },
    );
  } finally {
    try {
      encoder.close();
    } catch {
      /* Already closed after native codec error. */
    }
  }
}
export async function decodePage(page: AudioPage): Promise<Float32Array> {
  const result = new Float32Array(page.sampleCount);
  if (page.zero) return result;
  const { AudioDecoder, EncodedAudioChunk } = globals();
  if (!AudioDecoder || !EncodedAudioChunk || !page.decoderConfig) throw unsupported();
  let failure: Error | undefined;
  let coveredEnd = 0;
  const decoder = new AudioDecoder({
    output(frame: CodecFrame) {
      try {
        const data = new Float32Array(frame.numberOfFrames);
        frame.copyTo(data, { planeIndex: 0, format: 'f32-planar' });
        // Map timestamps, not packet count: Opus lookahead and final packet padding
        // are outside [0, sampleCount). Decoder output may use a native sample rate.
        // Some encoders timestamp the first packet at zero and advertise lookahead
        // only in OpusHead; others use a negative timestamp. Normalize both once.
        const firstTimestamp = page.packets[0]?.timestamp ?? 0;
        const timestampSkip = Math.max(0, (-firstTimestamp * page.sampleRate) / 1e6);
        const start =
          (frame.timestamp * page.sampleRate) / 1e6 -
          Math.max(0, page.preSkipSamples - timestampSkip);
        const ratio = frame.sampleRate / page.sampleRate;
        const first = Math.max(0, Math.ceil(start - 0.01));
        const end = Math.min(result.length, Math.ceil(start + data.length / ratio - 0.01));
        for (let i = first; i < end; i++) {
          const position = Math.max(0, (i - start) * ratio);
          const left = Math.min(data.length - 1, Math.floor(position));
          const fraction = position - left;
          result[i] =
            data[left] + (data[Math.min(left + 1, data.length - 1)] - data[left]) * fraction;
        }
        coveredEnd = Math.max(coveredEnd, end);
      } catch (error) {
        failure = error as Error;
      } finally {
        frame.close();
      }
    },
    error(error) {
      failure = error;
    },
  });
  try {
    const config = { ...page.decoderConfig };
    // Explicit timestamp trimming owns pre-skip. Do not let an OpusHead apply it twice.
    if (config.description) {
      config.description = config.description.slice();
      if (
        config.description.length >= 12 &&
        String.fromCharCode(...config.description.subarray(0, 8)) === 'OpusHead'
      ) {
        config.description[10] = 0;
        config.description[11] = 0;
      }
    }
    decoder.configure(config);
    for (const packet of page.packets) decoder.decode!(new EncodedAudioChunk(packet));
    await decoder.flush();
    if (failure) throw failure;
    if (coveredEnd < result.length)
      throw new Error('The decoded Opus page is shorter than its captured sample range.');
    return result;
  } catch (error) {
    throw new RecordingRepositoryError(
      'codec-failed',
      'The browser could not decode an Opus audio page.',
      { cause: error },
    );
  } finally {
    try {
      decoder.close();
    } catch {
      /* Already closed after native codec error. */
    }
  }
}
export function wavBlob(pcm: Float32Array, sampleRate: number): Blob {
  if (pcm.length > (0xffffffff - 36) / 2)
    throw new RecordingRepositoryError(
      'invalid-range',
      'The requested WAV exceeds the WAV format size limit.',
    );
  const bytes = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const value = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}
