import { decodeAttendeePcm } from './attendeeProtocol.js';
/** Silent PCM source: no microphone, speakers, or network ownership. */
export class ParticipantPcmMeter {
  context: any;
  source: any;
  stream: any = null;
  private lastSeen = 0;
  private active = false;
  private listener?: (pcm: Float32Array, rate: number) => void;
  private pending: Float32Array[] = [];
  private samples = 0;
  private volume = 0;
  constructor(readonly sampleRate: number) {
    this.context = { sampleRate };
    this.source = {};
  }
  async capability() {
    return { supported: true };
  }
  async start({ signal }: any = {}) {
    this.active = !signal?.aborted;
    return this.active;
  }
  level() {
    return this.active && Date.now() - this.lastSeen < 300 ? this.volume : 0;
  }
  push(chunk: string) {
    if (!this.active) return;
    const pcm = decodeAttendeePcm(chunk);
    this.lastSeen = Date.now();
    this.volume = Math.min(1, Math.sqrt(pcm.reduce((s, x) => s + x * x, 0) / pcm.length) * 5);
    if (this.listener) this.listener(pcm, this.sampleRate);
    else {
      this.samples += pcm.length;
      if (this.samples > this.sampleRate * 5) throw new Error('overloaded');
      this.pending.push(pcm);
    }
  }
  subscribePcm(listener: (pcm: Float32Array, rate: number) => void) {
    if (this.listener) throw new Error('capture-owned');
    this.listener = listener;
    for (const pcm of this.pending.splice(0)) listener(pcm, this.sampleRate);
    this.samples = 0;
    return () => {
      if (this.listener === listener) this.listener = undefined;
    };
  }
  async stop() {
    this.active = false;
    this.listener = undefined;
    this.pending = [];
    this.samples = 0;
    this.volume = 0;
  }
  release() {
    return this.stop();
  }
}
