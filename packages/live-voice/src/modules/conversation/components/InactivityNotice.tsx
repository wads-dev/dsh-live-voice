import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import type { VoiceInactivity } from '../models/inactivity.js';
export function InactivityNotice({ clock, restart }: { clock: VoiceInactivity; restart(): void }) {
  const state = React.useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const { scoped } = useLanguage((ctx) => ctx.settings);
  const copy = (scoped as any).autoEnd;
  if (state.phase === 'idle') return null;
  const ended = state.phase === 'ended';
  return (
    <div className="dlv-inactivity-notice">
      <span role="status">
        {ended ? copy.ended() : copy.countdown({ seconds: state.remaining })}
      </span>
      <button type="button" onClick={ended ? restart : clock.keepAlive}>
        {ended ? copy.restart() : copy.continue()}
      </button>
    </div>
  );
}
