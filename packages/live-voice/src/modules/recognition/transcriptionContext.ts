/** Shared request contract; context is a recognition hint, never agent instructions. */
export const TRANSCRIPTION_CONTEXT_MAX_LENGTH = 1000;

export function transcriptionContext(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (
    typeof value !== 'string' ||
    value.length > TRANSCRIPTION_CONTEXT_MAX_LENGTH ||
    value.includes('\0')
  )
    throw new Error('Transcription context must contain at most 1000 characters without NUL.');
  return value.trim();
}

/** WAV transport keeps its existing body; percent encoding permits Unicode and newlines. */
export function transcriptionContextHeader(value: unknown): Record<string, string> {
  const text = transcriptionContext(value);
  return text ? { 'x-dlv-transcription-context': encodeURIComponent(text) } : {};
}

export function readTranscriptionContextHeader(headers: Headers): string {
  const encoded = headers.get('x-dlv-transcription-context');
  if (encoded === null) return '';
  // At most nine encoded ASCII bytes per UTF-16 code unit, keeping headers bounded.
  if (encoded.length > TRANSCRIPTION_CONTEXT_MAX_LENGTH * 9)
    throw new Error('Transcription context header is too large.');
  return transcriptionContext(decodeURIComponent(encoded));
}
