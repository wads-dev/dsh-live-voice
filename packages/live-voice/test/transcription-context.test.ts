import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transcriptionContext,
  transcriptionContextHeader,
  readTranscriptionContextHeader,
} from '../src/modules/recognition/transcriptionContext.js';
import { defaultSettings, normalizeSettings } from '../src/modules/core/settings.js';
import { QwenHttpHost } from '../src/modules/core/qwen/QwenHttpHost.js';
import { WhisperHttpHost } from '../src/modules/recognition/engines/whisper/whisperRecognitionHost.js';
import { encodeMonoPcm16Wav } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.js';
import { apply } from '../src/app/server/apply.js';

const context = 'Native Brazilian Portuguese speaker.\nTechnical terms: ação, deploy, 中文.';
const wav = encodeMonoPcm16Wav(new Float32Array(1600), 16000);

test('transcription context defaults empty, normalizes and survives preference round trips', () => {
  assert.equal(defaultSettings.recognitionContext, '');
  for (const value of [undefined, null, 42, {}, false])
    assert.equal(normalizeSettings({ recognitionContext: value }).recognitionContext, '');
  const saved = normalizeSettings({ recognitionContext: '  ' + context + '  ' });
  assert.equal(normalizeSettings(JSON.parse(JSON.stringify(saved))).recognitionContext, context);
  assert.equal(
    normalizeSettings({ recognitionContext: 'a'.repeat(1001) }).recognitionContext.length,
    1000,
  );
  assert.equal(normalizeSettings({ recognitionContext: 'a\0b' }).recognitionContext, 'ab');
});

test('bounded Unicode multiline context uses an encoded header without changing the audio body', () => {
  assert.equal(
    readTranscriptionContextHeader(new Headers(transcriptionContextHeader(context))),
    context,
  );
  assert.deepEqual(transcriptionContextHeader('  '), {});
  assert.equal(readTranscriptionContextHeader(new Headers()), '');
  for (const value of [123, 'a'.repeat(1001), 'a\0b'])
    assert.throws(() => transcriptionContext(value));
  for (const value of ['%', '%00', 'x'.repeat(1001), '%20'.repeat(4000)])
    assert.throws(() =>
      readTranscriptionContextHeader(new Headers({ 'x-dlv-transcription-context': value })),
    );
});

for (const kind of ['whisper', 'qwen-multipart', 'qwen-json']) {
  test(kind + ' forwards only nonempty context using the standard prompt field', async () => {
    const bodies: any[] = [];
    const fetchImpl = async (url: any, options: any = {}) => {
      if (String(url).endsWith('/health'))
        return Response.json(kind === 'qwen-json' ? { service: 'ominix-api' } : {});
      bodies.push(options.body);
      return Response.json({ text: 'Transcript' });
    };
    const host =
      kind === 'whisper' ? new WhisperHttpHost({ fetchImpl }) : new QwenHttpHost({ fetchImpl });
    try {
      for (const value of ['', '   ', context]) {
        await host.transcribe(wav, { lang: 'auto', context: value });
        const body = bodies.at(-1);
        if (kind === 'qwen-json') {
          const json = JSON.parse(body);
          assert.equal(json.prompt, value.trim() || undefined);
          assert.equal(json.context, undefined);
          assert.equal(Buffer.from(json.file, 'base64').byteLength, wav.byteLength);
        } else {
          assert.equal(body.get('prompt'), value.trim() || null);
          assert.equal(body.get('context'), null);
          assert.equal(body.get('file').size, wav.byteLength);
        }
      }
      const before = bodies.length;
      await assert.rejects(host.transcribe(wav, { context: 'x'.repeat(1001) }));
      assert.equal(bodies.length, before);
    } finally {
      host.dispose();
    }
  });
}

test('local authenticated routes decode context, preserve cancellation and reject malformed input', async () => {
  const routes = new Map<string, any>();
  const cleanup: any[] = [];
  const bodies: FormData[] = [];
  const fetchImpl = async (url: any, options: any = {}) => {
    if (String(url).endsWith('/health')) return Response.json({});
    assert.ok(options.signal instanceof AbortSignal);
    bodies.push(options.body);
    return Response.json({ text: 'Transcript' });
  };
  apply(
    {
      connection: {
        fetch: {
          register(route: any) {
            routes.set(route.path, route);
            return () => routes.delete(route.path);
          },
        },
      },
      systemPrompt: { variable() {}, context() {} },
      effect(fn: any) {
        cleanup.push(fn());
      },
    },
    {
      settingsStore: { load: async () => ({}), save: async (value: any) => value },
      whisperStore: { load: async () => null },
      qwenStore: { load: async () => null },
      whisperFetch: fetchImpl,
      qwenFetch: fetchImpl,
    },
  );
  try {
    for (const engine of ['whisper', 'qwen']) {
      const path = '/api/dsh-live-voice/' + engine + '/transcribe';
      for (const header of [
        undefined,
        encodeURIComponent(context),
        '%',
        encodeURIComponent('x'.repeat(1001)),
        '%00',
      ]) {
        const before = bodies.length;
        const response = await routes.get(path).fetch(
          new Request('http://dsh.test' + path, {
            method: 'POST',
            body: wav,
            headers: {
              'content-type': 'audio/wav',
              'x-dlv-client-id': 'client',
              'x-dlv-operation-id': 'operation',
              ...(header === undefined ? {} : { 'x-dlv-transcription-context': header }),
            },
          }),
        );
        const valid = header === undefined || header === encodeURIComponent(context);
        assert.equal(response.status, valid ? 200 : 400);
        assert.equal(bodies.length, before + Number(valid));
        if (valid)
          assert.equal(bodies.at(-1)!.get('prompt'), header === undefined ? null : context);
        else assert.equal((await response.json()).error.code, 'invalid-context');
      }
    }
  } finally {
    for (const dispose of cleanup.reverse()) await dispose?.();
  }
});
