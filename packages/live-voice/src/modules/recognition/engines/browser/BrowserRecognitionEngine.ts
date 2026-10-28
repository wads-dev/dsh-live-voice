// @ts-nocheck
import { detectExternalAudioSupport } from './externalAudioSupport.js';

const externalAudioReason =
  'This browser cannot safely recognize shared audio. Choose Qwen or Whisper HTTP for shared audio.';
const invalidAudioTrack = () =>
  Object.assign(new Error('Shared recognition requires a live audio track.'), {
    name: 'InvalidStateError',
    code: 'invalid-audio-track',
  });
const abortError = () =>
  Object.assign(new Error('Speech recognition was cancelled.'), { name: 'AbortError' });
const localReason =
  'Local browser speech recognition is unavailable for this language. Install the local language pack, or explicitly turn off local-only processing in Settings if you permit the browser recognition service to process audio.';
const notify = (callback, value) => {
  try {
    callback?.(value);
  } catch {
    /* Consumer errors must not retain microphone ownership. */
  }
};

/** Web Speech recognition with explicit user-selected local-only or browser-service processing.
 * When local-only plus auto-install is selected, the browser's native language-pack install API is used.
 * All browser globals (including optional setTimeout/clearTimeout) are injectable.
 * capability({lang,signal}?) reports processing support and, for shared input, externalAudio support.
 * Shared input borrows the live meter track for the entire session; stop never owns/stops it.
 * start({lang,signal,onResult,onActivity,onError}?) resolves when native start() is accepted,
 * not when permission is granted. Native asynchronous errors go to onError(Error).
 * onResult({interim,final}) contains the current interim string and NEW final text only.
 * onActivity(boolean) reports speech activity, not microphone permission/readiness.
 * reset() replaces active native capture so its cumulative result list starts empty.
 * stop() aborts capture, discards pending results, removes handlers and cancels restarts.
 * Consecutive no-progress restarts are bounded; speech or nonempty results reset the budget.
 * Native start acceptance alone is not progress. Restart delay backs off up to 30 seconds.
 */
export class BrowserRecognitionEngine {
  constructor({
    globals = globalThis,
    meter,
    inputSource = 'microphone',
    lang = 'pt-BR',
    processLocally = true,
    autoInstallLocalPack = true,
    onResult,
    onActivity,
    onError,
    maxRestarts = 3,
    restartDelayMs = 100,
  } = {}) {
    if (!Number.isInteger(maxRestarts) || maxRestarts < 0 || maxRestarts > 100)
      throw new RangeError('maxRestarts must be an integer between 0 and 100.');
    if (!Number.isFinite(restartDelayMs) || restartDelayMs < 0)
      throw new RangeError('restartDelayMs must be nonnegative.');
    Object.assign(this, {
      globals,
      meter,
      inputSource,
      lang,
      processLocally,
      autoInstallLocalPack,
      onResult,
      onActivity,
      onError,
      maxRestarts,
      restartDelayMs,
    });
    this.session = null;
  }

  get active() {
    return this.session !== null;
  }
  get Recognition() {
    try {
      const standard = this.globals?.SpeechRecognition;
      return typeof standard === 'function' ? standard : this.globals?.webkitSpeechRecognition;
    } catch {
      return undefined;
    }
  }

  async capability({ lang = this.lang, processLocally = this.processLocally, signal } = {}) {
    if (this.inputSource !== 'shared') return this._processingCapability({ lang, processLocally });
    const Recognition = this.Recognition;
    const externalAudio =
      (Recognition && this.externalAudioRecognition === Recognition) ||
      (await detectExternalAudioSupport(this.globals, { signal }));
    if (!externalAudio)
      return {
        supported: false,
        local: processLocally,
        externalAudio: false,
        code: 'external-audio-unsupported',
        reason: externalAudioReason,
      };
    this.externalAudioRecognition = Recognition;
    const capability = await this._processingCapability({ lang, processLocally });
    return {
      ...capability,
      externalAudio: true,
      ...(!capability.supported && processLocally ? { code: 'browser-local-unavailable' } : {}),
    };
  }

