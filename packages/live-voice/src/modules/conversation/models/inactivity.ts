/** One application-owned clock for all sources feeding the committed composer. */
export class VoiceInactivity {
  snapshot = { phase: 'idle', remaining: 0 };
  listeners = new Set<() => void>();
  active = false;
  lastText = 0;
  lastTick = 0;
  deadline = 0;
  busySince = 0;
  warningText = '';
  echoUntil = 0;
  constructor(
    private options: {
      now?: () => number;
      warn: (seconds: number) => string;
      end: () => void;
    },
  ) {}
  now = () => this.options.now?.() ?? Date.now();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  patch(phase: string, remaining = 0) {
    if (this.snapshot.phase === phase && this.snapshot.remaining === remaining) return;
    this.snapshot = { phase, remaining };
    for (const listener of this.listeners) listener();
  }
  keepAlive = () => {
    this.lastText = this.now();
    this.deadline = 0;
    this.busySince = 0;
    this.patch('idle');
  };
  /** Filter only matching warning echo; unrelated replies remain eligible. */
  recognized(text: string) {
    const normalize = (value: string) =>
      value
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    if (!text.trim()) return true;
    const heard = normalize(text);
    const own = normalize(this.warningText);
    if (
      this.now() < this.echoUntil &&
      heard.length >= 24 &&
      heard.length >= own.length / 2 &&
      own.includes(heard)
    )
      return false;
    this.keepAlive();
    return true;
  }
  tick(active: boolean, busy: boolean, settings: any) {
    const now = this.now();
    const gap = this.lastTick && now - this.lastTick > 10000;
    this.lastTick = now;
    if (!settings.autoEndEnabled || !active) {
      this.active = false;
      if (this.snapshot.phase !== 'ended' || active) this.patch('idle');
      return;
    }
    if (!this.active) {
      this.active = true;
      this.keepAlive();
    }
    const total = settings.autoEndMinutes * 60000;
    const warning = settings.autoEndWarningMinutes * 60000;
    // A delayed/background/suspended timer must provide a fresh full warning window.
    if (gap && now - this.lastText >= total - warning) this.lastText = now - (total - warning);
    if (now - this.lastText < total - warning) return;
    if (!this.deadline || gap) {
      this.deadline = Math.max(this.lastText + total, now + warning);
      this.patch('warning', Math.ceil((this.deadline - now) / 1000));
      this.echoUntil = now + 30000;
      this.warningText = this.options.warn(this.snapshot.remaining);
    }
    this.patch('warning', Math.max(0, Math.ceil((this.deadline - now) / 1000)));
    if (now < this.deadline) return;
    // Protect speech already underway and queued recognition, but never wait forever.
    if (busy) {
      if (!this.busySince) this.busySince = now;
      if (now - this.busySince < 30000) return;
    }
    this.active = false;
    this.patch('ended');
    this.options.end();
  }
}
