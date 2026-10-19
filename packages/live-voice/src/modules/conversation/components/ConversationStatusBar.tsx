import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { ErrorMessage, IconButton, ToggleButton } from '../../../shared/design-system/index.js';
import { useConversationActions, useConversationController } from '../hooks/index.js';
import { DeliveryModeButton } from './DeliveryModeButton.js';
import { SpeechStatusBar } from './SpeechStatusBar.js';
import { RecognitionBar } from './RecognitionBar.js';
import { resolveConversationStatus } from './conversationStatus.js';

export type ConversationStatusBarProps = {
  controller: any;
  questionOnly?: boolean;
  includeSpeech?: boolean;
  overlay?: boolean;
  overlayStyle?: React.CSSProperties;
  sourceIcon?: 'mic' | 'meeting';
  sourceLabel?: string;
};
export function ConversationStatusBar({
  controller,
  questionOnly = false,
  includeSpeech = true,
  overlay = false,
  overlayStyle,
  sourceIcon = 'mic',
  sourceLabel,
}: ConversationStatusBarProps) {
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
  const { scoped: settings } = useLanguage((ctx) => ctx.settings);
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const { scoped: meeting } = useLanguage((ctx) => ctx.meeting);
  const state = useConversationController<any>(controller);
  const { invoke, error, clearError } = useConversationActions(controller);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!state.autoSendAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [state.autoSendAt]);
  const capture =
    state.starting || state.listening || state.recognizing || state.pendingTranscriptions > 0;
  if (questionOnly && !state.answeringQuestion) return null;
  if (
    !state.conversation &&
    !capture &&
    !state.speaking &&
    !state.paused &&
    !state.speechRunActive &&
    !(state.speechSegmentsRemaining > 0) &&
    !state.error &&
    !error
  )
    return null;
  const remaining = state.autoSendAt
    ? Math.max(1, Math.ceil((state.autoSendAt - now) / 1000))
    : null;
  const status = resolveConversationStatus(state, remaining, {
    commons,
    recognition,
    settings,
    speak,
  });
  return (
    <div
      className={
        overlay ? 'dlv-bar-wrap dlv-bar-stack dlv-question-overlay' : 'dlv-bar-wrap dlv-bar-stack'
      }
      style={overlay ? overlayStyle : undefined}
    >
      {includeSpeech && <SpeechStatusBar controller={controller} />}
      {(state.conversation || capture || state.error || error) && (
        <RecognitionBar
          controller={controller}
          listening={state.listening}
          label={sourceLabel || (commons as any).controls.title()}
          status={status}
          leading={
            <>
              {state.conversation && !capture ? (
                <IconButton
                  label={(recognition as any).microphone.takeControl()}
                  icon={sourceIcon}
                  onClick={() => invoke('takeMicrophone')}
                />
              ) : null}
              {capture ? (
                <ToggleButton
                  className="dlv-mic-state"
                  label={
                    state.muted
                      ? (recognition as any).microphone.resume()
                      : (recognition as any).microphone.ignore()
                  }
                  title={(recognition as any).microphone.inputStatus({
                    state: state.muted
                      ? (commons as any).input.ignoring()
                      : (commons as any).input.listening(),
                  })}
                  icon={sourceIcon}
                  visibleLabel={
                    state.muted
                      ? (commons as any).input.ignoringBadge()
                      : (commons as any).input.listeningBadge()
                  }
                  pressed={!state.muted}
                  data-muted={state.muted ? 'true' : 'false'}
                  onClick={() => invoke(state.muted ? 'resumeListeningInput' : 'muteListening')}
                />
              ) : null}
              {sourceLabel && (
                <span className="dlv-source-name" title={sourceLabel}>
                  {sourceLabel}
                </span>
              )}
            </>
          }
        >
          <ToggleButton
            icon="filter"
            label={(recognition as any).commands.enabled()}
            visibleLabel={
              state.settings.voiceCommandsEnabled ? (commons as any).on() : (commons as any).off()
            }
            pressed={Boolean(state.settings.voiceCommandsEnabled)}
            onClick={() =>
              invoke('updateSettings', {
                voiceCommandsEnabled: !state.settings.voiceCommandsEnabled,
              })
            }
          />
          <ToggleButton
            className="dlv-timestamp-toggle"
            icon="clock"
            label={(meeting as any).timestamps()}
            visibleLabel={(meeting as any).timestampsBadge()}
            pressed={Boolean(state.timestamps)}
            onClick={() => invoke('toggleTimestamps')}
          />
          <DeliveryModeButton
            mode={state.settings.sendingMode || 'manual'}
            onChange={(sendingMode) => invoke('updateSettings', { sendingMode })}
          />
          {remaining ? (
            <IconButton
              label={(settings as any).autoSend.cancel()}
              icon="close"
              onClick={() => invoke('cancelAutoSend')}
            />
          ) : null}
        </RecognitionBar>
      )}
      <ErrorMessage
        error={error || state.error}
        dismissLabel={(commons as any).dismissError()}
        dismissText={(commons as any).dismiss()}
        onDismiss={() => {
          clearError();
          controller.clearError();
        }}
      />
    </div>
  );
}
