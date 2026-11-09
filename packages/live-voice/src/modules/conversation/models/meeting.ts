// @ts-nocheck
import { MeetingTranscript } from './meetingTranscript.js';
import { VoiceCoordinator } from '../../core/coordinator.ts';
import {
  isRetryableVoiceError,
  MAX_RECOVERY_ATTEMPTS,
  recoveryDelayMs,
} from '../../core/recovery.js';

/** Application-owned capture; each source uses the same independent input policy. */
export class MeetingController {
  constructor({
    composer,
    settings,
    createSource,
    translate,
    onActivity,
    onSpeech,
    stopSpeech,
    savePreferences,
  }) {
    this.composer = composer;
    this.stopSpeech = stopSpeech;
    this.inputs = new Map();
    this.inputOverrides = new Map();
    this.settings = settings;
    this.savePreferences = savePreferences;
    this.createSource = createSource;
    this.t = translate;
    this.onActivity = onActivity;
    this.onSpeech = onSpeech;
    this.transcript = new MeetingTranscript(composer, settings);
    this.jobs = new Map();
    this.generations = new Map();
    this.listeners = new Set();
    this.snapshot = {
      active: false,
      timestamps: false,
      microphone: { starting: false, listening: false, pending: 0, error: null },
      shared: { starting: false, listening: false, pending: 0, error: null },
    };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  patch(source, next) {
    if (source) {
      const input =
        this.inputs.get(source) ||
        (next.listening || next.starting || next.error ? this.input(source) : null);
      const policy = {};
      for (const key of ['starting', 'listening', 'error', 'inputRecovery', 'inputError'])
        if (Object.hasOwn(next, key)) policy[key] = next[key];
      if (Object.hasOwn(next, 'pending')) policy.pendingTranscriptions = next.pending;
      if (Object.hasOwn(next, 'transcribing'))
        policy.pendingTranscriptionRequests = next.transcribing;
      if (Object.hasOwn(next, 'deliveryPending'))
        policy.pendingDeliveryTranscriptions = next.deliveryPending;
      input?.patch(policy);
    }
    this.snapshot = {
      ...this.snapshot,
      ...(source ? { [source]: { ...this.snapshot[source], ...next } } : next),
    };
    for (const listener of this.listeners) listener();
  }
  input(source = 'shared') {
    if (this.inputs.has(source)) return this.inputs.get(source);
    // Capture remains application-owned. This coordinator owns only source policy;
    // it never acquires the microphone or queues a second assistant playback.
    const input = new VoiceCoordinator({
      recognition: { stop: async () => {} },
      engines: {},
      meter: { stop: async () => {} },
      settings: {
        ...this.settings(),
        microphoneEnabled: true,
        timestampsEnabled:
          source !== 'microphone'
            ? this.settings().sharedTimestampsEnabled
            : this.settings().timestampsEnabled,
        ...(source !== 'microphone'
          ? {
              voiceCommandsEnabled:
                this.settings().sharedVoiceCommandsEnabled ?? this.settings().voiceCommandsEnabled,
            }
          : {}),
      },
      composer: {
        getDraft: () => this.composer.getDraft(),
        setDraft: (text) => this.composer.setDraft(text),
        appendFinal: (text, startedAt, paragraphBefore) => {
          this.transcript.append(source, text, startedAt, paragraphBefore);
          return this.composer.getDraft();
        },
        submit: (mode) => this.composer.submit?.(mode),
        handleQuestionResult: (result) => this.composer.handleQuestionResult?.(result),
        canAutoSend: () =>
          ![...this.jobs.keys()].some((key) => this.snapshot[key]?.starting) &&
          !this.jobs.get(source)?.recovery &&
          this.composer.canAutoSend?.() !== false &&
          [...this.inputs.entries()].every(
            ([other, input]) =>
              other === source || (!input.deliveryPending() && !input.getSnapshot().recognizing),
          ),
      },
    });
    this.inputOverrides.set(source, {
      sendingMode: input.getSnapshot().settings.sendingMode,
      voiceCommandsEnabled: input.getSnapshot().settings.voiceCommandsEnabled,
    });
    const update = input.updateSettings.bind(input);
    input.updateSettings = (next) => {
      this.inputOverrides.set(source, { ...this.inputOverrides.get(source), ...next });
      update(next);
      const patch = {};
      if (source === 'shared' && Object.hasOwn(next, 'voiceCommandsEnabled'))
        patch.sharedVoiceCommandsEnabled = next.voiceCommandsEnabled;
      if (Object.hasOwn(next, 'timestampsEnabled')) {
        this.transcript.setSourceTimestamps(source, next.timestampsEnabled);
        if (!source.startsWith('attendee:'))
          patch[source === 'shared' ? 'sharedTimestampsEnabled' : 'timestampsEnabled'] =
            next.timestampsEnabled;
      }
      if (Object.keys(patch).length) return this.savePreferences?.(input, patch);
    };
    input.clearError = () => this.patch(source, { error: null });
    input.endConversation = () => this.stop(source);
    input.stopSpeech = () => this.stopSpeech?.();
    const updatePolicy = input.updateSettings;
    input.updateSettings = (next) => {
      if (Object.hasOwn(next, 'announceAssistantMessages'))
        this.composer.updatePlaybackSettings?.({
          announceAssistantMessages: next.announceAssistantMessages,
        });
      return updatePolicy(next);
    };
    this.transcript.setSourceTimestamps(source, input.getSnapshot().timestamps);
    input.recordingId = () => this.jobs.get(source)?.engine?.session?.writer?.session.id;
    this.inputs.set(source, input);
    return input;
  }
  applySettings(settings) {
    for (const [source, input] of this.inputs) {
      const timestamps =
        source.startsWith('attendee:') &&
        typeof this.inputOverrides.get(source)?.timestampsEnabled === 'boolean'
          ? this.inputOverrides.get(source).timestampsEnabled
          : source !== 'microphone'
            ? settings.sharedTimestampsEnabled
            : settings.timestampsEnabled;
      this.transcript.setSourceTimestamps(source, Boolean(timestamps));
      VoiceCoordinator.prototype.updateSettings.call(input, {
        ...settings,
        ...this.inputOverrides.get(source),
        ...(source === 'shared' && typeof settings.sharedVoiceCommandsEnabled === 'boolean'
          ? { voiceCommandsEnabled: settings.sharedVoiceCommandsEnabled }
          : {}),
        timestampsEnabled: timestamps ?? input.getSnapshot().timestamps,
        microphoneEnabled: !input.getSnapshot().muted,
      });
    }
  }
  composerChanged(draft) {
    for (const input of this.inputs.values()) input.composerChanged(draft);
  }
  refreshDeliveryReadiness() {
    for (const input of this.inputs.values()) input.refreshDeliveryReadiness();
  }
  cancelDelivery() {
    for (const input of this.inputs.values()) input.cancelAutoSend();
  }
  composerReplaced() {
    // Recording/capture is application-owned and outlives any one chat composer.
    // Keep the audio clock and writer, but never deliver a final whose speech began
    // before the replacement composer was committed.
    for (const [source, job] of this.jobs) {
      const state = this.snapshot[source];
      job.discardResults =
        (Number.isSafeInteger(state?.pendingTranscriptionRequests)
          ? state.pendingTranscriptionRequests
          : state?.pending || 0) || (state?.recognizing ? 1 : 0);
    }
    this.cancelDelivery();
  }
  toggleTimestamps() {
    const enabled = !this.snapshot.timestamps;
    this.transcript.setTimestamps(enabled);
    this.patch(null, { timestamps: enabled });
  }
  async start(source, request, supplied) {
    if (this.disposed) {
      request
        ?.then((stream) => stream.getTracks().forEach((track) => track.stop()))
        .catch(() => {});
      return;
    }
    this.input(source);
    const stopping = this.stop(source);
    const generation = this.generations.get(source);
    await stopping;
    if (this.disposed || this.generations.get(source) !== generation) {
      request
        ?.then((stream) => stream.getTracks().forEach((track) => track.stop()))
        .catch(() => {});
      return;
    }
    this.patch(null, { active: true });
    const abort = new AbortController();
    const job = { abort, discardResults: 0 };
    this.jobs.set(source, job);
    const valid = () => this.jobs.get(source) === job && !abort.signal.aborted;
    this.patch(source, { starting: true, error: null });
    try {
      const settings = this.settings();
      const { meter, engine } = supplied || this.createSource(source, settings);
      const input = this.input(source);
      input.recognition.activityManaged = engine.activityManaged === true;
      input.meter = meter;
      // Sparse external audio restarts its recorder, not the user's input policy.
      // Retain a participant's mute across bursts; explicit tab/mic starts keep
      // their established unmute behavior.
      if (!source.startsWith('attendee:')) input.updateSettings({ microphoneEnabled: true });
      this.applySettings(settings);
      input.patch({ conversation: true, starting: true, error: null });
      Object.assign(job, { meter, engine });
      if (source === 'shared') meter.provide(request);
      meter.deviceId = settings.inputDeviceId;
      const capability = await engine.capability({
        lang: settings.recognitionLang,
        signal: abort.signal,
      });
      if (!valid()) return;
      if (!capability.supported)
        throw Object.assign(new Error(capability.reason || this.t('unavailable')), {
          code: capability.code,
        });
      if (!(await meter.start({ signal: abort.signal }))) {
        if (valid()) await this.stop(source);
        return;
      }
      if (!valid()) return;
      this.transcript.setActive(source, true);
      for (const track of meter.stream?.getTracks() || [])
        track.addEventListener(
          'ended',
          () => {
            if (valid()) void this.stop(source);
          },
          { once: true },
        );
      await this.startRecognition(source, job, settings);
    } catch (error) {
      if (valid()) {
        this.patch(source, {
          error:
            source !== 'microphone' && error.message === 'No shared audio track was returned.'
              ? this.t('noAudio')
              : error.code === 'external-audio-unsupported'
                ? this.t('browserSharedUnsupported')
                : error.code === 'browser-local-unavailable'
                  ? this.t('browserLocalUnavailable')
                  : this.t('failed'),
        });
        await this.stop(source);
      }
    } finally {
      if (!valid()) {
        await job.engine?.stop();
        await job.meter?.stop();
      }
      if (source === 'shared' && !job.meter?.stream)
        request
          ?.then((stream) => stream.getTracks().forEach((track) => track.stop()))
          .catch(() => {});
    }
  }
  async startRecognition(source, job, settings) {
    const { engine } = job;
    const input = this.input(source);
    const recognitionAbort = new AbortController();
    job.recognitionAbort = recognitionAbort;
    const valid = () =>
      this.jobs.get(source) === job &&
      !job.abort.signal.aborted &&
      job.recognitionAbort === recognitionAbort &&
      !recognitionAbort.signal.aborted;
    input.recognition.activityManaged = engine.activityManaged === true;
    try {
      await engine.start({
        lang: settings.recognitionLang,
        signal: recognitionAbort.signal,
        onResult: ({
          final,
          interim,
          startedAt,
          paragraphBefore,
          onCommandRecognized,
          onIgnoredMuted,
        }) => {
          if (!valid()) return;
          if (job.discardResults > 0) {
            job.discardResults--;
            return;
          }
          if (final?.trim()) job.retries = 0;
          const accepted = this.onSpeech?.(source, final || interim) !== false;
          if (accepted)
            input.onResult({
              final,
              interim,
              startedAt: Number.isFinite(startedAt)
                ? startedAt + (engine.attendeeTimestampOffset || 0)
                : startedAt,
              paragraphBefore,
              onCommandRecognized,
              onIgnoredMuted,
            });
          else if (final && !engine.activityManaged) input.patch({ recognizing: false });
          if (final && !interim && !engine.activityManaged) {
            this.onActivity?.(source, false);
            input.refreshDeliveryReadiness();
          }
        },
        onActivity: (active) => {
          if (!valid()) return;
          if (active) input.cancelAutoSend({ preserveIntent: true });
          input.patch({ recognizing: active, inputSpeechActive: active });
          this.onActivity?.(source, active);
          input.refreshDeliveryReadiness();
        },
        onProcessingChange: ({ pending, transcribing, deliveryPending }) => {
          if (!valid()) return;
          const requests =
            Number.isSafeInteger(transcribing) && transcribing >= 0 ? transcribing : pending;
          const delivery =
            Number.isSafeInteger(deliveryPending) && deliveryPending >= 0
              ? deliveryPending
              : pending;
          this.patch(source, { pending, transcribing: requests, deliveryPending: delivery });
          if (delivery) input.cancelAutoSend({ preserveIntent: true });
          else if (!input.getSnapshot().muted) input.maybeScheduleAutoSend();
        },
        onError: (error) => {
          if (valid()) this.recognitionFailed(source, job, error);
        },
      });
      if (valid()) {
        input.patch({ starting: false, listening: true });
        this.patch(source, {
          starting: false,
          listening: true,
          error: null,
          inputRecovery: null,
          inputError: null,
        });
        input.refreshDeliveryReadiness();
      }
    } catch (error) {
      if (valid()) this.recognitionFailed(source, job, error);
    }
  }
  recognitionFailed(source, job, error) {
    // Invalidate callbacks immediately, before teardown or a delayed restart.
    job.recognitionAbort?.abort();
    this.patch(source, {
      inputError: error?.message || String(error),
      inputRecovery: {
        attempt: job.retries || 0,
        maxAttempts: MAX_RECOVERY_ATTEMPTS,
        retrying: false,
        reason: String(error?.code || error?.name || 'Error'),
      },
      error: this.t(
        error?.code === 'external-audio-unsupported'
          ? 'browserSharedUnsupported'
          : error?.code === 'browser-local-unavailable'
            ? 'browserLocalUnavailable'
            : 'failed',
      ),
    });
    if (
      source !== 'shared' ||
      !isRetryableVoiceError(error) ||
      (job.retries || 0) >= MAX_RECOVERY_ATTEMPTS ||
      !this.sharedTrackLive(job)
    ) {
      void this.stop(source).catch(() => {});
      return;
    }
    this.queueRecognitionRecovery(source, job);
  }
  sharedTrackLive(job) {
    return job.meter?.stream?.getAudioTracks?.().some((track) => track.readyState === 'live');
  }
  queueRecognitionRecovery(source, job) {
    if (job.recovery) return;
    const valid = () =>
      !this.disposed && this.jobs.get(source) === job && !job.abort.signal.aborted;
    const input = this.input(source);
    input.cancelAutoSend({ preserveIntent: true });
    input.patch({ recognizing: false });
    this.patch(source, {
      starting: true,
      listening: true,
      pending: 0,
      transcribing: 0,
      deliveryPending: 0,
    });
    this.onActivity?.(source, false);
    const attempt = (job.retries = (job.retries || 0) + 1);
    this.patch(source, {
      inputRecovery: {
        attempt,
        maxAttempts: MAX_RECOVERY_ATTEMPTS,
        retrying: true,
        reason: this.input(source).getSnapshot().inputRecovery?.reason || 'restart',
      },
    });
    job.recovery = (async () => {
      try {
        await job.engine.stop();
        if (!valid()) return;
        await new Promise((resolve) => {
          const cancel = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            job.abort.signal.removeEventListener('abort', cancel);
            resolve();
          }, recoveryDelayMs(attempt));
          job.abort.signal.addEventListener('abort', cancel, { once: true });
        });
        if (!valid()) return;
        if (!this.sharedTrackLive(job)) {
          await this.stop(source);
          return;
        }
        const settings = this.settings();
        const replacement = this.createSource(source, settings);
        // The new, unstarted meter owns no capture. Never provide/start it: the
        // user's original display track stays owned by the original meter.
        replacement.engine.meter = job.meter;
        job.engine = replacement.engine;
        this.applySettings(settings);
        const capability = await job.engine.capability({
          lang: settings.recognitionLang,
          signal: job.abort.signal,
        });
        if (!valid()) return;
        if (!capability.supported) {
          await this.stop(source);
          return;
        }
        job.recovery = null;
        await this.startRecognition(source, job, settings);
      } catch (error) {
        // Failed teardown is not permission to overlap recognition resources.
        if (valid()) {
          this.patch(source, {
            error: this.t('failed'),
            inputError: error?.message || String(error),
            inputRecovery: {
              attempt,
              maxAttempts: MAX_RECOVERY_ATTEMPTS,
              retrying: false,
              reason: 'teardown-failed',
            },
          });
          await this.stop(source);
        }
      }
    })();
    void job.recovery.catch(() => {});
  }
  async stop(source) {
    this.generations.set(source, (this.generations.get(source) || 0) + 1);
    const job = this.jobs.get(source);
    this.jobs.delete(source);
    const input = this.inputs.get(source);
    input?.cancelAutoSend();
    input?.patch({
      conversation: false,
      starting: false,
      listening: false,
      recognizing: false,
      inputSpeechActive: false,
      pendingTranscriptions: 0,
      pendingTranscriptionRequests: 0,
      pendingDeliveryTranscriptions: 0,
    });
    this.onActivity?.(source, false);
    const recovery = input?.getSnapshot().inputRecovery;
    if (recovery?.retrying) this.patch(source, { inputRecovery: { ...recovery, retrying: false } });
    job?.recognitionAbort?.abort();
    job?.abort.abort();
    this.transcript.setActive(source, false);
    this.patch(source, {
      starting: false,
      listening: false,
      pending: 0,
      transcribing: 0,
      deliveryPending: 0,
    });
    try {
      await job?.engine?.stop();
    } finally {
      await job?.meter?.stop();
    }
  }
  async removeParticipant(source) {
    if (!source.startsWith('attendee:')) return;
    await this.stop(source);
    const input = this.inputs.get(source);
    if (input) {
      input.disposed = true;
      input.listeners.clear();
    }
    this.inputs.delete(source);
    this.inputOverrides.delete(source);
    this.generations.delete(source);
    this.transcript.forget(source);
    const { [source]: removed, ...remaining } = this.snapshot;
    this.snapshot = remaining;
    this.patch(null, {});
  }
  async end() {
    await this.attendee?.stop();
    await Promise.all(
      [...new Set(['microphone', 'shared', ...this.jobs.keys()])].map((source) =>
        this.stop(source),
      ),
    );
    this.transcript.reset();
    this.patch(null, { active: false });
  }
  async dispose() {
    this.disposed = true;
    await this.attendee?.dispose?.();
    await this.end();
    for (const input of this.inputs.values()) {
      input.cancelAutoSend();
      input.disposed = true;
      input.listeners.clear();
    }
    this.listeners.clear();
  }
}
