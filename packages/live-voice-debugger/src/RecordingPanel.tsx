import React from 'react';
import { TimelineWindow } from './TimelineWindow.js';
import { searchSegments } from './segmentSearch.js';
import {
  RECORDING_CHANGED,
  type RecordingSession,
  type RecordingService,
  type RecordingSegment,
} from '../../live-voice/src/modules/recording/types.js';
import type { DebuggerTranslation } from './i18n/index.js';
import { createRecordingInspector, type RecordingView } from './recordingInspector.js';

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(3) + ' MB';
function duration(samples: number, rate: number) {
  const milliseconds = Math.max(0, Math.round((samples / Math.max(1, rate)) * 1000));
  const seconds = Math.floor(milliseconds / 1000);
  return (
    [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':') +
    '.' +
    String(milliseconds % 1000).padStart(3, '0')
  );
}
const sourceKey = (session: RecordingSession) => JSON.stringify([session.kind, session.sourceId]);
const sourceName = (session: RecordingSession, copy: DebuggerTranslation) =>
  (session.participant?.provider === 'attendee'
    ? copy.recordings.participant
    : session.kind === 'microphone'
      ? copy.recordings.microphone
      : copy.recordings.shared) +
  ' · ' +
  (session.label || session.sourceId);
function stateName(session: RecordingSession, copy: DebuggerTranslation) {
  return {
    recording: copy.recordings.active,
    completed: copy.recordings.completed,
    interrupted: copy.recordings.interrupted,
    failed: copy.recordings.failed,
  }[session.state];
}

