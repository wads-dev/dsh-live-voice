// @ts-nocheck
import { TranscriptDraft } from './transcript.ts';
import { normalizeSettings } from './settings.ts';
import { SPEECH_QUEUE_PREFETCH_LIMIT } from '../speak/services/speechQueue.js';
import {
  filterSpeechOutput,
  hasMinimumWords,
  hasUnclosedCodeFence,
  hasIncompleteSpeechMarkdown,
  matchVoiceCommand,
  splitSpeechOutput,
  splitInitialSpeechItem,
} from './filters.ts';

const message = (error) => error?.message || String(error);
function cancellable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Session-owned policy. Input transitions are serialized; generations invalidate late work. */
export class VoiceCoordinator {
  constructor({
    recognition,
    engines,
    meter,
    composer,
    settings = {},
    persistSettings,
    recordingTimeline,
  }) {
    Object.assign(this, {
      recognition,
      engines,
      meter,
      composer,
      persistSettings,
      recordingTimeline,
    });
    this.listeners = new Set();
    this.transcript = new TranscriptDraft();
    this.epoch = 0;
    this.speechEpoch = 0;
    this.controlEpoch = 0;
    this.queue = [];
    this.speechHistory = [];
    this.speechCursor = -1;
    this.prefetchController = new AbortController();
    this.prefetchItems = new Set();
    this.activeSpeechItem = null;
    this.consumed = new Map();
    this.unfinished = new Set();
    this.suppressed = new Set();
    this.inputTail = Promise.resolve();
    this.speechBarrier = Promise.resolve();
    this.disposed = false;
    this.inputReleaseError = null;
    this.speechStopError = null;
    this.snapshot = {
      conversation: false,
      listening: false,
      recognizing: false,
      pendingTranscriptions: 0,
      pendingTranscriptionRequests: undefined,
      pendingDeliveryTranscriptions: undefined,
      muted: normalizeSettings(settings).microphoneEnabled === false,
      speaking: false,
      paused: false,
      starting: false,
      error: null,
      activeMessageId: null,
      speechLoading: false,
      speechText: null,
      speechEngine: null,
      answeringQuestion: false,
      autoSendAt: null,
      speechSegmentsRemaining: 0,
      speechSegmentIndex: 0,
      speechSegmentsTotal: 0,
      speechHasPrevious: false,
      speechRunActive: false,
      capabilities: {},
      settings: normalizeSettings(settings),
      timestamps: normalizeSettings(settings).timestampsEnabled,
    };
    this.autoSendTimer = null;
    this.autoSendDraft = null;
    this.holdToTalkRelease = false;
    this.interruptionTimer = null;
    this.interruptionResumeTimer = null;
    this.interruptionTranscriptConfirmed = false;
    this.interruptionPausedSpeech = false;
    this.assistantSpeechTimer = null;
    this.assistantSpeechNotBefore = 0;
    this.assistantSpeechDelayReason = 'silence-delay';
    this.recognition.lang = this.snapshot.settings.recognitionLang;
    this.meter.deviceId = this.snapshot.settings.inputDeviceId;
    this.getSnapshot = () => this.snapshot;
    this.subscribe = (listener) => {
      if (this.disposed) return () => {};
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    };
  }
  patch(next) {
    this.snapshot = { ...this.snapshot, ...next };
    this._auditSpeechWait();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* Views do not own resource cleanup. */
      }
    }
  }
  clearError() {
    if (!this.disposed) this.patch({ error: null });
  }
  replaceRecognition(recognition) {
    if (this.disposed || !recognition) return;
    this.recognition = recognition;
    Object.assign(recognition, {
      lang: this.snapshot.settings.recognitionLang,
      processLocally: this.snapshot.settings.recognitionProcessLocally,
      autoInstallLocalPack: this.snapshot.settings.recognitionAutoInstall,
      voiceDetectionEngine: this.snapshot.settings.voiceDetectionEngine,
      voiceDetectionPreset: this.snapshot.settings.voiceDetectionPreset,
      voiceDetectionCustomSilenceMs: this.snapshot.settings.voiceDetectionCustomSilenceMs,
      ...Object.fromEntries(
        [
          'recordingEnabled',
          'recordingKeepPrevious',
          'recordingBitrate',
          'recordingPreRollMs',
          'recordingPostRollMs',
          'voiceDetectionThreshold',
          'voiceDetectionMinimumSpeechMs',
          'voiceDetectionCustomParagraphMs',
        ].map((key) => [key, this.snapshot.settings[key]]),
      ),
    });
    this.patch({ capabilities: { ...this.snapshot.capabilities, recognition: undefined } });
  }
  explainRecognition() {
    throw new Error(
      (this.snapshot.capabilities.capture?.reason ||
        this.snapshot.capabilities.recognition?.reason ||
        'Local speech recognition is unavailable.') +
        ' Open Settings → Live Voice to check language and engine availability.',
    );
  }
  updateSettings(next) {
    if (this.disposed) return;
    const previousSettings = this.snapshot.settings;
    const settings = normalizeSettings({ ...previousSettings, ...next });
    const speechPreparationChanged = ['engine', 'voice', 'lang', 'rate', 'outputDeviceId'].some(
      (key) => Object.hasOwn(next, key) && settings[key] !== previousSettings[key],
    );
    if (speechPreparationChanged) this._cancelSpeechPrefetch();
    if (settings.volume !== previousSettings.volume) {
      this.engines[this.snapshot.speechEngine || settings.engine]?.setVolume?.(settings.volume);
    }
    this.meter.deviceId = settings.inputDeviceId;
    Object.assign(this.recognition, {
      lang: settings.recognitionLang,
      processLocally: settings.recognitionProcessLocally,
      autoInstallLocalPack: settings.recognitionAutoInstall,
      voiceDetectionEngine: settings.voiceDetectionEngine,
      voiceDetectionPreset: settings.voiceDetectionPreset,
      voiceDetectionCustomSilenceMs: settings.voiceDetectionCustomSilenceMs,
      ...Object.fromEntries(
        [
          'recordingEnabled',
          'recordingKeepPrevious',
          'recordingBitrate',
          'recordingPreRollMs',
          'recordingPostRollMs',
          'voiceDetectionThreshold',
          'voiceDetectionMinimumSpeechMs',
          'voiceDetectionCustomParagraphMs',
        ].map((key) => [key, settings[key]]),
      ),
    });
    this.patch({
      settings,
      timestamps: settings.timestampsEnabled,
      muted: settings.microphoneEnabled === false,
      recognizing: this.snapshot.recognizing,
      error: null,
    });
    if (settings.sendingMode === 'manual') this.cancelAutoSend();
    if (previousSettings.announceAssistantMessages && !settings.announceAssistantMessages) {
      // Disabling speech is an explicit cancellation, not just an admission preference.
      // Ignore unchanged persisted values so manual playback remains available while off.
      void this.stopSpeech();
    }
    if (Object.hasOwn(next, 'assistantSpeechDelaySeconds') && this.assistantSpeechNotBefore > 0) {
      this.assistantSpeechNotBefore = Date.now() + settings.assistantSpeechDelaySeconds * 1000;
      this._cancelAssistantSpeechTimer();
      this._drain();
    }
  }
  async refreshCapabilities({ localOnly = false } = {}) {
    if (localOnly) {
      // Configuration discovery is local and must never contact provider health endpoints.
      const playback = Object.fromEntries(
        Object.entries(this.engines).map(([id, engine]) => [
          id,
          {
            ...this.snapshot.capabilities[id],
            ...engine.getPlaybackCapabilities?.(),
          },
        ]),
      );
      const browser = this.engines.browser?.voices?.();
      const capture = await this.meter.capability?.();
      if (this.disposed) return;
      this.patch({
        capabilities: {
          ...this.snapshot.capabilities,
          ...playback,
          ...(browser
            ? {
                browser: {
                  ...playback.browser,
                  voices: browser.map(({ name, voiceURI, lang }) => ({ name, voiceURI, lang })),
                },
              }
            : {}),
          ...(capture ? { capture } : {}),
        },
      });
      return;
    }
    const request = (this.capabilityRequest = (this.capabilityRequest || 0) + 1);
    const caps = {};
    const lang = this.snapshot.settings.recognitionLang;
    Object.assign(this.recognition, {
      lang,
      processLocally: this.snapshot.settings.recognitionProcessLocally,
      autoInstallLocalPack: this.snapshot.settings.recognitionAutoInstall,
    });
    const probes = Object.entries(this.engines).map(([id, engine]) => [
      id,
      () => engine.capability?.() ?? engine.getCapabilities(),
    ]);
    probes.push(['recognition', () => this.recognition.capability({ lang })]);
    probes.push(['capture', () => this.meter.capability()]);
    await Promise.all(
      probes.map(async ([id, probe]) => {
        try {
          caps[id] = await probe();
        } catch (error) {
          caps[id] = { supported: false, reason: message(error) };
        }
        // A pending microphone/language check must not hide usable speech engines.
        if (
          !this.disposed &&
          request === this.capabilityRequest &&
          lang === this.snapshot.settings.recognitionLang
        ) {
          this.patch({ capabilities: { ...this.snapshot.capabilities, [id]: caps[id] } });
        }
      }),
    );
    return caps;
  }
  _input(task) {
    const result = this.inputTail.then(task);
    this.inputTail = result.catch(() => {});
    return result;
  }
  async _releaseInput() {
    // Drain recorder-owned worklet buffers while its context/source still exist.
    const recognitionResult = await Promise.resolve()
      .then(() => this.recognition.stop())
      .then(
        () => ({ status: 'fulfilled' }),
        (reason) => ({ status: 'rejected', reason }),
      );
    const results = [
      recognitionResult,
      ...(await Promise.allSettled([Promise.resolve().then(() => this.meter.stop())])),
    ];
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    if (errors.length) throw new AggregateError(errors, errors.map(message).join('; '));
  }
  startDictation() {
    return this.startListening(false);
  }
  startHoldToTalk() {
    this.holdToTalkRelease = false;
    return this.startListening(false);
  }
  async releaseHoldToTalk() {
    if (this.disposed || (!this.snapshot.listening && !this.snapshot.starting)) return;
    this.holdToTalkRelease = true;
    if (this.snapshot.starting) return;
    const epoch = this.epoch;
    await this.recognition.finish?.();
    if (this.disposed || this.epoch !== epoch) return;
    if (this.snapshot.pendingTranscriptions === 0) this._finishHoldToTalk();
  }
  _finishHoldToTalk() {
    if (!this.holdToTalkRelease) return;
    this.holdToTalkRelease = false;
    const draft = this.composer.getDraft();
    if (!draft.trim()) {
      void this.stopListening();
      return;
    }
    this.scheduleAutoSend(draft, { force: true, stopAfter: true });
  }
  startConversation() {
    if (this.disposed) return Promise.resolve();
    this.patch({ error: null });
    return this._startInput(true);
  }
  takeMicrophone() {
    return this.startListening(true);
  }
  async stopConversationInput() {
    this.patch({ conversation: false });
    await this.stopListening();
    if (!this._speechActivity()) {
      this.assistantSpeechNotBefore =
        Date.now() + this.snapshot.settings.assistantSpeechDelaySeconds * 1000;
      this._cancelAssistantSpeechTimer();
    }
    this._handleSpeechInterruption(this._speechActivity());
    this._drain();
  }
  toggleTimestamps() {
    return this.updateSettings({ timestampsEnabled: !this.snapshot.timestamps });
  }
  muteListening() {
    this.cancelAutoSend();
    // Discard pending recognition without rewriting the composer.
    this.transcript.reset();
    this.updateSettings({ microphoneEnabled: false });
    // Ignoring discards text; capture and interruption remain active even without voice commands.
  }
  resumeListeningInput() {
    this.transcript.reset();
    this.updateSettings({ microphoneEnabled: true });
    if (this.snapshot.listening || this.snapshot.starting) {
      if (!this.recognition.activityManaged) this.patch({ recognizing: false });
      return;
    }
    return this.startListening(this.snapshot.conversation);
  }
  startListening(conversation = this.snapshot.conversation) {
    if (this.disposed) return Promise.resolve();
    // Reserve input ownership before awaiting any speech teardown.
    this.patch({ error: null });
    const stopped = this.stopSpeech(false);
    return this._startInput(conversation, stopped);
  }
  _startInput(conversation, prerequisite = Promise.resolve()) {
    if (this.disposed) return Promise.resolve();
    const epoch = ++this.epoch;
    this.inputController?.abort();
    const controller = new AbortController();
    this.inputController = controller;
    this.patch({ starting: true, listening: false, recognizing: false, conversation });
    const valid = () => !this.disposed && epoch === this.epoch;
    return this._input(async () => {
      if (!valid()) return;
      try {
        await prerequisite;
        if (!valid()) return;
        if (this.speechStopError) throw this.speechStopError;
        await this._releaseInput();
        if (!valid()) return;
        // Enabling input is not a playback takeover. Speaker capture waits for playback.
        if (
          this.snapshot.settings.mode === 'speaker' &&
          this.snapshot.speaking &&
          !this.snapshot.paused
        ) {
          this.patch({ starting: false });
          return;
        }
        const lang = this.snapshot.settings.recognitionLang;
        this.recognition.lang = lang;
        const capability = await cancellable(
          this.recognition.capability({ lang }),
          controller.signal,
        );
        if (!valid()) return;
        if (!capability.supported)
          throw new Error(capability.reason || 'Local browser recognition is unavailable.');
        let started;
        try {
          const deviceId = this.snapshot.settings.inputDeviceId;
          try {
            started = await this.meter.start({ signal: controller.signal });
          } catch (error) {
            if (
              error?.name !== 'OverconstrainedError' ||
              !deviceId ||
              !valid() ||
              controller.signal.aborted ||
              this.snapshot.settings.inputDeviceId !== deviceId
            )
              throw error;
            // Repair only the obsolete input preference, without ending this input operation.
            VoiceCoordinator.prototype.updateSettings.call(this, { inputDeviceId: '' });
            await cancellable(
              Promise.resolve(this.persistSettings?.({ inputDeviceId: '' })),
              controller.signal,
            );
            if (
              !valid() ||
              controller.signal.aborted ||
              this.snapshot.settings.inputDeviceId !== ''
            )
              return;
            started = await this.meter.start({ signal: controller.signal });
          }
        } catch (error) {
          if (valid())
            this.patch({
              capabilities: {
                ...this.snapshot.capabilities,
                capture: {
                  supported: false,
                  permission: error?.name === 'NotAllowedError' ? 'denied' : 'error',
                  reason:
                    error?.name === 'NotAllowedError'
                      ? 'Microphone permission was denied. Allow it in browser settings, then refresh availability.'
                      : `Microphone capture failed: ${message(error)}`,
                },
              },
            });
          throw error;
        }
        if (!valid()) {
          await this._releaseInput();
          return;
        }
        if (!started) throw new Error('Microphone metering could not start.');
        this.transcript.reset();
        await this.recognition.start({
          lang,
          signal: controller.signal,
          onResult: (result) => {
            if (valid()) this.onResult(result);
          },
          onProcessingChange: ({ pending = 0, transcribing, deliveryPending } = {}) => {
            if (!valid()) return;
            const count = Number.isSafeInteger(pending) && pending >= 0 ? pending : 0;
            const requests =
              Number.isSafeInteger(transcribing) && transcribing >= 0 ? transcribing : count;
            const delivery =
              Number.isSafeInteger(deliveryPending) && deliveryPending >= 0
                ? deliveryPending
                : count;
            this.patch({
              pendingTranscriptions: count,
              pendingTranscriptionRequests: requests,
              pendingDeliveryTranscriptions: delivery,
            });
            if (delivery > 0) this.cancelAutoSend({ preserveIntent: true });
            else if (this.holdToTalkRelease) {
              if (count === 0) this._finishHoldToTalk();
            } else this.maybeScheduleAutoSend();
            if (count === 0) this._drain();
          },
          onActivity: (active) => {
            if (!valid()) return;
            if (active) {
              this.cancelAutoSend({ preserveIntent: true });
              this.assistantSpeechDelayReason = 'silence-delay';
              this.assistantSpeechNotBefore = Infinity;
              this._cancelAssistantSpeechTimer();
            } else
              this.assistantSpeechNotBefore =
                Date.now() + this.snapshot.settings.assistantSpeechDelaySeconds * 1000;
            this.patch({ recognizing: active });
            this._handleSpeechInterruption(this._speechActivity());
            if (!active) {
              this.refreshDeliveryReadiness();
              this._drain();
            }
          },
          onError: (error) => {
            if (!valid()) return;
            const ended = this.stopConversationInput();
            this.patch({ error: message(error) });
            void ended;
          },
        });
        if (!valid()) {
          await this._releaseInput();
          return;
        }
        this.patch({ listening: true, starting: false });
        if (this.holdToTalkRelease) void this.releaseHoldToTalk();
        this._drain();
      } catch (error) {
        try {
          await this._releaseInput();
        } catch (cleanup) {
          error = new AggregateError([error, cleanup], message(error) + '; ' + message(cleanup));
        }
        if (valid()) {
          this.patch({
            starting: false,
            listening: false,
            conversation: false,
            recognizing: false,
            error: message(error),
          });
        }
      }
    });
  }
  _interruptionTranscriptQualifies(text) {
    return hasMinimumWords(text, 1);
  }

  _speechActivity() {
    return this.snapshot.recognizing || this.externalSpeechActive;
  }
  setExternalSpeechActivity(active) {
    if (this.disposed) return;
    this.externalSpeechActive = Boolean(active);
    if (!active) this.externalSpeechConfirmed = false;
    if (active) {
      this.assistantSpeechDelayReason = 'silence-delay';
      this.assistantSpeechNotBefore = Infinity;
      this._cancelAssistantSpeechTimer();
    } else if (!this.snapshot.recognizing) {
      this.assistantSpeechNotBefore =
        Date.now() + this.snapshot.settings.assistantSpeechDelaySeconds * 1000;
    }
    this._handleSpeechInterruption(this._speechActivity());
    this._auditSpeechWait();
    if (!active) this._drain();
  }
  confirmExternalSpeech(text) {
    if (this.disposed) return false;
    const normalized = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    const heard = normalized(text);
    const own = normalized(this.snapshot.speechText);
    // System-audio mixes may still contain TTS despite browser exclusion hints.
    if (this.snapshot.speaking && heard && own.includes(heard)) return false;
    if (this.externalSpeechActive && this._interruptionTranscriptQualifies(text)) {
      this.externalSpeechConfirmed = true;
      this._handleSpeechInterruption(true);
    }
    return true;
  }
  _handleSpeechInterruption(active) {
    if (
      this.snapshot.settings.mode !== 'headphones' &&
      !this.externalSpeechConfirmed &&
      !this.interruptionPausedSpeech
    )
      return;
    if (active) {
      this._cancelInterruptionResume();
      if (
        !(this.interruptionTranscriptConfirmed || this.externalSpeechConfirmed) ||
        this.interruptionTimer !== null ||
        !this.snapshot.speaking ||
        this.snapshot.paused
      )
        return;
      this.interruptionTimer = setTimeout(() => {
        this.interruptionTimer = null;
        if (
          (this.interruptionTranscriptConfirmed || this.externalSpeechConfirmed) &&
          this._speechActivity() &&
          this.snapshot.speaking &&
          !this.snapshot.paused
        ) {
          this.activeRecordingTimeline?.('assistant-interruption-request', { automatic: true });
          this.interruptionPausedSpeech = true;
          void this.pauseSpeech(true).then(() => {
            if (!this._speechActivity()) this._scheduleInterruptionResume();
          });
        }
      }, this.snapshot.settings.assistantSpeechDelaySeconds * 1000);
      return;
    }
    if (this.interruptionTimer !== null) clearTimeout(this.interruptionTimer);
    this.interruptionTimer = null;
    this.interruptionTranscriptConfirmed = false;
    this._scheduleInterruptionResume();
  }
  _cancelInterruptionResume() {
    if (this.interruptionResumeTimer !== null) clearTimeout(this.interruptionResumeTimer);
    this.interruptionResumeTimer = null;
  }
  _scheduleInterruptionResume() {
    if (
      !this.interruptionPausedSpeech ||
      !this.snapshot.paused ||
      this._speechActivity() ||
      this.interruptionResumeTimer !== null
    )
      return;
    const epoch = this.speechEpoch;
    const control = this.controlEpoch;
    this.interruptionResumeTimer = setTimeout(() => {
      this.interruptionResumeTimer = null;
      if (
        this.disposed ||
        epoch !== this.speechEpoch ||
        control !== this.controlEpoch ||
        this._speechActivity() ||
        !this.interruptionPausedSpeech
      )
        return;
      this.interruptionPausedSpeech = false;
      void this.resumeSpeech();
    }, this.snapshot.settings.assistantSpeechDelaySeconds * 1000);
  }

  onResult({ final = '', interim = '', startedAt, paragraphBefore = false, onCommandRecognized }) {
    if (this.disposed || (!this.snapshot.listening && !this.snapshot.starting)) return;
    const recognizing = this.recognition.activityManaged ? this.snapshot.recognizing : !!interim;
    if (
      this.snapshot.speaking &&
      !this.snapshot.paused &&
      this.snapshot.settings.mode === 'speaker'
    )
      return;
    if (
      this.snapshot.settings.mode === 'headphones' &&
      this.snapshot.speaking &&
      this._interruptionTranscriptQualifies(final || interim)
    ) {
      this.interruptionTranscriptConfirmed = true;
      this._handleSpeechInterruption(true);
    }
    // Pending structured questions own recognition while waiting for a hands-free
    // answer. Keep their interim and final text out of the normal chat composer.
    if (
      !this.snapshot.muted &&
      typeof this.composer.handleQuestionResult === 'function' &&
      this.composer.handleQuestionResult({ final, interim })
    ) {
      this.cancelAutoSend();
      this.transcript.reset();
      this.patch({ recognizing });
      return;
    }
    // A native event can contain a final result without an interim result. Do not
    // run a second empty hypothesis update: it would replace the just-committed
    // result with a stale composer snapshot before the editor publishes it.
    if (final) {
      const command =
        this.snapshot.settings.voiceCommandsEnabled &&
        matchVoiceCommand(final, {
          send: this.snapshot.settings.voiceCommandSend,
          queue: this.snapshot.settings.voiceCommandQueue,
          end: this.snapshot.settings.voiceCommandEnd,
          mute: this.snapshot.settings.voiceCommandMute,
          resume: this.snapshot.settings.voiceCommandResume,
          stopSpeaking: this.snapshot.settings.voiceCommandStopSpeaking,
          clear: this.snapshot.settings.voiceCommandClear,
        });
      if (command) {
        if (onCommandRecognized) onCommandRecognized(command);
        else this.recordingTimeline?.()?.('voice-command-recognized', { command });
        // Discard pending recognition without rewriting the composer.
        this.transcript.reset();
        this.cancelAutoSend();
        this.patch({ recognizing });
        if (command === 'end') void this.endConversation();
        else if (command === 'mute') this.muteListening();
        else if (command === 'resume') this.resumeListeningInput();
        else if (command === 'stopSpeaking') {
          if (!this.snapshot.settings.announceAssistantMessages) void this.stopSpeech();
          this.updateSettings({ announceAssistantMessages: false });
        } else if (command === 'clear') {
          this.cancelAutoSend();
          this.transcript.reset();
          this.composer.setDraft('');
        } else if (this.snapshot.muted) return;
        else {
          const sendingMode = command === 'send' ? 'steer' : 'queue';
          // Spoken delivery is a one-shot action, not an automatic-send preference change.
          if (this.composer.getDraft().trim() && typeof this.composer.submit === 'function')
            this.composer.submit(sendingMode);
        }
        return;
      }
      if (this.snapshot.muted) {
        // Discard pending recognition without rewriting the composer.
        this.transcript.reset();
        this.patch({ recognizing });
        this._handleSpeechInterruption(this._speechActivity());
        if (!interim && !recognizing) {
          this.assistantSpeechNotBefore =
            Date.now() + this.snapshot.settings.assistantSpeechDelaySeconds * 1000;
          this._drain();
        }
        return;
      }
      if (
        this.snapshot.settings.recognitionFilterEnabled &&
        !hasMinimumWords(final, this.snapshot.settings.recognitionMinimumWords)
      ) {
        // Discard pending recognition without rewriting the composer.
        this.transcript.reset();
        this.patch({ recognizing });
        this.refreshDeliveryReadiness();
        return;
      }
      this.cancelAutoSend();
      const appended = this.composer.appendFinal?.(final, startedAt, paragraphBefore);
      const next =
        appended ?? this.transcript.update(this.composer.getDraft(), final, true, paragraphBefore);
      if (appended == null) this.composer.setDraft(next);
      if (this.snapshot.settings.sendingMode !== 'manual') this.autoSendIntent = next;
      this.maybeScheduleAutoSend(next);
    }
    if (interim) {
      this.cancelAutoSend({ preserveIntent: true });
      // Interim hypotheses affect recognition status only, never composer content.
    }
    if (!this.recognition.activityManaged && !interim && this.snapshot.recognizing)
      this.assistantSpeechNotBefore =
        Date.now() + this.snapshot.settings.assistantSpeechDelaySeconds * 1000;
    this.patch({ recognizing });
    this.refreshDeliveryReadiness();
    this._handleSpeechInterruption(this._speechActivity());
    this._drain();
  }
  deliveryPending() {
    return this.snapshot.pendingDeliveryTranscriptions ?? this.snapshot.pendingTranscriptions;
  }
  maybeScheduleAutoSend(draft = this.autoSendIntent) {
    if (draft == null || draft !== this.composer.getDraft()) return;
    if (this.autoSendTimer !== null) return;
    if (
      this.snapshot.settings.sendingMode === 'manual' ||
      this.snapshot.muted ||
      this.composer.canAutoSend?.() === false ||
      this.snapshot.recognizing ||
      this.deliveryPending() > 0
    )
      return;
    this.scheduleAutoSend(draft);
  }
  refreshDeliveryReadiness() {
    if (
      this.composer.canAutoSend?.() === false ||
      this.snapshot.recognizing ||
      this.deliveryPending() > 0
    )
      this.cancelAutoSend({ preserveIntent: true });
    else this.maybeScheduleAutoSend();
  }
  scheduleAutoSend(draft, { force = false, stopAfter = false } = {}) {
    this.cancelAutoSend();
    if (!draft.trim() || typeof this.composer.submit !== 'function') return;
    const delay = this.snapshot.settings.autoSendDelaySeconds * 1000;
    this.autoSendDraft = draft;
    this.autoSendIntent = draft;
    this.patch({ autoSendAt: Date.now() + delay });
    this.autoSendTimer = setTimeout(() => {
      this.autoSendTimer = null;
      const expected = this.autoSendDraft;
      this.autoSendIntent = null;
      this.autoSendDraft = null;
      this.patch({ autoSendAt: null });
      if (
        !this.disposed &&
        (force || this.snapshot.settings.sendingMode !== 'manual') &&
        !this.snapshot.muted &&
        this.composer.canAutoSend?.() !== false &&
        expected === this.composer.getDraft()
      ) {
        try {
          this.composer.submit(
            this.snapshot.settings.sendingMode === 'steer' && !force ? 'steer' : 'queue',
          );
          // Web Speech keeps a cumulative native result list for the lifetime of
          // one recognition instance. Start a fresh instance at the turn boundary
          // so the sent utterance cannot prefix the next one.
          this.transcript.reset();
          this.recognition.reset?.();
          if (stopAfter) void this.stopListening();
        } catch (error) {
          this.patch({ error: message(error) });
        } finally {
          // Automatic assistant speech shares the same turn boundary as delivery:
          // it may proceed only after the transcript was submitted (or the
          // countdown ended without a matching draft).
          this._drain();
        }
      } else {
        if (
          !this.disposed &&
          !this.snapshot.muted &&
          expected === this.composer.getDraft() &&
          this.snapshot.settings.sendingMode !== 'manual' &&
          this.composer.canAutoSend?.() === false
        )
          this.autoSendIntent = expected;
        this._drain();
      }
    }, delay);
  }
  cancelAutoSend({ preserveIntent = false } = {}) {
    if (!preserveIntent) this.autoSendIntent = null;
    if (this.autoSendTimer !== null) clearTimeout(this.autoSendTimer);
    this.autoSendTimer = null;
    this.autoSendDraft = null;
    if (this.snapshot?.autoSendAt !== null) this.patch({ autoSendAt: null });
  }
  composerChanged(draft) {
    if (this.autoSendIntent != null && draft !== this.autoSendIntent) this.cancelAutoSend();
  }
  stopListening() {
    this.holdToTalkRelease = false;
    this.cancelAutoSend();
    ++this.epoch;
    this.inputController?.abort();
    this.patch({
      listening: false,
      recognizing: false,
      pendingTranscriptions: 0,
      pendingTranscriptionRequests: 0,
      pendingDeliveryTranscriptions: 0,
      starting: false,
    });
    return this._input(async () => {
      try {
        await this._releaseInput();
        this.inputReleaseError = null;
      } catch (error) {
        this.inputReleaseError = error;
        this.patch({ error: message(error) });
      }
      this.transcript.reset();
    });
  }
  async cancelDictation() {
    // Discard pending recognition without rewriting the composer.
    await this.stopListening();
  }
  async endConversation() {
    this._cancelAssistantSpeechTimer();
    this.assistantSpeechNotBefore = 0;
    this.patch({ conversation: false });
    await Promise.all([this.stopListening(), this.stopSpeech(false)]);
  }
  _cancelSpeechPrefetch() {
    this.prefetchController.abort();
    this.prefetchController = new AbortController();
    for (const item of this.prefetchItems) {
      if (!this.speechHistory.includes(item)) {
        item.prepared?.dispose?.();
        item.prepared = null;
      }
      item.preparing = null;
    }
    this.prefetchItems.clear();
  }

  _speechPreparationKey() {
    const { engine, voice, lang, rate, outputDeviceId } = this.snapshot.settings;
    return JSON.stringify([engine, voice, lang, rate, outputDeviceId]);
  }
  _resetStaleSpeechItem(item, key) {
    if (item.preparationKey === key) return;
    item.prepared?.dispose?.();
    item.prepared = null;
    item.preparing = null;
    item.prepareError = null;
    item.preparationKey = key;
  }
  _prefetchSpeech() {
    if (this.speechSuspended && !this.queue[0]?.manual) return;
    const engine = this.engines[this.snapshot.settings.engine];
    if (typeof engine?.prepare !== 'function') return;
    const options = {
      voice: this.snapshot.settings.voice || undefined,
      rate: this.snapshot.settings.rate,
      volume: this.snapshot.settings.volume,
      lang: this.snapshot.settings.lang,
      outputDeviceId: this.snapshot.settings.outputDeviceId,
    };
    const key = this._speechPreparationKey();
    for (const item of this.queue.slice(0, SPEECH_QUEUE_PREFETCH_LIMIT)) {
      this._resetStaleSpeechItem(item, key);
      if (item.prepared || item.preparing) continue;
      this.prefetchItems.add(item);
      const signal = this.prefetchController.signal;
      item.preparing = engine
        .prepare(item.text, { ...options, signal })
        .then((prepared) => {
          if (item.preparationKey === key) item.preparing = null;
          if (
            signal.aborted ||
            item.preparationKey !== key ||
            (!this.queue.includes(item) && !this.speechHistory.includes(item))
          ) {
            prepared.dispose?.();
            this.prefetchItems.delete(item);
          } else item.prepared = prepared;
          return prepared;
        })
        .catch((error) => {
          if (item.preparationKey === key) {
            item.preparing = null;
            if (!signal.aborted) item.prepareError = error;
          }
        });
    }
  }

  _releaseSpeechHistory() {
    for (const item of this.speechHistory) item.prepared?.dispose?.();
    this.speechHistory = [];
    this.speechCursor = -1;
  }
  getSpeechHistory() {
    const groups = [];
    for (const item of [...this.speechHistory, ...this.queue]) {
      let group = groups.at(-1);
      if (!group || group.messageId !== item.id) {
        group = { messageId: item.id, segments: [] };
        groups.push(group);
      }
      if (!group.segments.includes(item)) group.segments.push(item);
    }
    return groups;
  }
  _syncSpeechSegments() {
    const speechSegmentsRemaining = this.queue.length + (this.snapshot.speaking ? 1 : 0);
    const speechHasPrevious = this.speechCursor > 0;
    const items = [...new Set([...this.speechHistory, ...this.queue])];
    const speechSegmentsTotal = items.length;
    const speechSegmentIndex = this.speechCursor >= 0 ? this.speechCursor + 1 : 0;
    const speechRunActive =
      speechSegmentsRemaining > 0 ||
      this.speechHistory.some((item) => !item.manual && this.unfinished.has(item.id));
    if (
      speechSegmentsRemaining !== this.snapshot.speechSegmentsRemaining ||
      speechHasPrevious !== this.snapshot.speechHasPrevious ||
      speechRunActive !== this.snapshot.speechRunActive ||
      speechSegmentsTotal !== this.snapshot.speechSegmentsTotal ||
      speechSegmentIndex !== this.snapshot.speechSegmentIndex
    )
      this.patch({
        speechSegmentsRemaining,
        speechHasPrevious,
        speechRunActive,
        speechSegmentsTotal,
        speechSegmentIndex,
      });
  }

  /** Copy only logical automatic-speech state before lifecycle teardown destroys resources. */
  checkpointSpeech() {
    const active =
      this.snapshot.speaking && this.activeSpeechItem && !this.activeSpeechItem.manual
        ? [this.activeSpeechItem]
        : [];
    return {
      consumed: [...this.consumed],
      unfinished: [...this.unfinished],
      suppressed: [...this.suppressed],
      pending: [...active, ...this.queue.filter((item) => !item.manual)].map(({ text, id }) => ({
        text,
        id,
      })),
      paused: this.snapshot.paused && !this.interruptionPausedSpeech,
    };
  }
  restoreSpeech(checkpoint) {
    if (!checkpoint || this.disposed) return;
    this.consumed = new Map(checkpoint.consumed);
    this.unfinished = new Set(checkpoint.unfinished);
    this.suppressed = new Set(checkpoint.suppressed);
    this.queue = checkpoint.pending.map(({ text, id }) => ({ text, id }));
    this.patch({ paused: checkpoint.paused && this.queue.length > 0 });
    this._syncSpeechSegments();
  }
  async suspendSpeech() {
    this.speechSuspended = true;
    await Promise.all([
      VoiceCoordinator.prototype.stopSpeech.call(this, false),
      this.stopListening(),
    ]);
  }
  discardSpeechMessage(id) {
    this.suppressed.add(id);
    this.queue = this.queue.filter((item) => item.id !== id);
    if (this.snapshot.activeMessageId === id) void this._navigateSpeech();
    this._syncSpeechSegments();
  }
  activateSpeech() {
    if (this.disposed) return;
    this.speechSuspended = false;
    this._prefetchSpeech();
    this._drain();
  }
  _suppressPending() {
    for (const id of this.unfinished) this.suppressed.add(id);
    if (this.snapshot.activeMessageId !== null) this.suppressed.add(this.snapshot.activeMessageId);
    for (const item of this.queue) this.suppressed.add(item.id);
    this.queue = [];
  }
  async stopSpeech(resumeListening = true) {
    const timeline = this.activeRecordingTimeline ?? this.recordingSpeechWait?.timeline;
    if (this.snapshot.speaking || this.queue.length || this.recordingSpeechWait)
      timeline?.('assistant-cancel');
    this._endSpeechWait('cancelled');
    this.activeRecordingTimeline = null;
    this._cancelAssistantSpeechTimer();
    this.assistantSpeechNotBefore = 0;
    this._cancelInterruptionResume();
    if (this.interruptionTimer !== null) clearTimeout(this.interruptionTimer);
    this.interruptionTimer = null;
    this.interruptionResumeTimer = null;
    this.interruptionTranscriptConfirmed = false;
    this.interruptionPausedSpeech = false;
    const epoch = ++this.speechEpoch;
    ++this.controlEpoch;
    this.speechController?.abort();
    this.speechLaunchPending = false;
    this._cancelSpeechPrefetch();
    this._suppressPending();
    this._releaseSpeechHistory();
    this.patch({
      speaking: false,
      paused: false,
      activeMessageId: null,
      speechLoading: false,
      speechText: null,
      speechEngine: null,
    });
    this._syncSpeechSegments();
    const stopped = this.speechBarrier.then(async () => {
      const results = await Promise.allSettled(
        Object.values(this.engines).map((engine) => Promise.resolve().then(() => engine.stop())),
      );
      const failed = results.find((result) => result.status === 'rejected');
      this.speechStopError = failed?.reason ?? null;
      if (failed) throw failed.reason;
    });
    this.speechBarrier = stopped.catch(() => {});
    try {
      await stopped;
    } catch (error) {
      if (epoch === this.speechEpoch) this.patch({ error: message(error) });
      return;
    }
    if (
      epoch === this.speechEpoch &&
      !this.disposed &&
      resumeListening &&
      this.snapshot.conversation &&
      !this.snapshot.listening &&
      !this.snapshot.starting
    )
      await this._startInput(true);
  }
  async previousSpeechSegment() {
    if (this.speechCursor <= 0 || this.disposed) return;
    const replay = this.speechHistory.slice(this.speechCursor - 1);
    this.queue = [...replay, ...this.queue.filter((item) => !replay.includes(item))];
    await this._navigateSpeech();
  }
  async skipSpeechSegment() {
    if (this.disposed || !this.queue.length) return;
    if (!this.snapshot.speaking && !this.snapshot.paused) {
      const skipped = this.queue.shift();
      if (!this.speechHistory.includes(skipped)) this.speechHistory.push(skipped);
      this.speechCursor = this.speechHistory.indexOf(skipped);
    }
    await this._navigateSpeech();
  }
  async _navigateSpeech() {
    this._cancelInterruptionResume();
    this.interruptionPausedSpeech = false;
    const engine = this.engines[this.snapshot.speechEngine || this.snapshot.settings.engine];
    const epoch = ++this.speechEpoch;
    ++this.controlEpoch;
    this.speechController?.abort();
    this._cancelAssistantSpeechTimer();
    this.assistantSpeechNotBefore = 0;
    this.patch({ speaking: false, paused: false, speechLoading: false });
    this._syncSpeechSegments();
    const stopped = this.speechBarrier.then(() => engine?.stop());
    this.speechBarrier = stopped.catch(() => {});
    try {
      await stopped;
    } catch (error) {
      this.speechStopError = error;
      if (epoch === this.speechEpoch) this.patch({ error: message(error) });
      return;
    }
    if (epoch !== this.speechEpoch || this.disposed) return;
    this._drain();
  }
  getSpeechProgress() {
    return this.engines[this.snapshot.speechEngine]?.getPlaybackProgress?.() ?? null;
  }
  async pauseSpeech(automatic = false) {
    if (!automatic) {
      this._cancelInterruptionResume();
      this.interruptionPausedSpeech = false;
    }
    if (this.disposed || this.snapshot.paused) return;
    if (!this.snapshot.speaking && this.snapshot.speechRunActive) {
      this._cancelAssistantSpeechTimer();
      this.patch({ paused: true });
      return;
    }
    if (!this.snapshot.speaking) return;
    if (this.speechLaunchPending) {
      // Preparation has no player to pause yet; retain an explicit launch gate.
      ++this.controlEpoch;
      this.patch({ paused: true });
      return;
    }
    const epoch = this.speechEpoch;
    const control = ++this.controlEpoch;
    try {
      const result =
        await this.engines[this.snapshot.speechEngine || this.snapshot.settings.engine].pause();
      if (result !== false) this._cancelSpeechPrefetch();
      if (
        epoch === this.speechEpoch &&
        control === this.controlEpoch &&
        this.snapshot.speaking &&
        result !== false
      ) {
        this.patch({ paused: true });
        this.activeRecordingTimeline?.('assistant-pause');
      }
    } catch (error) {
      if (epoch === this.speechEpoch) this.patch({ error: message(error) });
    }
  }
  async resumeSpeech() {
    this._cancelInterruptionResume();
    this.interruptionPausedSpeech = false;
    if (this.disposed || !this.snapshot.paused) return;
    if (!this.snapshot.speaking) {
      this.patch({ paused: false });
      this.assistantSpeechNotBefore = 0;
      this._drain();
      return;
    }
    if (this.speechLaunchPending) {
      const epoch = this.speechEpoch;
      const control = ++this.controlEpoch;
      if (this.snapshot.settings.mode === 'speaker') {
        await this.stopListening();
        if (this.inputReleaseError) {
          this.patch({ error: message(this.inputReleaseError) });
          return;
        }
      }
      if (epoch === this.speechEpoch && control === this.controlEpoch)
        this.patch({ paused: false });
      return;
    }
    const epoch = this.speechEpoch;
    const control = ++this.controlEpoch;
    try {
      if (this.snapshot.settings.mode === 'speaker') {
        await this.stopListening();
        if (this.inputReleaseError) throw this.inputReleaseError;
      }
      if (epoch !== this.speechEpoch || control !== this.controlEpoch) return;
      const result =
        await this.engines[this.snapshot.speechEngine || this.snapshot.settings.engine].resume();
      if (epoch === this.speechEpoch && control === this.controlEpoch && result !== false) {
        this.patch({ paused: false });
        this.activeRecordingTimeline?.('assistant-resume');
        this._prefetchSpeech();
      }
    } catch (error) {
      if (epoch === this.speechEpoch) this.patch({ error: message(error) });
    }
  }
  async speak(text, messageId = null) {
    if (this.disposed) return;
    const stopped = this.stopSpeech(false);
    const epoch = this.speechEpoch;
    await stopped;
    if (this.disposed || epoch !== this.speechEpoch || this.speechStopError) return;
    const segments = splitSpeechOutput(text, {
      filterCodeBlocks: this.snapshot.settings.outputCodeFilterEnabled,
      codeBlockMaxLines: this.snapshot.settings.outputCodeMaxLines,
      codeBlockNotice: this.snapshot.settings.outputCodeNotice,
      lang: this.snapshot.settings.lang,
    });
    const initial = segments.shift();
    if (!initial) return;
    const parts = splitInitialSpeechItem(initial);
    const first = parts.shift();
    segments.unshift(...parts);
    this.queue.push(...segments.map((segment) => ({ text: segment, id: messageId, manual: true })));
    this._prefetchSpeech();
    this._syncSpeechSegments();
    return this.play(first, messageId, true);
  }
  async play(text, messageId, manual = false) {
    if (this.disposed || !text.trim()) return;
    if (this.snapshot.speaking) {
      this.queue.push({ text, id: messageId, manual });
      this._prefetchSpeech();
      this._syncSpeechSegments();
      return;
    }
    const item =
      this.activeSpeechItem?.text === text
        ? this.activeSpeechItem
        : { text, id: messageId, manual };
    if (!this.speechHistory.includes(item)) this.speechHistory.push(item);
    this.speechCursor = this.speechHistory.indexOf(item);
    const epoch = ++this.speechEpoch;
    const controller = new AbortController();
    this.speechController = controller;
    this.speechLaunchPending = true;
    const timeline = this.activeRecordingTimeline ?? this.recordingTimeline?.();
    this._endSpeechWait('ready');
    this.activeRecordingTimeline = timeline;
    timeline?.('assistant-play-request', {
      automatic: !manual,
      mode: this.snapshot.settings.mode,
      queuedSegments: this.queue.length,
      pendingTranscriptions: this.snapshot.pendingTranscriptions,
    });
    let playbackStarted = false;
    let playbackFinished = false;
    const engine = this.engines[this.snapshot.settings.engine];
    this._resetStaleSpeechItem(item, this._speechPreparationKey());
    item.engine = engine;
    if (!engine) {
      this.queue = [];
      this.patch({ error: 'Speech engine unavailable.' });
      return;
    }
    // Reserve playback synchronously so incoming stream chunks cannot overtake gating.
    this.patch({
      speaking: true,
      paused: false,
      activeMessageId: messageId,
      speechLoading: true,
      speechText: text,
      speechEngine: this.snapshot.settings.engine,
      error: null,
    });
    this._syncSpeechSegments();
    let failed = false;
    try {
      await this.speechBarrier;
      if (this.speechStopError) throw this.speechStopError;
      if (epoch !== this.speechEpoch || this.disposed) return;
      if (this.snapshot.settings.mode === 'speaker') {
        const gating = this.snapshot.listening;
        if (gating) timeline?.('capture-gated');
        await this.stopListening();
        if (this.inputReleaseError) {
          if (gating) timeline?.('capture-gate-failed');
          throw this.inputReleaseError;
        }
        if (gating) timeline?.('input-stop-complete');
      }
      if (epoch !== this.speechEpoch || this.disposed) return;
      const queued = item;
      if (queued?.preparing) await queued.preparing;
      if (epoch !== this.speechEpoch || this.disposed) return;
      if (queued?.prepareError) throw queued.prepareError;
      const options = {
        onPlaybackStart: () => {
          if (
            epoch === this.speechEpoch &&
            !this.disposed &&
            !controller.signal.aborted &&
            !playbackFinished
          ) {
            if (!playbackStarted) timeline?.('assistant-start');
            playbackStarted = true;
            this.patch({ speechLoading: false });
          }
        },
        voice: this.snapshot.settings.voice || undefined,
        rate: this.snapshot.settings.rate,
        volume: this.snapshot.settings.volume,
        outputDeviceId: this.snapshot.settings.outputDeviceId,
        signal: controller.signal,
      };
      if (!queued.prepared && typeof engine.prepare === 'function') {
        const prepared = await engine.prepare(text, options);
        if (epoch !== this.speechEpoch || this.disposed) {
          prepared.dispose?.();
          return;
        }
        queued.prepared = prepared;
      }
      while (this.snapshot.paused && epoch === this.speechEpoch && !this.disposed)
        await this._waitSpeechLaunch(controller.signal);
      if (epoch !== this.speechEpoch || this.disposed) return;
      this.speechLaunchPending = false;
      options.volume = this.snapshot.settings.volume;
      if (queued?.prepared && typeof engine.playPrepared === 'function') {
        const prepared = queued.prepared;
        this.prefetchItems.delete(queued);
        await engine.playPrepared(prepared, { ...options, retainPrepared: true });
      } else await engine.speak(text, options);
    } catch (error) {
      if (epoch === this.speechEpoch) {
        failed = true;
        this._suppressPending();
        if (error.name !== 'AbortError') timeline?.('assistant-error');
        if (error.name !== 'AbortError') this.patch({ error: message(error) });
      }
    } finally {
      playbackFinished = true;
      if (playbackStarted) timeline?.('assistant-end');
      if (
        this.activeRecordingTimeline === timeline &&
        epoch === this.speechEpoch &&
        !this.queue.length
      )
        this.activeRecordingTimeline = null;
      if (epoch === this.speechEpoch && !this.disposed) {
        this.patch({
          speaking: false,
          paused: false,
          activeMessageId: null,
          speechLoading: false,
          speechText: this.queue.length || this.unfinished.has(messageId) ? text : null,
          speechEngine:
            this.queue.length || this.unfinished.has(messageId) ? this.snapshot.speechEngine : null,
        });
        if (
          failed ||
          (!this.queue.length &&
            !this.speechHistory.some((item) => !item.manual && this.unfinished.has(item.id)))
        )
          this._releaseSpeechHistory();
        this._syncSpeechSegments();
        if (!failed && this.queue.length) {
          this.assistantSpeechDelayReason = 'segment-gap';
          this.assistantSpeechNotBefore = Date.now() + this.snapshot.settings.segmentGapMs;
          this._drain();
        } else if (
          this.snapshot.conversation &&
          !this.snapshot.listening &&
          !this.snapshot.starting
        )
          await this._startInput(true);
      }
    }
  }
  _waitSpeechLaunch(signal) {
    if (!this.snapshot.paused) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        unsubscribe();
        signal.removeEventListener('abort', done);
        resolve();
      };
      const unsubscribe = this.subscribe(() => {
        if (!this.snapshot.paused || signal.aborted) done();
      });
      signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
  }
  _endSpeechWait(outcome = 'ready') {
    const wait = this.recordingSpeechWait;
    if (!wait) return null;
    this.recordingSpeechWait = null;
    wait.timeline?.('assistant-wait-end', { ...wait.details, outcome });
    return wait.timeline;
  }
  _auditSpeechWait() {
    // Transitions only: no per-frame events, raw text, or inference probabilities.
    if (this.disposed || !this.queue.length || this.snapshot.speaking) {
      this._endSpeechWait(this.snapshot.speaking ? 'ready' : 'cancelled');
      return;
    }
    const reasons = [];
    const manual = this.queue[0]?.manual;
    if (this.speechSuspended && !manual) reasons.push('suspended');
    if (this.snapshot.paused) reasons.push('paused');
    if (this.snapshot.recognizing) reasons.push('user-speech');
    if (this.externalSpeechActive) reasons.push('external-speech');
    if (this.snapshot.starting) reasons.push('input-starting');
    if (!manual && this.snapshot.pendingTranscriptions > 0) reasons.push('transcription');
    if (!manual && this.snapshot.autoSendAt !== null) reasons.push('delivery');
    const delay = this.assistantSpeechNotBefore - Date.now();
    if (delay > 0 && Number.isFinite(delay))
      reasons.push(this.assistantSpeechDelayReason ?? 'silence-delay');
    if (!reasons.length) {
      this._endSpeechWait('ready');
      return;
    }
    const key = reasons.join(',');
    if (this.recordingSpeechWait?.key === key) return;
    this._endSpeechWait('changed');
    const timeline =
      reasons.includes('segment-gap') && this.activeRecordingTimeline
        ? this.activeRecordingTimeline
        : this.recordingTimeline?.();
    const details = {
      reasons,
      queuedSegments: this.queue.length,
      pendingTranscriptions: this.snapshot.pendingTranscriptions,
      ...(Number.isFinite(delay) && delay > 0 ? { delayMs: Math.ceil(delay) } : {}),
    };
    this.recordingSpeechWait = { key, timeline, details };
    timeline?.('assistant-wait-start', details);
  }
  _cancelAssistantSpeechTimer() {
    if (this.assistantSpeechTimer !== null) clearTimeout(this.assistantSpeechTimer);
    this.assistantSpeechTimer = null;
  }
  _drain() {
    this._auditSpeechWait();
    if (
      this.disposed ||
      (this.speechSuspended && !this.queue[0]?.manual) ||
      (!this.snapshot.settings.announceAssistantMessages && !this.queue[0]?.manual) ||
      this.snapshot.speaking ||
      this.snapshot.paused ||
      this._speechActivity() ||
      this.snapshot.starting ||
      (!this.queue[0]?.manual &&
        (this.snapshot.pendingTranscriptions > 0 || this.snapshot.autoSendAt !== null)) ||
      !this.queue.length
    )
      return;
    const wait = this.assistantSpeechNotBefore - Date.now();
    if (wait > 0) {
      if (Number.isFinite(wait) && this.assistantSpeechTimer === null)
        this.assistantSpeechTimer = setTimeout(() => {
          this.assistantSpeechTimer = null;
          this._drain();
        }, wait);
      return;
    }
    this._cancelAssistantSpeechTimer();
    this.assistantSpeechNotBefore = 0;
    const next = this.queue.shift();
    this.activeSpeechItem = next;
    this._prefetchSpeech();
    void this.play(next.text, next.id, next.manual === true).finally(() => {
      if (this.activeSpeechItem === next) this.activeSpeechItem = null;
      // Audio remains owned by the playback run until completion.
      this.prefetchItems.delete(next);
    });
  }
  /** Baselines survive conversation toggles; cancelled message IDs remain suppressed. */
  observeMessage(id, text, { complete = false, baseline = false } = {}) {
    if (this.disposed) return;
    if (complete) this.unfinished.delete(id);
    else this.unfinished.add(id);
    if (
      complete &&
      !this.snapshot.speaking &&
      !this.queue.length &&
      this.speechHistory.some((item) => item.id === id)
    ) {
      this._releaseSpeechHistory();
      this.patch({ speechText: null, speechEngine: null });
      this._syncSpeechSegments();
    }
    if (baseline || !this.snapshot.settings.announceAssistantMessages || this.suppressed.has(id)) {
      this.consumed.set(id, text.length);
      return;
    }
    const offset = this.consumed.get(id) || 0;
    if (text.length < offset) {
      this.consumed.set(id, text.length);
      return;
    }
    const remaining = text.slice(offset);
    const boundary = complete ? remaining.length : remaining.lastIndexOf('\n') + 1;
    if (boundary <= 0) return;
    if (!complete && hasIncompleteSpeechMarkdown(remaining.slice(0, boundary))) return;
    if (hasUnclosedCodeFence(remaining.slice(0, boundary)) && !complete) return;
    const chunk = filterSpeechOutput(remaining.slice(0, boundary).trim(), {
      filterCodeBlocks: this.snapshot.settings.outputCodeFilterEnabled,
      codeBlockMaxLines: this.snapshot.settings.outputCodeMaxLines,
      codeBlockNotice: this.snapshot.settings.outputCodeNotice,
      lang: this.snapshot.settings.lang,
    }).trim();
    this.consumed.set(id, offset + boundary);
    if (chunk) {
      const initial = !this.snapshot.speaking && !this.queue.some((item) => item.prepared);
      const parts = initial ? splitInitialSpeechItem(chunk) : [chunk];
      this.queue.push(...parts.map((text) => ({ text, id })));
      this._prefetchSpeech();
      this._syncSpeechSegments();
      this._drain();
    }
  }
  async dispose() {
    if (this.disposed) return;
    this.cancelAutoSend();
    this._cancelAssistantSpeechTimer();
    this.disposed = true;
    this.listeners.clear();
    await this.endConversation(true);
  }
}
