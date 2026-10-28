// @ts-nocheck
import {
  createFallbackTranslator,
  useLanguage,
  withAppLanguage as withLiveVoiceLanguage,
} from '../../../app/client/i18n/index.js';

import { resolveConversationStatus } from './conversationStatus.js';
import { RecordingProgress } from './RecordingProgress.js';

// UI only: the controller owns capture, recognition, playback and policy.
export function createConversationComponents(
  React,
  translate = createFallbackTranslator(),
  locale,
) {
  const fallbackTranslate = (key, params) => translate(key, params);
  function useLiveVoiceLanguage() {
    const { scoped: commons } = useLanguage((ctx) => ctx.commons);
    const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
    const { scoped: settings } = useLanguage((ctx) => ctx.settings);
    const { scoped: speak } = useLanguage((ctx) => ctx.speak);
    return React.useCallback(
      (key, params) => {
        const path = key.replace(/^dsh-live-voice\./, '').split('.');
        const roots = { commons, recognition, settings, speak };
        let value = roots[path.shift()];
        for (const segment of path) value = value?.[segment];
        return typeof value === 'function' ? value(params) : fallbackTranslate(key, params);
      },
      [commons, recognition, settings, speak],
    );
  }
  let t = fallbackTranslate;
  const localize = (value) =>
    typeof value === 'string' && value.startsWith('dsh-live-voice.') ? t(value) : value;
  function useController(controller) {
    const subscribe = React.useCallback((listener) => controller.subscribe(listener), [controller]);
    const read = React.useCallback(() => controller.getSnapshot(), [controller]);
    return React.useSyncExternalStore(subscribe, read, read);
  }
  function Icon({ name }) {
    const common = {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    };
    const paths = {
      mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8',
      micOff:
        'M9 9v3a3 3 0 0 0 5.12 2.12M15 9V5a3 3 0 0 0-5.64-1.42M6 10v2a6 6 0 0 0 9.5 4.88M18 10v2a6 6 0 0 1-.5 2.4M12 18v4M8 22h8M3 3l18 18',
      speaker: 'M3 9h4l6-5v16l-6-5H3V9M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14',
      close: 'M6 6l12 12M18 6L6 18',
      stop: 'M6 6h12v12H6z',
      pause: 'M8 5v14M16 5v14',
      play: 'M7 4l13 8-13 8z',
      skipNext: 'M5 5l10 7-10 7V5M19 5v14',
      send: 'M3 11.5L21 3l-8.5 18-2-7.5L3 11.5zm7.5 2L21 3',
      queue: 'M5 6h14M5 12h10M5 18h6M18 15v6M15 18h6',
      speakerOff: 'M3 9h4l6-5v16l-6-5H3V9M17 9l5 6M22 9l-5 6',
    };
    return <svg {...common}>{<path d={paths[name] || paths.mic} />}</svg>;
  }
  function Button({
    label,
    icon,
    visibleLabel,
    title = label,
    className = 'dlv-pill-button',
    ...props
  }) {
    label = localize(label);
    title = localize(title);
    visibleLabel = localize(visibleLabel);
    return (
      <button
        {...props}
        type="button"
        className={'dlv-icon-button ' + className}
        title={title}
        aria-label={label}
      >
        {<Icon name={icon} />}
        {visibleLabel ? (
          <span className="dlv-toggle-state" aria-hidden>
            {visibleLabel}
          </span>
        ) : null}
      </button>
    );
  }
  // Keep rejection handling local without swallowing controller-published errors.
  function useActions(controller) {
    const [error, setError] = React.useState('');
    const alive = React.useRef(true);
    React.useEffect(() => {
      alive.current = true;
      return () => {
        alive.current = false;
      };
    }, []);
    const invoke = (name, ...args) => {
      setError('');
      try {
        Promise.resolve(controller[name](...args)).catch((reason) => {
          if (alive.current) setError(reason instanceof Error ? reason.message : String(reason));
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    return [invoke, error, () => setError('')];
  }
  function ErrorText({ error, onDismiss }) {
    t = useLiveVoiceLanguage();
    return error ? (
      <div className="dlv-error" role="alert">
        {String(error)}
        {onDismiss ? (
          <button
            type="button"
            aria-label={t('dsh-live-voice.commons.dismissError')}
            onClick={onDismiss}
          >
            {t('dsh-live-voice.commons.dismiss')}
          </button>
        ) : null}
      </div>
    ) : null;
  }
  function MicrophoneButtons({ controller }) {
    t = useLiveVoiceLanguage();
    const state = useController(controller);
    const [invoke, error, clearError] = useActions(controller);
    const busy = state.conversation || state.listening || state.starting || state.recognizing;
    if (busy) return null;
    return (
      <React.Fragment>
        {
          <Button
            className="dlv-mic"
            icon="mic"
            label="dsh-live-voice.commons.conversation.start"
            onClick={() => invoke('startConversation')}
          />
        }
        {<ErrorText error={error} onDismiss={clearError} />}
      </React.Fragment>
    );
  }
  function Waveform({ controller, enabled }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const canvas = ref.current;
      const context = canvas?.getContext('2d');
      if (!context) return undefined;
      let frame = 0;
      let disposed = false;
      let width = 1;
      let height = 40;
      let ratio = 1;
      const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      function resize() {
        const bounds = canvas.getBoundingClientRect();
        width = Math.max(1, bounds.width);
        height = Math.max(1, bounds.height || 40);
        ratio = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
      observer?.observe(canvas);
      window.addEventListener('resize', resize);
      resize();
      function draw(time) {
        if (disposed) return;
        if (ratio !== Math.max(1, window.devicePixelRatio || 1)) resize();
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        const raw = Number(controller.meter?.level?.() ?? 0);
        const level = enabled && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
        const color = getComputedStyle(canvas).color;
        // Zero input is flat: decorative motion must never imply microphone activity.
        for (let layer = 0; layer < 3; layer += 1) {
          context.beginPath();
          context.strokeStyle = layer === 1 ? '#38bdf8' : color;
          context.globalAlpha = 0.4 + layer * 0.25;
          context.lineWidth = layer === 2 ? 2 : 1;
          const phase = motion?.matches ? 0 : time / (500 + layer * 170);
          for (let x = 0; x <= width; x += 2) {
            const envelope = Math.sin((Math.PI * x) / width);
            const y =
              height / 2 +
              Math.sin((x / width) * Math.PI * (4 + layer * 2) + phase) *
                envelope *
                level *
                height *
                (0.43 - layer * 0.08);
            if (x === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          }
          context.stroke();
        }
        context.globalAlpha = 1;
        frame = window.requestAnimationFrame(draw);
      }
      frame = window.requestAnimationFrame(draw);
      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        observer?.disconnect();
        window.removeEventListener('resize', resize);
      };
    }, [controller, enabled]);
    return <canvas ref={ref} className="dlv-wave" aria-hidden />;
  }
  function RecordingBar({ controller, questionOnly = false, overlay = false, overlayStyle }) {
    t = useLiveVoiceLanguage();
    const state = useController(controller);
    const [now, setNow] = React.useState(Date.now());
    React.useEffect(() => {
      if (!state.autoSendAt) return;
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 200);
      return () => clearInterval(timer);
    }, [state.autoSendAt]);
    const [invoke, error, clearError] = useActions(controller);
    const capture =
      state.starting || state.listening || state.recognizing || state.pendingTranscriptions > 0;
    if (questionOnly && !state.answeringQuestion) return null;
    if (
      !state.conversation &&
      !capture &&
      !state.speaking &&
      !state.paused &&
      !state.error &&
      !error
    )
      return null;
    const remaining = state.autoSendAt
      ? Math.max(1, Math.ceil((state.autoSendAt - now) / 1000))
      : null;
    const localizedStatus = resolveConversationStatus(state, remaining, {
      commons: {
        conversation: { idle: () => t('dsh-live-voice.commons.conversation.idle') },
        status: Object.fromEntries(
          ['ready', 'recovering', 'stopped'].map((key) => [
            key,
            () => t('dsh-live-voice.commons.status.' + key),
          ]),
        ),
      },
      recognition: {
        microphone: { starting: () => t('dsh-live-voice.recognition.microphone.starting') },
        status: Object.fromEntries(
          [
            'answer',
            'awaitingAnswer',
            'listening',
            'listeningProcessing',
            'processing',
            'waiting',
            'waitingCommand',
          ].map((key) => [key, () => t('dsh-live-voice.recognition.status.' + key)]),
        ),
      },
      settings: {
        autoSend: {
          countdown: (params) => t('dsh-live-voice.settings.autoSend.countdown', params),
        },
      },
    });
    return (
      <div
        className={overlay ? 'dlv-bar-wrap dlv-question-overlay' : 'dlv-bar-wrap'}
        style={overlay ? overlayStyle : undefined}
      >
        {
          <div
            className="dlv-pill"
            role="group"
            aria-label={t('dsh-live-voice.commons.controls.title')}
          >
            {capture && !state.conversation ? (
              <Button
                label={t('dsh-live-voice.recognition.dictation.cancel')}
                icon="close"
                onClick={() => invoke('cancelDictation')}
              />
            ) : null}
            {state.conversation ? (
              <Button
                label={t('dsh-live-voice.commons.conversation.end')}
                icon="close"
                onClick={() => invoke('stopConversationInput')}
              />
            ) : null}
            <RecordingProgress controller={controller} />
            {<Waveform controller={controller} enabled={Boolean(state.listening)} />}
            {
              <span className="dlv-status" role="status" aria-live="polite">
                {localizedStatus}
              </span>
            }
            {
              <Button
                className="dlv-live-toggle"
                label={t('dsh-live-voice.settings.delivery.toggle')}
                title={t('dsh-live-voice.settings.delivery.status', {
                  mode:
                    state.settings.sendingMode === 'steer'
                      ? t('dsh-live-voice.settings.delivery.steerDescription')
                      : state.settings.sendingMode === 'queue'
                        ? t('dsh-live-voice.commons.queue')
                        : t('dsh-live-voice.commons.off'),
                })}
                icon={state.settings.sendingMode === 'queue' ? 'queue' : 'send'}
                visibleLabel={
                  state.settings.sendingMode === 'steer'
                    ? 'dsh-live-voice.commons.send'
                    : state.settings.sendingMode === 'queue'
                      ? 'dsh-live-voice.commons.delivery.queueBadge'
                      : 'dsh-live-voice.commons.toggle.offBadge'
                }
                aria-label={t('dsh-live-voice.settings.delivery.status', {
                  mode: t(
                    state.settings.sendingMode === 'steer'
                      ? 'dsh-live-voice.settings.delivery.steerDescription'
                      : state.settings.sendingMode === 'queue'
                        ? 'dsh-live-voice.commons.queue'
                        : 'dsh-live-voice.commons.manual',
                  ),
                })}
                aria-pressed={['queue', 'steer'].includes(state.settings.sendingMode)}
                data-mode={state.settings.sendingMode || 'manual'}
                onClick={() =>
                  invoke('updateSettings', {
                    sendingMode: !['queue', 'steer'].includes(state.settings.sendingMode)
                      ? 'queue'
                      : state.settings.sendingMode === 'queue'
                        ? 'steer'
                        : 'manual',
                  })
                }
              />
            }
            {
              <Button
                className={`dlv-live-toggle${state.speechSegmentsRemaining > 0 ? ' dlv-live-toggle-expanded' : ''}`}
                label={t('dsh-live-voice.speak.autoPlayback.label')}
                title={
                  state.speechSegmentsRemaining > 0
                    ? t(
                        state.speechSegmentsRemaining === 1
                          ? 'dsh-live-voice.speak.autoPlayback.remainingOne'
                          : 'dsh-live-voice.speak.autoPlayback.remainingOther',
                        {
                          state: t(
                            state.settings.announceAssistantMessages !== false
                              ? 'dsh-live-voice.commons.on'
                              : 'dsh-live-voice.commons.off',
                          ),
                          count: state.speechSegmentsRemaining,
                        },
                      )
                    : t('dsh-live-voice.speak.autoPlayback.status', {
                        state: t(
                          state.settings.announceAssistantMessages !== false
                            ? 'dsh-live-voice.commons.on'
                            : 'dsh-live-voice.commons.off',
                        ),
                      })
                }
                icon={state.settings.announceAssistantMessages !== false ? 'speaker' : 'speakerOff'}
                visibleLabel={
                  state.settings.announceAssistantMessages === false
                    ? 'dsh-live-voice.commons.toggle.offBadge'
                    : state.speechSegmentsRemaining > 0
                      ? String(state.speechSegmentsRemaining)
                      : 'dsh-live-voice.commons.on'
                }
                role="switch"
                aria-checked={state.settings.announceAssistantMessages !== false}
                onClick={() =>
                  invoke('updateSettings', {
                    announceAssistantMessages: state.settings.announceAssistantMessages === false,
                  })
                }
              />
            }
            {remaining ? (
              <Button
                label={t('dsh-live-voice.settings.autoSend.cancel')}
                icon="close"
                onClick={() => invoke('cancelAutoSend')}
              />
            ) : null}
            {state.conversation && !capture ? (
              <Button
                label={t('dsh-live-voice.recognition.microphone.takeControl')}
                icon="mic"
                onClick={() => invoke('takeMicrophone')}
              />
            ) : null}
            {capture ? (
              <Button
                className="dlv-live-toggle dlv-mic-state"
                label={
                  state.muted
                    ? 'dsh-live-voice.recognition.microphone.resume'
                    : 'dsh-live-voice.recognition.microphone.ignore'
                }
                title={t('dsh-live-voice.recognition.microphone.inputStatus', {
                  state: t(
                    state.muted
                      ? 'dsh-live-voice.commons.input.ignoring'
                      : 'dsh-live-voice.commons.input.listening',
                  ),
                })}
                icon="mic"
                visibleLabel={
                  state.muted
                    ? 'dsh-live-voice.commons.input.ignoringBadge'
                    : 'dsh-live-voice.commons.input.listeningBadge'
                }
                aria-pressed={Boolean(state.muted)}
                data-muted={state.muted ? 'true' : 'false'}
                onClick={() => invoke(state.muted ? 'resumeListeningInput' : 'muteListening')}
              />
            ) : null}
            {
              // Keep the playback controls mounted during the configured gap between
              // queued segments; only Pause is unavailable when no audio is active.
              state.speechSegmentsRemaining > 1 ? (
                <Button
                  label={t('dsh-live-voice.speak.playback.next')}
                  icon="skipNext"
                  onClick={() => invoke('skipSpeechSegment')}
                />
              ) : null
            }
            {state.speechSegmentsRemaining > 0 &&
            state.capabilities[state.settings.engine]?.pause ? (
              <Button
                label={t('dsh-live-voice.speak.playback.pause')}
                icon="pause"
                disabled={!state.speaking || state.paused}
                onClick={() => invoke('pauseSpeech')}
              />
            ) : null}
            {state.paused && state.capabilities[state.settings.engine]?.resume ? (
              <Button
                label={t('dsh-live-voice.speak.playback.resume')}
                icon="play"
                onClick={() => invoke('resumeSpeech')}
              />
            ) : null}
            {state.speechSegmentsRemaining > 0 ? (
              <Button
                label={t('dsh-live-voice.speak.playback.stopAll')}
                icon="stop"
                onClick={() => invoke('stopSpeech')}
              />
            ) : null}
          </div>
        }
        {
          <ErrorText
            error={error || state.error}
            onDismiss={() => {
              clearError();
              controller.clearError();
            }}
          />
        }
      </div>
    );
  }
  function SpeakButton({ active = false, disabled = false, label, onClick }) {
    t = useLiveVoiceLanguage();
    return (
      <Button
        className="dlv-speaker"
        label={
          label ||
          (active ? 'dsh-live-voice.speak.playback.stop' : 'dsh-live-voice.speak.playback.message')
        }
        icon={active ? 'stop' : 'speaker'}
        aria-pressed={Boolean(active)}
        disabled={disabled}
        onClick={onClick}
      />
    );
  }
  const provide = (Component) => withLiveVoiceLanguage(Component, locale);
  return {
    MicrophoneButtons: provide(MicrophoneButtons),
    RecordingBar: provide(RecordingBar),
    SpeakButton: provide(SpeakButton),
  };
}
