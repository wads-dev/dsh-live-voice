import React from 'react';
import type { RecordingsTranslation } from './i18n/recordings/base.js';

type Part = 'start' | 'end' | 'range';
interface Props {
  total: number;
  start: number;
  end: number;
  copy: RecordingsTranslation;
  format(sample: number): string;
  onChange(start: number, end: number): void;
  onReset(): void;
}
/** A single sample-clock track: resize either edge or pan the fixed-width selection. */
export function TimelineWindow({ total, start, end, copy, format, onChange, onReset }: Props) {
  const track = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    pointer: number;
    x: number;
    width: number;
    total: number;
    start: number;
    end: number;
    part: Part;
    element: HTMLButtonElement;
  } | null>(null);
  const stopDrag = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.element.hasPointerCapture(current.pointer))
      current.element.releasePointerCapture(current.pointer);
  };
  React.useEffect(() => {
    if (total <= 0) stopDrag();
  }, [total]);
  React.useEffect(() => stopDrag, []);
  const change = (part: Part, delta: number, initialStart = start, initialEnd = end) => {
    if (total <= 0) return;
    if (part === 'start')
      onChange(Math.max(0, Math.min(initialEnd - 1, initialStart + delta)), initialEnd);
    else if (part === 'end')
      onChange(initialStart, Math.min(total, Math.max(initialStart + 1, initialEnd + delta)));
    else {
      const offset = Math.max(-initialStart, Math.min(total - initialEnd, delta));
      onChange(initialStart + offset, initialEnd + offset);
    }
  };
  const begin = (event: React.PointerEvent<HTMLButtonElement>, part: Part) => {
    if (total <= 0 || event.button !== 0 || drag.current) return;
    const width = track.current?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      width,
      total,
      start,
      end,
      part,
      element: event.currentTarget,
    };
  };
  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    change(
      current.part,
      Math.round(((event.clientX - current.x) * current.total) / current.width),
      current.start,
      current.end,
    );
  };
  const finish = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    stopDrag();
  };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, part: Part) => {
    const step = Math.max(1, Math.round(total / (event.shiftKey ? 10 : 100)));
    const amount = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -step * 10,
      PageUp: step * 10,
    }[event.key];
    let delta = amount;
    if (event.key === 'Home') delta = part === 'end' ? start + 1 - end : -start;
    if (event.key === 'End') delta = part === 'start' ? end - 1 - start : total - end;
    if (delta === undefined) return;
    event.preventDefault();
    change(part, delta);
  };
  const handlers = (part: Part) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => begin(event, part),
    onPointerMove: move,
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      move(event);
      finish(event);
    },
    onPointerCancel: finish,
    onLostPointerCapture: () => {
      drag.current = null;
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => keyboard(event, part),
  });
  const percent = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  return (
    <div className="dlvd-timeline-window" role="group" aria-label={copy.window}>
      <div className="dlvd-window-selector">
        <div className="dlvd-window-values">
          <span>
            {copy.start}: {format(start)}
          </span>
          <span>
            {copy.end}: {format(end)}
          </span>
        </div>
        <div className="dlvd-window-track" ref={track}>
          <button
            type="button"
            role="slider"
            className="dlvd-window-selection"
            aria-label={copy.window}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, total - (end - start))}
            aria-valuenow={start}
            aria-valuetext={format(start) + ' – ' + format(end)}
            aria-orientation="horizontal"
            disabled={total <= 0}
            style={{ left: percent(start) + '%', width: percent(end - start) + '%' }}
            {...handlers('range')}
          />
          <button
            type="button"
            role="slider"
            className="dlvd-window-handle"
            data-edge="start"
            aria-label={copy.windowStart}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, end - 1)}
            aria-valuenow={start}
            aria-valuetext={format(start)}
            aria-orientation="horizontal"
            disabled={total <= 0}
            style={{ left: percent(start) + '%' }}
            {...handlers('start')}
          />
          <button
            type="button"
            role="slider"
            className="dlvd-window-handle"
            data-edge="end"
            aria-label={copy.windowEnd}
            aria-valuemin={Math.min(total, start + 1)}
            aria-valuemax={total}
            aria-valuenow={end}
            aria-valuetext={format(end)}
            aria-orientation="horizontal"
            disabled={total <= 0}
            style={{ left: percent(end) + '%' }}
            {...handlers('end')}
          />
        </div>
      </div>
      <button
        type="button"
        className="dlvd-window-reset"
        title={copy.windowReset}
        aria-label={copy.windowReset}
        onClick={onReset}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8l-5-5m13 5 5-5M8 16l-5 5m13-5 5 5" />
        </svg>
      </button>
    </div>
  );
}
