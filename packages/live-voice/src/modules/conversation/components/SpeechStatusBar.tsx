import React from 'react';
import { RecoveryFeedback } from './RecoveryFeedback.js';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { ErrorMessage, IconButton } from '../../../shared/design-system/index.js';
import { useConversationActions, useConversationController } from '../hooks/index.js';
import { PlaybackControls } from './PlaybackControls.js';
import { ScrollingSpeechCaption } from './ScrollingSpeechCaption.js';
export function SpeechStatusBar({ controller }: { controller: any }) {
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const state = useConversationController<any>(controller);
  const { invoke, error, clearError } = useConversationActions(controller);
  const [progress, setProgress] = React.useState<any>(null);
  React.useEffect(() => {
    setProgress(null);
    if (!state.speechText || !state.speaking) return;
    const update = () => setProgress(controller.getSpeechProgress?.() ?? null);
    update();
    if (state.paused) return;
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [controller, state.speechText, state.speaking, state.paused]);
  if (
    !state.speaking &&
    !state.paused &&
    !state.speechRunActive &&
    !(state.speechSegmentsRemaining > 0) &&
    !state.speechRecovery &&
    !state.speechError
  )
    return null;
  const text = state.speechText ?? '';
  const ratio =
    progress &&
    Number.isFinite(progress.durationSeconds) &&
    progress.durationSeconds > 0 &&
    Number.isFinite(progress.positionSeconds)
      ? Math.max(0, Math.min(1, progress.positionSeconds / progress.durationSeconds))
      : null;
  const loading = state.speechLoading === true && state.speaking && !state.paused;
  const index = state.speechSegmentIndex ?? 0;
  const total = state.speechSegmentsTotal ?? state.speechSegmentsRemaining ?? 0;
  return (
    <div className="dlv-bar-wrap dlv-speech-bar">
      <div
        className="dlv-pill dlv-speech-pill"
        role="group"
        aria-label={(speak as any).captions.title()}
      >
        <IconButton
          label={(speak as any).playback.previous()}
          icon="skipPrevious"
          disabled={!state.speechHasPrevious}
          onClick={() => invoke('previousSpeechSegment')}
        />
        <div className="dlv-caption-stack">
          <ScrollingSpeechCaption
            text={text}
            label={(speak as any).captions.approximate()}
            controller={controller}
            segment={index}
            paused={state.paused || !state.speaking}
            loading={loading}
          />
          <div
            className="dlv-caption-progress"
            data-loading={loading ? 'true' : 'false'}
            role="progressbar"
            aria-hidden={!loading}
            aria-label={
              loading ? (speak as any).captions.loading() : (speak as any).captions.progress()
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loading || ratio === null ? undefined : Math.round(ratio * 100)}
          >
            <span style={loading ? undefined : { width: (ratio ?? 0) * 100 + '%' }} />
          </div>
        </div>
        <IconButton
          label={(speak as any).playback.next()}
          icon="skipNext"
          disabled={!(state.speechSegmentsRemaining > 1)}
          onClick={() => invoke('skipSpeechSegment')}
        />
        <span
          className="dlv-speech-count"
          aria-label={(speak as any).captions.position({ index, total })}
        >
          {index}/{total}
        </span>
        <PlaybackControls state={state} invoke={invoke} navigation={false} />
      </div>
      <RecoveryFeedback
        recovery={state.speechRecovery}
        detail={state.speechError}
        source="speech"
        onRetry={() => invoke('resumeSpeech')}
      />
      <ErrorMessage
        error={error || (state.speechRecovery ? null : state.speechError)}
        dismissLabel={(commons as any).dismissError()}
        dismissText={(commons as any).dismiss()}
        onDismiss={() => {
          clearError();
          controller.clearError('speech');
        }}
      />
    </div>
  );
}
