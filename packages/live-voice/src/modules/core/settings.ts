// @ts-nocheck
import { TRANSCRIPTION_CONTEXT_MAX_LENGTH } from '../recognition/transcriptionContext.js';
import { resolveCodeNotice } from './speechDefaults.js';
import { normalizeShortcut } from '../../shared/design-system/forms/keyboardShortcut.js';
export const voiceDetectionPresets = Object.freeze({
  short: Object.freeze({
    silenceMs: 400,
    paragraphMs: 2000,
    label: 'Short',
    description: 'Transcribe quickly after a short pause.',
  }),
  natural: Object.freeze({
    silenceMs: 1000,
    paragraphMs: 3000,
    label: 'Natural',
    description: 'Allow normal pauses between phrases.',
  }),
  long: Object.freeze({
    silenceMs: 2000,
    paragraphMs: 4000,
    label: 'Long',
    description: 'Wait through longer thinking pauses.',
  }),
});
export const usesPluginVoiceDetection = (engine) =>
  typeof engine === 'string' && engine !== '' && engine !== 'browser';
export const qwenVoices = Object.freeze([
  Object.freeze({ value: 'aiden', label: 'Aiden — male, American English' }),
  Object.freeze({ value: 'ryan', label: 'Ryan — male, English' }),
  Object.freeze({ value: 'uncle_fu', label: 'Uncle Fu — male, Chinese' }),
  Object.freeze({ value: 'dylan', label: 'Dylan — male, Beijing Chinese' }),
  Object.freeze({ value: 'eric', label: 'Eric — male, Sichuan Chinese' }),
  Object.freeze({ value: 'vivian', label: 'Vivian — female, Chinese' }),
  Object.freeze({ value: 'serena', label: 'Serena — female, Chinese' }),
  Object.freeze({ value: 'ono_anna', label: 'Ono Anna — female, Japanese' }),
  Object.freeze({ value: 'sohee', label: 'Sohee — female, Korean' }),
]);
export const defaultQwenVoice = qwenVoices[0].value;
export const isQwenVoice = (value) => qwenVoices.some((voice) => voice.value === value);
export const defaultAgentVoiceContext = `Live Voice output is active. Your entire user-facing response will be spoken aloud.
Be concise and conversational. Lead with the answer or next action. Avoid unnecessary repetition, long preambles, dense lists, raw code, paths, and verbose status narration.
Do not narrate routine tool activity by default. If the user explicitly asks you to keep them informed while working, provide brief spoken progress updates only at meaningful milestones.`;

export const assistantSpeechDelayOptions = Object.freeze([0.6, 1.5, 2, 3, 4, 5]);

export const autoSendDelayOptions = Object.freeze([0.6, 0.8, 1, 2, 3, 4, 5, 6]);

export const recordingBitrateOptions = Object.freeze([24000, 32000, 48000, 64000, 96000]);

