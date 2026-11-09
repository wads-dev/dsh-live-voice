import React from 'react';
import type { RecordingSegment } from '../../live-voice/src/modules/recording/types.js';
import type { RecordingsTranslation } from './i18n/recordings/base.js';
/** One latest successful nonempty attempt per visible row, in displayed order. */
export function segmentTranscripts(segments: RecordingSegment[]) {
  return segments
    .map(
      (segment) =>
        [...segment.attempts]
          .reverse()
          .find((attempt) => attempt.status === 'success' && attempt.text?.trim())
          ?.text?.trim() || '',
    )
    .filter(Boolean)
    .join('\n\n');
}
export function CopyTranscripts({
  segments,
  copy,
}: {
  segments: RecordingSegment[];
  copy: RecordingsTranslation;
}) {
  const text = segmentTranscripts(segments);
  const ref = React.useRef<HTMLButtonElement>(null);
  const mounted = React.useRef(true);
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<'success' | 'error' | null>(null);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  React.useEffect(() => setFeedback(null), [text]);
  return (
    <span className="dlvd-copy-transcripts">
      <button
        ref={ref}
        type="button"
        disabled={!text || busy}
        title={copy.copyTranscriptsHelp}
        onClick={async () => {
          setBusy(true);
          setFeedback(null);
          try {
            const clipboard = ref.current?.ownerDocument.defaultView?.navigator.clipboard;
            if (!clipboard?.writeText) throw Error('clipboard-unavailable');
            await clipboard.writeText(text);
            if (mounted.current) setFeedback('success');
          } catch {
            if (mounted.current) setFeedback('error');
          } finally {
            if (mounted.current) setBusy(false);
          }
        }}
      >
        {copy.copyTranscripts}
      </button>
      {feedback && (
        <span role={feedback === 'error' ? 'alert' : 'status'}>
          {feedback === 'error' ? copy.copyTranscriptsError : copy.copyTranscriptsSuccess}
        </span>
      )}
    </span>
  );
}
