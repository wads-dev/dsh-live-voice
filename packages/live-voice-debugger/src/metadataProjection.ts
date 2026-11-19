import { sanitizeVoiceErrorEvent, type VoiceErrorEvent } from '../../live-voice/src/modules/core/diagnosticsErrors.js';
import { recordingSegments, type RecordingSession } from '../../live-voice/src/modules/recording/types.js';

/** Caller must establish authorization independently. A set supplied here is not proof of it.
 * These functions neither access storage nor authenticate a caller or isolate a browser.
 * IDs are used solely for selection, never returned or used to join unrelated records.
 * Each input array and the authorization set are limited to 10,000 entries; oversized
 * inputs are rejected, not truncated. Pages require a limit between 1 and 100.
 */
export interface PageRequest { offset: number; limit: number }
export interface Page<T> { items: T[]; nextOffset: number | null }
const MAX_LIMIT = 100;
// Reject oversized snapshots instead of silently returning an incomplete page.
const MAX_INPUT = 10_000;
function validate(request: PageRequest): void {
  if (!request || !Number.isSafeInteger(request.offset) || request.offset < 0 ||
      !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > MAX_LIMIT)
    throw new RangeError('Invalid pagination');
}
function bounded(items: unknown): void {
  if (!Array.isArray(items) || items.length > MAX_INPUT) throw new RangeError('Invalid or oversized input');
}
function checkIds(ids: ReadonlySet<string>): void {
  if (!(ids instanceof Set) || ids.size > MAX_INPUT) throw new Error('Invalid authorization set');
}
function page<T, U>(items: readonly T[], request: PageRequest, project: (item: T) => U): Page<U> {
  const end = Math.min(items.length, request.offset + request.limit);
  return { items: items.slice(request.offset, end).map(project), nextOffset: end < items.length ? end : null };
}
function authorized(ids: ReadonlySet<string>, id: unknown): void {
  checkIds(ids);
  if (typeof id !== 'string' || !id || !ids.has(id))
    throw new Error('Recording not authorized');
}
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const time = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
};
const choice = <T extends string>(value: unknown, values: readonly T[]): T | null =>
  typeof value === 'string' && values.includes(value as T) ? value as T : null;

export function projectRecordings(sessions: readonly RecordingSession[], ids: ReadonlySet<string>, request: PageRequest) {
  validate(request);
  checkIds(ids);
  bounded(sessions);
  return page(sessions.filter(s => typeof s.id === 'string' && ids.has(s.id)), request, s => ({
    kind: choice(s.kind, ['microphone', 'shared'] as const),
    state: choice(s.state, ['recording', 'completed', 'interrupted', 'failed'] as const),
    startedAt: time(s.startedAt), endedAt: time(s.endedAt), sampleRate: number(s.sampleRate),
    capturedSamples: number(s.capturedSamples), savedSamples: number(s.savedSamples), audioBytes: number(s.audioBytes),
    archiveGapCount: Array.isArray(s.archiveGaps) ? s.archiveGaps.length : null,
    storage: choice(s.storage, ['indexeddb', 'memory'] as const), starred: s.starred === true, persistent: s.persistent === true,
  }));
}
export function projectSegments(session: RecordingSession, ids: ReadonlySet<string>, request: PageRequest) {
  validate(request);
  authorized(ids, session?.id);
  bounded(session.pins);
  return page(recordingSegments({ ...session, attempts: [] }), request, s => ({
    kind: choice(s.kind, ['speech', 'silence'] as const), startSample: number(s.startSample),
    endSample: number(s.endSample), open: s.open === true,
  }));
}
export function projectAttempts(session: RecordingSession, ids: ReadonlySet<string>, request: PageRequest) {
  validate(request);
  authorized(ids, session?.id);
  bounded(session.attempts);
  return page(session.attempts, request, a => ({
    status: choice(a.status, ['pending', 'success', 'error'] as const),
    startSample: number(a.startSample), endSample: number(a.endSample),
    createdAt: time(a.createdAt), finishedAt: time(a.finishedAt),
    request: a.request?.transport === 'http-wav' ? {
      payloadBytes: number(a.request.payloadBytes), inputSamples: number(a.request.inputSamples),
      inputSampleRate: number(a.request.inputSampleRate), sampleCount: number(a.request.sampleCount),
      sampleRate: number(a.request.sampleRate), durationMs: number(a.request.durationMs),
      responseStatus: number(a.request.responseStatus),
    } : null,
  }));
}
export function projectEvents(session: RecordingSession, ids: ReadonlySet<string>, request: PageRequest) {
  validate(request);
  authorized(ids, session?.id);
  bounded(session.events ?? []);
  // No event details: these can contain IDs and future free-form data.
  return page(session.events ?? [], request, e => ({
    kind: choice(e.kind, [
      'transcription-ignored-muted', 'voice-command-recognized', 'assistant-wait-start', 'assistant-wait-end',
      'assistant-play-request', 'assistant-interruption-request', 'assistant-cancel', 'assistant-error',
      'input-stop-complete', 'capture-gate-failed', 'assistant-start', 'assistant-end', 'assistant-pause',
      'assistant-resume', 'capture-gated', 'capture-start', 'capture-end',
    ] as const),
    occurredAt: time(e.occurredAt), atSample: number(e.atSample),
  }));
}
export function projectErrors(events: readonly VoiceErrorEvent[], ids: ReadonlySet<string>, request: PageRequest) {
  validate(request);
  checkIds(ids);
  bounded(events);
  // Only pass fields used in the projection to the sanitizer, avoiding unbounded
  // stack/cause traversal in untrusted persisted input.
  const selected = events.map(e => {
    if (!e?.exception || typeof e.exception !== 'object') return null;
    return sanitizeVoiceErrorEvent({
      at: e.at, operation: e.operation, context: e.context,
      exception: { name: e.exception.name, code: e.exception.code },
    });
  }).filter((e): e is VoiceErrorEvent =>
    !!e && typeof e.context.recordingId === 'string' && ids.has(e.context.recordingId));
  return page(selected, request, e => ({
    at: number(e.at), operation: e.operation,
    source: e.context.source ?? null, stage: e.context.stage ?? null,
    attempt: number(e.context.attempt), status: number(e.context.status),
    exception: { name: e.exception.name, code: e.exception.code ?? null },
  }));
}
