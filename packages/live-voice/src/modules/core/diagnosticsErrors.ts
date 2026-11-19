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
const token = (value: unknown) =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9_.:-]{0,95}$/i.test(value) ? value : undefined;
const integer = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
function exception(error: unknown, operationalMessage: boolean, depth = 0): VoiceErrorException {
  if (!error || typeof error !== 'object') return { name: typeof error };
  const e = error as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown; cause?: unknown };
  const frames = typeof e.stack === 'string' ? e.stack.slice(0, 8192).split('\n')
    .filter((line) => /^\s*at\s|@.*:\d+:\d+$/.test(line))
    .map((line) => /:(\d{1,8}):(\d{1,8})\)?\s*$/.exec(line)?.slice(1).join(':'))
    .filter((frame): frame is string => Boolean(frame)).slice(0, 12) : [];
  const code = integer(e.code) ?? token(e.code);
  return {
    name: token(e.name) ?? 'Error',
    ...(code !== undefined ? { code } : {}),
    // Only opt in for errors whose messages cannot contain user or provider content.
    ...(operationalMessage && typeof e.message === 'string' ? { message: e.message.slice(0, 320).replace(/[\r\n\t]+/g, ' ') } : {}),
    ...(frames.length ? { frames } : {}),
    ...(depth < 2 && e.cause != null && e.cause !== error ? { cause: exception(e.cause, false, depth + 1) } : {}),
  };
}
export function reportVoiceError(
  operation: string, error: unknown, context: VoiceErrorContext = {},
  options: { operationalMessage?: boolean } = {}, target: Target = globalThis as unknown as Target,
): void {
  try {
    const sink = target[VOICE_ERROR_SINK];
    if (typeof sink !== 'function') return;
    const info = exception(error, options.operationalMessage === true);
    if (info.name === 'AbortError') return;
    const safe: VoiceErrorContext = {};
    for (const key of ['source', 'recordingId', 'stage'] as const) {
      const value = token(context[key]);
      if (value !== undefined) safe[key] = value;
    }
    for (const key of ['attempt', 'status'] as const) {
      const value = integer(context[key]);
      if (value !== undefined) safe[key] = value;
    }
    (sink as Sink)({ at: Date.now(), operation: token(operation) ?? 'voice.unknown', context: safe, exception: info });
  } catch {
    // Diagnostics must not change voice behavior.
  }
}
export function installVoiceErrorSink(target: Target, sink: Sink): () => void {
  target[VOICE_ERROR_SINK] = sink;
  return () => { if (target[VOICE_ERROR_SINK] === sink) delete target[VOICE_ERROR_SINK]; };
}
