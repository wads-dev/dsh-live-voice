/** Selection policy is independent of engine availability and provider health. */
export const recognitionEngineOrder = Object.freeze([
  'browser',
  'whisper-browser',
  'qwen-browser',
  'qwen-http',
  'whisper-http',
]);
export function speakingEngineOrder(hostPlatform?: string) {
  return hostPlatform === 'darwin'
    ? ['say', 'browser', 'qwen-http', 'chatterbox-http']
    : ['browser', 'qwen-http', 'say', 'chatterbox-http'];
}
export function defaultSpeakingEngine(hostPlatform?: string) {
  return speakingEngineOrder(hostPlatform)[0];
}
