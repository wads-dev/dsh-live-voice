import React from 'react';
import type { RecordingEvent } from '../../live-voice/src/modules/recording/types.js';
import type { RecordingsTranslation } from './i18n/recordings/base.js';
import {
  eventCategories,
  groupTimelineEvents,
  type EventCategory,
  type EventGroup,
} from './eventTimelineModel.js';

function EventGlyph({ kind }: { kind: string }) {
  const path = kind.includes('command')
    ? 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z'
    : kind.includes('wait')
      ? 'M6 3h12M6 21h12M7 3v4l10 10v4M17 3v4L7 17v4'
      : kind.includes('error') || kind.includes('failed')
        ? 'M12 3 2 21h20L12 3ZM12 9v5M12 17v.1'
        : kind.includes('cancel')
          ? 'm6 6 12 12M6 18 18 6'
          : kind.includes('pause') || kind.includes('interruption')
            ? 'M8 5v14M16 5v14'
            : kind.endsWith('end') || kind === 'input-stop-complete'
              ? 'M5 5h14v14H5Z'
              : kind.startsWith('capture')
                ? 'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8'
                : 'm7 4 13 8-13 8Z';
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
interface Props {
  events: RecordingEvent[];
  start: number;
  end: number;
  copy: RecordingsTranslation;
  format(sample: number): string;
  name(kind: string): string;
  details(event: RecordingEvent): string;
  onSelect(events: RecordingEvent[]): void;
}
/** Semantic lanes. The immediate tooltip is deliberately transparent to all pointer input. */
export function EventTimeline({
  events,
  start,
  end,
  copy,
  format,
  name,
  details,
  onSelect,
}: Props) {
  const root = React.useRef<HTMLDivElement>(null);
  const lanes = React.useRef<HTMLDivElement>(null);
  const bubble = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(720);
  const [active, setActive] = React.useState<{ key: string; anchor: HTMLButtonElement } | null>(
    null,
  );
  const tooltipId = React.useId();
  const groups = React.useMemo(
    () => groupTimelineEvents(events, start, end, width),
    [events, start, end, width],
  );
  const group = groups.find((item) => item.key === active?.key);
  const labels: Record<EventCategory, string> = {
    waiting: copy.eventWaiting,
    playback: copy.eventPlayback,
    capture: copy.eventCapture,
    command: copy.eventCommand,
    attention: copy.eventAttention,
  };
  const timestamp = (event: RecordingEvent) =>
    new Date(event.occurredAt).toLocaleString() +
    '.' +
    new Date(event.occurredAt).getMilliseconds().toString().padStart(3, '0');
  const describe = (item: EventGroup) =>
    item.events.length === 1
      ? name(item.events[0].kind) + ' · ' + timestamp(item.events[0])
      : labels[item.category] +
        ' · ' +
        copy.eventCount.replace('{count}', String(item.events.length));
  React.useLayoutEffect(() => {
    const node = lanes.current;
    const win = node?.ownerDocument.defaultView;
    if (!node || !win) return;
    const update = () => setWidth(node.getBoundingClientRect().width || 720);
    update();
    const observer = win.ResizeObserver ? new win.ResizeObserver(update) : null;
    observer?.observe(node);
    win.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      win.removeEventListener('resize', update);
    };
  }, []);
  React.useEffect(() => setActive(null), [start, end]);
  React.useLayoutEffect(() => {
    const node = bubble.current;
    const anchor = active?.anchor;
    const doc = root.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!node || !anchor || !group || !win) return;
    node.showPopover?.();
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const size = node.getBoundingClientRect();
      node.style.left =
        Math.max(
          8,
          Math.min(rect.left + rect.width / 2 - size.width / 2, win.innerWidth - size.width - 8),
        ) + 'px';
      const top = rect.top - size.height - 8;
      node.style.top =
        Math.max(8, top >= 8 ? top : Math.min(rect.bottom + 8, win.innerHeight - size.height - 8)) +
        'px';
    };
    position();
    const close = () => setActive(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    win.addEventListener('scroll', position, true);
    win.addEventListener('resize', close);
    doc!.addEventListener('keydown', key, true);
    doc!.addEventListener('pointerdown', close, true);
    win.addEventListener('pagehide', close);
    return () => {
      node.hidePopover?.();
      win.removeEventListener('scroll', position, true);
      win.removeEventListener('resize', close);
      doc!.removeEventListener('keydown', key, true);
      doc!.removeEventListener('pointerdown', close, true);
      win.removeEventListener('pagehide', close);
    };
  }, [active, group, copy]);
  const show = (item: EventGroup, anchor: HTMLButtonElement) =>
    setActive({ key: item.key, anchor });
  return (
    <div className="dlvd-event-timeline" ref={root}>
      <div className="dlvd-event-legend">
        {eventCategories.map((category) => (
          <span key={category} data-category={category}>
            <EventGlyph
              kind={
                category === 'waiting'
                  ? 'wait'
                  : category === 'capture'
                    ? 'capture-start'
                    : category === 'attention'
                      ? 'error'
                      : category === 'command'
                        ? 'voice-command'
                        : 'assistant-start'
              }
            />
            {labels[category]}
          </span>
        ))}
      </div>
      <p className="dlvd-event-help">{copy.eventTrackHelp}</p>
      <div className="dlvd-event-track" ref={lanes} role="group" aria-label={copy.events}>
        {eventCategories.map((category) => (
          <div
            className="dlvd-event-lane"
            key={category}
            data-category={category}
            role="group"
            aria-label={labels[category]}
          >
            {groups
              .filter((item) => item.category === category)
              .map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className="dlvd-event-marker"
                  data-category={category}
                  data-event={item.events.length === 1 ? item.events[0].kind : 'group'}
                  data-count={item.events.length}
                  style={{ left: item.fraction * 100 + '%' }}
                  aria-label={describe(item) + ' · ' + copy.eventInspect}
                  aria-describedby={active?.key === item.key ? tooltipId : undefined}
                  onMouseEnter={(event) => show(item, event.currentTarget)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={(event) => show(item, event.currentTarget)}
                  onBlur={() => setActive(null)}
                  onClick={() => {
                    setActive(null);
                    onSelect(item.events);
                  }}
                >
                  <EventGlyph kind={item.events[0].kind} />
                  {item.events.length > 1 && (
                    <span className="dlvd-event-count">{item.events.length}</span>
                  )}
                </button>
              ))}
          </div>
        ))}
      </div>
      {group && root.current && (
        <div
          ref={bubble}
          id={tooltipId}
          role="tooltip"
          popover="manual"
          className="dlvd-event-tooltip"
          style={{ pointerEvents: 'none' }}
          data-category={group.category}
        >
          <strong>
            {labels[group.category]} ·{' '}
            {copy.eventCount.replace('{count}', String(group.events.length))}
          </strong>
          <div className="dlvd-event-tooltip-list">
            {group.events.slice(0, 5).map((event) => (
              <div key={event.id}>
                <b>{name(event.kind)}</b>
                <time dateTime={event.occurredAt}>{timestamp(event)}</time>
                <span>
                  {copy.captured}: {format(event.atSample)}
                </span>
                {details(event) && <span>{details(event)}</span>}
              </div>
            ))}
          </div>
          {group.events.length > 5 && (
            <div>{copy.eventMore.replace('{count}', String(group.events.length - 5))}</div>
          )}
          <footer>{copy.eventInspect}</footer>
        </div>
      )}
    </div>
  );
}
