/** Classify only failures caught at a fetch boundary, never arbitrary TypeErrors. */
export function voiceNetworkFailure(error: any, signal?: AbortSignal) {
  if (signal?.aborted || error?.name === 'AbortError') return error;
  if (!['TypeError', 'NetworkError', 'TimeoutError'].includes(error?.name)) return error;
  return Object.assign(new Error(error.message, { cause: error }), {
    name: error.name,
    code: error.name === 'TimeoutError' ? 'network-timeout' : 'network',
    retryable: true,
  });
}
