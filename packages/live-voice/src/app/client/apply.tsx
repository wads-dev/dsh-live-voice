// @ts-nocheck
import React from 'react';
import {
  matchesShortcut,
  releasesShortcut,
} from '../../shared/design-system/forms/keyboardShortcut.js';
import { microphoneAction } from '../../modules/conversation/models/microphoneAction.js';
import { SessionSpeechMemory } from '../../modules/speak/services/sessionSpeechMemory.js';
import { readSileroVadDiagnostics } from '../../modules/recognition/vad/SileroVadRuntime.js';
import { createRecordingRepository } from '../../modules/recording/repository.js';
import { recordingTranscriber } from '../../modules/recognition/recordingTranscriber.js';
import { RECORDING_KEY, RECORDING_CHANGED } from '../../modules/recording/types.js';
import { sileroVadAssetBase } from '../../modules/recognition/vad/assets.js';
import { createVadAssetDiagnostics } from './vadDiagnostics.js';
import { createTranscriptionLeaveGuard } from './transcriptionLeaveGuard.js';
import { SpeechStatusBar } from '../../modules/conversation/components/SpeechStatusBar.js';
import { MeetingController } from '../../modules/conversation/models/meeting.js';
import { AttendeeClient } from '../../modules/conversation/models/AttendeeClient.js';
import { SharedAudioMeter, requestSharedAudio } from '../../modules/core/sharedAudio.js';
import {
  MeetingToggle,
  MeetingBars,
} from '../../modules/conversation/components/MeetingControls.js';
import { createPortal } from 'react-dom';
import { preserveComposerSelection } from './composerSelection.js';
import { MicrophoneMeter, VoiceCoordinator, VoiceOwnership } from '../../modules/core/index.js';
import {
  BrowserRecognitionEngine,
  QwenHttpRecognitionEngine,
  WhisperHttpRecognitionEngine,
} from '../../modules/recognition/index.js';
import {
  BrowserSpeakingEngine,
  HostAudioSpeakingEngine,
  QwenHttpSpeakingEngine,
} from '../../modules/speak/index.js';
import { createLiveVoiceSettings } from '../../modules/settings/index.js';
import {
  ConversationControls,
  ConversationStatusBar,
  SpeakButton as ModularSpeakButton,
} from '../../modules/conversation/index.js';
import { registerLiveVoiceLocales } from './i18n/index.js';
import { registerConversationSlots, registerSettingsSlot } from './registerSlots.js';
import { styles } from '../../styles/index.js';
import { createPluginUpdate } from '../../modules/settings/services/pluginUpdate.js';
import { createDebuggerInstall } from '../../modules/settings/services/debuggerInstall.js';
import { LocalModelManager } from '../../modules/recognition/local/LocalModelManager.js';
import { BrowserLocalRecognitionEngine } from '../../modules/recognition/local/BrowserLocalRecognitionEngine.js';
import { createSettingsClient } from '../../modules/settings/models/settingsStorage.js';
import {
  publishDiagnosticSource,
  readCoordinatorDiagnostics,
} from '../../modules/core/diagnostics.js';
import {
  assistantMessages,
  addressedTurn,
  latestUserSequence,
  pendingQuestionSpeech,
} from '../../modules/conversation/models/chat.js';