export const defaultSettings = Object.freeze({
  engine: 'browser',
  recognitionEngine: 'browser',
  browserWhisperModel: 'whisper-small',
  browserQwenModel: 'qwen-0.6b',
  browserAsrDevice: 'webgpu',
  recognitionProcessLocally: true,
  recognitionAutoInstall: true,
  voiceDetectionEngine: 'silero',
  voiceDetectionPreset: 'short',
  voiceDetectionCustomSilenceMs: 1000,
  voiceDetectionCustomParagraphMs: 3000,
  voiceDetectionThreshold: 0.5,
  voiceDetectionMinimumSpeechMs: 250,
  recordingEnabled: true,
  recordingKeepPrevious: 1,
  recordingBitrate: 48000,
  recordingPreRollMs: 320,
  recordingPostRollMs: 320,
  recognitionMaxUtteranceSeconds: 60,
  microphoneEnabled: true,
  holdToTalkEnabled: false,
  holdToTalkShortcut: 'Control',
  microphoneShortcut: 'Control+Shift+Space',
  meetingShortcut: '',
  assistantSpeechShortcut: '',
  announceAssistantMessages: true,
  agentVoiceContextEnabled: true,
  agentVoiceContext: defaultAgentVoiceContext,
  interruptSpeechOnUserMessage: false,
  sendingMode: 'manual',
  dshBusyEnterBehavior: 'queue',
  autoSendDelaySeconds: 4,
  assistantSpeechDelaySeconds: 1.5,
  mode: 'speaker',
  lang: 'pt-BR',
  recognitionLang: 'pt-BR',
  recognitionContext: '',
  voice: '',
  inputDeviceId: '',
  outputDeviceId: '',
  recognitionFilterEnabled: true,
  recognitionMinimumWords: 2,
  voiceCommandsEnabled: true,
  sharedVoiceCommandsEnabled: true,
  timestampsEnabled: false,
  sharedTimestampsEnabled: false,
  microphoneSourceName: 'Me',
  sharedSourceName: 'Them',
  meetingSource: 'shared',
  attendeeApiUrl: 'http://localhost:8000',
  attendeeIngressUrl: '',
  attendeeBotId: '',
  attendeeBotName: 'DSH Live Voice',
  voiceCommandSend: 'send, send message',
  voiceCommandQueue: 'queue, queue message',
  voiceCommandEnd: 'end, end conversation',
  voiceCommandMute: 'mute, stop listening',
  voiceCommandResume: 'resume, start listening',
  voiceCommandStopSpeaking: 'stop talking, stop speaking, shut up',
  voiceCommandClear: 'clear all, clear message',
  outputCodeFilterEnabled: true,
  outputCodeMaxLines: 5,
  outputCodeNotice: resolveCodeNotice(undefined, 'pt-BR'),
  rate: 1,
  volume: 1,
  segmentGapMs: 400,
});
/** Source names are single-line labels, not transcript markup. Empty/invalid values restore defaults. */
export const normalizeSourceName = (value, fallback) => {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value))
    return fallback;
  const name = value.trim();
  return name && name.length <= 80 ? name : fallback;
};

const normalizeCommandPhrases = (value, fallback) =>
  typeof value === 'string' && value.length <= 1000 && !value.includes('\0')
    ? value
        .split(/[,\r\n]+/)
        .map((phrase) => phrase.trim())
        .filter(Boolean)
        .slice(0, 20)
        .join(', ')
    : fallback;

export const customSilenceMinMs = 100;
export const customSilenceMaxMs = 10000;
export const normalizeCustomSilenceMs = (value) =>
  Number.isInteger(value) && value >= customSilenceMinMs && value <= customSilenceMaxMs
    ? value
    : defaultSettings.voiceDetectionCustomSilenceMs;
export const customParagraphMinMs = 100;
export const customParagraphMaxMs = 30000;
export const normalizeCustomParagraphMs = (value) =>
  Number.isInteger(value) && value >= customParagraphMinMs && value <= customParagraphMaxMs
    ? value
    : defaultSettings.voiceDetectionCustomParagraphMs;
export const voiceDetectionParagraphMs = (settings) =>
  settings.voiceDetectionPreset === 'custom'
    ? normalizeCustomParagraphMs(settings.voiceDetectionCustomParagraphMs)
    : voiceDetectionPresets[
        Object.hasOwn(voiceDetectionPresets, settings.voiceDetectionPreset)
          ? settings.voiceDetectionPreset
          : defaultSettings.voiceDetectionPreset
      ].paragraphMs;
export const voiceDetectionSilenceMs = (settings) =>
  settings.voiceDetectionPreset === 'custom'
    ? normalizeCustomSilenceMs(settings.voiceDetectionCustomSilenceMs)
    : (
        voiceDetectionPresets[settings.voiceDetectionPreset] ||
        voiceDetectionPresets[defaultSettings.voiceDetectionPreset]
      ).silenceMs;

