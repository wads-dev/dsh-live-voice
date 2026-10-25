import { BrowserRecognitionEngine } from './BrowserRecognitionEngine.js';
import { detectExternalAudioSupport } from './externalAudioSupport.js';

type NativeRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(track: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
};

type RecognitionConstructor = new () => NativeRecognition;

/** Browser dependencies may be supplied for isolated environments and tests. */
export interface BrowserRecordingGlobals {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  document?: Document;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

export interface BrowserRecordingTranscriptionOptions {
  lang?: string;
  processLocally?: boolean;
  autoInstallLocalPack?: boolean;
  signal?: AbortSignal;
  globals?: BrowserRecordingGlobals;
}

const failure = (message: string, code: string) => Object.assign(new Error(message), { code });
const cancelled = () =>
  Object.assign(new Error('Recording transcription was cancelled.'), { name: 'AbortError' });

/** Transcribe mono PCM once, in real time, without microphone capture or native restarts.
 * Playback begins only after native recognition starts. Completion waits for native
 * end, including finals delivered after playback ends; all phases share a bounded
 * recording-duration + 30 second deadline. No audio is connected to the speakers.
 */
export function transcribeBrowserRecording(
  pcm: Float32Array,
  rate: number,
  {
    lang = 'pt-BR',
    processLocally = true,
    autoInstallLocalPack = true,
    signal,
    globals = globalThis as BrowserRecordingGlobals,
  }: BrowserRecordingTranscriptionOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(cancelled());
    if (!(pcm instanceof Float32Array) || !pcm.length || !Number.isFinite(rate) || rate <= 0)
      return reject(
        new RangeError(
          'Recording transcription requires nonempty mono Float32 PCM and a positive sample rate.',
        ),
      );
    if (pcm.some((sample) => !Number.isFinite(sample)))
      return reject(new RangeError('Recording PCM must contain only finite samples.'));

    const setTimer = globals.setTimeout ?? globalThis.setTimeout;
    const clearTimer = globals.clearTimeout ?? globalThis.clearTimeout;
    const probeAbort = new AbortController();
    let context: AudioContext | undefined;
    let source: AudioBufferSourceNode | undefined;
    let destination: MediaStreamAudioDestinationNode | undefined;
    let recognition: NativeRecognition | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let playbackStarted = false;
    let playbackEnded = false;
    const finals = new Set<number>();
    const transcript: string[] = [];
    const attempt = (operation: () => void) => {
      try {
        operation();
      } catch {
        /* Continue releasing independent resources. */
      }
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      probeAbort.abort();
      if (timer !== undefined) clearTimer(timer);
      if (recognition) {
        recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
        if (error) attempt(() => recognition!.abort());
      }
      if (source) {
        source.onended = null;
        attempt(() => source!.stop());
        attempt(() => source!.disconnect());
        source.buffer = null;
      }
      if (destination) {
        attempt(() => destination!.disconnect());
        for (const track of destination.stream.getTracks()) attempt(() => track.stop());
      }
      if (context)
        attempt(() => {
          void context!.close().catch(() => {});
        });
      if (error) reject(error);
      else resolve(transcript.join(' ').trim());
    };
    const onAbort = () => finish(cancelled());
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimer(
      () =>
        finish(
          failure(
            'Browser recording transcription timed out. Retry with a shorter recording or choose Qwen or Whisper.',
            'recognition-timeout',
          ),
        ),
      Math.min(2_147_483_647, Math.ceil((pcm.length / rate) * 1000) + 30_000),
    );

    void (async () => {
      // This must precede even host capability construction: ignored track
      // arguments must never be allowed to turn archived audio into mic input.
      const externalAudio = await detectExternalAudioSupport(globals as typeof globalThis, {
        signal: probeAbort.signal,
      });
      if (settled) return;
      if (!externalAudio)
        throw failure(
          'This browser cannot safely transcribe saved audio. Choose Qwen or Whisper; microphone fallback is disabled.',
          'external-audio-unsupported',
        );
      const engine = new BrowserRecognitionEngine({
        globals: globals as typeof globalThis,
        lang,
        processLocally,
        // Keep the availability probe read-only until cancellation is checked.
        autoInstallLocalPack: false,
      });
      // Capability only; engine.start() would introduce continuous restart semantics.
      let capability = await engine.capability({ lang, processLocally });
      if (settled) return;
      if (processLocally && autoInstallLocalPack && capability.availability === 'downloadable') {
        capability = await engine.installLocalPack({ lang });
        if (settled) return;
      }
      if (!capability.supported) throw failure(capability.reason, 'recognition-unavailable');
      const Recognition = engine.Recognition as RecognitionConstructor;
      const Audio = globals.AudioContext ?? globals.webkitAudioContext;
      if (!Audio)
        throw failure(
          'Web Audio is unavailable. Choose Qwen or Whisper for saved audio.',
          'audio-context-unavailable',
        );
      context = new Audio();
      destination = context.createMediaStreamDestination();
      source = context.createBufferSource();
      const buffer = context.createBuffer(1, pcm.length, rate);
      buffer.getChannelData(0).set(pcm);
      source.buffer = buffer;
      source.connect(destination);
      const track = destination.stream.getAudioTracks()[0];
      if (track?.kind !== 'audio' || track.readyState !== 'live')
        throw failure('Saved audio requires a live synthetic audio track.', 'invalid-audio-track');
      recognition = new Recognition();
      if (processLocally) {
        if (!('processLocally' in recognition))
          throw failure(
            'Local browser recognition is unavailable. Install the language pack or explicitly allow browser-service processing.',
            'recognition-unavailable',
          );
        recognition.processLocally = true;
        if (recognition.processLocally !== true)
          throw failure('The browser did not enable local processing.', 'recognition-unavailable');
      } else if ('processLocally' in recognition) recognition.processLocally = false;
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onstart = () => {
        if (settled || playbackStarted) return;
        playbackStarted = true;
        void (async () => {
          await context!.resume();
          if (!settled) source!.start();
        })().catch(finish);
      };
      recognition.onresult = (event) => {
        if (settled) return;
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal || finals.has(i)) continue;
          finals.add(i);
          const text = result[0]?.transcript?.trim();
          if (text) transcript.push(text);
        }
      };
      recognition.onerror = (event) =>
        finish(
          failure(
            'Browser recording transcription failed: ' + (event.error || 'unknown error'),
            event.error || 'recognition-error',
          ),
        );
      recognition.onend = () => {
        if (settled) return;
        if (!playbackEnded)
          finish(
            failure(
              'Browser recognition ended before the saved audio finished. Retry with a shorter recording or choose Qwen or Whisper.',
              'recording-incomplete',
            ),
          );
        else finish();
      };
      source.onended = () => {
        if (settled || playbackEnded) return;
        playbackEnded = true;
        // stop requests final results; abort here would discard delayed finals.
        try {
          recognition!.stop();
        } catch (error) {
          finish(error);
        }
      };
      recognition.start(track);
    })().catch(finish);
  });
}
