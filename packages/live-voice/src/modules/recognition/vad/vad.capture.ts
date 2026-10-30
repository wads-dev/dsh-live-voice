// Worklet entry: globals belong to AudioWorkletGlobalScope, not the window.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  port: MessagePort;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class VadCaptureProcessor extends AudioWorkletProcessor {
  private stopped = false;
  private paused = false;
  private pcm = new Float32Array(2048);
  private at = 0;
  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (event.data?.type === 'resume') this.paused = false;
      if (event.data?.type === 'flush') {
        if (event.data.pause) this.paused = true;
        if (this.at) {
          const pcm = this.pcm.slice(0, this.at);
          this.port.postMessage({ pcm, sampleRate }, [pcm.buffer]);
          this.at = 0;
        }
        this.port.postMessage({ type: 'flushed' });
      }
      if (event.data?.type === 'stop') {
        this.stopped = true;
        if (event.data.drain && this.at) {
          const pcm = this.pcm.slice(0, this.at);
          this.port.postMessage({ pcm, sampleRate }, [pcm.buffer]);
        }
        this.at = 0;
        this.port.postMessage({ type: 'stopped' });
      }
    };
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    for (const channels of outputs) for (const channel of channels) channel.fill(0);
    if (this.stopped) return false;
    if (this.paused) return true;
    const input = inputs[0];
    if (!input?.length) return true;
    for (let i = 0; i < input[0].length; i++) {
      let sum = 0;
      for (const channel of input) sum += channel[i] || 0;
      this.pcm[this.at++] = sum / input.length;
      if (this.at === this.pcm.length) {
        this.port.postMessage({ pcm: this.pcm, sampleRate }, [this.pcm.buffer]);
        this.pcm = new Float32Array(2048);
        this.at = 0;
      }
    }
    return true;
  }
}
registerProcessor('dsh-silero-vad-capture', VadCaptureProcessor);
export {};
