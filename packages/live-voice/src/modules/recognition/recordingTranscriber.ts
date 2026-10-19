import type { RecordingTranscriber } from '../recording/repository.js';
import { encodeMonoPcm16Wav } from './engines/whisper/WhisperRecognitionEngine.js';
import { transcriptionContextHeader } from './transcriptionContext.js';
import { transcriptionRequestMetadata } from '../recording/requestMetadata.js';

/** Snapshot current HTTP settings for one explicit archive retry, without capture/composer ownership. */
export function recordingTranscriber(
  settings: {
    recognitionEngine: string;
    recognitionLang?: string;
    recognitionContext?: string;
  },
  fetchImpl: typeof fetch = globalThis.fetch,
): RecordingTranscriber {
  const engine = settings.recognitionEngine;
  if (engine !== 'qwen-http' && engine !== 'whisper-http')
    throw new Error('archive-http-engine-required');
  const language = settings.recognitionLang ?? 'auto';
  const context = settings.recognitionContext;
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
