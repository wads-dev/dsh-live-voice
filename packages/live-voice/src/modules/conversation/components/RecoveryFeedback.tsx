import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';

/** Source-scoped runtime feedback; dismissal never cancels or resumes recovery. */
export function RecoveryFeedback({
  recovery,
  source,
  detail,
  onRetry,
}: {
  recovery?: { attempt: number; maxAttempts: number; retrying: boolean; reason: string } | null;
  source: 'microphone' | 'shared' | 'speech';
  detail?: string | null;
  onRetry?(): void;
}) {
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  if (!recovery) return null;
  const copy = (commons as any).recovery;
  return (
    <div className="dlv-error" role="status" aria-live="polite" data-recovery-source={source}>
      <span>
        {copy[recovery.retrying ? 'retrying' : 'stopped']({
          source: copy[source](),
          attempt: recovery.attempt,
          maxAttempts: recovery.maxAttempts,
          reason: detail ? recovery.reason + ': ' + detail : recovery.reason,
        })}
        {!recovery.retrying
          ? ' ' + copy[source === 'speech' ? 'speechAction' : 'inputAction']()
          : ''}
      </span>
      {!recovery.retrying && onRetry ? (
        <button type="button" onClick={onRetry}>
          {copy.retry()}
        </button>
      ) : null}
    </div>
  );
}
