import { defaultSettings, normalizeSourceName } from '../../core/settings.js';

export type MeetingSource = 'microphone' | 'shared' | `attendee:${string}`;

/** One composer writer; independent recognizers deliver final chunks in arrival order. */
export class MeetingTranscript {
  private active = new Set<MeetingSource>();
  private labels = new Map<MeetingSource, string>();
  setLabel(source: MeetingSource, name: string) {
    this.labels.set(source, normalizeSourceName(name, source));
  }
  forget(source: MeetingSource) {
    this.active.delete(source);
    this.labels.delete(source);
    this.sourceTimestamps.delete(source);
    if (this.last === source) this.last = null;
  }
  private last: MeetingSource | null = null;
  private timestamps = false;
  private sourceTimestamps = new Map<MeetingSource, boolean>();
  setSourceTimestamps(source: MeetingSource, enabled: boolean) {
    if (this.sourceTimestamps.get(source) === enabled) return;
    this.sourceTimestamps.set(source, enabled);
  }
  setTimestamps(enabled: boolean) {
    this.timestamps = enabled;
  }
  constructor(
    private composer: { getDraft(): string; setDraft(text: string): void },
    private settings: () => { microphoneSourceName?: string; sharedSourceName?: string } = () =>
      defaultSettings,
  ) {}
  setActive(source: MeetingSource, enabled: boolean) {
    if (enabled) this.active.add(source);
    else this.active.delete(source);
  }
  append(source: MeetingSource, text: string, startedAt?: number, paragraphBefore = false) {
    const chunk = text.trim().replace(/\s*\r?\n\s*/g, ' ');
    if (!chunk || !this.active.has(source)) return;
    const draft = this.composer.getDraft();
    if (!draft) this.last = null;
    const labelled = this.active.size > 1 || source.startsWith('attendee:');
    const timestamps = this.sourceTimestamps.get(source) ?? this.timestamps;
    const changed = this.last !== source || paragraphBefore;
    const date = new Date(Number.isFinite(startedAt) ? startedAt! : Date.now());
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp =
      timestamps && changed
        ? '[' +
          date.getFullYear() +
          '/' +
          pad(date.getMonth() + 1) +
          '/' +
          pad(date.getDate()) +
          ' ' +
          pad(date.getHours()) +
          ':' +
          pad(date.getMinutes()) +
          ':' +
          pad(date.getSeconds()) +
          '] '
        : '';
    const key = source === 'microphone' ? 'microphoneSourceName' : 'sharedSourceName';
    const name =
      this.labels.get(source) || normalizeSourceName(this.settings()[key], defaultSettings[key]);
    const prefix = changed ? stamp + (labelled ? name + ': ' : '') : '';
    const boundary =
      paragraphBefore ||
      (this.last !== null && this.last !== source) ||
      (this.last === null && (labelled || timestamps));
    const separator = draft
      ? boundary
        ? /\n\n$/.test(draft)
          ? ''
          : /\n$/.test(draft)
            ? '\n'
            : '\n\n'
        : /\s$/.test(draft)
          ? ''
          : ' '
      : '';
    const next = draft + separator + prefix + chunk;
    this.composer.setDraft(next);
    this.last = source;
  }
  reset() {
    this.active.clear();
    this.last = null;
  }
}