  async _processingCapability({ lang, processLocally }) {
    try {
      const Recognition = this.Recognition;
      if (typeof Recognition !== 'function') throw new Error();
      const probe = new Recognition();
      if (typeof probe.start !== 'function' || typeof probe.abort !== 'function') throw new Error();
      if (!processLocally)
        return {
          supported: true,
          local: false,
          reason: 'Browser recognition service may process audio remotely.',
        };
      if (typeof Recognition.available !== 'function' || !('processLocally' in probe))
        throw new Error();
      probe.processLocally = true;
      if (probe.processLocally !== true) throw new Error();
      let availability = await Recognition.available({ langs: [lang], processLocally: true });
      if (availability === 'downloadable' && this.autoInstallLocalPack) {
        const installed = await Recognition.install?.({ langs: [lang], processLocally: true });
        if (installed === true)
          availability = await Recognition.available({ langs: [lang], processLocally: true });
        else
          return {
            supported: false,
            local: true,
            availability,
            reason: `The browser could not install the local ${lang} language pack. Disable local processing to use the browser recognition service, or try again later.`,
          };
      }
      if (availability !== 'available')
        return {
          supported: false,
          local: true,
          availability,
          reason: `Local recognition for ${lang}: ${availability}. ${availability === 'downloadable' ? 'The language pack is not installed; enable automatic installation or browser-service recognition.' : availability === 'downloading' ? 'The browser is still installing the language pack.' : 'The browser cannot currently provide on-device recognition for this language.'}`,
        };
      return { supported: true, local: true };
    } catch {
      return {
        supported: false,
        local: processLocally,
        reason: processLocally
          ? localReason
          : 'Browser speech recognition is unavailable in this browser.',
      };
    }
  }
  async installLocalPack({ lang = this.lang } = {}) {
    const Recognition = this.Recognition;
    if (typeof Recognition?.install !== 'function')
      throw new Error('This browser cannot install local speech-recognition language packs.');
    const result = await Recognition.install({ langs: [lang], processLocally: true });
    if (result !== true) throw new Error(`Local recognition for ${lang} could not be installed.`);
    return this.capability({ lang, processLocally: true });
  }

  async start({
    lang = this.lang,
    signal,
    onResult = this.onResult,
    onActivity = this.onActivity,
    onError = this.onError,
  } = {}) {
    this.stop();
    if (signal?.aborted) throw abortError();
    const session = {
      lang,
      signal,
      probeAbort: new AbortController(),
      audioTrack: null,
      onResult,
      onActivity,
      onError,
      restarts: 0,
      timer: null,
      recognition: null,
      speaking: false,
      finishing: false,
      finishPromise: null,
      resolveFinish: null,
    };
    this.session = session;
    const cancelled = new Promise((resolve, reject) => {
      session.rejectCancelled = reject;
    });
    session.cancel = () => {
      if (this.session === session) this.stop();
    };
    signal?.addEventListener('abort', session.cancel, { once: true });
    const capability = await Promise.race([
      this.capability({
        lang,
        processLocally: this.processLocally,
        signal: session.probeAbort.signal,
      }),
      cancelled,
    ]);
    if (this.session !== session || signal?.aborted) {
      session.cancel();
      throw abortError();
    }
    if (!capability.supported) {
      this.stop();
      throw Object.assign(new Error(capability.reason), { code: capability.code });
    }
    try {
      if (this.inputSource === 'shared')
        session.audioTrack = this.meter?.stream?.getAudioTracks?.()[0];
      this._begin(session);
      if (this.session !== session) throw abortError();
    } catch (error) {
      if (this.session === session) this.stop();
      throw error;
    }
  }

  _activity(session, active) {
    if (session.speaking === active) return;
    session.speaking = active;
    notify(session.onActivity, active);
  }

  _detach(recognition) {
    if (!recognition) return;
    for (const name of ['onresult', 'onerror', 'onend', 'onspeechstart', 'onspeechend'])
      recognition[name] = null;
  }

  _fail(session, error) {
    if (this.session !== session) return;
    this.stop();
    notify(session.onError, error);
  }

