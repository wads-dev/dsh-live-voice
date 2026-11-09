import type { RecordingEvent } from '../../live-voice/src/modules/recording/types.js';

export const eventCategories = [
  'waiting',
  'playback',
  'capture',
  'command',
  'ignored',
  'attention',
] as const;
export type EventCategory = (typeof eventCategories)[number];
export function eventCategory(kind: string): EventCategory {
  if (kind === 'transcription-ignored-muted') return 'ignored';
  if (kind === 'voice-command-recognized') return 'command';
  if (kind.startsWith('assistant-wait')) return 'waiting';
  if (
    kind.includes('error') ||
    kind.includes('failed') ||
    kind.includes('cancel') ||
    kind.includes('interruption')
  )
    return 'attention';
  if (kind.startsWith('capture-') || kind === 'input-stop-complete') return 'capture';
  return 'playback';
}
/** Paired intervals on the captured sample clock only; zero-width capture gaps remain points. */
export function eventIntervals(events: RecordingEvent[], frontier: number) {
  const open = new Map<string, RecordingEvent>();
  const ranges: { category: 'waiting' | 'playback'; start: number; end: number }[] = [];
  for (const event of events) {
    const category = event.kind.startsWith('assistant-wait') ? 'waiting' : 'playback';
    const starts =
      event.kind === 'assistant-wait-start' ||
      event.kind === 'assistant-start' ||
      event.kind === 'assistant-resume';
    const ends =
      event.kind === 'assistant-wait-end' ||
      ['assistant-end', 'assistant-pause', 'assistant-cancel', 'assistant-error'].includes(
        event.kind,
      );
    if (starts && !open.has(category)) open.set(category, event);
    if (ends && open.has(category)) {
      const begin = open.get(category)!;
      open.delete(category);
      if (event.atSample > begin.atSample)
        ranges.push({ category, start: begin.atSample, end: event.atSample });
    }
  }
  for (const [category, begin] of open)
    if (frontier > begin.atSample)
      ranges.push({
        category: category as 'waiting' | 'playback',
        start: begin.atSample,
        end: frontier,
      });
  return ranges;
}
export interface EventGroup {
  key: string;
  category: EventCategory;
  fraction: number;
  events: RecordingEvent[];
}
/** Visual grouping only. Every original event and its two clocks remain intact. */
export function groupTimelineEvents(
  events: RecordingEvent[],
  start: number,
  end: number,
  width: number,
): EventGroup[] {
  const span = Math.max(1, end - start);
  const slots = Math.max(1, Math.floor(Math.max(1, width) / 36));
  const groups = new Map<string, EventGroup>();
  for (const event of events) {
    if (event.atSample < start || event.atSample > end) continue;
    const category = eventCategory(event.kind);
    const fraction = (event.atSample - start) / span;
    const slot = Math.min(slots - 1, Math.floor(fraction * slots));
    const key = category + ':' + slot;
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { key, category, fraction, events: [event] });
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      events: [...group.events].sort(
        (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
      ),
      // Center each occupied bucket; avoids overlapping buttons and clipping at either boundary.
      fraction: (Number(group.key.split(':')[1]) + 0.5) / slots,
    }))
    .sort(
      (a, b) =>
        eventCategories.indexOf(a.category) - eventCategories.indexOf(b.category) ||
        a.fraction - b.fraction,
    );
}
