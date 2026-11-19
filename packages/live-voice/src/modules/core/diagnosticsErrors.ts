/** Optional diagnostics sink. The core retains no error history. */
export const VOICE_ERROR_SINK = Symbol.for('dsh-live-voice.error-sink.v1');
export interface VoiceErrorContext {
  source?: string;
  recordingId?: string;
  stage?: string;
  attempt?: number;
  status?: number;
}
export interface VoiceErrorException {
  name: string;
  code?: string | number;
  message?: string;
  frames?: string[];
  cause?: VoiceErrorException;
}
export interface VoiceErrorEvent {
  at: number;
  operation: string;
  context: VoiceErrorContext;
  exception: VoiceErrorException;
}
type Target = { [key: symbol]: unknown };
type Sink = (event: VoiceErrorEvent) => void;
const operations = new Set(['voice.unknown', 'capture.failure', 'meeting.start', 'recognition.failure', 'recognition.teardown', 'recognition.audio-gap', 'recognition.snapshot-limit', 'recording.storage', 'recording.timeline', 'speech.failure', 'browser-local.download', 'browser-local.load', 'browser-local.transcribe']);
const sources = new Set(['microphone', 'shared', 'participant', 'speech', 'browser-local']);
const stages = new Set(['start', 'recovery', 'teardown', 'gate', 'prepare', 'playback', 'download', 'load', 'transcription', 'event', 'backlog', 'backpressure', 'metadata', 'begin', 'read-flush', 'gap', 'finish', 'worker', 'audio', 'append', 'pin', 'attempt', 'read']);
const integer = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
// Names and codes can originate in providers or workers; token syntax alone is not redaction.
const errorNames = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'AggregateError',
  'AbortError', 'NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError',
  'InvalidStateError', 'NotSupportedError', 'SecurityError', 'QuotaExceededError',
  'TimeoutError', 'NetworkError', 'DataError', 'EncodingError', 'OperationError',
  'StorageBackpressure', 'RecordingRepositoryError', 'BrowserAsrError',
]);
const errorCodes = new Set([
  'ABORT_ERR', 'audio-gap', 'browser-local-unavailable', 'cancelled', 'download-failed',
  'external-audio-unsupported', 'f16-unavailable', 'gpu-unavailable', 'inference-failed',
  'invalid-audio', 'invalid-audio-track', 'invalid-command', 'invalid-model', 'model-busy',
  'model-missing', 'restart-limit', 'runtime-outdated', 'runtime-unavailable', 'storage-failed',
  'unavailable',
]);
const safeCode = (value: unknown): string | number | undefined => {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 25 ? value : undefined;
  if (typeof value !== 'string') return undefined;
  if (errorCodes.has(value)) return value;
  return /^http_[1-5][0-9]{2}$/.test(value) ? value : undefined;
};
function exception(error: unknown, depth = 0): VoiceErrorException {
  if (!error || typeof error !== 'object') return { name: 'Error' };
  const e = error as { name?: unknown; code?: unknown; stack?: unknown; frames?: unknown; cause?: unknown };
  const frames = typeof e.stack === 'string' ? e.stack.slice(0, 8192).split('\n')
    .filter((line) => /^\s*at\s|@.*:\d+:\d+$/.test(line))
    .map((line) => /:(\d{1,8}):(\d{1,8})\)?\s*$/.exec(line)?.slice(1).join(':'))
    .filter((frame): frame is string => Boolean(frame)).slice(0, 12) : Array.isArray(e.frames)
      ? e.frames.filter((frame): frame is string => typeof frame === 'string' && /^[0-9]{1,8}:[0-9]{1,8}$/.test(frame)).slice(0, 12)
      : [];
  const code = safeCode(e.code);
  return {
    name: typeof e.name === 'string' && errorNames.has(e.name) ? e.name : 'Error',
    ...(code !== undefined ? { code } : {}),
    ...(frames.length ? { frames } : {}),
    ...(depth < 2 && e.cause != null && e.cause !== error ? { cause: exception(e.cause, depth + 1) } : {}),
  };
}
/** Sanitize untrusted live or persisted events; never carry message text or unknown properties. */
export function sanitizeVoiceErrorEvent(value: unknown): VoiceErrorEvent | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const event = value as { at?: unknown; operation?: unknown; context?: unknown; exception?: unknown };
    const at = integer(event.at);
    if (at === undefined || at < 0 || !event.exception || typeof event.exception !== 'object') return null;
    const context = event.context && typeof event.context === 'object' ? event.context as VoiceErrorContext : {};
    const safe: VoiceErrorContext = {};
    if (typeof context.source === 'string' && sources.has(context.source)) safe.source = context.source;
    if (typeof context.stage === 'string' && stages.has(context.stage)) safe.stage = context.stage;
    if (typeof context.recordingId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.recordingId)) safe.recordingId = context.recordingId;
    if (Number.isSafeInteger(context.attempt) && context.attempt! >= 0 && context.attempt! <= 100) safe.attempt = context.attempt;
    if (Number.isSafeInteger(context.status) && context.status! >= 100 && context.status! <= 599) safe.status = context.status;
    return { at, operation: typeof event.operation === 'string' && operations.has(event.operation) ? event.operation : 'voice.unknown', context: safe, exception: exception(event.exception) };
  } catch { return null; }
}
export function reportVoiceError(
  operation: string, error: unknown, context: VoiceErrorContext = {},
  _options: { operationalMessage?: boolean } = {}, target: Target = globalThis as unknown as Target,
): void {
  try {
    const sink = target[VOICE_ERROR_SINK];
    if (typeof sink !== 'function') return;
    const info = exception(error);
    if (info.name === 'AbortError') return;
    const event = sanitizeVoiceErrorEvent({ at: Date.now(), operation, context, exception: info });
    if (event) (sink as Sink)(event);
  } catch {
    // Diagnostics must not change voice behavior.
  }
}
export function installVoiceErrorSink(target: Target, sink: Sink): () => void {
  target[VOICE_ERROR_SINK] = sink;
  return () => { if (target[VOICE_ERROR_SINK] === sink) delete target[VOICE_ERROR_SINK]; };
}
