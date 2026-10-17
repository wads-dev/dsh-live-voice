import { transcriptionContextHeader } from '../recognition/transcriptionContext.js';
import type {
  RecordingRepository,
  RecordingWriter,
  RecordingAttempt,
  RecordingPin,
} from './types.js';
import type { SileroVadOptions, SileroVadStream } from '../recognition/vad/SileroVadRuntime.js';
type CaptureHandle = { finish(): Promise<void>; release(): void };
type Processing = {
  queued: number;
  active: boolean;
  transcribing: number;
  deliveryPending: number;
  pending: number;
};
interface RecognitionCallbacks {
  signal?: AbortSignal;
  lang?: string;
  onResult?(result: {
    final: string;
    interim: string;
    startedAt: number;
    paragraphBefore?: boolean;
  }): void;
  onActivity?(active: boolean): void;
  onError?(error: Error): void;
  onProcessingChange?(state: Processing): void;
}
interface RecordingEngine {
  meter: { context: AudioContext; source: AudioNode };
  g: { fetch: typeof fetch };
  recordings: RecordingRepository;
  route: string;
  recognitionContext?: string;
  transcribePcm?(
    pcm: Float32Array,
    sampleRate: number,
    language: string,
    signal?: AbortSignal,
  ): Promise<string>;
  lang: string;
  startGeneration: number;
  session: RecognitionSession | null;
  voiceDetectionThreshold?: number;
  voiceDetectionMinimumSpeechMs?: number;
  voiceDetectionPreset?: string;
  voiceDetectionCustomSilenceMs?: number;
  voiceDetectionCustomParagraphMs?: number;
  maxUtteranceSeconds?: number;
  recordingEnabled?: boolean;
  recordingKeepPrevious?: number;
  recordingBitrate?: number;
  recordingPreRollMs?: number;
  recordingPostRollMs?: number;
  inputSource?: 'microphone' | 'shared';
  sourceId?: string;
  sourceLabel?: string;
  recordingErrorMessage(error: unknown): string;
  vadErrorMessage(error: unknown): string;
  vadFactory(options: SileroVadOptions): SileroVadStream;
  vadCapture(
    context: AudioContext,
    source: AudioNode,
    stream: SileroVadStream,
    onPcm: (pcm: Float32Array, rate: number) => void,
  ): Promise<CaptureHandle>;
  stop(): Promise<void>;
}
interface RecognitionSession {
  writer: RecordingWriter;
  detector: string;
  sampleRate: number;
  capture: CaptureHandle | null;
  vad: SileroVadStream | null;
  finished: boolean;
  finishing: boolean;
  finishPromise: Promise<void> | null;
  transcriptionQueue: RecordingAttempt[];
  activeRequest: AbortController | null;
  draining: boolean;
  signal?: AbortSignal;
  onProcessingChange?: RecognitionCallbacks['onProcessingChange'];
  tail: Promise<void>;
  pendingWrites: number;
  pendingSpeechWrites: number;
  lang: string;
  operation: string;
  capturedSamples: number;
  pinDetector?: PinDetector;
  finishRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  abort(): void;
}
const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
import { PinDetector } from './PinDetector.js';
import { voiceDetectionSilenceMs, voiceDetectionParagraphMs } from '../core/settings.js';
/** Minimum context on each transcription boundary; independent of VAD pin positions. */
export const TRANSCRIPTION_BOUNDARY_MARGIN_MS = 800;
const uid = () => crypto.randomUUID();
/** Audio ownership stays with the recording; the queue only holds range references. */
export async function startRecordingRecognition(
  engine: RecordingEngine,
  options: RecognitionCallbacks,
  capture: { silero: boolean; encode(pcm: Float32Array, rate: number): ArrayBuffer },
) {
  const { signal, lang = engine.lang, onResult, onActivity, onError, onProcessingChange } = options;
  const rate = engine.meter.context.sampleRate;
  const policy = {
    enabled: engine.recordingEnabled !== false,
    keepPrevious: engine.recordingKeepPrevious ?? 1,
    bitrate: engine.recordingBitrate ?? 48000,
    preRollMs: Math.max(TRANSCRIPTION_BOUNDARY_MARGIN_MS, engine.recordingPreRollMs ?? 320),
    postRollMs: Math.max(TRANSCRIPTION_BOUNDARY_MARGIN_MS, engine.recordingPostRollMs ?? 320),
  };
  const generation = engine.startGeneration;
  const writer = await engine.recordings
    .begin({
      sourceId: engine.sourceId ?? 'microphone',
      kind: engine.inputSource ?? 'microphone',
      label: engine.sourceLabel ?? engine.inputSource ?? 'microphone',
      sampleRate: rate,
      policy,
      configuration: {
        detector: capture.silero ? 'silero' : 'energy',
        threshold: engine.voiceDetectionThreshold ?? 0.5,
        minimumSpeechMs: engine.voiceDetectionMinimumSpeechMs ?? 250,
        silenceMs: voiceDetectionSilenceMs(engine),
        paragraphMs: voiceDetectionParagraphMs(engine),
        maxUtteranceSeconds: engine.maxUtteranceSeconds ?? 60,
        preRollMs: policy.preRollMs,
        postRollMs: policy.postRollMs,
        bitrate: policy.bitrate,
      },
    })
    .catch((error) => {
      throw new Error(engine.recordingErrorMessage(error));
    });
  if (engine.startGeneration !== generation || signal?.aborted) {
    await writer.finish('interrupted');
    throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
  }
  await writer.pin('silence-start', 0, 0);
  if (engine.startGeneration !== generation || signal?.aborted) {
    await writer.finish('interrupted');
    throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
  }
  const session: RecognitionSession = {
    writer,
    detector: capture.silero ? 'silero' : 'energy',
    sampleRate: rate,
    capture: null,
    vad: null,
    finished: false,
    finishing: false,
    finishPromise: null,
    transcriptionQueue: [],
    activeRequest: null,
    draining: false,
    signal,
    onProcessingChange,
    tail: Promise.resolve(),
    pendingWrites: 0,
    pendingSpeechWrites: 0,
    lang,
    operation: uid(),
    capturedSamples: 0,
    finishRecording: async () => {},
    stopRecording: async () => {},
    abort: () => {},
  };
  engine.session = session;
  const valid = () => engine.session === session && !signal?.aborted;
  // Range descriptors only: future post-roll must never block serialized PCM writes.
  const awaitingTail: RecordingAttempt[] = [];
  let stopping = false;
  let recoveryPending = false;
  let captureFailure: string | undefined;
  const captureValid = () => engine.session === session || stopping;
  const notify = () => {
    if (valid())
      session.onProcessingChange?.({
        queued: awaitingTail.length + session.transcriptionQueue.length,
        active: !!session.activeRequest,
        // Only queued/running speech attempts belong in the visible transcription status.
        transcribing:
          awaitingTail.length + session.transcriptionQueue.length + (session.activeRequest ? 1 : 0),
        // Speech-boundary bookkeeping must settle before delivery, but silent PCM writes must not reset it.
        deliveryPending:
          awaitingTail.length +
          session.transcriptionQueue.length +
          (session.activeRequest ? 1 : 0) +
          session.pendingSpeechWrites +
          (session.finishing || recoveryPending ? 1 : 0),
        // All writes still protect release, playback admission and page leave.
        pending:
          awaitingTail.length +
          session.transcriptionQueue.length +
          (session.activeRequest ? 1 : 0) +
          session.pendingWrites +
          (session.finishing || recoveryPending ? 1 : 0),
      });
  };
  const failure = (error: unknown) => {
    if (!valid()) return;
    captureFailure = asError(error).message;
    onError?.(new Error(engine.recordingErrorMessage(error)));
    void engine.stop();
  };
  const serialize = (task: () => Promise<void>, preserve = false, speech = false) => {
    session.pendingWrites++;
    if (speech) session.pendingSpeechWrites++;
    notify();
    const work = session.tail.then(async () => {
      if (preserve || valid()) await task();
    });
    session.tail = work.catch(failure).finally(() => {
      session.pendingWrites--;
      if (speech) session.pendingSpeechWrites--;
      notify();
    });
    return work;
  };
  const max = Math.max(1, Math.floor((engine.maxUtteranceSeconds || 60) * rate));
  let queuedThrough = 0;
  const paragraphStarts = new Set<number>();
  const paragraphSamples = (voiceDetectionParagraphMs(engine) * rate) / 1000;
  let liveSpeechStart: number | null = null;
  let lastSplitQueued = 0;
  const checkLiveSplit = () => {
    if (liveSpeechStart === null || !valid()) return;
    const through = Math.min(
      session.capturedSamples,
      Math.round((detector.position * rate) / (capture.silero ? 16000 : rate)),
    );
    if (through - Math.max(liveSpeechStart, lastSplitQueued) < max) return;
    const end = Math.max(liveSpeechStart, lastSplitQueued) + max;
    lastSplitQueued = end;
    void serialize(
      async () => {
        const speech = [...writer.session.pins].reverse().find((p) => p.kind === 'speech-start');
        if (speech && valid()) await queueSpeech(speech, end);
      },
      false,
      true,
    ).catch(() => {});
  };
  const queueSpeech = async (pin: RecordingPin, end: number) => {
    for (let at = Math.max(pin.atSample, queuedThrough); at < end; at += max) {
      const requestedStart = Math.max(0, at - (policy.preRollMs * rate) / 1000);
      const requestedEnd = Math.min(end, at + max) + (policy.postRollMs * rate) / 1000;
      const attempt: RecordingAttempt = {
        id: uid(),
        segmentId: pin.id,
        startSample: Math.floor(requestedStart),
        endSample: Math.floor(requestedEnd),
        paragraphBefore: at === pin.atSample && paragraphStarts.has(pin.atSample),
        speechStartSample: at,
        engine: engine.transcribePcm
          ? engine.route.includes('qwen')
            ? 'qwen-browser'
            : 'whisper-browser'
          : engine.route.includes('qwen')
            ? 'qwen-http'
            : 'whisper-http',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      awaitingTail.push(attempt);
      notify();
    }
    queuedThrough = Math.max(queuedThrough, end);
    await releaseCapturedRanges();
  };
  async function releaseCapturedRanges() {
    if (!valid()) return;
    const captured = writer.session.capturedSamples;
    while (awaitingTail.length && (session.finished || awaitingTail[0].endSample <= captured)) {
      const pending = awaitingTail[0];
      const attempt = { ...pending, endSample: Math.min(pending.endSample, captured) };
      await writer.attempt(attempt);
      if (!valid()) return;
      awaitingTail.shift();
      session.transcriptionQueue.push(attempt);
      notify();
    }
    void drain();
  }
  const pin = (kind: RecordingPin['kind'], at: number, confirmed: number) => {
    const startSample = Math.min(
      session.capturedSamples,
      Math.round((at * rate) / (capture.silero ? 16000 : rate)),
    );
    const confirmedSample = Math.min(
      session.capturedSamples,
      Math.round((confirmed * rate) / (capture.silero ? 16000 : rate)),
    );
    if (kind === 'speech-start') {
      liveSpeechStart = startSample;
      lastSplitQueued = startSample;
    } else liveSpeechStart = null;
    void serialize(
      async () => {
        const previous = writer.session.pins.at(-1);
        if (
          kind === 'speech-start' &&
          previous?.kind === 'silence-start' &&
          previous.atSample > 0 &&
          startSample - previous.atSample >= paragraphSamples
        )
          paragraphStarts.add(startSample);
        await writer.pin(kind, startSample, confirmedSample);
        if (valid() && kind === 'silence-start' && previous?.kind === 'speech-start')
          await queueSpeech(previous, startSample);
      },
      true,
      true,
    ).catch(() => {});
  };
  const detector = new PinDetector({
    sampleRate: capture.silero ? 16000 : rate,
    threshold: engine.voiceDetectionThreshold ?? 0.5,
    minimumSpeechMs: engine.voiceDetectionMinimumSpeechMs ?? 250,
    silenceMs: voiceDetectionSilenceMs(engine),
    onPin: pin,
    onActivity: (active) => {
      if (active) {
        if (valid()) onActivity?.(true);
      } else
        void serialize(async () => {
          if (valid()) onActivity?.(false);
        }).catch(() => {});
    },
  });
  session.pinDetector = detector;
  async function drain() {
    if (session.draining || !valid()) return;
    session.draining = true;
    try {
      while (valid() && session.transcriptionQueue.length) {
        const attempt = session.transcriptionQueue.shift()!;
        const request = new AbortController();
        session.activeRequest = request;
        notify();
        try {
          const pcm = await writer.read(attempt.startSample, attempt.endSample);
          if (!valid()) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
          let text: string;
          if (engine.transcribePcm) {
            text = await engine.transcribePcm(pcm, rate, lang || engine.lang, request.signal);
          } else {
            const response = await engine.g.fetch(engine.route + '/transcribe', {
              method: 'POST',
              headers: {
                'content-type': 'audio/wav',
                'x-dlv-client-id': session.operation,
                'x-dlv-operation-id': attempt.id,
                'x-dlv-language': lang,
                ...transcriptionContextHeader(engine.recognitionContext),
              },
              credentials: 'same-origin',
              body: capture.encode(pcm, rate),
              signal: request.signal,
            });
            const json = await response.json();
            if (!response.ok || !json?.ok)
              throw new Error(json?.error?.message || 'Recognition request failed.');
            text = String(json.value?.text ?? '').trim();
          }
          await writer.attempt({
            ...attempt,
            status: 'success',
            text,
            finishedAt: new Date().toISOString(),
          });
          if (valid() && text)
            onResult?.({
              final: text,
              interim: '',
              startedAt:
                Date.parse(writer.session.startedAt) +
                ((attempt.speechStartSample ?? attempt.startSample) / rate) * 1000,
              paragraphBefore: attempt.paragraphBefore,
            });
        } catch (error) {
          await writer
            .attempt({
              ...attempt,
              status: 'error',
              error: asError(error).name === 'AbortError' ? 'cancelled' : asError(error).message,
              finishedAt: new Date().toISOString(),
            })
            .catch(failure);
          if (valid() && asError(error).name !== 'AbortError') onError?.(asError(error));
        } finally {
          if (session.activeRequest === request) session.activeRequest = null;
          notify();
        }
      }
    } finally {
      session.draining = false;
      notify();
    }
  }
  const ingest = (pcm: Float32Array, sampleRate: number) => {
    if (!captureValid() || session.finished) return;
    if (sampleRate !== rate) {
      failure(new Error('Capture sample rate changed.'));
      return;
    }
    session.capturedSamples += pcm.length;
    if (session.pendingWrites > 128) {
      failure(new Error('Recording storage cannot keep up.'));
      return;
    }
    const copy = pcm.slice();
    void serialize(async () => {
      await writer.append(copy);
      await releaseCapturedRanges();
    }, true).catch(() => {});
  };
  let vadGeneration = 0;
  let restartAttempts = 0;
  let recovering: Promise<void> | null = null;
  let deferredFailure: Error | null = null;
  const sileroValid = () => valid() && !stopping && !session.finished && !session.finishing;
  const releaseSilero = () => {
    ++vadGeneration;
    const previousCapture = session.capture;
    const previousVad = session.vad;
    session.capture = null;
    session.vad = null;
    try {
      previousCapture?.release();
    } finally {
      previousVad?.release();
    }
  };
  const terminalVadFailure = (error: unknown) => {
    if (!valid() || stopping || session.finished) return;
    captureFailure = asError(error).message;
    onError?.(new Error(engine.vadErrorMessage(error)));
    void engine.stop();
  };
  const installSilero = async () => {
    const token = ++vadGeneration;
    let installing = true;
    let installationFailure: Error | undefined;
    const failed = (error: Error) => {
      if (token !== vadGeneration || !sileroValid()) return;
      if (installing) installationFailure = error;
      else recoverSilero(error);
    };
    const vad = engine.vadFactory({
      onProbability: ({ probability, pcm }) => {
        if (token !== vadGeneration || !captureValid() || session.finished) return;
        // A successful inference, not merely attachment, restores the retry budget.
        restartAttempts = 0;
        detector.frame(probability, pcm.length);
        checkLiveSplit();
      },
      onError: failed,
      onReset: () => failed(new Error('VAD analysis interrupted.')),
    });
    session.vad = vad;
    try {
      const attached = await engine.vadCapture(
        engine.meter.context,
        engine.meter.source,
        vad,
        (pcm, sampleRate) => {
          if (token === vadGeneration) ingest(pcm, sampleRate);
        },
      );
      if (token !== vadGeneration || !sileroValid()) {
        attached.release();
        vad.release();
        throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
      }
      session.capture = attached;
      if (installationFailure) throw installationFailure;
    } finally {
      installing = false;
    }
  };
  const retrySilero = async (initialError?: unknown) => {
    let error = initialError;
    while (sileroValid()) {
      if (error) {
        releaseSilero();
        if (restartAttempts >= 2) throw error;
        restartAttempts++;
        // Retain the recorded sample clock and any open speech across analysis loss.
        // No fabricated silence pin and no automatic switch to energy detection.
        detector.skipTo(Math.round((session.capturedSamples * 16000) / rate));
        // Release failed peer streams in the shared pool before reacquiring.
        await Promise.resolve();
      }
      if (!sileroValid()) return;
      try {
        await installSilero();
        return;
      } catch (failure) {
        if (!sileroValid() || asError(failure).name === 'AbortError') return;
        error = failure;
      }
    }
  };
  const recoverSilero = (error: Error) => {
    if (!sileroValid()) return;
    if (recovering) {
      ++vadGeneration;
      deferredFailure = error;
      return;
    }
    // Invalidate callbacks immediately; duplicate reset/error callbacks consume one attempt.
    ++vadGeneration;
    recoveryPending = true;
    notify();
    recovering = Promise.resolve()
      .then(() => retrySilero(error))
      .catch(terminalVadFailure)
      .finally(() => {
        recovering = null;
        const pending = deferredFailure;
        deferredFailure = null;
        if (pending) recoverSilero(pending);
        else {
          recoveryPending = false;
          notify();
        }
      });
  };
  session.finishRecording = () => {
    if (session.finishPromise) return session.finishPromise;
    session.finishing = true;
    session.finishPromise = Promise.resolve().then(async () => {
      try {
        await recovering;
        await session.capture?.finish();
        if (!valid()) return;
        session.finished = true;
        detector.finish();
        // Capture is drained: release remaining ranges using only the real available tail.
        await serialize(releaseCapturedRanges);
        await session.tail;
        await writer.finish();
        session.vad?.release();
      } catch (error) {
        captureFailure = asError(error).message;
        if (valid()) onError?.(new Error(engine.vadErrorMessage(error)));
        void engine.stop();
      } finally {
        session.finishing = false;
        notify();
      }
    });
    notify();
    return session.finishPromise;
  };
  session.stopRecording = async () => {
    stopping = true;
    awaitingTail.length = 0;
    await recovering;
    session.activeRequest?.abort();
    if (session.finishing) session.capture?.release();
    else {
      try {
        await session.capture?.finish();
      } catch {
        session.capture?.release();
      }
    }
    session.finished = true;
    session.vad?.release();
    detector.finish();
    for (const attempt of session.transcriptionQueue.splice(0))
      await writer
        .attempt({
          ...attempt,
          status: 'error',
          error: 'cancelled',
          finishedAt: new Date().toISOString(),
        })
        .catch(() => {});
    await session.tail;
    await writer.finish(captureFailure ? 'failed' : 'completed', captureFailure).catch(() => {});
    stopping = false;
  };
  session.abort = () => engine.stop();
  signal?.addEventListener('abort', session.abort, { once: true });
  try {
    if (capture.silero) {
      await retrySilero();
    } else {
      const processor = engine.meter.context.createScriptProcessor(4096, 1, 1);
      const gain = engine.meter.context.createGain();
      gain.gain.value = 0;
      processor.connect(gain);
      gain.connect(engine.meter.context.destination);
      engine.meter.source.connect(processor);
      processor.onaudioprocess = (event) => {
        const pcm = new Float32Array(event.inputBuffer.getChannelData(0));
        ingest(pcm, rate);
        const rms = Math.sqrt(pcm.reduce((n, x) => n + x * x, 0) / pcm.length);
        if (captureValid()) {
          detector.frame(rms > 0.012 ? 1 : 0, pcm.length);
          checkLiveSplit();
        }
      };
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        processor.onaudioprocess = null;
        engine.meter.source.disconnect(processor);
        processor.disconnect();
        gain.disconnect();
      };
      session.capture = { finish: async () => release(), release };
    }
    if (!valid()) {
      await session.stopRecording();
      throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    }
  } catch (error) {
    await session.stopRecording();
    if (engine.session === session) engine.session = null;
    if (asError(error).name === 'AbortError') throw error;
    throw new Error(
      capture.silero ? engine.vadErrorMessage(error) : engine.recordingErrorMessage(error),
    );
  }
  return session;
}
