import React from 'react';
import { formatBytes } from './formatBytes.js';
import type {
  RecordingService,
  RecordingSession,
} from '../../live-voice/src/modules/recording/types.js';
import type { RecordingsTranslation } from './i18n/recordings/base.js';

export const recordingBusy = (session: RecordingSession) =>
  session.state === 'recording' || session.attempts.some((a) => a.status === 'pending');
export function recordingStorage(sessions: RecordingSession[]) {
  let bytes = 0,
    unknown = 0;
  for (const session of sessions) {
    if (
      typeof session.audioBytes === 'number' &&
      Number.isFinite(session.audioBytes) &&
      session.audioBytes >= 0
    )
      bytes += session.audioBytes;
    else unknown++;
  }
  return { bytes, unknown, count: sessions.length };
}
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/{([a-zA-Z]+)}/g, (all, key) => String(values[key] ?? all));
type Preview = { ids: string[]; bytes: number; unknown: number; stars: number; busy: number };
type Result = { removed: number; skipped: number; failed: number };

/** Bulk deletion is bounded by the explicitly confirmed snapshot, never the changing live list. */
export function RecordingStorage({
  locale = 'en',
  service,
  sessions,
  loading,
  failed,
  copy,
  refresh,
  onBusy,
}: {
  locale?: string;
  service: RecordingService;
  sessions: RecordingSession[];
  loading: boolean;
  failed: boolean;
  copy: RecordingsTranslation;
  refresh(): void;
  onBusy(busy: boolean): void;
}) {
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [progress, setProgress] = React.useState(0);
  const lifetime = React.useRef(0);
  const running = React.useRef(false);
  const currentService = React.useRef(service);
  currentService.current = service;
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const cancel = React.useRef<HTMLButtonElement>(null);
  const status = React.useRef<HTMLParagraphElement>(null);
  const id = React.useId();
  React.useEffect(() => {
    ++lifetime.current;
    setPreview(null);
    setResult(null);
    setBusy(false);
    running.current = false;
    onBusy(false);
    const invalidate = () => {
      ++lifetime.current;
      running.current = false;
    };
    const hide = () => {
      invalidate();
      setPreview(null);
      setBusy(false);
      setResult(null);
      onBusy(false);
    };
    const win = root.current?.ownerDocument.defaultView;
    win?.addEventListener('pagehide', hide);
    return () => {
      invalidate();
      win?.removeEventListener('pagehide', hide);
    };
  }, [service]);
  React.useEffect(() => {
    if (preview && !busy) cancel.current?.focus();
  }, [preview]);
  const total = recordingStorage(sessions);
  const eligible = sessions.filter((s) => !recordingBusy(s));
  const dismiss = () => {
    if (running.current) return;
    setPreview(null);
    trigger.current?.focus();
  };
  const startPreview = () => {
    if (running.current || loading || failed) return;
    const candidates = sessions.filter((s) => !recordingBusy(s));
    const size = recordingStorage(candidates);
    setResult(null);
    setPreview({
      ids: candidates.map((s) => s.id),
      bytes: size.bytes,
      unknown: size.unknown,
      stars: candidates.filter((s) => s.starred).length,
      busy: sessions.length - candidates.length,
    });
  };
  const remove = async () => {
    if (!preview || running.current || failed || loading) return;
    running.current = true;
    setBusy(true);
    onBusy(true);
    setProgress(0);
    const token = lifetime.current;
    const valid = () => token === lifetime.current && currentService.current === service;
    const outcome: Result = { removed: 0, skipped: preview.busy, failed: 0 };
    try {
      for (const recordingId of preview.ids) {
        if (!valid()) return;
        try {
          const latest = await service.get(recordingId);
          if (!valid()) return;
          if (!latest || recordingBusy(latest)) outcome.skipped++;
          else {
            await service.remove(recordingId);
            outcome.removed++;
          }
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === 'active-recording' || code === 'not-found') outcome.skipped++;
          else outcome.failed++;
        }
        if (!valid()) return;
        setProgress(outcome.removed + outcome.failed + outcome.skipped - preview.busy);
      }
      setResult(outcome);
      setPreview(null);
    } finally {
      if (valid()) {
        running.current = false;
        setBusy(false);
        onBusy(false);
        refresh();
        // Focus an existing status surface after React commits the completed summary.
        queueMicrotask(() => {
          if (valid()) status.current?.focus();
        });
      }
    }
  };
  return (
    <div className="dlvd-recording-storage" ref={root}>
      <div className="dlvd-storage-overview" aria-busy={loading || busy}>
        <div>
          <h3>{copy.storageOverview}</h3>
          <p className="dlvd-audio-total">
            <span>{copy.storageTotal}: </span>
            <strong>
              {loading
                ? copy.loading
                : failed
                  ? copy.storageUnknown
                  : total.unknown
                    ? fill(copy.storagePartial, {
                        size: formatBytes(total.bytes, locale),
                        count: total.unknown,
                      })
                    : formatBytes(total.bytes, locale)}
            </strong>
          </p>
          <p className="dlvd-storage-count">
            {failed || loading ? '—' : fill(copy.storageSessions, { count: total.count })}
          </p>
        </div>
        <button
          ref={trigger}
          type="button"
          className="dlvd-delete-all"
          disabled={loading || failed || busy || !eligible.length}
          onClick={startPreview}
        >
          {copy.deleteAll}
        </button>
      </div>
      <p className="dlvd-storage-scope">{copy.storageScope}</p>
      {!loading && !failed && sessions.length > 0 && eligible.length === 0 && (
        <p role="status">{copy.deleteAllActive}</p>
      )}
      {preview && (
        <section
          className="dlvd-delete-all-confirm"
          role="group"
          aria-labelledby={id}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !busy) {
              event.stopPropagation();
              dismiss();
            }
          }}
        >
          <h4 id={id}>{copy.deleteAllConfirm}</h4>
          <p>
            {fill(copy.deleteAllPreview, {
              count: preview.ids.length,
              stars: preview.stars,
              busy: preview.busy,
            })}
          </p>
          <p>
            {copy.storageAudio}:{' '}
            {preview.unknown
              ? fill(copy.storagePartial, {
                  size: formatBytes(preview.bytes, locale),
                  count: preview.unknown,
                })
              : formatBytes(preview.bytes, locale)}
          </p>
          <p>{copy.deleteAllWarning}</p>
          <div className="dlvd-toolbar">
            <button ref={cancel} type="button" disabled={busy} onClick={dismiss}>
              {copy.cancel}
            </button>
            <button
              type="button"
              className="dlvd-delete-all"
              disabled={busy || loading || failed}
              onClick={() => void remove()}
            >
              {copy.deleteAllConfirmAction}
            </button>
          </div>
          {busy && (
            <p role="status">
              {fill(copy.deleteAllProgress, { done: progress, count: preview.ids.length })}
            </p>
          )}
        </section>
      )}
      <p
        ref={status}
        tabIndex={-1}
        className="dlvd-storage-result"
        role={result?.failed ? 'alert' : 'status'}
      >
        {result && fill(copy.deleteAllResult, result)}
      </p>
    </div>
  );
}
