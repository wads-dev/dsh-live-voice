import React from 'react';
import {
  DIAGNOSTIC_CHANGED,
  DIAGNOSTIC_KEY,
  type DiagnosticSource,
} from '../../live-voice/src/modules/core/diagnostics.js';
import { createInspector } from './inspector.js';
import type { DebuggerTranslation } from './i18n/index.js';
import { StateTree } from './StateTree.js';
import { RecordingPanel } from './RecordingPanel.js';
import { RuntimePanel } from './RuntimePanel.js';
export function DebuggerPanel({
  copy,
  locale = 'en',
  onClose,
  target = window,
}: {
  copy: DebuggerTranslation;
  locale?: string;
  onClose(): void;
  target?: any;
}) {
  const [tab, setTab] = React.useState<'recordings' | 'states' | 'runtimes'>('recordings');
  const tabsId = React.useId();
  const [frozen, setFrozen] = React.useState(false);
  const [refreshHz, setRefreshHz] = React.useState(10);
  const updateRef = React.useRef<(() => void) | null>(null);
  const [content, setContent] = React.useState(false);
  const [module, setModule] = React.useState('');
  const [view, setView] = React.useState<ReturnType<
    ReturnType<typeof createInspector>['read']
  > | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [eventsPaused, setEventsPaused] = React.useState(false);
  const pausedRef = React.useRef(false);
  const inspectorRef = React.useRef<ReturnType<typeof createInspector> | null>(null);
  React.useEffect(() => {
    if (frozen) return;
    let inspector: ReturnType<typeof createInspector> | null = null;
    let source: DiagnosticSource | null = null;
    const update = () => {
      try {
        const next = target[DIAGNOSTIC_KEY];
        if (next !== source) {
          inspector?.dispose();
          inspector = null;
          source = next?.version === 1 ? next : null;
          if (source) {
            inspector = createInspector(source);
            inspector.setPaused(pausedRef.current);
          }
          inspectorRef.current = inspector;
        }
        setView(inspector?.read(content) ?? null);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    };
    update();
    updateRef.current = update;
    target.addEventListener(DIAGNOSTIC_CHANGED, update);
    return () => {
      updateRef.current = null;
      target.removeEventListener(DIAGNOSTIC_CHANGED, update);
      inspector?.dispose();
      inspectorRef.current = null;
    };
  }, [frozen, content, target]);
  React.useEffect(() => {
    if (frozen) return;
    const timer = setInterval(() => updateRef.current?.(), 1000 / refreshHz);
    return () => clearInterval(timer);
  }, [frozen, refreshHz]);
  const modules = [...new Set(view?.transitions.map((entry) => entry.module) ?? [])].sort();
  const runtimeData = (view?.state as any)?.runtimes;
  const hasRuntimes = !!runtimeData?.models?.length;
  const tabs: ('recordings' | 'states' | 'runtimes')[] = hasRuntimes
    ? ['recordings', 'states', 'runtimes']
    : ['recordings', 'states'];
  React.useEffect(() => {
    if (tab === 'runtimes' && !hasRuntimes) setTab('states');
  }, [tab, hasRuntimes]);
  return (
    <aside className="dlvd-panel" aria-label={copy.commons.title}>
      <header>
        <strong>{copy.commons.title}</strong>
        <span>{refreshHz} Hz</span>
        <button type="button" onClick={onClose} aria-label={copy.commons.close}>
          ×
        </button>
      </header>
      <div className="dlvd-tabs" role="tablist" aria-label={copy.commons.title}>
        {tabs.map((name) => (
          <button
            type="button"
            key={name}
            role="tab"
            id={tabsId + '-' + name + '-tab'}
            aria-controls={tabsId + '-' + name}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const index = tabs.indexOf(tab);
                const next =
                  event.key === 'Home'
                    ? tabs[0]
                    : event.key === 'End'
                      ? tabs[tabs.length - 1]
                      : tabs[
                          (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
                        ];
                setTab(next);
                event.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>('[id="' + tabsId + '-' + next + '-tab"]')
                  ?.focus();
              }
            }}
          >
            {name === 'recordings'
              ? copy.recordings.title
              : name === 'runtimes'
                ? copy.runtimes.title
                : copy.commons.states}
          </button>
        ))}
      </div>
      <div
        className="dlvd-tab-panel"
        role="tabpanel"
        id={tabsId + '-recordings'}
        aria-labelledby={tabsId + '-recordings-tab'}
        hidden={tab !== 'recordings'}
      >
        {tab === 'recordings' && <RecordingPanel copy={copy} locale={locale} target={target} />}
      </div>
      {hasRuntimes && (
        <div
          className="dlvd-tab-panel"
          role="tabpanel"
          id={tabsId + '-runtimes'}
          aria-labelledby={tabsId + '-runtimes-tab'}
          hidden={tab !== 'runtimes'}
        >
          {tab === 'runtimes' && <RuntimePanel data={runtimeData} copy={copy} />}
        </div>
      )}
      <div
        className="dlvd-tab-panel"
        role="tabpanel"
        id={tabsId + '-states'}
        aria-labelledby={tabsId + '-states-tab'}
        hidden={tab !== 'states'}
      >
        <p>{copy.commons.help}</p>
        <div className="dlvd-toolbar">
          <label>
            {copy.commons.refreshRate}
            <select
              value={refreshHz}
              onChange={(event) => setRefreshHz(Number(event.target.value))}
            >
              {[1, 2, 5, 10, 20].map((hz) => (
                <option key={hz} value={hz}>
                  {hz} Hz
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setFrozen(!frozen)}>
            {frozen ? copy.commons.resume : copy.commons.freeze}
          </button>
          <label>
            <input
              type="checkbox"
              checked={content}
              onChange={(event) => {
                setView(null);
                setFrozen(false);
                setContent(event.target.checked);
              }}
            />
            {copy.commons.content}
          </label>
        </div>
        {failed ? (
          <p role="alert">{copy.commons.error}</p>
        ) : !view ? (
          <p role="status">{copy.commons.waiting}</p>
        ) : (
          <div className="dlvd-columns">
            <section className="dlvd-state-pane" aria-label={copy.commons.states}>
              <h3>{copy.commons.states}</h3>
              <div className="dlvd-scroll" tabIndex={0}>
                <StateTree name="context" value={view.state} omitted={copy.commons.omitted} />
              </div>
            </section>
            <section className="dlvd-event-pane" aria-label={copy.commons.transitions}>
              <h3>{copy.commons.transitions}</h3>
              <div className="dlvd-toolbar">
                <button
                  type="button"
                  aria-pressed={eventsPaused}
                  onClick={() => {
                    const paused = !eventsPaused;
                    inspectorRef.current?.setPaused(paused);
                    pausedRef.current = paused;
                    setEventsPaused(paused);
                  }}
                >
                  {eventsPaused ? copy.commons.eventsResume : copy.commons.eventsPause}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    inspectorRef.current?.clear();
                    setView((current) => (current ? { ...current, transitions: [] } : current));
                  }}
                >
                  {copy.commons.eventsClear}
                </button>
              </div>
              <label>
                {copy.commons.filter}
                <select value={module} onChange={(event) => setModule(event.target.value)}>
                  <option value="">{copy.commons.all}</option>
                  {modules.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <div className="dlvd-history dlvd-scroll" tabIndex={0}>
                {view.transitions
                  .filter((entry) => !module || entry.module === module)
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <details key={entry.sequence} data-level={entry.level}>
                      <summary>
                        <small>{new Date(entry.timeMs).toLocaleTimeString()}</small>{' '}
                        <code>
                          {entry.sessionId} / {entry.module}
                        </code>
                      </summary>
                      <StateTree
                        name="before"
                        value={entry.before}
                        omitted={copy.commons.omitted}
                      />
                      <StateTree name="after" value={entry.after} omitted={copy.commons.omitted} />
                    </details>
                  ))}
                {!view.transitions.length && <p>{copy.commons.empty}</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