  _begin(session) {
    if (this.session !== session) return;
    if (
      this.inputSource === 'shared' &&
      (session.audioTrack?.kind !== 'audio' || session.audioTrack.readyState !== 'live')
    )
      throw invalidAudioTrack();
    const recognition = new this.Recognition();
    if (this.processLocally) {
      if (!('processLocally' in recognition)) throw new Error(localReason);
      recognition.processLocally = true;
      if (recognition.processLocally !== true) throw new Error(localReason);
    } else if ('processLocally' in recognition) recognition.processLocally = false;
    recognition.lang = session.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    session.recognition = recognition;
    const finals = new Set();
    const starts = new Map();
    let speechStartedAt = null;
    const valid = () => this.session === session && session.recognition === recognition;
    recognition.onspeechstart = () => {
      if (!valid()) return;
      session.restarts = 0;
      speechStartedAt = Date.now();
      this._activity(session, true);
    };
    recognition.onspeechend = () => {
      if (valid()) this._activity(session, false);
    };
    recognition.onresult = (event) => {
      if (!valid()) return;
      let startedAt = null;
      const interim = [],
        final = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (!finals.has(i) && !starts.has(i) && text.trim())
          starts.set(i, speechStartedAt ?? Date.now());
        if (text.trim()) session.restarts = 0;
        if (result.isFinal) {
          if (!finals.has(i)) {
            finals.add(i);
            startedAt ??= starts.get(i);
            final.push(text);
          }
        } else interim.push(text);
      }
      notify(session.onResult, { interim: interim.join(' '), final: final.join(' '), startedAt });
    };
    recognition.onerror = (event) => {
      if (!valid()) return;
      const error = Object.assign(
        new Error('Local browser recognition failed: ' + (event.error || 'unknown error')),
        { code: event.error },
      );
      // no-speech is recoverable only when the browser subsequently ends this session.
      if (event.error === 'no-speech') return;
      else this._fail(session, error);
    };
    recognition.onend = () => {
      if (!valid()) return;
      this._detach(recognition);
      session.recognition = null;
      this._activity(session, false);
      if (this.session !== session) return;
      if (session.finishing) {
        this.session = null;
        session.signal?.removeEventListener('abort', session.cancel);
        session.resolveFinish?.();
        return;
      }
      if (session.restarts >= this.maxRestarts) {
        this._fail(
          session,
          Object.assign(
            new Error(
              'Local browser recognition stopped repeatedly. Restart listening manually or choose another local engine.',
            ),
            { code: 'restart-limit', retryable: true },
          ),
        );
        return;
      }
      session.restarts++;
      session.timer = (this.globals.setTimeout ?? globalThis.setTimeout)(
        () => {
          session.timer = null;
          if (this.session !== session) return;
          try {
            this._begin(session);
          } catch (error) {
            this._fail(session, error);
          }
        },
        Math.min(30_000, this.restartDelayMs * 2 ** Math.min(session.restarts - 1, 20)),
      );
    };
    if (this.inputSource === 'shared') recognition.start(session.audioTrack);
    else recognition.start();
  }

  finish() {
    const session = this.session;
    if (!session) return Promise.resolve();
    if (session.finishPromise) return session.finishPromise;
    session.finishing = true;
    session.finishPromise = new Promise((resolve) => {
      session.resolveFinish = resolve;
    });
    if (session.timer !== null) {
      (this.globals.clearTimeout ?? globalThis.clearTimeout)(session.timer);
      session.timer = null;
      this.session = null;
      session.resolveFinish();
      return session.finishPromise;
    }
    try {
      session.recognition?.stop();
      if (!session.recognition) {
        this.session = null;
        session.resolveFinish();
      }
    } catch {
      this.session = null;
      session.resolveFinish();
    }
    return session.finishPromise;
  }

  reset() {
    const session = this.session;
    const recognition = session?.recognition;
    if (!session || !recognition) return false;
    this._detach(recognition);
    session.recognition = null;
    try {
      recognition.abort();
    } catch {
      /* Browser already ended capture. */
    }
    this._activity(session, false);
    if (this.session !== session || session.signal?.aborted) return false;
    try {
      this._begin(session);
      return true;
    } catch (error) {
      this._fail(session, error);
      return false;
    }
  }

  async stop() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    session.rejectCancelled(abortError());
    session.probeAbort.abort();
    session.signal?.removeEventListener('abort', session.cancel);
    if (session.timer !== null)
      (this.globals.clearTimeout ?? globalThis.clearTimeout)(session.timer);
    this._detach(session.recognition);
    try {
      session.recognition?.abort();
    } catch {
      /* Browser already ended capture. */
    }
    this._activity(session, false);
    session.resolveFinish?.();
  }
}
