import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { IconButton } from '../../../shared/design-system/index.js';
import { ConversationStatusBar } from './ConversationStatusBar.js';
import { ContextPopover } from '../../../shared/design-system/feedback/ContextPopover.js';
import {
  AttendeeControls,
  AttendeeControlFeedback,
  AttendeeBotStatus,
  AttendeeConnectionDialog,
} from './AttendeeControls.js';
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
  const [joinDraft, setJoinDraft] = React.useState(null);
  const [connectionOpen, setConnectionOpen] = React.useState(false);
  const [popoverVersion, setPopoverVersion] = React.useState(0);
  const triggerId = React.useId();
  const restoreFocus = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!connectionOpen && restoreFocus.current) {
      restoreFocus.current = false;
      document.getElementById(triggerId)?.focus();
    }
  }, [connectionOpen, triggerId]);
  const configure = () => {
    setPopoverVersion((value) => value + 1); // Unmount only the quick panel, never its client.
    setConnectionOpen(true);
  };
  const sharedActive = Boolean(state.shared.listening || state.shared.starting);
  const active =
    sharedActive || Boolean(attendee?.active || attendee?.starting || attendee?.hasBotControl);
  return (
    <>
      <ContextPopover
        key={popoverVersion}
        label={copy.actions()}
        openOnClick
        trigger={
          <IconButton
            id={triggerId}
            icon={active ? 'meeting' : 'meetingOff'}
            label={copy.title()}
            title={copy.actions()}
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
              <button
                type="button"
                className="dlv-meeting-menu-action"
                aria-expanded={showMeet}
                onClick={() => setShowMeet(!showMeet)}
              >
                {copy.joinMeet()}
              </button>
              {showMeet && (
                <AttendeeControls
                  client={meeting.attendee}
                  settings={voice.settings}
                  onConfigure={configure}
                  draft={joinDraft}
                  onDraftChange={setJoinDraft}
                />
              )}
            </>
          )}
        </div>
      </ContextPopover>
      {connectionOpen && voice && (
        <AttendeeConnectionDialog
          client={meeting.attendee}
          settings={voice.settings}
          updateSettings={
            controller.updateSettings ? (patch) => controller.updateSettings(patch) : undefined
          }
          onClose={() => {
            restoreFocus.current = true;
            setConnectionOpen(false);
          }}
        />
      )}
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
  if (
    !value.listening &&
    !value.starting &&
    !value.error &&
    !rows.length &&
    !attendee?.error &&
    !attendee?.hasBotControl &&
    !attendee?.controlError
  )
    return null;
  const label = (copy as any).shared();
  const input = meeting.input('shared');
  return (
    <div className="dlv-meeting-bars">
      {attendee?.hasBotControl && attendee?.botId && (
        <div className="dlv-meeting-summary">
          <AttendeeBotStatus state={attendee} />
          <button
            type="button"
            disabled={attendee.leaving}
            onClick={() => void meeting.attendee.leave()}
          >
            {(copy as any).attendee[attendee.leaving ? 'leaving' : 'leave']()}
          </button>
        </div>
      )}
      {attendee && <AttendeeControlFeedback state={attendee} />}
      {attendee?.error && <div role="alert">{attendee.error}</div>}
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
