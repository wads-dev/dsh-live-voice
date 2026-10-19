import { HostAudioSpeakingEngine } from '../audio/HostAudioEngine.js';

/** Reuse host-audio preparation, cancellation and browser playback without queue changes. */
export class ChatterboxSpeakingEngine extends HostAudioSpeakingEngine {
  constructor({ globals = globalThis, lang = 'pt-BR' } = {}) {
    super({
      endpoint: '/api/dsh-live-voice/chatterbox/speech',
      capability: '/api/dsh-live-voice/chatterbox/capabilities',
      globals,
      lang,
      synthesisRate: () => 1,
    } as any);
  }
}
