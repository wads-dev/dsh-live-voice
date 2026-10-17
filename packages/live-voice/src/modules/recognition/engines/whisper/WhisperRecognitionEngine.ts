// @ts-nocheck
import { startRecordingRecognition } from '../../../recording/RecordingRecognition.js';
import { createRecordingRepository } from '../../../recording/repository.js';
import { sileroVadAvailable } from '../../vad/assets.js';
import { defaultSettings, voiceDetectionSilenceMs } from '../../../core/settings.js';
import { acquireSileroVadStream, attachSileroVadCapture } from '../../vad/SileroVadRuntime.js';

const ROUTE = '/api/dsh-live-voice/whisper';

const abortError = () =>
  Object.assign(new Error('Whisper recognition was cancelled.'), { name: 'AbortError' });
export function encodeMonoPcm16Wav(samples, inputRate) {
  const ratio = inputRate / 16000,
    length = Math.floor(samples.length / ratio),
    out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio),
      end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end && j < samples.length; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    out[i] = value < 0 ? value * 32768 : value * 32767;
  }
  const buffer = new ArrayBuffer(44 + out.byteLength),
    view = new DataView(buffer),
    text = (at, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
    };
  text(0, 'RIFF');
  view.setUint32(4, 36 + out.byteLength, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, out.byteLength, true);
  new Int16Array(buffer, 44).set(out);
  return buffer;
}
export class WhisperHttpRecognitionEngine {
  constructor({
    globals = globalThis,
    meter,
    voiceDetectionEngine = defaultSettings.voiceDetectionEngine,
    vadFactory = acquireSileroVadStream,
    vadCapture = attachSileroVadCapture,
    vadAvailable = () => sileroVadAvailable(globals.fetch),
    vadErrorMessage = () => 'Silero VAD is unavailable. Select energy detection or retry.',
    voiceDetectionPreset = defaultSettings.voiceDetectionPreset,
    voiceDetectionCustomSilenceMs = defaultSettings.voiceDetectionCustomSilenceMs,
    voiceDetectionCustomParagraphMs = defaultSettings.voiceDetectionCustomParagraphMs,
    recognitionContext = '',
    maxUtteranceSeconds = 60,
    recordings,
    inputSource = 'microphone',
    sourceId = inputSource,
    sourceLabel = inputSource,
    recordingErrorMessage = () =>
      'Recording could not be saved. Capture stopped to avoid silent data loss.',
    recordingEnabled = true,
    recordingKeepPrevious = 1,
    recordingBitrate = 48000,
    recordingPreRollMs = 320,
    recordingPostRollMs = 320,
    voiceDetectionThreshold = 0.5,
    voiceDetectionMinimumSpeechMs = 250,
  } = {}) {
    this.g = globals;
    this.meter = meter;
    this.voiceDetectionEngine = voiceDetectionEngine;
    this.vadFactory = vadFactory;
    this.vadCapture = vadCapture;
    this.vadAvailable = vadAvailable;
    this.vadErrorMessage = vadErrorMessage;
    this.session = null;
    this.lang = 'pt-BR';
    this.voiceDetectionPreset = voiceDetectionPreset;
    this.voiceDetectionCustomSilenceMs = voiceDetectionCustomSilenceMs;
    this.voiceDetectionCustomParagraphMs = voiceDetectionCustomParagraphMs;
    this.recognitionContext = recognitionContext;
    this.maxUtteranceSeconds = maxUtteranceSeconds;
    Object.assign(this, {
      recordings: recordings ?? createRecordingRepository(),
      inputSource,
      sourceId,
      sourceLabel,
      recordingErrorMessage,
      recordingEnabled,
      recordingKeepPrevious,
      recordingBitrate,
      recordingPreRollMs,
      recordingPostRollMs,
      voiceDetectionThreshold,
      voiceDetectionMinimumSpeechMs,
    });
    this.route = ROUTE;
  }
  get activityManaged() {
    return true;
  }
  get segmentation() {
    return { silenceMs: voiceDetectionSilenceMs(this) };
  }
  async capability() {
    try {
      const response = await this.g.fetch(this.route + '/capabilities', {
          credentials: 'same-origin',
        }),
        json = await response.json();
      return json?.ok
        ? json.value
        : {
            supported: false,
            local: true,
            streaming: false,
            reason: json?.error?.message || 'Whisper HTTP host is unavailable.',
          };
    } catch (error) {
      return {
        supported: false,
        local: true,
        streaming: false,
        reason: 'Whisper HTTP host connection failed: ' + error.message,
      };
    }
  }
  async start({
    lang = this.lang,
    signal,
    onResult,
    onActivity,
    onError,
    onProcessingChange,
  } = {}) {
    await this.stop();
    const startGeneration = (this.startGeneration = (this.startGeneration || 0) + 1);
    if (signal?.aborted) throw abortError();
    const context = this.meter?.context,
      source = this.meter?.source;
    const silero = this.voiceDetectionEngine === 'silero';
    if (silero) {
      let available = false;
      try {
        available = await this.vadAvailable();
      } catch {}
      if (signal?.aborted || this.startGeneration !== startGeneration) throw abortError();
      if (!available) {
        const error = Object.assign(new Error('Silero VAD assets are unavailable.'), {
          code: 'unavailable',
        });
        throw new Error(this.vadErrorMessage(error));
      }
    }
    if (signal?.aborted || this.startGeneration !== startGeneration) throw abortError();
    if (!context || !source || (!silero && typeof context.createScriptProcessor !== 'function'))
      throw new Error('This browser cannot capture PCM audio for Whisper HTTP.');
    const recording = await startRecordingRecognition(
      this,
      { lang, signal, onResult, onActivity, onError, onProcessingChange },
      { silero, encode: encodeMonoPcm16Wav },
    );
    if (this.startGeneration !== startGeneration || signal?.aborted) throw abortError();
    return recording;
  }
  finish() {
    return this.session?.finishRecording() ?? Promise.resolve();
  }
  async stop() {
    this.startGeneration = (this.startGeneration || 0) + 1;
    const session = this.session;
    if (!session) return;
    this.session = null;
    session.signal?.removeEventListener('abort', session.abort);
    await session.stopRecording();
    session.onProcessingChange?.({
      queued: 0,
      active: false,
      transcribing: 0,
      deliveryPending: 0,
      pending: 0,
    });
  }
}