/** Persisted preferences are untrusted and may belong to an older version. */
export function normalizeSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    engine: ['browser', 'say', 'qwen-http'].includes(source.engine)
      ? source.engine
      : defaultSettings.engine,
    recognitionEngine: [
      'browser',
      'whisper-http',
      'qwen-http',
      'whisper-browser',
      'qwen-browser',
    ].includes(source.recognitionEngine)
      ? source.recognitionEngine
      : defaultSettings.recognitionEngine,
    browserWhisperModel: [
      'whisper-tiny',
      'whisper-base',
      'whisper-small',
      'whisper-medium',
      'whisper-large-v3-turbo',
    ].includes(source.browserWhisperModel)
      ? source.browserWhisperModel
      : defaultSettings.browserWhisperModel,
    browserQwenModel: 'qwen-0.6b',
    browserAsrDevice: source.browserAsrDevice === 'wasm' ? 'wasm' : 'webgpu',
    recognitionProcessLocally:
      typeof source.recognitionProcessLocally === 'boolean'
        ? source.recognitionProcessLocally
        : defaultSettings.recognitionProcessLocally,
    recognitionContext:
      typeof source.recognitionContext === 'string'
        ? source.recognitionContext
            .replaceAll('\0', '')
            .slice(0, TRANSCRIPTION_CONTEXT_MAX_LENGTH)
            .trim()
        : defaultSettings.recognitionContext,
    recognitionAutoInstall:
      typeof source.recognitionAutoInstall === 'boolean'
        ? source.recognitionAutoInstall
        : defaultSettings.recognitionAutoInstall,
    voiceDetectionEngine: ['energy', 'silero'].includes(source.voiceDetectionEngine)
      ? source.voiceDetectionEngine
      : defaultSettings.voiceDetectionEngine,
    voiceDetectionPreset:
      source.voiceDetectionPreset === 'custom' ||
      Object.hasOwn(voiceDetectionPresets, source.voiceDetectionPreset)
        ? source.voiceDetectionPreset
        : defaultSettings.voiceDetectionPreset,
    voiceDetectionCustomSilenceMs: normalizeCustomSilenceMs(source.voiceDetectionCustomSilenceMs),
    voiceDetectionCustomParagraphMs: normalizeCustomParagraphMs(
      source.voiceDetectionCustomParagraphMs,
    ),
    voiceDetectionThreshold:
      typeof source.voiceDetectionThreshold === 'number' &&
      Number.isFinite(source.voiceDetectionThreshold) &&
      source.voiceDetectionThreshold >= 0.05 &&
      source.voiceDetectionThreshold <= 0.95
        ? source.voiceDetectionThreshold
        : defaultSettings.voiceDetectionThreshold,
    voiceDetectionMinimumSpeechMs:
      Number.isInteger(source.voiceDetectionMinimumSpeechMs) &&
      source.voiceDetectionMinimumSpeechMs >= 50 &&
      source.voiceDetectionMinimumSpeechMs <= 2000
        ? source.voiceDetectionMinimumSpeechMs
        : defaultSettings.voiceDetectionMinimumSpeechMs,
    recordingEnabled:
      typeof source.recordingEnabled === 'boolean'
        ? source.recordingEnabled
        : defaultSettings.recordingEnabled,
    recordingKeepPrevious:
      Number.isInteger(source.recordingKeepPrevious) &&
      source.recordingKeepPrevious >= 1 &&
      source.recordingKeepPrevious <= 100
        ? source.recordingKeepPrevious
        : defaultSettings.recordingKeepPrevious,
    recordingBitrate: recordingBitrateOptions.includes(source.recordingBitrate)
      ? source.recordingBitrate
      : defaultSettings.recordingBitrate,
    recordingPreRollMs:
      Number.isInteger(source.recordingPreRollMs) &&
      source.recordingPreRollMs >= 0 &&
      source.recordingPreRollMs <= 2000
        ? source.recordingPreRollMs
        : defaultSettings.recordingPreRollMs,
    recordingPostRollMs:
      Number.isInteger(source.recordingPostRollMs) &&
      source.recordingPostRollMs >= 0 &&
      source.recordingPostRollMs <= 2000
        ? source.recordingPostRollMs
        : defaultSettings.recordingPostRollMs,
    recognitionMaxUtteranceSeconds:
      Number.isInteger(source.recognitionMaxUtteranceSeconds) &&
      source.recognitionMaxUtteranceSeconds >= 10 &&
      source.recognitionMaxUtteranceSeconds <= 300
        ? source.recognitionMaxUtteranceSeconds
        : defaultSettings.recognitionMaxUtteranceSeconds,
    microphoneEnabled:
      typeof source.microphoneEnabled === 'boolean'
        ? source.microphoneEnabled
        : defaultSettings.microphoneEnabled,
    holdToTalkEnabled:
      typeof source.holdToTalkEnabled === 'boolean'
        ? source.holdToTalkEnabled
        : defaultSettings.holdToTalkEnabled,
    holdToTalkShortcut: normalizeShortcut(
      source.holdToTalkShortcut,
      defaultSettings.holdToTalkShortcut,
    ),
    microphoneShortcut: normalizeShortcut(
      source.microphoneShortcut,
      defaultSettings.microphoneShortcut,
    ),
    meetingSource: source.meetingSource === 'attendee' ? 'attendee' : 'shared',
    attendeeApiUrl:
      typeof source.attendeeApiUrl === 'string'
        ? source.attendeeApiUrl.slice(0, 256)
        : defaultSettings.attendeeApiUrl,
    attendeeIngressUrl:
      typeof source.attendeeIngressUrl === 'string' ? source.attendeeIngressUrl.slice(0, 1024) : '',
    attendeeBotName: normalizeSourceName(source.attendeeBotName, defaultSettings.attendeeBotName),
    attendeeBotId:
      typeof source.attendeeBotId === 'string' ? source.attendeeBotId.slice(0, 128) : '',
    meetingShortcut: normalizeShortcut(source.meetingShortcut, defaultSettings.meetingShortcut),
    assistantSpeechShortcut: normalizeShortcut(
      source.assistantSpeechShortcut,
      defaultSettings.assistantSpeechShortcut,
    ),
    announceAssistantMessages:
      typeof source.announceAssistantMessages === 'boolean'
        ? source.announceAssistantMessages
        : defaultSettings.announceAssistantMessages,
    agentVoiceContextEnabled:
      typeof source.agentVoiceContextEnabled === 'boolean'
        ? source.agentVoiceContextEnabled
        : defaultSettings.agentVoiceContextEnabled,
    agentVoiceContext:
      typeof source.agentVoiceContext === 'string' &&
      source.agentVoiceContext.length <= 4000 &&
      !source.agentVoiceContext.includes('\0')
        ? source.agentVoiceContext.trim()
        : defaultSettings.agentVoiceContext,
    interruptSpeechOnUserMessage:
      typeof source.interruptSpeechOnUserMessage === 'boolean'
        ? source.interruptSpeechOnUserMessage
        : defaultSettings.interruptSpeechOnUserMessage,
    dshBusyEnterBehavior: ['queue', 'steer'].includes(source.dshBusyEnterBehavior)
      ? source.dshBusyEnterBehavior
      : defaultSettings.dshBusyEnterBehavior,
    sendingMode:
      source.sendingMode === 'automatic'
        ? 'queue'
        : ['manual', 'queue', 'steer'].includes(source.sendingMode)
          ? source.sendingMode
          : defaultSettings.sendingMode,
    autoSendDelaySeconds: autoSendDelayOptions.includes(source.autoSendDelaySeconds)
      ? source.autoSendDelaySeconds
      : defaultSettings.autoSendDelaySeconds,
    assistantSpeechDelaySeconds: assistantSpeechDelayOptions.includes(
      source.assistantSpeechDelaySeconds,
    )
      ? source.assistantSpeechDelaySeconds
      : defaultSettings.assistantSpeechDelaySeconds,
    mode: ['speaker', 'headphones'].includes(source.mode) ? source.mode : defaultSettings.mode,
    lang:
      typeof source.lang === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(source.lang)
        ? source.lang
        : defaultSettings.lang,
    recognitionLang:
      source.recognitionLang === 'auto' ||
      (typeof source.recognitionLang === 'string' &&
        /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(source.recognitionLang))
        ? source.recognitionLang
        : typeof source.lang === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(source.lang)
          ? source.lang
          : defaultSettings.recognitionLang,
    voice:
      typeof source.voice === 'string' && source.voice.length <= 200 && !source.voice.includes('\0')
        ? source.voice
        : '',
    inputDeviceId:
      typeof source.inputDeviceId === 'string' &&
      source.inputDeviceId.length <= 500 &&
      !source.inputDeviceId.includes('\0')
        ? source.inputDeviceId
        : '',
    outputDeviceId:
      typeof source.outputDeviceId === 'string' &&
      source.outputDeviceId.length <= 500 &&
      !source.outputDeviceId.includes('\0')
        ? source.outputDeviceId
        : '',
    recognitionFilterEnabled:
      typeof source.recognitionFilterEnabled === 'boolean'
        ? source.recognitionFilterEnabled
        : defaultSettings.recognitionFilterEnabled,
    recognitionMinimumWords:
      Number.isInteger(source.recognitionMinimumWords) &&
      source.recognitionMinimumWords >= 1 &&
      source.recognitionMinimumWords <= 20
        ? source.recognitionMinimumWords
        : defaultSettings.recognitionMinimumWords,
    voiceCommandsEnabled:
      typeof source.voiceCommandsEnabled === 'boolean'
        ? source.voiceCommandsEnabled
        : defaultSettings.voiceCommandsEnabled,
    microphoneSourceName: normalizeSourceName(
      source.microphoneSourceName,
      defaultSettings.microphoneSourceName,
    ),
    sharedSourceName: normalizeSourceName(
      source.sharedSourceName,
      defaultSettings.sharedSourceName,
    ),
    timestampsEnabled:
      typeof source.timestampsEnabled === 'boolean' ? source.timestampsEnabled : false,
    sharedTimestampsEnabled:
      typeof source.sharedTimestampsEnabled === 'boolean' ? source.sharedTimestampsEnabled : false,
    sharedVoiceCommandsEnabled:
      typeof source.sharedVoiceCommandsEnabled === 'boolean'
        ? source.sharedVoiceCommandsEnabled
        : typeof source.voiceCommandsEnabled === 'boolean'
          ? source.voiceCommandsEnabled
          : defaultSettings.sharedVoiceCommandsEnabled,
    voiceCommandSend: normalizeCommandPhrases(
      source.voiceCommandSend,
      defaultSettings.voiceCommandSend,
    ),
    voiceCommandQueue: normalizeCommandPhrases(
      source.voiceCommandQueue,
      defaultSettings.voiceCommandQueue,
    ),
    voiceCommandEnd: normalizeCommandPhrases(
      source.voiceCommandEnd,
      defaultSettings.voiceCommandEnd,
    ),
    voiceCommandMute: normalizeCommandPhrases(
      source.voiceCommandMute,
      defaultSettings.voiceCommandMute,
    ),
    voiceCommandResume: normalizeCommandPhrases(
      source.voiceCommandResume,
      defaultSettings.voiceCommandResume,
    ),
    voiceCommandStopSpeaking: normalizeCommandPhrases(
      source.voiceCommandStopSpeaking,
      defaultSettings.voiceCommandStopSpeaking,
    ),
    voiceCommandClear: normalizeCommandPhrases(
      source.voiceCommandClear,
      defaultSettings.voiceCommandClear,
    ),
    outputCodeFilterEnabled:
      typeof source.outputCodeFilterEnabled === 'boolean'
        ? source.outputCodeFilterEnabled
        : defaultSettings.outputCodeFilterEnabled,
    outputCodeMaxLines:
      Number.isInteger(source.outputCodeMaxLines) &&
      source.outputCodeMaxLines >= 0 &&
      source.outputCodeMaxLines <= 100
        ? source.outputCodeMaxLines
        : defaultSettings.outputCodeMaxLines,
    outputCodeNotice:
      typeof source.outputCodeNotice === 'string' &&
      source.outputCodeNotice.trim() &&
      source.outputCodeNotice.length <= 300 &&
      !source.outputCodeNotice.includes('\0')
        ? resolveCodeNotice(source.outputCodeNotice, source.lang || defaultSettings.lang)
        : resolveCodeNotice(defaultSettings.outputCodeNotice, source.lang || defaultSettings.lang),
    rate: Number.isFinite(source.rate) && source.rate >= 0.1 && source.rate <= 3 ? source.rate : 1,
    volume:
      Number.isFinite(source.volume) && source.volume >= 0 && source.volume <= 1
        ? source.volume
        : 1,
    segmentGapMs:
      Number.isFinite(source.segmentGapMs) &&
      source.segmentGapMs >= 0 &&
      source.segmentGapMs <= 2000
        ? Math.round(source.segmentGapMs)
        : 400,
  };
}
