import type { RecordingTranscriber } from '../recording/repository.js';
import { encodeMonoPcm16Wav } from './engines/whisper/WhisperRecognitionEngine.js';
import { transcriptionContextHeader } from './transcriptionContext.js';
import { transcriptionRequestMetadata } from '../recording/requestMetadata.js';
import { LocalModelManager } from './local/LocalModelManager.js';
import { findBrowserAsrModel, type BrowserAsrDevice } from './local/modelCatalog.js';
import { transcribeBrowserRecording } from './engines/browser/transcribeRecording.js';

type ArchiveModelManager = Pick<
  LocalModelManager,
  'refresh' | 'prepare' | 'transcribe' | 'dispose'
>;
type ArchiveDependencies = {
  createLocalModels?: () => ArchiveModelManager;
  transcribeBrowser?: typeof transcribeBrowserRecording;
};

/** Match live browser inference's mono 16 kHz sample mapping. */
function localPcm(pcm: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return pcm;
  const output = new Float32Array(Math.floor((pcm.length * 16000) / rate));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor((i * rate) / 16000);
    const end = Math.min(pcm.length, Math.max(start + 1, Math.floor(((i + 1) * rate) / 16000)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += pcm[j];
    output[i] = sum / (end - start);
  }
  return output;
}

/** Snapshot current recognition settings for one explicit retry, without capture/composer ownership. */
export function recordingTranscriber(
  settings: {
    recognitionEngine: string;
    recognitionLang?: string;
    recognitionContext?: string;
    recognitionProcessLocally?: boolean;
    recognitionAutoInstall?: boolean;
    browserWhisperModel?: string;
    browserQwenModel?: string;
    browserAsrDevice?: BrowserAsrDevice;
  },
  fetchImpl: typeof fetch = globalThis.fetch,
  dependencies: ArchiveDependencies = {},
): RecordingTranscriber {
  const engine = settings.recognitionEngine;
  const language = settings.recognitionLang ?? 'auto';
  const context = settings.recognitionContext;
  if (engine === 'browser') {
    const processLocally = settings.recognitionProcessLocally ?? true;
    const autoInstallLocalPack = settings.recognitionAutoInstall ?? true;
    return {
      engine,
      transcribe: (pcm, rate, signal) =>
        (dependencies.transcribeBrowser ?? transcribeBrowserRecording)(pcm, rate, {
          lang: language,
          processLocally,
          autoInstallLocalPack,
          signal,
        }),
    };
  }
  if (engine === 'whisper-browser' || engine === 'qwen-browser') {
    const key =
      engine === 'qwen-browser' ? settings.browserQwenModel : settings.browserWhisperModel;
    const model = key && findBrowserAsrModel(key);
    if (!model || model.family !== (engine === 'qwen-browser' ? 'qwen' : 'whisper'))
      throw new Error('invalid-model');
    const device =
      model.devices.length === 1 ? model.devices[0] : (settings.browserAsrDevice ?? 'webgpu');
    return {
      engine: 'browser-local/' + model.key,
      async transcribe(pcm, rate, signal) {
        signal?.throwIfAborted();
        // An inspector cancellation must not terminate a live capture's shared worker.
        // This short-lived runtime reads the same installed cache, never downloads weights.
        const manager = dependencies.createLocalModels?.() ?? new LocalModelManager();
        const dispose = () => manager.dispose();
        signal?.addEventListener('abort', dispose, { once: true });
        try {
          await manager.refresh();
          signal?.throwIfAborted();
          await manager.prepare(model.key, device, signal);
          signal?.throwIfAborted();
          const input = localPcm(pcm, rate);
          const parts: string[] = [];
          const size = 25 * 16000;
          const overlap = 1600 * 16;
          for (let start = 0; start < input.length; start += size - overlap) {
            signal?.throwIfAborted();
            const end = Math.min(input.length, start + size);
            // Copy: the worker transfers/detaches its input buffer. Never truncate long segments.
            parts.push(
              await manager.transcribe(model.key, input.slice(start, end), language, signal),
            );
            signal?.throwIfAborted();
            if (end === input.length) break;
          }
          return parts
            .map((part) => part.trim())
            .filter(Boolean)
            .join(' ');
        } finally {
          signal?.removeEventListener('abort', dispose);
          manager.dispose();
        }
      },
    };
  }
  if (engine !== 'qwen-http' && engine !== 'whisper-http')
    throw new Error('archive-engine-unsupported');
  return {
    engine,
    async transcribe(pcm, rate, signal, onRequest) {
      const body = encodeMonoPcm16Wav(pcm, rate);
      const metadata = transcriptionRequestMetadata(body, pcm.length, rate, language);
      await onRequest?.(metadata);
      signal?.throwIfAborted();
      const response = await fetchImpl(
        '/api/dsh-live-voice/' + (engine === 'qwen-http' ? 'qwen' : 'whisper') + '/transcribe',
        {
          method: 'POST',
          credentials: 'same-origin',
          signal,
          headers: {
            'content-type': 'audio/wav',
            'x-dlv-client-id': crypto.randomUUID(),
            'x-dlv-operation-id': crypto.randomUUID(),
            'x-dlv-language': language,
            ...transcriptionContextHeader(context),
          },
          body,
        },
      );
      await onRequest?.({ ...metadata, responseStatus: response.status });
      const json = await response.json();
      if (!response.ok || !json?.ok)
        throw new Error(json?.error?.message || 'archive-transcription-failed');
      return String(json.value?.text ?? '').trim();
    },
  };
}
