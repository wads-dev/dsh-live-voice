import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { IconButton } from '../../../shared/design-system/index.js';
import { ConversationStatusBar } from './ConversationStatusBar.js';
import { ContextPopover } from '../../../shared/design-system/feedback/ContextPopover.js';
import { AttendeeControls } from './AttendeeControls.js';
export function MeetingToggle({ meeting, onToggle, controller }: any) {
  const { scoped: language } = useLanguage((ctx) => ctx.meeting);
  const copy = language as any;
  const state: any = React.useSyncExternalStore(meeting.subscribe, meeting.getSnapshot);
  const attendee: any = React.useSyncExternalStore(
    meeting.attendee?.subscribe || (() => () => {}),
    meeting.attendee?.getSnapshot || (() => null),
  );
  const voice: any = React.useSyncExternalStore(
    controller?.subscribe || (() => () => {}),
    controller?.getSnapshot || (() => null),
  );
  const [showMeet, setShowMeet] = React.useState(false);
  const sharedActive = Boolean(state.shared.listening || state.shared.starting);
  const hasMeeting = Boolean(
    attendee?.hasBotControl ||
    attendee?.botId ||
    attendee?.joining ||
    attendee?.joinUncertain ||
    attendee?.leaveRequested ||
    attendee?.active ||
    attendee?.starting ||
    attendee?.leaving,
  );
  const feedbackKey = {
    'leave-failed': 'leaveFailed',
    'control-unavailable': 'controlUnavailable',
    'control-expired': 'controlExpired',
    'control-released': 'controlReleased',
    'control-unknown': 'controlUnknown',
  }[attendee?.controlError];
  const feedback =
    attendee?.error ||
    (feedbackKey
      ? copy.attendee[feedbackKey]()
      : attendee?.joinUncertain
        ? copy.attendee.joinFailed()
        : '');
  const active =
    sharedActive || Boolean(attendee?.active || attendee?.starting || attendee?.hasBotControl);
  return (
    <>
      <ContextPopover
        label={copy.actions()}
        openOnClick
        trigger={
          <IconButton
            icon={active ? 'meeting' : 'meetingOff'}
            label={feedback ? `${copy.title()}: ${feedback}` : copy.title()}
            title={feedback ? `${copy.actions()}: ${feedback}` : copy.actions()}
            data-meeting-error={feedback ? 'true' : undefined}
            className="dlv-composer-toggle"
            data-toggle-active={String(active)}
          />
        }
      >
        <div className="dlv-meeting-menu">
          <button type="button" className="dlv-meeting-menu-action" onClick={onToggle}>
            {sharedActive ? copy.stopShared() : copy.shareTab()}
          </button>
          {meeting.attendee && voice && (
            <>
              {!hasMeeting && (
                <button
                  type="button"
                  className="dlv-meeting-menu-action"
                  aria-expanded={showMeet}
                  onClick={() => setShowMeet(!showMeet)}
                >
                  {copy.joinMeet()}
                </button>
              )}
              {(hasMeeting || showMeet || Boolean(feedback)) && (
                <AttendeeControls
                  client={meeting.attendee}
                  settings={voice.settings}
                  onDisconnect={() => setShowMeet(true)}
                />
              )}
            </>
          )}
        </div>
      </ContextPopover>
    </>
  );
}
export function MeetingBars({ meeting }: any) {
  const { scoped: copy } = useLanguage((ctx) => ctx.meeting);
  const state: any = React.useSyncExternalStore(meeting.subscribe, meeting.getSnapshot);
  const attendee: any = React.useSyncExternalStore(
    meeting.attendee?.subscribe || (() => () => {}),
    meeting.attendee?.getSnapshot || (() => null),
  );
  const rows = attendee?.participants || [];
  const value = state.shared;
  if (!value.listening && !value.starting && !value.error && !rows.some((row) => row.blocks))
    return null;
  const label = (copy as any).shared();
  const input = meeting.input('shared');
  return (
    <div className="dlv-meeting-bars">
      {rows
        .filter((row) => row.blocks)
        .map((row) => (
          <ConversationStatusBar
            key={row.source}
            controller={meeting.input(row.source)}
            includeSpeech={false}
            sourceIcon="meeting"
            sourceLabel={row.name}
          />
        ))}
      <ConversationStatusBar
        controller={input}
        includeSpeech={false}
        sourceIcon="meeting"
        sourceLabel={label}
      />
    </div>
  );
}
