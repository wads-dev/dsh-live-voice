import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConversationStatus } from '../src/modules/conversation/components/conversationStatus.js';
import {
  createFallbackTranslator,
  liveVoiceDictionaries,
} from '../src/app/client/i18n/registerDshLocales.js';
import type { LiveVoiceLocale } from '../src/app/client/i18n/catalogs/index.js';

function languageFor(locale: LiveVoiceLocale = 'en'): any {
  const translate = createFallbackTranslator(locale);
  const scoped = (path: string): any =>
    new Proxy(() => {}, {
      get: (_, name) => scoped(path + '.' + String(name)),
      apply: (_, __, [params]) => translate(path, params),
    });
  return scoped('dsh-live-voice');
}

const language = languageFor();

test('failed or recovering input never reports ready', () => {
  assert.equal(
    resolveConversationStatus({ inputRecovery: { retrying: true } }, null, language),
    'Recovering recognition',
  );
  assert.equal(
    resolveConversationStatus({ inputRecovery: { retrying: false } }, null, language),
    'Recognition stopped',
  );
  assert.equal(
    resolveConversationStatus({ error: 'native recognition stopped' }, null, language),
    'Recognition stopped',
  );
});

test('audio storage barriers never appear as queued transcription', () => {
  const language = languageFor();
  for (const pendingTranscriptions of [1, 2, 32]) {
    assert.equal(
      resolveConversationStatus(
        { listening: true, pendingTranscriptions, pendingTranscriptionRequests: 0 },
        null,
        language,
      ),
      'Waiting',
    );
    assert.equal(
      resolveConversationStatus(
        {
          listening: true,
          recognizing: true,
          pendingTranscriptions,
          pendingTranscriptionRequests: 0,
        },
        null,
        language,
      ),
      'Listening',
    );
    assert.equal(
      resolveConversationStatus(
        { listening: true, pendingTranscriptions, pendingTranscriptionRequests: 1 },
        null,
        language,
      ),
      'Transcribing',
    );
  }
});

test('status matrix separates current speech from pending transcription and soft mute', () => {
  for (const listening of [false, true]) {
    for (const recognizing of [false, true]) {
      for (const pendingTranscriptions of [0, 1, 3]) {
        for (const muted of [false, true]) {
          const state = { listening, recognizing, pendingTranscriptions, muted };
          const expected = listening
            ? muted
              ? 'Waiting for command'
              : recognizing
                ? pendingTranscriptions > 0
                  ? 'Listening and transcribing'
                  : 'Listening'
                : pendingTranscriptions > 0
                  ? 'Transcribing'
                  : 'Waiting'
            : recognizing || pendingTranscriptions > 0
              ? 'Transcribing'
              : 'Voice ready';
          assert.equal(
            resolveConversationStatus(state, null, language),
            expected,
            JSON.stringify(state),
          );
        }
      }
    }
  }
  assert.equal(resolveConversationStatus({ listening: true }, null, language), 'Waiting');
  assert.equal(
    resolveConversationStatus({ listening: true, recognizing: true }, null, language),
    'Listening',
    'omitted pending count is not a transcription backlog',
  );
});

test('starting, structured questions, countdown, and idle retain their distinct status', () => {
  const cases: [any, number | null, string][] = [
    [{ starting: true }, null, 'Starting microphone'],
    [{ starting: true, recognizing: true, pendingTranscriptions: 2 }, null, 'Starting microphone'],
    [{ answeringQuestion: true, listening: true }, null, 'Listening for your answer'],
    [
      { answeringQuestion: true, listening: true, recognizing: true, pendingTranscriptions: 2 },
      null,
      'Recognizing answer',
    ],
    [{ answeringQuestion: true, recognizing: true }, null, 'Recognizing answer'],
    [{ listening: true }, 3, 'Sending in 3'],
    [{ conversation: true }, null, 'Conversation idle'],
    [{}, null, 'Voice ready'],
  ];
  for (const [state, remaining, expected] of cases)
    assert.equal(
      resolveConversationStatus(state, remaining, language),
      expected,
      JSON.stringify(state),
    );
});

test('ignoring an active input displays command waiting even with question and transcription activity', () => {
  for (const recognizing of [false, true]) {
    for (const pendingTranscriptions of [0, 2]) {
      const state = {
        listening: true,
        muted: true,
        answeringQuestion: true,
        recognizing,
        pendingTranscriptions,
      };
      assert.equal(resolveConversationStatus(state, null, language), 'Waiting for command');
    }
  }
  assert.equal(
    resolveConversationStatus(
      { muted: true, listening: false, pendingTranscriptions: 2 },
      null,
      language,
    ),
    'Transcribing',
    'mute is scoped to an actively listening source, not completed capture',
  );
});

test('all supported locales render status copy without ellipses or unresolved keys', () => {
  const keys = [
    'commons.conversation.idle',
    'commons.status.ready',
    'recognition.microphone.starting',
    'recognition.status.answer',
    'recognition.status.awaitingAnswer',
    'recognition.status.listening',
    'recognition.status.listeningProcessing',
    'recognition.status.processing',
    'recognition.status.waiting',
    'recognition.status.waitingCommand',
    'settings.autoSend.countdown',
    'speak.status.paused',
    'speak.status.playing',
  ];
  const states: [any, number | null][] = [
    [{ starting: true }, null],
    [{ listening: true }, null],
    [{ listening: true, recognizing: true }, null],
    [{ listening: true, recognizing: true, pendingTranscriptions: 2 }, null],
    [{ listening: true, pendingTranscriptions: 2 }, null],
    [{ listening: true, muted: true, recognizing: true, pendingTranscriptions: 2 }, null],
    [{ recognizing: true }, null],
    [{ pendingTranscriptions: 2 }, null],
    [{ answeringQuestion: true, listening: true }, null],
    [{ answeringQuestion: true, recognizing: true }, null],
    [{ listening: true }, 3],
    [{ conversation: true }, null],
    [{}, null],
  ];
  for (const locale of Object.keys(liveVoiceDictionaries) as LiveVoiceLocale[]) {
    const translate = createFallbackTranslator(locale);
    for (const key of keys) {
      const identifier = 'dsh-live-voice.' + key;
      assert.ok(Object.hasOwn(liveVoiceDictionaries[locale], identifier), locale + ': ' + key);
      const copy = translate(identifier, { remaining: 3 });
      assert.ok(copy.trim(), locale + ': ' + key);
      assert.doesNotMatch(copy, /…|\.\.\./, locale + ': ' + key);
      assert.doesNotMatch(copy, /dsh-live-voice\.|\{remaining\}/, locale + ': ' + key);
    }
    for (const [state, remaining] of states) {
      const copy = resolveConversationStatus(state, remaining, languageFor(locale));
      assert.ok(copy.trim(), locale + ': ' + JSON.stringify(state));
      assert.doesNotMatch(copy, /…|\.\.\.|dsh-live-voice\.|\{remaining\}/);
    }
  }
});