export function RecordingPanel({ copy, target }: { copy: DebuggerTranslation; target: any }) {
  const [view, setView] = React.useState<RecordingView>({
    service: null,
    sessions: [],
    selected: null,
    segments: [],
    loading: true,
    failed: false,
  });
  const inspector = React.useRef<ReturnType<typeof createRecordingInspector> | null>(null);
  const [filter, setFilter] = React.useState('');
  React.useEffect(() => {
    const current = createRecordingInspector(target, setView);
    inspector.current = current;
    current.discover();
    // Poll only service identity; recording data is refreshed by its subscription.
    const timer = setInterval(current.discover, 1000);
    target.addEventListener(RECORDING_CHANGED, current.discover);
    return () => {
      clearInterval(timer);
      target.removeEventListener(RECORDING_CHANGED, current.discover);
      current.dispose();
      inspector.current = null;
    };
  }, [target]);
  const sources = [
    ...new Map(view.sessions.map((session) => [sourceKey(session), session])).values(),
  ];
  const visible = view.sessions
    .filter((session) => !filter || sourceKey(session) === filter)
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  React.useEffect(() => {
    if (
      !view.loading &&
      filter &&
      visible.length &&
      !visible.some((s) => s.id === view.selected?.id)
    )
      inspector.current?.select(visible[0].id);
  }, [filter, view.selected?.id, view.loading, visible[0]?.id]);
  const selected =
    view.selected && visible.some((s) => s.id === view.selected?.id) ? view.selected : null;
  return (
    <section className="dlvd-recordings" aria-label={copy.recordings.title}>
      <p>{copy.recordings.help}</p>
      <div className="dlvd-toolbar">
        <label>
          {copy.recordings.sourceFilter}{' '}
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">{copy.recordings.allSources}</option>
            {sources.map((session) => (
              <option key={sourceKey(session)} value={sourceKey(session)}>
                {sourceName(session, copy)}
                {session.participant ? ' · ' + session.participant.participantId : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            inspector.current?.discover();
            inspector.current?.refresh();
          }}
        >
          {copy.recordings.refresh}
        </button>
      </div>
      {view.failed && <p role="alert">{copy.recordings.loadError}</p>}
      {!view.service ? (
        <p role="status">{copy.recordings.unavailable}</p>
      ) : (
        <>
          {view.loading && <p role="status">{copy.recordings.loading}</p>}
          <p className="dlvd-audio-total">
            {copy.recordings.storageTotal}:{' '}
            {view.sessions.every((s) => s.audioBytes !== undefined)
              ? megabytes(view.sessions.reduce((sum, s) => sum + (s.audioBytes ?? 0), 0))
              : copy.recordings.storageUnknown}
          </p>
          <div className="dlvd-recording-columns">
            <div
              className="dlvd-session-list dlvd-scroll"
              tabIndex={0}
              aria-label={copy.recordings.title}
            >
              {!visible.length && !view.loading && <p>{copy.recordings.empty}</p>}
              {sources
                .filter((source) => !filter || sourceKey(source) === filter)
                .map((source) => (
                  <section key={sourceKey(source)} aria-label={sourceName(source, copy)}>
                    <h3>{sourceName(source, copy)}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{copy.recordings.date}</th>
                          <th scope="col">{copy.recordings.state}</th>
                          <th scope="col">{copy.recordings.duration}</th>
                          <th scope="col">{copy.recordings.saved}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible
                          .filter((session) => sourceKey(session) === sourceKey(source))
                          .map((session) => (
                            <tr key={session.id} data-selected={session.id === selected?.id}>
                              <td>
                                <button
                                  type="button"
                                  aria-pressed={session.id === selected?.id}
                                  onClick={() => inspector.current?.select(session.id)}
                                >
                                  {session.starred && (
                                    <span
                                      role="img"
                                      aria-label={copy.recordings.starred}
                                      title={copy.recordings.starHelp}
                                    >
                                      ★
                                    </span>
                                  )}{' '}
                                  <span>{sourceName(session, copy)}</span>
                                  <br />
                                  {session.name && (
                                    <strong>
                                      {session.name}
                                      <br />
                                    </strong>
                                  )}
                                  <time dateTime={session.startedAt}>
                                    {new Date(session.startedAt).toLocaleString()}
                                  </time>
                                </button>
                              </td>
                              <td>{stateName(session, copy)}</td>
                              <td>{duration(session.capturedSamples, session.sampleRate)}</td>
                              <td>
                                {duration(session.savedSamples, session.sampleRate)}
                                <br />
                                {session.storage === 'indexeddb' || session.persistent
                                  ? copy.recordings.persistent
                                  : copy.recordings.memory}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </section>
                ))}
            </div>
            <div className="dlvd-recording-detail dlvd-scroll" tabIndex={0}>
              {selected ? (
                <RecordingDetail
                  key={selected.id}
                  copy={copy}
                  session={selected}
                  service={view.service}
                  segments={view.segments}
                  refresh={() => inspector.current?.refresh()}
                />
              ) : (
                <p>{copy.recordings.selectSession}</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RecordingDetail({
  copy,
  session,
  service,
  segments,
  refresh,
}: {
  copy: DebuggerTranslation;
  session: RecordingSession;
  service: RecordingService;
  segments: RecordingSegment[];
  refresh(): void;
}) {
  const container = React.useRef<HTMLElement | null>(null);
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const playback = React.useRef<{ url: string; api: typeof URL } | null>(null);
  const download = React.useRef<{ url: string; api: typeof URL } | null>(null);
  const generation = React.useRef(0);
  const playGeneration = React.useRef(0);
  const [error, setError] = React.useState<keyof DebuggerTranslation['recordings'] | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [starring, setStarring] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [name, setName] = React.useState(session.name ?? '');
  const [naming, setNaming] = React.useState(false);
  React.useEffect(() => {
    setName(session.name ?? '');
  }, [session.id, session.name, service]);
  const [selectedSegment, setSelectedSegment] = React.useState('');
  const clearPlayback = (player = audio.current) => {
    ++playGeneration.current;
    if (player?.hasAttribute('src')) {
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
    if (playback.current) playback.current.api.revokeObjectURL(playback.current.url);
    playback.current = null;
  };
  const clearDownload = () => {
    if (download.current) download.current.api.revokeObjectURL(download.current.url);
    download.current = null;
  };
  React.useEffect(() => {
    setStarring(false);
    const owner = container.current?.ownerDocument.defaultView;
    const player = audio.current;
    const release = () => {
      ++generation.current;
      clearPlayback(player);
      clearDownload();
    };
    owner?.addEventListener('pagehide', release);
    return () => {
      owner?.removeEventListener('pagehide', release);
      release();
    };
  }, [service, session.id]);
  const play = async (segment?: RecordingSegment) => {
    clearPlayback();
    const token = generation.current;
    const request = playGeneration.current;
    setPlaying(true);
    setError(null);
    setSelectedSegment(segment?.id ?? '');
    try {
      const blob = await service.audio(session.id, segment?.startSample, segment?.endSample);
      if (token !== generation.current || request !== playGeneration.current) return;
      const player = audio.current;
      const api = player?.ownerDocument.defaultView?.URL;
      if (!player || !api) return;
      const url = api.createObjectURL(blob);
      playback.current = { url, api };
      player.src = url;
      await player.play();
    } catch {
      if (token === generation.current && request === playGeneration.current) {
        clearPlayback();
        setError('audioError');
        setPlaying(false);
      }
    } finally {
      if (token === generation.current && request === playGeneration.current) setPlaying(false);
    }
  };
  const exportSession = async () => {
    const token = generation.current;
    setExporting(true);
    setError(null);
    clearDownload();
    try {
      const blob = await service.export(session.id);
      if (token !== generation.current) return;
      const doc = container.current?.ownerDocument;
      const api = doc?.defaultView?.URL;
      if (!doc || !api) return;
      const url = api.createObjectURL(blob);
      download.current = { url, api };
      const link = doc.createElement('a');
      link.href = url;
      link.download = 'recording-' + session.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
      doc.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    } catch {
      if (token === generation.current) {
        clearDownload();
        setError('exportError');
      }
    } finally {
      if (token === generation.current) setExporting(false);
    }
  };
  const toggleStarred = async () => {
    const token = generation.current;
    setStarring(true);
    setError(null);
    try {
      await service.setStarred(session.id, !session.starred);
      if (token === generation.current) refresh();
    } catch {
      if (token === generation.current) setError('starError');
    } finally {
      if (token === generation.current) setStarring(false);
    }
  };
  const saveName = async () => {
    if (!service.setName) return;
    const token = generation.current;
    setNaming(true);
    setError(null);
    try {
      await service.setName(session.id, name);
      if (token === generation.current) refresh();
    } catch {
      if (token === generation.current) setError('nameError');
    } finally {
      if (token === generation.current) setNaming(false);
    }
  };
  const eventName = (kind: string) =>
    ({
      'assistant-start': copy.recordings.assistantStart,
      'assistant-end': copy.recordings.assistantEnd,
      'assistant-pause': copy.recordings.assistantPause,
      'assistant-resume': copy.recordings.assistantResume,
      'capture-gated': copy.recordings.captureGated,
      'capture-start': copy.recordings.captureStart,
      'capture-end': copy.recordings.captureEnd,
    })[kind] ?? kind;
  const removeSession = async () => {
    const token = ++generation.current;
    setExporting(false);
    setPlaying(false);
    setDeleting(true);
    setError(null);
    clearPlayback();
    clearDownload();
    try {
      await service.remove(session.id);
      if (token === generation.current) {
        setConfirmDelete(false);
        refresh();
      }
    } catch {
      if (token === generation.current) setError('deleteError');
    } finally {
      if (token === generation.current) setDeleting(false);
    }
  };
  const [search, setSearch] = React.useState('');
  React.useEffect(() => setSearch(''), [session.id, service]);
  const matchedSegments = React.useMemo(() => searchSegments(segments, search), [segments, search]);
  const length = Math.max(1, session.savedSamples);
  const [windowStart, setWindowStart] = React.useState(0);
  // null follows the live right edge until the user explicitly chooses an end.
  const [windowEnd, setWindowEnd] = React.useState<number | null>(null);
  React.useEffect(() => {
    setWindowStart(0);
    setWindowEnd(null);
  }, [session.id, service]);
  const viewEnd = Math.max(1, Math.min(length, windowEnd ?? length));
  const viewStart = Math.max(0, Math.min(windowStart, viewEnd - 1));
  const viewLength = viewEnd - viewStart;
  const inWindow = (sample: number) => sample >= viewStart && sample <= viewEnd;
  const position = (sample: number) => ((sample - viewStart) / viewLength) * 100 + '%';
  const segmentName = (segment: RecordingSegment) =>
    (segment.kind === 'speech' ? copy.recordings.speech : copy.recordings.silence) +
    ' · ' +
    duration(segment.startSample, session.sampleRate) +
    ' — ' +
    duration(segment.endSample, session.sampleRate);
  return (
    <section ref={container} aria-label={sourceName(session, copy)}>
      <h3>{sourceName(session, copy)}</h3>
      {session.name && (
        <p>
          <strong>
            {copy.recordings.name}: {session.name}
          </strong>
        </p>
      )}
      {session.participant && (
        <details>
          <summary>{copy.recordings.participantDetails}</summary>
          <dl>
            <dt>{copy.recordings.originalName}</dt>
            <dd>{session.participant.originalName}</dd>
            {session.participant.alias && (
              <>
                <dt>{copy.recordings.aliasAtCapture}</dt>
                <dd>{session.participant.alias}</dd>
              </>
            )}
            <dt>{copy.recordings.participantId}</dt>
            <dd>{session.participant.participantId}</dd>
            <dt>{copy.recordings.meetingId}</dt>
            <dd>{session.participant.groupId}</dd>
          </dl>
        </details>
      )}
      {session.starred && service.setName && (
        <form
          className="dlvd-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <label>
            {copy.recordings.name}{' '}
            <input
              value={name}
              maxLength={120}
              disabled={naming || deleting}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <button
            type="submit"
            disabled={naming || deleting || starring || name === (session.name ?? '')}
          >
            {copy.recordings.saveName}
          </button>
        </form>
      )}
      <dl className="dlvd-recording-meta">
        <dt>{copy.recordings.date}</dt>
        <dd>{new Date(session.startedAt).toLocaleString()}</dd>
        <dt>{copy.recordings.state}</dt>
        <dd>{stateName(session, copy)}</dd>
        <dt>{copy.recordings.storageAudio}</dt>
        <dd>
          {session.audioBytes === undefined
            ? copy.recordings.storageUnknown
            : megabytes(session.audioBytes)}
        </dd>
        <dt>{copy.recordings.captured}</dt>
        <dd>{duration(session.capturedSamples, session.sampleRate)}</dd>
        <dt>{copy.recordings.saved}</dt>
        <dd>
          {duration(session.savedSamples, session.sampleRate)} ·
          {session.storage === 'indexeddb' || session.persistent
            ? copy.recordings.persistent
            : copy.recordings.memory}
        </dd>
        {session.endedAt && (
          <>
            <dt>{copy.recordings.end}</dt>
            <dd>{new Date(session.endedAt).toLocaleString()}</dd>
          </>
        )}
      </dl>
      {session.error && (
        <p role="alert">
          {copy.recordings.error}: {session.error}
        </p>
      )}
      <div className="dlvd-toolbar">
        <button
          type="button"
          aria-label={session.starred ? copy.recordings.unstar : copy.recordings.star}
          aria-pressed={!!session.starred}
          title={session.starred ? copy.recordings.unstarHelp : copy.recordings.starHelp}
          disabled={starring || deleting || naming}
          onClick={() => void toggleStarred()}
        >
          {session.starred ? '★' : '☆'}
        </button>
        <button
          type="button"
          disabled={playing || deleting || !session.savedSamples}
          onClick={() => void play()}
        >
          {copy.recordings.playSession}
        </button>
        <button type="button" disabled={exporting || deleting} onClick={() => void exportSession()}>
          {copy.recordings.export}
        </button>
        <button
          type="button"
          disabled={deleting || starring || naming}
          onClick={() => setConfirmDelete(true)}
        >
          {copy.recordings.delete}
        </button>
      </div>
      {confirmDelete && (
        <div
          className="dlvd-delete-confirm"
          role="group"
          aria-label={copy.recordings.confirmDelete}
        >
          <p>{copy.recordings.confirmDelete}</p>
          <button
            type="button"
            disabled={deleting || starring || naming}
            onClick={() => void removeSession()}
          >
            {copy.recordings.delete}
          </button>{' '}
          <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>
            {copy.recordings.cancel}
          </button>
        </div>
      )}
      {error && <p role="alert">{copy.recordings[error]}</p>}
      <audio
        ref={audio}
        controls
        preload="none"
        aria-label={copy.recordings.audio}
        onError={() => {
          clearPlayback();
          setError('audioError');
        }}
      />
      <h4>{copy.recordings.timeline}</h4>
      <TimelineWindow
        key={session.id}
        total={session.savedSamples}
        start={viewStart}
        end={Math.min(viewEnd, session.savedSamples)}
        copy={copy.recordings}
        format={(sample) => duration(sample, session.sampleRate)}
        onChange={(start, end) => {
          setWindowStart(start);
          setWindowEnd(end >= length ? null : end);
        }}
        onReset={() => {
          setWindowStart(0);
          setWindowEnd(null);
        }}
      />
      <div className="dlvd-timeline" role="group" aria-label={copy.recordings.timeline}>
        {segments
          .filter((segment) => segment.endSample > viewStart && segment.startSample < viewEnd)
          .map((segment) => (
            <button
              key={segment.id}
              type="button"
              data-kind={segment.kind}
              aria-label={segmentName(segment)}
              title={segmentName(segment)}
              aria-pressed={selectedSegment === segment.id}
              style={{
                left: position(Math.max(viewStart, segment.startSample)),
                width:
                  ((Math.min(viewEnd, segment.endSample) -
                    Math.max(viewStart, segment.startSample)) /
                    viewLength) *
                    100 +
                  '%',
              }}
              onClick={() => {
                clearPlayback();
                setPlaying(false);
                setSelectedSegment(segment.id);
              }}
            />
          ))}
        {(session.events ?? [])
          .filter((event) => inWindow(event.atSample))
          .map((event, index) => (
            <span
              key={event.id}
              className="dlvd-event-pin"
              data-event={event.kind}
              style={{
                left: position(event.atSample),
                top: (index % 3) * 12,
              }}
              title={eventName(event.kind) + ' · ' + new Date(event.occurredAt).toLocaleString()}
              aria-hidden="true"
            >
              ◆
            </span>
          ))}
        {session.pins
          .filter((pin) => inWindow(pin.atSample))
          .map((pin) => (
            <span
              key={pin.id}
              className="dlvd-pin"
              aria-hidden="true"
              style={{ left: position(pin.atSample) }}
              title={
                (pin.kind === 'speech-start' ? copy.recordings.speech : copy.recordings.silence) +
                ' · ' +
                duration(pin.atSample, session.sampleRate)
              }
            />
          ))}
      </div>
      <div className="dlvd-timeline-legend">
        <span data-kind="speech">{copy.recordings.speech}</span>
        {' · '}
        <span data-kind="silence">{copy.recordings.silence}</span>
        {' · '}
        {duration(viewStart, session.sampleRate)} –{' '}
        {duration(Math.min(viewEnd, session.savedSamples), session.sampleRate)}
      </div>
      <h4>{copy.recordings.events}</h4>
      <p>{copy.recordings.eventsHelp}</p>
      <table className="dlvd-recording-events">
        <thead>
          <tr>
            <th scope="col">{copy.recordings.state}</th>
            <th scope="col">{copy.recordings.eventTime}</th>
            <th scope="col">{copy.recordings.captured}</th>
          </tr>
        </thead>
        <tbody>
          {(session.events ?? []).map((event) => (
            <tr key={event.id}>
              <td>{eventName(event.kind)}</td>
              <td>
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString()}.
                  {new Date(event.occurredAt).getMilliseconds().toString().padStart(3, '0')}
                </time>
              </td>
              <td>{duration(event.atSample, session.sampleRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>{copy.recordings.segments}</h4>
      <label>
        {copy.recordings.search}
        <input
          type="search"
          value={search}
          maxLength={160}
          aria-label={copy.recordings.search}
          onInput={(event) => setSearch(event.currentTarget.value)}
        />
      </label>
      {search.trim() && matchedSegments.length === 0 && (
        <p role="status">{copy.recordings.searchEmpty}</p>
      )}
      <table className="dlvd-segments">
        <thead>
          <tr>
            <th scope="col">{copy.recordings.state}</th>
            <th scope="col">{copy.recordings.start}</th>
            <th scope="col">{copy.recordings.end}</th>
            <th scope="col">{copy.recordings.duration}</th>
            <th scope="col">{copy.recordings.audio}</th>
          </tr>
        </thead>
        <tbody>
          {matchedSegments.map((segment) => (
            <React.Fragment key={segment.id}>
              <tr data-selected={selectedSegment === segment.id}>
                <td>
                  <span>{sourceName(session, copy)}</span>
                  <br />
                  {segment.kind === 'speech' ? copy.recordings.speech : copy.recordings.silence}
                  {segment.open && <small>{copy.recordings.open}</small>}
                </td>
                <td>{duration(segment.startSample, session.sampleRate)}</td>
                <td>{duration(segment.endSample, session.sampleRate)}</td>
                <td>{duration(segment.endSample - segment.startSample, session.sampleRate)}</td>
                <td>
                  <button
                    type="button"
                    disabled={deleting || segment.endSample <= segment.startSample}
                    aria-label={
                      copy.recordings.play +
                      ' · ' +
                      sourceName(session, copy) +
                      ' · ' +
                      segmentName(segment)
                    }
                    onClick={() => void play(segment)}
                  >
                    {copy.recordings.play}
                  </button>
                </td>
              </tr>
              {segment.kind === 'speech' && (
                <tr>
                  <td colSpan={5}>
                    <details open={!!search.trim() || selectedSegment === segment.id || undefined}>
                      <summary>
                        {copy.recordings.attempts} · {segment.attempts.length}
                      </summary>
                      {!segment.attempts.length && <p>{copy.recordings.noAttempts}</p>}
                      {segment.attempts.map((attempt) => (
                        <article className="dlvd-attempt" key={attempt.id}>
                          <div>
                            {copy.recordings.engine}: {attempt.engine} ·
                            {
                              {
                                pending: copy.recordings.pending,
                                success: copy.recordings.success,
                                error: copy.recordings.error,
                              }[attempt.status]
                            }
                          </div>
                          <time dateTime={attempt.createdAt}>
                            {new Date(attempt.createdAt).toLocaleString()}
                          </time>
                          {attempt.finishedAt && (
                            <>
                              {' '}
                              —{' '}
                              <time dateTime={attempt.finishedAt}>
                                {new Date(attempt.finishedAt).toLocaleString()}
                              </time>
                            </>
                          )}
                          <div>
                            {duration(attempt.startSample, session.sampleRate)} —{' '}
                            {duration(attempt.endSample, session.sampleRate)}
                          </div>
                          {attempt.text != null && (
                            <p className="dlvd-transcript">{attempt.text}</p>
                          )}
                          {attempt.error && (
                            <p className="dlvd-attempt-error">
                              {copy.recordings.error}: {attempt.error}
                            </p>
                          )}
                        </article>
                      ))}
                    </details>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <details>
        <summary>
          {copy.recordings.pins} · {session.pins.length}
        </summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{copy.recordings.state}</th>
              <th scope="col">{copy.recordings.start}</th>
              <th scope="col">{copy.recordings.pinConfirmed}</th>
              <th scope="col">{copy.recordings.pinDelay}</th>
            </tr>
          </thead>
          <tbody>
            {session.pins.map((pin) => (
              <tr key={pin.id}>
                <td>
                  {pin.kind === 'speech-start' ? copy.recordings.speech : copy.recordings.silence}
                </td>
                <td>{duration(pin.atSample, session.sampleRate)}</td>
                <td>{duration(pin.confirmedAtSample, session.sampleRate)}</td>
                <td>{duration(pin.delaySamples, session.sampleRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
