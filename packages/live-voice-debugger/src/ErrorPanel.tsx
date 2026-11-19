import React from 'react';
import type { VoiceErrorJournal } from './errorJournal.js';
import type { DebuggerTranslation } from './i18n/index.js';

type Page = Awaited<ReturnType<VoiceErrorJournal['list']>>;
const token = (value: unknown) => typeof value === 'string' && /^[a-z0-9][a-z0-9_.:-]{0,95}$/i.test(value) ? value : '—';

export function ErrorPanel({ journal, copy, locale }: { journal?: VoiceErrorJournal; copy: DebuggerTranslation; locale: string }) {
  const [offset, setOffset] = React.useState(0);
  const [revision, setRevision] = React.useState(0);
  const [page, setPage] = React.useState<Page | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!journal) return;
    return journal.subscribe(() => setRevision((value) => value + 1));
  }, [journal]);
  React.useEffect(() => {
    let active = true;
    setPage(null);
    setFailed(false);
    if (journal) journal.list({ offset, limit: 20 }).then(
      (next) => { if (active) setPage(next); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [journal, offset, revision]);
  const c = copy.commons;
  if (!journal || failed) return <p role="status">{c.errorJournalUnavailable}</p>;
  if (!page) return <p role="status">{c.errorLoading}</p>;
  return <div className="dlvd-scroll" tabIndex={0}>
    {!page.persistent && <p role="status">{c.errorNonPersistent}</p>}
    {!page.items.length && <p>{c.errorEmpty}</p>}
    <div className="dlvd-history">
      {page.items.map((entry) => {
        const causes: string[] = [];
        let cause = entry.exception.cause;
        for (let depth = 0; cause && depth < 3; depth++, cause = cause.cause) causes.push(token(cause.name));
        const date = new Date(entry.at);
        return <section key={entry.id} className="dlvd-error-entry">
          <dl className="dlvd-recording-meta">
            <dt>{c.errorTime}</dt><dd>{Number.isFinite(date.getTime()) ? <time dateTime={date.toISOString()}>{date.toLocaleString(locale)}</time> : '—'}</dd>
            <dt>{c.errorOperation}</dt><dd><code>{token(entry.operation)}</code></dd>
            <dt>{c.errorName}</dt><dd><code>{token(entry.exception.name)}</code></dd>
            <dt>{c.errorCause}</dt><dd><code>{causes.join(' → ') || '—'}</code></dd>
          </dl>
        </section>;
      })}
    </div>
    <div className="dlvd-toolbar">
      <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>{c.errorNewer}</button>
      <button type="button" disabled={page.nextOffset === null} onClick={() => setOffset(page.nextOffset!)}>{c.errorOlder}</button>
    </div>
  </div>;
}
