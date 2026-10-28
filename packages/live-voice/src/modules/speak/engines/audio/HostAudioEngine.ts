// @ts-nocheck
import { voiceNetworkFailure } from '../../../core/networkFailure.js';
const cancelled = () => Object.assign(new Error('Speech was cancelled.'), { name: 'AbortError' });

/** Technical diagnostics only: no audio URLs, speech text, or device identifiers. */
export function hostAudioPlaybackError(cause, phase, audio) {
  const name = typeof cause?.name === 'string' ? cause.name : 'Error';
  const mediaCode = Number.isInteger(audio?.error?.code) ? audio.error.code : null;
  const permission = ['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(name);
  const unsupported = name === 'NotSupportedError' || mediaCode === 4;
  const category = permission
    ? 'permission'
    : unsupported
      ? 'unsupported'
      : phase === 'output-routing'
        ? 'output-routing'
        : mediaCode
          ? 'media'
          : 'playback';
  const recoverable =
    !permission &&
    !unsupported &&
    (['AbortError', 'NetworkError', 'NotReadableError'].includes(name) ||
      (phase === 'output-routing' && name === 'NotFoundError') ||
      [1, 2, 3].includes(mediaCode));
  const error = new Error(cause?.message || 'The browser could not play host speech audio.', {
    cause,
  });
  Object.assign(error, { name, phase, category, recoverable, mediaCode });
  if (cause?.code !== undefined) error.code = cause.code;
  return error;
}

/** Browser-owned playback for compact host-synthesized audio. */
export class HostAudioSpeakingEngine {
  constructor({
    endpoint,
    globals = globalThis,
    lang = 'pt-BR',
    capability,
    synthesisRate,
    playbackRate,
    audioFormat = 'audio/mp4',
  } = {}) {
    Object.assign(this, {
      endpoint,
      g: globals,
      lang,
      capabilityEndpoint: capability,
      audioFormat,
    });
    this.synthesisRate = synthesisRate || ((rate) => rate);
    this.playbackRate = playbackRate || ((rate) => rate);
    this.current = null;
  }
  getPlaybackCapabilities() {
    return { pause: true, resume: true };
  }
  async capability() {
    try {
      const url = this.capabilityEndpoint || this.endpoint.replace(/\/speech$/, '/capabilities');
      const response = await this.g.fetch(url, { credentials: 'same-origin' });
      const json = await response.json();
      if (!response.ok || !json?.ok)
        throw new Error(json?.error?.message || 'Speech capability check failed.');
      return {
        ...json.value,
        local: true,
        location: 'host',
        pause: true,
        resume: true,
        audioFormat: this.audioFormat,
      };
    } catch (error) {
      return {
        supported: false,
        local: true,
        location: 'host',
        pause: true,
        resume: true,
        reason: error?.message || String(error),
      };
    }
  }
  async prepare(text, { voice, lang = this.lang, rate = 1, signal } = {}) {
    if (typeof text !== 'string') throw new TypeError('Speech text must be a string.');
    if (signal?.aborted) throw cancelled();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const response = await this.g
        .fetch(this.endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, lang, voice, rate: this.synthesisRate(rate) }),
          signal: controller.signal,
        })
        .catch((error) => {
          throw voiceNetworkFailure(error, controller.signal);
        });
      if (!response.ok) {
        let body;
        try {
          body = await response.json();
        } catch {}
        throw Object.assign(
          new Error(
            body?.error?.message || 'Host speech synthesis failed (' + response.status + ').',
          ),
          {
            code: 'http_' + response.status,
            retryable: [408, 429].includes(response.status) || response.status >= 500,
            phase: 'synthesis',
          },
        );
      }
      if (controller.signal.aborted) throw cancelled();
      const blob = await response.blob();
      if (blob.type && blob.type !== this.audioFormat)
        throw new Error('Host speech returned an unsupported audio format.');
      const url = this.g.URL.createObjectURL(blob);
      let disposed = false;
      return {
        audio: new this.g.Audio(url),
        url,
        dispose: () => {
          if (!disposed) {
            disposed = true;
            this.g.URL.revokeObjectURL(url);
          }
        },
      };
    } catch (error) {
      if (controller.signal.aborted && error?.name !== 'AbortError') throw cancelled();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
  }
  async playPrepared(prepared, options = {}) {
    const { signal, outputDeviceId = '', rate = 1, volume = 1, retainPrepared = false } = options;
    if (!prepared?.audio) throw new TypeError('Prepared speech audio is required.');
    const request = {};
    const stopping = this.stop();
    this.playRequest = request;
    await stopping;
    if (signal?.aborted || this.playRequest !== request) {
      if (!retainPrepared) prepared.dispose();
      throw cancelled();
    }
    const operation = { prepared, audio: prepared.audio, paused: false, ready: false };
    this.current = operation;
    const audio = operation.audio;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = (pause) => {
        if (settled) return false;
        settled = true;
        audio.removeEventListener('playing', started);
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', failed);
        signal?.removeEventListener('abort', aborted);
        if (this.current === operation) this.current = null;
        if (pause) audio.pause();
        if (!retainPrepared) prepared.dispose();
        return true;
      };
      const done = () => {
        if (cleanup(false)) resolve();
      };
      const started = () => {
        if (!settled && this.current === operation) options.onPlaybackStart?.();
      };
      const fail = (cause, phase) => {
        if (settled) return;
        const error = hostAudioPlaybackError(cause, phase, audio);
        if (cleanup(true)) reject(error);
        return error;
      };
      const failed = () => fail(audio.error, 'media');
      const aborted = () => {
        if (cleanup(true)) reject(cancelled());
      };
      operation.cancel = aborted;
      // The same failure path owns initial play and resume, including synchronous throws.
      operation.play = async (phase) => {
        try {
          await audio.play();
        } catch (cause) {
          const error = fail(cause, phase);
          if (error) throw error;
        }
      };
      audio.addEventListener('playing', started, { once: true });
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', failed, { once: true });
      signal?.addEventListener('abort', aborted, { once: true });
      const launch = async () => {
        let phase = 'play';
        try {
          if (retainPrepared) audio.currentTime = 0;
          audio.playbackRate = this.playbackRate(rate);
          audio.volume = volume;
          if (outputDeviceId && typeof audio.setSinkId === 'function') {
            phase = 'output-routing';
            await audio.setSinkId(outputDeviceId);
          }
          // Cancellation settles immediately, even when routing never completes.
          if (settled) return;
          if (signal?.aborted || this.current !== operation) return aborted();
          operation.ready = true;
          if (!operation.paused) await operation.play('play');
        } catch (cause) {
          if (!settled) fail(cause, phase);
        }
      };
      if (signal?.aborted) aborted();
      else void launch();
    });
  }
  async speak(text, options = {}) {
    const prepared = await this.prepare(text, options);
    try {
      return await this.playPrepared(prepared, options);
    } catch (error) {
      prepared.dispose();
      throw error;
    }
  }
  setVolume(volume) {
    if (this.current?.audio) this.current.audio.volume = volume;
  }
  async stop() {
    this.playRequest = null;
    const operation = this.current;
    if (!operation) return;
    this.current = null;
    if (operation.cancel) operation.cancel();
    else {
      operation.audio.pause();
      operation.prepared.dispose();
    }
  }
  getPlaybackProgress() {
    const audio = this.current?.audio;
    if (
      !audio ||
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0 ||
      !Number.isFinite(audio.currentTime)
    )
      return null;
    return { positionSeconds: audio.currentTime, durationSeconds: audio.duration };
  }
  pause() {
    if (!this.current?.audio || this.current.paused) return false;
    this.current.paused = true;
    this.current.audio.pause();
    return true;
  }
  async resume() {
    if (!this.current?.audio || (!this.current.paused && !this.current.audio.paused)) return false;
    this.current.paused = false;
    if (this.current.ready) await this.current.play('resume');
    return true;
  }
}
