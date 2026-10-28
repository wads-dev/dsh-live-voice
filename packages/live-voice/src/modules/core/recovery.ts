/** Shared conservative recovery policy. Attempts count retries, not the initial operation. */
export const MAX_RECOVERY_ATTEMPTS = 3;
export const recoveryDelayMs = (attempt: number) =>
  250 * 2 ** Math.max(0, Math.min(attempt - 1, 2));
export function isRetryableVoiceError(error: any): boolean {
  const code = [error?.code, error?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[-_]/g, '');
  if (error?.retryable === false || error?.recoverable === false) return false;
  if (
    /notallowed|permission|denied|unsupported|notsupported|security|permanent|invalid|languageunavailable|servicenotallowed/.test(
      code,
    )
  )
    return false;
  // Native media AbortError is distinct from our explicit cancellation: the adapter
  // only sets recoverable after confirming a browser-owned playback failure.
  if (error?.recoverable === true) return true;
  if (/abort|cancel|notfound/.test(code)) return false;
  if (error?.retryable === true) return true;
  return /network|timeout|timedout|temporar|unavailable|audiobusy|audiocapture|notreadable|connection|econn|http(408|429|5[0-9][0-9])/.test(
    code,
  );
}