export const inject = ['slots', 'connection', 'uiConversation', 'uiSession', 'locale'];
export function apply(ctx) {
  const t = registerLiveVoiceLocales(ctx);
  const SettingsPanel = createLiveVoiceSettings(t, ctx.locale);
  const controllers = new Map();
  const speechMemory = new SessionSpeechMemory();
  let automaticSpeechEnabled;
  const retiring = new Set();
  const preferences = createSettingsClient();
  let preferencesLoaded = false;
  const settingsControllers = new Set();
  let disposed = false;
  const recordings = createRecordingRepository(undefined, () => recordingTranscriber(preferences.getSnapshot()));
  const recordingTimeline = () => {
    const append = recordings.timeline();
    return (kind) => {
      void append(kind).catch(() => {
        // Metadata failures must be visible without blocking or cancelling playback.
        for (const entry of controllers.values())
          entry.controller.patch({ error: t('dsh-live-voice.recording.error.failed') });
      });
    };
  };
  const localModels = new LocalModelManager();
  void localModels.refresh();
  const leaveGuard = createTranscriptionLeaveGuard(window);
  // Voice conversation mode belongs to the plugin, not to a mounted composer.
  // A route change may replace every conversation slot, but the next committed
  // composer should inherit the user's explicit choice to remain in voice mode.
  let voiceModeActive = false;
  let meetingEntry = null;
  let sharedSpeechActive = false;
  const externalSpeaking = new Set();
  const meeting = new MeetingController({
    onActivity: (source, active) => {
      if (source === 'microphone') return;
      if (active) externalSpeaking.add(source);
      else externalSpeaking.delete(source);
      sharedSpeechActive = externalSpeaking.size > 0;
      meetingEntry?.controller.setExternalSpeechActivity(sharedSpeechActive);
      meetingEntry?.controller.refreshDeliveryReadiness();
    },
    onSpeech: (source, text) =>
      source === 'microphone' || meetingEntry?.controller.confirmExternalSpeech(text) !== false,
    stopSpeech: () => meetingEntry?.controller.stopSpeech(),
    composer: {
      getDraft: () => meetingEntry?.draft || '',
      setDraft: (text) => {
        meetingEntry?.controller.cancelAutoSend();
        meetingEntry?.controller.composer.setDraft(text);
      },
      submit: (mode) => {
        meeting.cancelDelivery();
        meetingEntry?.controller.cancelAutoSend();
        meetingEntry?.controller.composer.submit(mode);
      },
      updatePlaybackSettings: (next) => meetingEntry?.controller.updateSettings(next),
      handleQuestionResult: (result) =>
        meetingEntry?.controller.composer.handleQuestionResult?.(result),
      canAutoSend: () =>
        !!meetingEntry &&
        !meetingEntry.controller.getSnapshot().recognizing &&
        !meetingEntry.controller.deliveryPending(),
    },
    settings: () => preferences.getSnapshot(),
    savePreferences: (controller, next) => savePreferences(controller, next),
    translate: (key) => t('dsh-live-voice.meeting.' + key),
    createSource: (source, settings) => {
      const meter = source === 'shared' ? new SharedAudioMeter() : new MicrophoneMeter();
      return { meter, engine: recognitionFor(settings, meter, source) };
    },
  });
  meeting.attendee = new AttendeeClient(
    meeting,
    (source, meter, name) => {
      const settings = preferences.getSnapshot();
      if (settings.recognitionEngine === 'browser') throw new Error('external-pcm-unsupported');
      const engine = recognitionFor(settings, meter, source);
      engine.inputSource = 'shared';
      engine.sourceId = source;
      engine.sourceLabel = name;
      return engine;
    },
    (key, values) => t('dsh-live-voice.meeting.attendee.' + key, values),
  );
  meeting.attendee.canStart = () =>
    !disposed && preferences.getSnapshot().recognitionEngine !== 'browser';
  meeting.attendee.canDeliver = () => !disposed && !!meetingEntry?.composers.size;
  leaveGuard.watch(() => {
    const state = meeting.getSnapshot();
    return Object.values(state).filter((value) => value && typeof value === 'object');
  }, meeting.subscribe);
  let updateManager;
  if (typeof ctx.inject === 'function')
    ctx.inject(['remote', 'remote.pluginManager'], (remoteCtx) => {
      updateManager = remoteCtx.remote.pluginManager;
      remoteCtx.effect(
        () => () => {
          updateManager = undefined;
        },
        'dsh-live-voice: release update manager',
      );
    });
  const isPluginOperationBusy = () => {
    const m = meeting.getSnapshot();
    if (
      disposed ||
      voiceModeActive ||
      retiring.size ||
      m.active ||
      meeting.attendee.getSnapshot().active ||
      meeting.attendee.getSnapshot().starting ||
      m.shared.starting ||
      m.shared.pending ||
      m.microphone.starting ||
      m.microphone.pending
    )
      return true;
    return [...controllers.values()].some((entry) => {
      const s = entry.controller.getSnapshot();
      return (
        s.starting ||
        s.listening ||
        s.recognizing ||
        s.pendingTranscriptions ||
        s.speaking ||
        s.autoSendPending ||
        s.speechBarVisible
      );
    });
  };
  const pluginUpdate = createPluginUpdate({
    manager: () => updateManager,
    isBusy: isPluginOperationBusy,
  });
  const debuggerInstall = createDebuggerInstall({
    manager: () => updateManager,
    isBusy: isPluginOperationBusy,
  });
  const unsubscribeMeetingDelivery = meeting.subscribe(() =>
    meetingEntry?.controller.refreshDeliveryReadiness(),
  );
  ctx.effect(
    () => () => unsubscribeMeetingDelivery(),
    'dsh-live-voice: remove meeting delivery subscription',
  );
  const assetDiagnostics = createVadAssetDiagnostics(sileroVadAssetBase());
  const diagnosticListeners = new Set();
  const notifyDiagnostics = () => {
    for (const listener of diagnosticListeners) {
      try {
        listener();
      } catch {
        /* Observers never own voice behavior. */
      }
    }
  };
  ctx.effect(() => {
    window[RECORDING_KEY] = recordings;
    window.dispatchEvent(new window.Event(RECORDING_CHANGED));
    const unsubscribeModels = localModels.subscribe(notifyDiagnostics);
    const unpublish = publishDiagnosticSource(window, {
      version: 1,
      read: ({ includeContent = false } = {}) => ({
        application: { disposed, voiceModeActive, retiring: retiring.size },
        runtimes: localModels.readDiagnostics(),
        audioSources: {
          vad: { status: readSileroVadDiagnostics().status, ...assetDiagnostics() },
          microphone: meetingEntry
            ? readCoordinatorDiagnostics(meetingEntry.controller, includeContent)
            : null,
          shared: (() => {
            const input = meeting.inputs.get('shared');
            const job = meeting.jobs.get('shared');
            if (!input) return null;
            return readCoordinatorDiagnostics(
              {
                ...input,
                getSnapshot: input.getSnapshot,
                recognition: job?.engine ?? input.recognition,
                meter: job?.meter ?? input.meter,
              },
              includeContent,
            );
          })(),
        },
        sessions: Object.fromEntries(
          [...controllers].map(([id, entry]) => [
            id,
            readCoordinatorDiagnostics(entry.controller, includeContent),
          ]),
        ),
        settingsControllers: [...settingsControllers].map((controller) =>
          readCoordinatorDiagnostics(controller, includeContent),
        ),
      }),
      subscribe: (listener) => {
        diagnosticListeners.add(listener);
        return () => {
          diagnosticListeners.delete(listener);
        };
      },
    });
    return () => {
      unpublish();
      unsubscribeModels();
      diagnosticListeners.clear();
    };
  }, 'dsh-live-voice: diagnostic bridge');
  const publishVoiceContext = (
    entry,
    active = entry?.controller?.getSnapshot().conversation === true,
  ) => {
    if (!entry) return;
    const settings = entry.controller.getSnapshot().settings;
    const body = JSON.stringify({
      sessionId: entry.key,
      active:
        active &&
        settings.announceAssistantMessages !== false &&
        settings.agentVoiceContextEnabled !== false,
      context: settings.agentVoiceContext,
    });
    if (body === entry.lastVoiceContextBody) return;
    entry.lastVoiceContextBody = body;
    void fetch('/api/dsh-live-voice/voice-context', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body,
    }).catch(() => {});
  };
  const ownership = new VoiceOwnership();
  const recognitionSettingKeys = new Set([
    'recognitionEngine',
    'browserWhisperModel',
    'browserQwenModel',
    'browserAsrDevice',
    'recognitionLang',
    'recognitionContext',
    'inputDeviceId',
    'recognitionProcessLocally',
    'recognitionAutoInstall',
    'voiceDetectionEngine',
    'voiceDetectionPreset',
    'voiceDetectionCustomSilenceMs',
    'voiceDetectionCustomParagraphMs',
    'recognitionMaxUtteranceSeconds',
    'recordingEnabled',
    'recordingKeepPrevious',
    'recordingBitrate',
    'recordingPreRollMs',
    'recordingPostRollMs',
    'voiceDetectionThreshold',
    'voiceDetectionMinimumSpeechMs',
  ]);
  const changesRecognition = (next) =>
    Object.keys(next).some((key) => recognitionSettingKeys.has(key));
  const recordingOptions = (settings, inputSource) => ({
    recordings,
    recognitionContext: settings.recognitionContext,
    inputSource,
    sourceId: inputSource,
    sourceLabel: inputSource === 'shared' ? settings.sharedSourceName : settings.micSourceName,
    recordingEnabled: settings.recordingEnabled,
    recordingKeepPrevious: settings.recordingKeepPrevious,
    recordingBitrate: settings.recordingBitrate,
    recordingPreRollMs: settings.recordingPreRollMs,
    recordingPostRollMs: settings.recordingPostRollMs,
    voiceDetectionThreshold: settings.voiceDetectionThreshold,
    voiceDetectionMinimumSpeechMs: settings.voiceDetectionMinimumSpeechMs,
    voiceDetectionCustomParagraphMs: settings.voiceDetectionCustomParagraphMs,
    recordingErrorMessage: () => t('dsh-live-voice.recording.error.failed'),
  });
  const recognitionFor = (settings, meter, inputSource = 'microphone') =>
    ['whisper-browser', 'qwen-browser'].includes(settings.recognitionEngine)
      ? new BrowserLocalRecognitionEngine({
          ...recordingOptions(settings, inputSource),
          meter,
          manager: localModels,
          modelKey:
            settings.recognitionEngine === 'qwen-browser'
              ? settings.browserQwenModel
              : settings.browserWhisperModel,
          device:
            settings.recognitionEngine === 'qwen-browser' ? 'webgpu' : settings.browserAsrDevice,
          voiceDetectionEngine: settings.voiceDetectionEngine,
          voiceDetectionPreset: settings.voiceDetectionPreset,
          voiceDetectionCustomSilenceMs: settings.voiceDetectionCustomSilenceMs,
          voiceDetectionCustomParagraphMs: settings.voiceDetectionCustomParagraphMs,
          maxUtteranceSeconds: settings.recognitionMaxUtteranceSeconds,
          message: (code) =>
            t('dsh-live-voice.recognition.local.error.' + code.replaceAll('-', '_')),
          vadErrorMessage: () => t('dsh-live-voice.recognition.silero.error.failed'),
        })
      : settings.recognitionEngine === 'qwen-http'
        ? new QwenHttpRecognitionEngine({
            ...recordingOptions(settings, inputSource),
            meter,
            vadErrorMessage: (error) =>
              t(
                'dsh-live-voice.recognition.silero.error.' +
                  (error?.code === 'unavailable'
                    ? 'unavailable'
                    : error?.code === 'overloaded'
                      ? 'overloaded'
                      : 'failed'),
              ),
            voiceDetectionEngine: settings.voiceDetectionEngine,
            voiceDetectionPreset: settings.voiceDetectionPreset,
            voiceDetectionCustomSilenceMs: settings.voiceDetectionCustomSilenceMs,
            maxUtteranceSeconds: settings.recognitionMaxUtteranceSeconds,
          })
        : settings.recognitionEngine === 'whisper-http'
          ? new WhisperHttpRecognitionEngine({
              ...recordingOptions(settings, inputSource),
              meter,
              vadErrorMessage: (error) =>
                t(
                  'dsh-live-voice.recognition.silero.error.' +
                    (error?.code === 'unavailable'
                      ? 'unavailable'
                      : error?.code === 'overloaded'
                        ? 'overloaded'
                        : 'failed'),
                ),
              voiceDetectionEngine: settings.voiceDetectionEngine,
              voiceDetectionPreset: settings.voiceDetectionPreset,
              voiceDetectionCustomSilenceMs: settings.voiceDetectionCustomSilenceMs,
              maxUtteranceSeconds: settings.recognitionMaxUtteranceSeconds,
            })
          : new BrowserRecognitionEngine({
              ...(inputSource === 'shared' ? { meter, inputSource } : {}),
              processLocally: settings.recognitionProcessLocally,
              autoInstallLocalPack: settings.recognitionAutoInstall,
            });
  const run = (controller, promise) =>
    Promise.resolve(promise).catch((error) => {
      if (!disposed && !controller.disposed)
        controller.patch({ error: error?.message || String(error) });
    });
  async function savePreferences(controller, next) {
    try {
      return await preferences.save(next);
    } catch {
      const error = new Error(t('dsh-live-voice.settings.persistence.saveError'));
      if (!disposed && !controller.disposed) controller.patch({ error: error.message });
      throw error;
    }
  }
  let attendeeRecognitionSettings = null;
  const unsubscribePreferences = preferences.subscribe((settings) => {
    if (
      attendeeRecognitionSettings &&
      [...recognitionSettingKeys].some((key) => attendeeRecognitionSettings[key] !== settings[key])
    )
      void meeting.attendee.stop();
    attendeeRecognitionSettings = settings;
    if (disposed) return;
    preferencesLoaded = true;
    const speechChanged =
      automaticSpeechEnabled !== undefined &&
      automaticSpeechEnabled !== settings.announceAssistantMessages;
    automaticSpeechEnabled = settings.announceAssistantMessages;
    if (speechChanged) speechMemory.reset();
    meeting.applySettings(settings);
    for (const entry of controllers.values()) {
      if (entry.closed) continue;
      entry.applySettings(settings);
      if (speechChanged) {
        entry.speechState = speechMemory.session(entry.key);
        entry.refreshSpeech(true);
      } else if (entry.speechAttached) entry.refreshSpeech();
    }
    for (const c of settingsControllers) {
      if (c.disposed) continue;
      const previous = c.getSnapshot().settings;
      if ([...recognitionSettingKeys].some((key) => previous[key] !== settings[key]))
        c.replaceRecognition(recognitionFor(settings, c.meter));
      c.applySavedSettings(settings);
      c.patch({ hostPlatform: preferences.getHostPlatform() });
      for (const engine of Object.values(c.engines)) engine.lang = settings.lang;
      run(c, c.refreshCapabilities({ localOnly: true }));
    }
  });
  ctx.effect(
    () => () => unsubscribePreferences(),
    'dsh-live-voice: remove preferences subscription',
  );
  function suspendSessionSpeech(entry) {
    if (!entry.speechAttached) return;
    if (!entry.controller.speechSuspended || !entry.speechState.checkpoint)
      entry.speechState.checkpoint = entry.controller.checkpointSpeech();
    entry.speechAttached = false;
    ++entry.speechRequest;
    const stopped = entry.controller.suspendSpeech();
    entry.speechRelease = Promise.resolve(stopped).then(() => {
      if (entry.controller.speechStopError) throw entry.controller.speechStopError;
      if (entry.controller.inputReleaseError) throw entry.controller.inputReleaseError;
    });
    entry.speechRelease.catch(() => {});
  }
  function activateSessionSpeech(entry) {
    const request = ++entry.speechRequest;
    const releases = [
      ...retiring,
      ...settingsControllers,
      ...[...controllers.values()]
        .filter((other) => other !== entry)
        .map((other) => ({ endConversation: () => other.speechRelease })),
    ];
    return ownership.run(entry.controller, releases, async () => {
      await preferences.ready;
      await entry.speechRelease;
      if (disposed || entry.closed || !entry.speechAttached || request !== entry.speechRequest)
        return;
      entry.controller.restoreSpeech(entry.speechState.checkpoint);
      entry.speechState.checkpoint = null;
      entry.refreshSpeech(!entry.speechState.attached);
      entry.speechState.attached = true;
      entry.controller.activateSpeech();
    });
  }
  function retire(entry) {
    if (entry.closed) return;
    suspendSessionSpeech(entry);
    entry.closed = true;
    if (meetingEntry === entry) {
      void meeting.attendee.stop();
      meeting.cancelDelivery();
      meetingEntry = null;
      meeting.transcript.setActive('microphone', false);
    }
    entry.request++;
    entry.composers.clear();
    entry.unsubscribe?.();
    entry.unsubscribe = null;
    entry.unsubscribeVoiceContext?.();
    entry.unsubscribeVoiceContext = null;
    entry.unsubscribePendingQuestion?.();
    entry.unsubscribePendingQuestion = null;
    entry.questionCapture = null;
    entry.controller.patch({ answeringQuestion: false });
    publishVoiceContext(entry, false);
    entry.unsubscribeMeetingMicrophone?.();
    entry.chatListeners.clear();
    if (controllers.get(entry.key) === entry) controllers.delete(entry.key);
    notifyDiagnostics();
    // Keep teardown in the hardware handoff barrier, not in the session registry.
    const done = run(entry.controller, entry.controller.dispose());
    const barrier = {
      endConversation: async () => {
        await done;
        if (entry.controller.speechStopError) throw entry.controller.speechStopError;
        if (entry.controller.inputReleaseError) throw entry.controller.inputReleaseError;
      },
    };
    retiring.add(barrier);
    void done.finally(() => {
      entry.unsubscribeLeaveGuard?.();
      if (!entry.controller.speechStopError && !entry.controller.inputReleaseError)
        retiring.delete(barrier);
    });
  }
  function get(sessionId) {
    const key = String(sessionId);
    if (controllers.has(key)) return controllers.get(key);
    const entry = {
      key,
      speechState: speechMemory.session(key),
      speechAttached: false,
      speechRequest: 0,
      draft: '',
      pendingDraft: undefined,
      publishedDraft: undefined,
      publishedRevision: undefined,
      pendingRevision: undefined,
      staleDrafts: new Set(),
      composers: new Map(),
      refs: 0,
      buttons: 0,
      request: 0,
      closed: false,
      lastVoiceContextBody: null,
    };
    const settings = preferences.getSnapshot();
    const engineBrowser = new BrowserSpeakingEngine({ lang: settings.lang || 'pt-BR' });
    const engineSay = new HostAudioSpeakingEngine({
      endpoint: '/api/dsh-live-voice/say/speech',
      capability: '/api/dsh-live-voice/say/capabilities',
      lang: settings.lang || 'pt-BR',
      synthesisRate: () => 175,
      playbackRate: (rate) => rate,
    });
    const engineQwen = new QwenHttpSpeakingEngine({ lang: settings.lang || 'pt-BR' });
    const meter = new MicrophoneMeter();
    const recognition = recognitionFor(settings, meter);
    entry.controller = new VoiceCoordinator({
      recordingTimeline,
      persistSettings: (next) => savePreferences(entry.controller, next),
      recognition,
      engines: { browser: engineBrowser, say: engineSay, 'qwen-http': engineQwen },
      meter,
      composer: {
        getDraft: () => entry.draft,
        canAutoSend: () =>
          [...meeting.inputs.values()].every(
            (input) => !input.deliveryPending() && !input.getSnapshot().recognizing,
          ),
        appendFinal: (text, startedAt, paragraphBefore) => {
          meeting.cancelDelivery();
          if (
            meetingEntry === entry &&
            (entry.meeting?.getSnapshot().shared.listening ||
              entry.meeting?.attendee?.getSnapshot().active ||
              Object.entries(entry.meeting?.getSnapshot() || {}).some(
                ([source, state]) =>
                  source.startsWith('attendee:') &&
                  (state.listening || state.starting || state.pending),
              ) ||
              entry.controller.getSnapshot().timestamps)
          ) {
            meeting.transcript.setSourceTimestamps(
              'microphone',
              !!entry.controller.getSnapshot().timestamps,
            );
            entry.meeting.transcript.append('microphone', text, startedAt, paragraphBefore);
            return entry.draft;
          }
          return null;
        },
        submit: (mode = 'queue') => {
          meeting.cancelDelivery();
          const owner = [...entry.composers.values()].at(-1);
          if (!owner) return;
          const busyEnter = entry.controller.getSnapshot().settings.dshBusyEnterBehavior;
          if (mode !== busyEnter || busyEnter === 'steer') {
            // InputActions.submit() always queues; it does not emulate normal Enter.
            // Use an actual Enter gesture for steering-default composers, adding Ctrl
            // only for the opposite mode. Read the preference at delivery time.
            // Never fall back to normal submit: that would deliver the wrong mode.
            owner.submitAccelerated?.(mode !== busyEnter);
            return;
          }
          owner.actions.submit?.();
        },
        handleQuestionResult: ({ final, interim }) => {
          const capture = entry.questionCapture;
          if (!capture || capture.answering || (!final && !interim)) return false;
          if (final?.trim()) {
            capture.answering = true;
            capture.answers.push({
              id: capture.interaction.questions[capture.index].id,
              selected: [],
              custom: final.trim(),
            });
            capture.index++;
            if (capture.index < capture.interaction.questions.length) {
              capture.answering = false;
              const text = pendingQuestionSpeech(capture.interaction, capture.index);
              if (text)
                run(entry.controller, entry.controller.speak(text, capture.interaction.key));
            } else {
              entry.questionCapture = null;
              entry.controller.patch({ answeringQuestion: false });
              run(entry.controller, capture.interaction.answer({ answers: capture.answers }));
            }
          }
          return true;
        },
        setDraft: (text) => {
          if (disposed || entry.closed) return;
          const owner = [...entry.composers.values()].at(-1);
          if (!owner) return;
          // Preserve unacknowledged voice writes across unchanged slot renders,
          // but let new editor publications (including manual edits) supersede them.
          if (entry.pendingDraft === undefined) entry.staleDrafts.clear();
          entry.staleDrafts.add(entry.draft);
          if (entry.publishedDraft !== undefined) entry.staleDrafts.add(entry.publishedDraft);
          const previous = entry.draft;
          entry.draft = text;
          entry.pendingDraft = text;
          entry.pendingRevision = entry.publishedRevision;
          const append = text.length > previous.length && text.startsWith(previous);
          if (append) preserveComposerSelection(() => owner.actions.setDraft(text));
          else owner.actions.setDraft(text);
        },
      },
      settings,
    });
    const controller = entry.controller;
    entry.unsubscribeLeaveGuard = leaveGuard.watch(
      () => [controller.getSnapshot()],
      controller.subscribe,
    );
    controller.speechSuspended = true;
    controller.restoreSpeech(entry.speechState.checkpoint);
    entry.unsubscribeVoiceContext = controller.subscribe(() => {
      publishVoiceContext(entry);
      notifyDiagnostics();
    });
    notifyDiagnostics();
    publishVoiceContext(entry);
    entry.chat = ctx.uiConversation.binding(sessionId).target('chat');
    entry.chatListeners = new Set();
    entry.subscribeChat = (listener) => {
      if (entry.closed) return () => {};
      entry.chatListeners.add(listener);
      return () => entry.chatListeners.delete(listener);
    };
    entry.readChat = entry.chat.getSnapshot.bind(entry.chat);
    const refresh = (reset = false) => {
      if (disposed || entry.closed) return;
      const snapshot = entry.readChat();
      const messages = assistantMessages(snapshot);
      const memory = entry.speechState;
      if (!preferencesLoaded && memory.attached) return;
      const initial = !memory.baselined;
      const userSeq = latestUserSequence(snapshot);
      if (
        !initial &&
        entry.speechAttached &&
        userSeq > entry.userSeq &&
        controller.getSnapshot().settings.interruptSpeechOnUserMessage &&
        (controller.getSnapshot().speaking || controller.getSnapshot().paused)
      )
        run(controller, controller.stopSpeech());
      entry.userSeq = Math.max(entry.userSeq ?? -1, userSeq);
      // Action-only mounts never consume updates belonging to a detached composer.
      if (!entry.speechAttached && memory.baselined && !reset) return;
      for (const message of messages) {
        const previousText = memory.textById.get(message.id);
        const rewritten =
          !reset &&
          memory.attached &&
          previousText !== undefined &&
          !message.text.startsWith(previousText);
        if (message.interrupted || rewritten) controller.discardSpeechMessage(message.id);
        memory.textById.set(message.id, message.text);
        const baseline = speechMemory.baseline(memory, message, initial);
        controller.observeMessage(message.id, message.text, {
          complete: message.complete,
          baseline: !preferencesLoaded || reset || baseline || message.interrupted,
        });
      }
      if (messages.length) memory.baselined = true;
    };
    entry.refreshSpeech = refresh;
    refresh();
    entry.unsubscribe = entry.chat.subscribe(() => {
      refresh();
      for (const listener of entry.chatListeners) listener();
    });
    // DSH 0.1.6 may omit this legacy store. Keep the remaining voice controls
    // available while structured-question integration is unavailable.
    const pendingInteractions = ctx.uiSession.pendingInteractions;
    const refreshPendingQuestion = (baseline = false) => {
      if (disposed || entry.closed || !pendingInteractions) return;
      const interaction = pendingInteractions.getSnapshot().get(sessionId);
      const key = interaction?.kind === 'question' ? interaction.key : null;
      if (!key || (entry.questionCapture && entry.questionCapture.interaction.key !== key)) {
        entry.questionCapture = null;
        controller.patch({ answeringQuestion: false });
      }
      if (baseline) {
        entry.pendingQuestionKey = key;
        return;
      }
      if (!key || key === entry.pendingQuestionKey) return;
      entry.pendingQuestionKey = key;
      const text = pendingQuestionSpeech(interaction);
      if (text && controller.getSnapshot().conversation) {
        entry.questionCapture = { interaction, index: 0, answers: [], answering: false };
        controller.patch({ answeringQuestion: true });
        run(controller, controller.speak(text, key));
      }
    };
    if (pendingInteractions) {
      refreshPendingQuestion(true);
      entry.unsubscribePendingQuestion = pendingInteractions.subscribe(refreshPendingQuestion);
    }
    const update = controller.updateSettings.bind(controller);
    entry.applySettings = (next) => {
      const before = controller.getSnapshot();
      update(next);
      const settings = controller.getSnapshot().settings;
      if ([...recognitionSettingKeys].some((key) => before.settings[key] !== settings[key])) {
        if (!entry.restoreInput) entry.inputRestoreRequest = entry.request;
        entry.restoreInput ||= Boolean(before.listening || before.starting);
        const revision = (entry.inputSettingsRevision = (entry.inputSettingsRevision || 0) + 1);
        entry.inputSettingsBarrier = (entry.inputSettingsBarrier || Promise.resolve())
          .catch(() => {})
          .then(async () => {
            if (disposed || entry.closed || revision !== entry.inputSettingsRevision) return;
            await VoiceCoordinator.prototype.stopListening.call(controller);
            if (controller.inputReleaseError) throw controller.inputReleaseError;
            if (disposed || entry.closed || revision !== entry.inputSettingsRevision) return;
            controller.replaceRecognition(
              recognitionFor(controller.getSnapshot().settings, controller.meter),
            );
            const restart = entry.restoreInput && entry.inputRestoreRequest === entry.request;
            entry.restoreInput = false;
            const current = controller.getSnapshot();
            if (
              restart &&
              !(current.settings.mode === 'speaker' && current.speaking && !current.paused)
            )
              await controller._startInput(current.conversation);
          });
        run(controller, entry.inputSettingsBarrier);
      }
      publishVoiceContext(entry);
      engineBrowser.lang = controller.getSnapshot().settings.lang;
      engineQwen.lang = controller.getSnapshot().settings.lang;
      run(controller, controller.refreshCapabilities({ localOnly: true }));
    };
    controller.updateSettings = (next) => {
      if (disposed || entry.closed) return;
      entry.applySettings(next);
      return savePreferences(controller, next);
    };
    // Cancel only this entry's queued acquisition. Global cancellation here would
    // invalidate a newer session while its predecessor is being unmounted.
    for (const method of [
      'stopListening',
      'cancelDictation',
      'stopConversationInput',
      'endConversation',
      'stopSpeech',
    ]) {
      const original = controller[method].bind(controller);
      controller[method] = (...args) => {
        // Internal handoffs release resources, not the parked navigation cursor.
        if (method === 'endConversation' && args[0] === true && !entry.speechAttached) {
          controller.patch({ conversation: false });
          return Promise.all([
            controller.stopListening(),
            VoiceCoordinator.prototype.stopSpeech.call(controller, false),
          ]);
        }
        if (!entry.closed && (method === 'stopSpeech' || method === 'endConversation')) {
          const parked = entry.speechState.checkpoint;
          if (parked) {
            parked.suppressed = [
              ...new Set([
                ...parked.suppressed,
                ...parked.unfinished,
                ...parked.pending.map((item) => item.id),
              ]),
            ];
            parked.pending = [];
            parked.paused = false;
          }
        }
        entry.request++;
        if (
          (method === 'endConversation' && args[0] !== true) ||
          method === 'stopConversationInput'
        )
          voiceModeActive = false;
        const result = original(...args);
        Promise.resolve(result).finally(() => publishVoiceContext(entry));
        return result;
      };
    }
    for (const method of [
      'startDictation',
      'startHoldToTalk',
      'startConversation',
      'takeMicrophone',
      'speak',
    ]) {
      const original = controller[method].bind(controller);
      controller[method] = (...args) => {
        if (disposed || entry.closed || !entry.refs) return Promise.resolve();
        if (method !== 'speak' && !entry.composers.size) return Promise.resolve();
        if (method === 'startConversation' || method === 'takeMicrophone') {
          // Input mode never resets speech offsets: a partial response may already
          // be waiting for its stable boundary while the microphone is closed.
          voiceModeActive = true;
        }
        const request = ++entry.request;
        return ownership.run(
          controller,
          [...controllers.values()].map((other) => other.controller).concat([...retiring]),
          async () => {
            try {
              await preferences.ready;
            } catch {
              throw new Error(t('dsh-live-voice.settings.persistence.loadError'));
            }
            if (disposed || entry.closed || !entry.refs || request !== entry.request) return;
            if (method !== 'speak' && !entry.composers.size) return;
            const result = original(...args);
            Promise.resolve(result).finally(() => publishVoiceContext(entry));
            return result;
          },
        );
      };
    }
    entry.meeting = meeting;
    entry.startMeetingSource = (source) => {
      try {
        const request = requestSharedAudio();
        request.catch(() => {});
        void entry.meeting.start(source, request);
      } catch {
        entry.meeting.patch(source, { error: t('dsh-live-voice.meeting.failed') });
      }
    };
    entry.toggleMeetingSource = () => {
      const value = entry.meeting.getSnapshot().shared;
      if (value.starting || value.listening) void entry.meeting.stop('shared');
      else entry.startMeetingSource('shared');
    };
    let microphoneActive = false;
    const unsubscribeMeetingMicrophone = controller.subscribe(() => {
      const state = controller.getSnapshot();
      const next = Boolean(state.listening || state.starting);
      if (meetingEntry === entry) entry.meeting.refreshDeliveryReadiness();
      if (meetingEntry === entry && next !== microphoneActive) {
        microphoneActive = next;
        entry.meeting.transcript.setActive('microphone', next);
      }
    });
    entry.unsubscribeMeetingMicrophone = unsubscribeMeetingMicrophone;
    controllers.set(key, entry);
    void preferences.ready.catch(() => {
      if (!entry.closed)
        controller.patch({ error: t('dsh-live-voice.settings.persistence.loadError') });
    });
    run(controller, controller.refreshCapabilities({ localOnly: true }));
    return entry;
  }
  function useEntry(sessionId, kind) {
    const [entry, setEntry] = React.useState(null);
    React.useLayoutEffect(() => {
      if (disposed) return;
      // Allocation and subscriptions happen only for committed mounts. Suspended
      // or abandoned renders never acquire a session, probe engines, or retain it.
      const current = get(sessionId);
      current.refs++;
      if (kind === 'buttons') current.buttons++;
      setEntry(current);
      return () => {
        current.refs--;
        if (kind === 'buttons') current.buttons--;
        if (!current.refs) current.request++;
        // StrictMode replay reacquires the same entry before this microtask.
        queueMicrotask(() => {
          if (!current.refs) retire(current);
        });
      };
    }, [sessionId, kind]);
    return entry?.key === String(sessionId) && !entry.closed ? entry : null;
  }
  function useComposer(entry, props) {
    // DSH publishes shell.state as useInput and shell.actions as inputActions.
    // Subscribe even when an embedding also supplies an input snapshot: that
    // snapshot is not the reactive owner of the shell-owned editor.
    const subscribedInput = props.useInput?.((value) => value);
    const input = subscribedInput ?? props.input;
    const token = React.useRef({});
    React.useLayoutEffect(() => {
      if (!entry || entry.closed || disposed) return;
      return () => {
        entry.composers.delete(token.current);
        if (!entry.composers.size) suspendSessionSpeech(entry);
        if (meetingEntry === entry && !entry.composers.size) {
          void meeting.attendee.stop();
          meeting.cancelDelivery();
          meetingEntry = null;
          meeting.transcript.setActive('microphone', false);
        }
        // Message-action mounts may outlive the composer; never retain its actions.
        // Do not interpret a route-driven composer unmount as the user's request
        // to leave voice mode. Retirement still releases the old controller; the
        // next committed composer resumes the conversation automatically.
      };
    }, [entry]);
    React.useLayoutEffect(() => {
      if (!entry || entry.closed || disposed) return;
      if (!input || typeof props.inputActions?.setDraft !== 'function') return;
      if (meetingEntry !== entry) {
        if (meetingEntry) {
          void meeting.attendee.stop();
          suspendSessionSpeech(meetingEntry);
        }
        meeting.cancelDelivery();
        meetingEntry = entry;
        entry.controller.setExternalSpeechActivity(sharedSpeechActive);
        const state = entry.controller.getSnapshot();
        meeting.transcript.setActive(
          'microphone',
          Boolean((state.listening || state.starting) && !state.muted),
        );
      }
      entry.composers.set(token.current, {
        actions: props.inputActions,
        submitAccelerated: (accelerated = true) => {
          const active = document.activeElement;
          const editor =
            active?.nodeType === 1 && active.isContentEditable
              ? active
              : document.querySelector('[contenteditable="true"]');
          if (!editor || editor.nodeType !== 1) return;
          editor.focus();
          const KeyboardEventCtor = editor.ownerDocument.defaultView?.KeyboardEvent;
          if (!KeyboardEventCtor) return;
          editor.dispatchEvent(
            new KeyboardEventCtor('keydown', {
              key: 'Enter',
              code: 'Enter',
              ctrlKey: accelerated,
              bubbles: true,
              cancelable: true,
            }),
          );
        },
      });
      const attachSpeech = !entry.speechAttached;
      if (attachSpeech) entry.speechAttached = true;
      const inputReady =
        voiceModeActive && !entry.controller.getSnapshot().conversation
          ? entry.controller.startConversation()
          : Promise.resolve();
      run(
        entry.controller,
        Promise.resolve(inputReady).then(() => {
          if (attachSpeech && entry.speechAttached && !entry.closed)
            return activateSessionSpeech(entry);
        }),
      );
    }, [entry, input, props.inputActions]);
    React.useLayoutEffect(() => {
      if (!entry || entry.closed || disposed || !input) return;
      const published = typeof input.draft === 'string' ? input.draft : '';
      // A voice write is optimistic until React commits the editor publication.
      // Unrelated slot renders must not restore the previous draft in between.
      entry.publishedDraft = published;
      entry.publishedRevision = input.draftRev;
      const newerRevision =
        Number.isInteger(input.draftRev) &&
        Number.isInteger(entry.pendingRevision) &&
        input.draftRev > entry.pendingRevision;
      if (entry.pendingDraft === undefined) entry.draft = published;
      else if (
        published === entry.pendingDraft ||
        newerRevision ||
        !entry.staleDrafts.has(published)
      ) {
        // A new manual edit is authoritative even if the exact voice echo was skipped.
        entry.draft = published;
        entry.pendingDraft = undefined;
        entry.staleDrafts.clear();
      }
      entry.controller.composerChanged(entry.draft);
      if (meetingEntry === entry) meeting.composerChanged(entry.draft);
    });
  }
  function Buttons(props) {
    const entry = useEntry(props.sessionId, 'buttons');
    useComposer(entry, props);
    return entry ? (
      <div className="dlv-composer-toggles">
        <MeetingToggle meeting={entry.meeting} onToggle={entry.toggleMeetingSource} controller={entry.controller} />
        <ConversationControls controller={entry.controller} />
      </div>
    ) : null;
  }
  function Settings() {
    const [controller, setController] = React.useState(null);
    React.useEffect(() => {
      const settings = preferences.getSnapshot();
      const browser = new BrowserSpeakingEngine({ lang: settings.lang });
      const qwen = new QwenHttpSpeakingEngine({ lang: settings.lang });
      const meter = new MicrophoneMeter();
      const recognition = recognitionFor(settings, meter);
      const c = new VoiceCoordinator({
        recordingTimeline,
        persistSettings: (next) => savePreferences(c, next),
        recognition,
        engines: {
          browser,
          say: new HostAudioSpeakingEngine({
            endpoint: '/api/dsh-live-voice/say/speech',
            capability: '/api/dsh-live-voice/say/capabilities',
            synthesisRate: () => 175,
            playbackRate: (rate) => rate,
          }),
          'qwen-http': qwen,
        },
        meter,
        composer: { getDraft: () => '', setDraft: () => {} },
        settings,
      });
      const speak = c.speak.bind(c);
      c.speak = (...args) =>
        ownership.run(
          c,
          [...controllers.values()].map((entry) => entry.controller).concat([...retiring]),
          async () => {
            try {
              await preferences.ready;
            } catch {
              throw new Error(t('dsh-live-voice.settings.persistence.loadError'));
            }
            if (!disposed && !c.disposed) return speak(...args);
          },
        );
      const update = c.updateSettings.bind(c);
      c.applySavedSettings = update;
      c.localModels = localModels;
      c.attendee = meeting.attendee;
      settingsControllers.add(c);
      const unsubscribeLeaveGuard = leaveGuard.watch(() => [c.getSnapshot()], c.subscribe);
      const unsubscribeDiagnostics = c.subscribe(notifyDiagnostics);
      notifyDiagnostics();
      void preferences.ready.catch(() =>
        c.patch({ error: t('dsh-live-voice.settings.persistence.loadError') }),
      );
      let settingsRevision = 0;
      c.updateSettings = async (next) => {
        const revision = ++settingsRevision;
        update(next);
        browser.lang = c.getSnapshot().settings.lang;
        qwen.lang = c.getSnapshot().settings.lang;
        const settings = c.getSnapshot().settings;
        if (changesRecognition(next)) c.replaceRecognition(recognitionFor(settings, c.meter));
        const saved = savePreferences(c, next);
        run(c, c.refreshCapabilities({ localOnly: true }));
        await saved;
        if (revision !== settingsRevision || disposed || c.disposed) return;
        // The shared preference subscriber reconfigures only affected resources.
        // A voice/output/UI change must not end playback, meeting capture, or chats.
      };
      const refresh = () => run(c, c.refreshCapabilities({ localOnly: true }));
      document.addEventListener('dsh-live-voice:capabilitieschanged', refresh);
      c.patch({ hostPlatform: preferences.getHostPlatform() });
      setController(c);
      refresh();
      return () => {
        document.removeEventListener('dsh-live-voice:capabilitieschanged', refresh);
        unsubscribeDiagnostics();
        settingsControllers.delete(c);
        unsubscribeLeaveGuard();
        notifyDiagnostics();
        void c.dispose();
      };
    }, []);
    return controller ? (
      <SettingsPanel
        controller={controller}
        pluginUpdate={pluginUpdate}
        debuggerInstall={debuggerInstall}
      />
    ) : null;
  }
  registerSettingsSlot(ctx, Settings, () => t('dsh-live-voice.commons.pluginName'));
  function Dock(props) {
    const entry = useEntry(props.sessionId, 'dock');
    useComposer(entry, props);
    return entry ? (
      <div className="dlv-bar-stack">
        <SpeechStatusBar controller={entry.controller} />
        <MeetingBars meeting={entry.meeting} />
        <ConversationStatusBar controller={entry.controller} includeSpeech={false} />
      </div>
    ) : null;
  }
  function QuestionStatusView({ entry }) {
    const snapshot = React.useSyncExternalStore(
      entry.controller.subscribe,
      entry.controller.getSnapshot,
    );
    const [overlayStyle, setOverlayStyle] = React.useState();
    React.useLayoutEffect(() => {
      if (!snapshot.answeringQuestion) return;
      const seat = document.querySelector('[data-composer-seat]');
      if (!seat) return;
      const update = () => {
        const rect = seat.getBoundingClientRect();
        setOverlayStyle({
          left: rect.left + rect.width / 2,
          width: Math.min(720, Math.max(0, rect.width - 32)),
        });
      };
      update();
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
      observer?.observe(seat);
      window.addEventListener('resize', update);
      return () => {
        observer?.disconnect();
        window.removeEventListener('resize', update);
      };
    }, [snapshot.answeringQuestion]);
    const target = typeof document === 'undefined' ? null : document.body;
    return snapshot.answeringQuestion && target && overlayStyle
      ? createPortal(
          <ConversationStatusBar
            controller={entry.controller}
            questionOnly
            overlay
            overlayStyle={overlayStyle}
          />,

          target,
        )
      : null;
  }
  function QuestionStatus(props) {
    const entry = useEntry(props.sessionId, 'question-status');
    return entry ? <QuestionStatusView entry={entry} /> : null;
  }
  function ActionView({ entry, messageId }) {
    const snapshot = React.useSyncExternalStore(
      entry.controller.subscribe,
      entry.controller.getSnapshot,
    );
    const chat = React.useSyncExternalStore(entry.subscribeChat, entry.readChat);
    const message = addressedTurn(assistantMessages(chat), messageId);
    const active = snapshot.speaking && message.id === snapshot.activeMessageId;
    return (
      <ModularSpeakButton
        active={active}
        disabled={!message.text.trim()}
        onClick={() =>
          run(
            entry.controller,
            active
              ? entry.controller.stopSpeech()
              : entry.controller.speak(message.text, message.id),
          )
        }
      />
    );
  }
  function Action(props) {
    const entry = useEntry(props.sessionId, 'action');
    return entry ? <ActionView entry={entry} messageId={props.messageId} /> : null;
  }
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-live-voice';
    style.textContent = styles;
    document.head.appendChild(style);
    return () => style.remove();
  });
  registerConversationSlots(ctx, { Buttons, Dock, QuestionStatus, Action }, () =>
    t('dsh-live-voice.commons.pluginName'),
  );
  ctx.effect(() => {
    const stop = () => {
      speechMemory.clear();
      for (const entry of controllers.values()) entry.speechState.checkpoint = null;
      ownership.cancel();
      void meeting.end();
      for (const entry of controllers.values()) {
        run(entry.controller, entry.controller.endConversation());
      }
    };
    let holdToTalk = null;
    let heldShortcut = '';
    const candidate = () => {
      const candidates = [...controllers.values()].filter(
        (entry) => entry.buttons > 0 && entry.composers.size > 0,
      );
      return candidates.length === 1 ? candidates[0] : null;
    };
    const releaseHoldToTalk = () => {
      const entry = holdToTalk;
      holdToTalk = null;
      if (!entry || entry.closed) return;
      run(entry.controller, entry.controller.releaseHoldToTalk());
    };
    const onKeyDown = (event) => {
      if (
        disposed ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.target?.closest?.('.dlv-settings, .dlv-shortcut-field')
      )
        return;
      if (event.key === 'Escape' && holdToTalk) {
        const entry = holdToTalk;
        holdToTalk = null;
        event.preventDefault();
        run(entry.controller, entry.controller.cancelDictation());
        return;
      }
      const entry = candidate();
      if (!entry) return;
      const c = entry.controller;
      const state = c.getSnapshot();
      const settings = state.settings;
      if (matchesShortcut(event, settings.microphoneShortcut)) {
        event.preventDefault();
        run(c, c[microphoneAction(state)]());
      } else if (matchesShortcut(event, settings.meetingShortcut)) {
        event.preventDefault();
        entry.toggleMeetingSource();
      } else if (matchesShortcut(event, settings.assistantSpeechShortcut)) {
        event.preventDefault();
        run(
          c,
          c.updateSettings({
            announceAssistantMessages: settings.announceAssistantMessages === false,
          }),
        );
      } else if (
        !holdToTalk &&
        settings.holdToTalkEnabled &&
        matchesShortcut(event, settings.holdToTalkShortcut)
      ) {
        event.preventDefault();
        holdToTalk = entry;
        heldShortcut = settings.holdToTalkShortcut;
        run(c, c.startHoldToTalk());
      }
    };
    const onKeyUp = (event) => {
      if (holdToTalk && releasesShortcut(event, heldShortcut)) releaseHoldToTalk();
    };
    const refreshCapabilities = () => {
      for (const entry of controllers.values())
        run(entry.controller, entry.controller.refreshCapabilities({ localOnly: true }));
      document.dispatchEvent(new Event('dsh-live-voice:capabilitieschanged'));
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') refreshCapabilities();
    };
    window.speechSynthesis?.addEventListener?.('voiceschanged', refreshCapabilities);
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshCapabilities);
    document.addEventListener('visibilitychange', visibilityChanged);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseHoldToTalk);
    window.addEventListener('pagehide', stop);
    return () => {
      disposed = true;
      leaveGuard.dispose();
      localModels.dispose();
      if (window[RECORDING_KEY] === recordings) {
        delete window[RECORDING_KEY];
        window.dispatchEvent(new window.Event(RECORDING_CHANGED));
      }
      void Promise.allSettled(
        [...controllers.values()].map((entry) => entry.controller.stopListening()),
      )
        .then(() => meeting.dispose())
        .then(() => recordings.dispose());
      ownership.close();
      speechMemory.clear();
      window.speechSynthesis?.removeEventListener?.('voiceschanged', refreshCapabilities);
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshCapabilities);
      document.removeEventListener('visibilitychange', visibilityChanged);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseHoldToTalk);
      window.removeEventListener('pagehide', stop);
      for (const entry of controllers.values()) retire(entry);
      void meeting.dispose();
    };
  });
}
