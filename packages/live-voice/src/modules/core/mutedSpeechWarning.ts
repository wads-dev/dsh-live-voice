/** Per-input speech clock with trailing silence debounce; never retains transcript text. */
export class MutedSpeechWarning {
  private speechSince: number | null = null;
  private silenceSince: number | null = null;
  private visible = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private changed: () => void,
    private now = () => Date.now(),
  ) {}
  private schedule(delay: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.changed();
    }, delay);
  }
  reset() {
    this.speechSince = this.silenceSince = null;
    this.visible = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  update(state: any) {
    if (!state.muted || !(state.listening || state.starting) || state.navigationPaused) {
      this.reset();
      return false;
    }
    const now = this.now();
    if (state.inputSpeechActive === true) {
      this.silenceSince = null;
      if (this.visible) {
        clearTimeout(this.timer);
        this.timer = undefined;
        return true;
      }
      if (this.speechSince === null) this.speechSince = now;
      const remaining = 4000 - (now - this.speechSince);
      if (remaining <= 0) {
        this.visible = true;
        clearTimeout(this.timer);
        this.timer = undefined;
        return true;
      }
      this.schedule(remaining);
      return false;
    }
    this.speechSince = null;
    if (!this.visible) {
      this.reset();
      return false;
    }
    if (this.silenceSince === null) this.silenceSince = now;
    const remaining = 3000 - (now - this.silenceSince);
    if (remaining <= 0) {
      this.reset();
      return false;
    }
    this.schedule(remaining);
    return true;
  }
}
