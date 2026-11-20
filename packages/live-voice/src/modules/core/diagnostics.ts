/** Versioned read-only boundary; debugger UI is never imported by the runtime. */
export const DIAGNOSTIC_KEY = Symbol.for('dsh-live-voice.diagnostics.v1');
export const DIAGNOSTIC_CHANGED = 'dsh-live-voice:diagnostics-changed';
export type DiagnosticValue =
  null | boolean | number | string | DiagnosticValue[] | { [key: string]: DiagnosticValue };
export interface DiagnosticSource {
  version: 1;
  read(options?: { includeContent?: boolean }): DiagnosticValue;
  subscribe(listener: () => void): () => void;
}
export function publishDiagnosticSource(target: any, source: DiagnosticSource) {
  target[DIAGNOSTIC_KEY] = source;
  const ChangedEvent = target.Event ?? Event;
  target.dispatchEvent?.(new ChangedEvent(DIAGNOSTIC_CHANGED));
  return () => {
    if (target[DIAGNOSTIC_KEY] !== source) return;
    delete target[DIAGNOSTIC_KEY];
    target.dispatchEvent?.(new ChangedEvent(DIAGNOSTIC_CHANGED));
  };
}
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
/** Explicit projection excludes audio, functions, resources and free-form errors. */
export function readCoordinatorDiagnostics(
  controller: any,
  includeContent = false,
): DiagnosticValue {
  const state = controller.getSnapshot();
  const recognition = controller.recognition?.session;
  const sampleRate = recognition?.sampleRate || controller.meter?.context?.sampleRate;
  const detector = recognition?.detector || (recognition?.chunks ? 'energy' : null);
  const settings: Record<string, DiagnosticValue> = {};
  const publicSettings = new Set([
    'engine',
    'recognitionEngine',
    'voiceDetectionEngine',
    'voiceDetectionPreset',
    'sendingMode',
    'dshBusyEnterBehavior',
    'mode',
    'lang',
    'recognitionLang',
  ]);
  for (const [key, value] of Object.entries(state.settings ?? {})) {
    settings[key] =
      typeof value === 'string'
        ? includeContent || publicSettings.has(key)
          ? value
          : { characters: value.length }
        : typeof value === 'boolean' || typeof value === 'number'
          ? value
          : null;
  }
  const item = (entry: any): DiagnosticValue => ({
    messageId: entry.id == null ? null : String(entry.id),
    manual: entry.manual === true,
    characters: entry.text?.length ?? 0,
    ...(includeContent ? { text: String(entry.text ?? '') } : {}),
    preparing: Boolean(entry.preparing),
    prepared: Boolean(entry.prepared),
    failed: Boolean(entry.prepareError),
  });
  return {
    settings,
    lifecycle: {
      disposed: Boolean(controller.disposed),
      conversation: Boolean(state.conversation),
    },
    composer: {
      characters: controller.composer?.getDraft?.()?.length ?? 0,
      answeringQuestion: Boolean(state.answeringQuestion),
      ...(includeContent ? { draft: controller.composer?.getDraft?.() ?? '' } : {}),
    },
    capture: {
      starting: Boolean(state.starting),
      listening: Boolean(state.listening),
      muted: Boolean(state.muted),
      generation: number(controller.epoch),
      level: number(controller.meter?.level?.()),
      releaseFailed: Boolean(controller.inputReleaseError),
    },
    vad: {
      source: state.settings?.recognitionEngine === 'browser' ? 'native' : 'plugin',
      activity: Boolean(state.recognizing),
      configuredDetector:
        state.settings?.recognitionEngine === 'browser'
          ? 'native'
          : (state.settings?.voiceDetectionEngine ?? 'silero'),
      activeDetector:
        state.settings?.recognitionEngine === 'browser' && state.listening ? 'native' : detector,
      threshold: detector === 'energy' ? 0.012 : null,
      positiveSpeechThreshold: detector === 'silero' ? 0.5 : null,
      negativeSpeechThreshold: detector === 'silero' ? 0.35 : null,
      probability: number(recognition?.probability),
      sampleRate: number(sampleRate),
      silenceMs:
        recognition?.chunks && sampleRate ? (recognition.silence / sampleRate) * 1000 : null,
    },
    chunker: {
      available: Boolean(recognition?.chunks),
      bufferedSamples: number(recognition?.samples),
      bufferedChunks: recognition?.chunks?.length ?? null,
      containsSpeech: recognition?.voiced ?? null,
      preRollSamples:
        recognition?.preRoll?.reduce((n: number, frame: Float32Array) => n + frame.length, 0) ?? 0,
      accountedPcmBytes: recognition?.chunks
        ? ((recognition.samples || 0) +
            (recognition.preRoll?.reduce((n: number, frame: Float32Array) => n + frame.length, 0) ||
              0)) *
          4
        : null,
    },
    recording: recognition?.writer
      ? {
          id: recognition.writer.session.id,
          capturedSamples: recognition.writer.session.capturedSamples,
          savedSamples: recognition.writer.session.savedSamples,
          state: recognition.writer.session.state,
          pins: recognition.writer.session.pins.length,
          storage: recognition.writer.session.storage,
          persistent: recognition.writer.session.persistent,
        }
      : null,
    recognition: {
      pendingTranscriptions: number(state.pendingTranscriptions),
      activeRequest: Boolean(recognition?.activeRequest),
      queue: (recognition?.transcriptionQueue ?? []).map((chunk: any) => {
        const range = chunk.attempt ?? chunk;
        const samples = number(
          range.endSample != null
            ? range.endSample - range.startSample
            : (range.samples ?? range).length,
        );
        return { samples, durationMs: sampleRate && samples !== null ? (samples / sampleRate) * 1000 : null };
      }),
    },
    delivery: {
      autoSendAt: number(state.autoSendAt),
      countdownActive: controller.autoSendTimer != null,
      holdToTalkRelease: Boolean(controller.holdToTalkRelease),
    },
    speech: {
      configuredEngine: state.settings?.engine ?? null,
      activeEngine: state.speechEngine ?? null,
      activeEndpoint: controller.engines?.[state.speechEngine]?.endpoint ?? null,
      speaking: Boolean(state.speaking),
      paused: Boolean(state.paused),
      activeMessageId: state.activeMessageId == null ? null : String(state.activeMessageId),
      generation: number(controller.speechEpoch),
      controlGeneration: number(controller.controlEpoch),
      remaining: number(state.speechSegmentsRemaining),
      notBefore: number(controller.assistantSpeechNotBefore),
      waitingForActivity: controller.assistantSpeechNotBefore === Infinity,
      stopFailed: Boolean(controller.speechStopError),
      queue: (controller.queue ?? []).map(item),
      activeItem: controller.activeSpeechItem ? item(controller.activeSpeechItem) : null,
      prefetchCount: controller.prefetchItems?.size ?? 0,
      consumed: Object.fromEntries(controller.consumed ?? []),
      unfinished: [...(controller.unfinished ?? [])].map(String),
      suppressed: [...(controller.suppressed ?? [])].map(String),
    },
    interruption: {
      transcriptConfirmed: Boolean(controller.interruptionTranscriptConfirmed),
      pausedSpeech: Boolean(controller.interruptionPausedSpeech),
      timerActive: controller.interruptionTimer != null,
    },
    capabilities: Object.fromEntries(
      Object.entries(state.capabilities ?? {}).map(([key, cap]: [string, any]) => [
        key,
        cap
          ? {
              supported: cap.supported === true,
              local: cap.local ?? null,
              pause: cap.pause ?? null,
              resume: cap.resume ?? null,
              hasReason: Boolean(cap.reason),
            }
          : null,
      ]),
    ),
    error: {
      present: Boolean(state.error),
      ...(includeContent ? { message: state.error ?? null } : {}),
    },
  };
}
