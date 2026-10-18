// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LiveVoiceTranslationProvider } from '../src/app/client/i18n/index.ts';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
import { ConversationControls } from '../src/modules/conversation/components/ConversationControls.tsx';
import { SpeechStatusBar } from '../src/modules/conversation/components/SpeechStatusBar.tsx';
import { ConversationStatusBar } from '../src/modules/conversation/components/ConversationStatusBar.tsx';
import { remainingSpeechCaption } from '../src/modules/conversation/components/speechCaption.ts';
import { HostAudioSpeakingEngine } from '../src/modules/speak/engines/audio/HostAudioEngine.ts';

test('caption projection clips by approximate character position and keeps word boundaries', () => {
  const text = 'First second third fourth';
  assert.equal(remainingSpeechCaption(text, null), text);
  assert.equal(
    remainingSpeechCaption(text, { positionSeconds: 5, durationSeconds: 10 }),
    'third fourth',
  );
  assert.equal(remainingSpeechCaption(text, { positionSeconds: -1, durationSeconds: 10 }), text);
  assert.equal(remainingSpeechCaption(text, { positionSeconds: 2, durationSeconds: NaN }), text);
  assert.equal(
    remainingSpeechCaption('你好世界', { positionSeconds: 2, durationSeconds: 4 }),
    '世界',
  );
});

test('host progress follows audio position, remains stable during pause, and clears after stop', async () => {
  const engine = new HostAudioSpeakingEngine();
  const audio = {
    duration: 10,
    currentTime: 4,
    paused: false,
    pause() {
      this.paused = true;
    },
  };
  engine.current = { audio, prepared: { dispose() {} } };
  assert.deepEqual(engine.getPlaybackProgress(), { positionSeconds: 4, durationSeconds: 10 });
  engine.pause();
  assert.equal(engine.getPlaybackProgress().positionSeconds, 4);
  await engine.stop();
  assert.equal(engine.getPlaybackProgress(), null);
  audio.duration = Infinity;
  engine.current = { audio };
  assert.equal(engine.getPlaybackProgress(), null);
});

test('separate speech bar advances captions, pauses without hiding, stops and preserves recognition bar', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  t.mock.timers.enable({ apis: ['setInterval'] });
  let position = 0;
  let state = {
    conversation: true,
    speaking: true,
    listening: false,
    paused: false,
    speechText: 'First second third fourth',
    speechEngine: 'say',
    speechSegmentsRemaining: 14,
    speechSegmentIndex: 2,
    speechSegmentsTotal: 15,
    speechHasPrevious: true,
    speechLoading: true,
    settings: { engine: 'say' },
    capabilities: { say: { pause: true, resume: true } },
  };
  const listeners = new Set();
  const patch = (next) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };
  const controller = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSpeechProgress: () => ({ positionSeconds: position, durationSeconds: 10 }),
    pauseSpeech: () => patch({ paused: true }),
    resumeSpeech: () => patch({ paused: false }),
    stopSpeech: () =>
      patch({ speaking: false, paused: false, speechSegmentsRemaining: 0, speechText: null }),
    meter: { level: () => 0 },
    clearError() {},
  };
  await act(async () =>
    root.render(
      <LiveVoiceTranslationProvider>
        <ConversationStatusBar controller={controller} />
      </LiveVoiceTranslationProvider>,
    ),
  );
  const speech = document.querySelector('.dlv-speech-bar');
  const recognition = document.querySelector('[aria-label="Voice controls"]');
  assert.ok(speech);
  assert.ok(recognition);
  assert.equal(speech.querySelector('[aria-label="End voice conversation"]'), null);
  assert.equal(speech.querySelector('[aria-label="Take microphone"]'), null);
  assert.equal(recognition.querySelector('[aria-label="Pause speech"]'), null);
  assert.ok(recognition.querySelector('[aria-label="Take microphone"]'));
  const pill = speech.querySelector('.dlv-speech-pill');
  assert.equal(pill.children[0].getAttribute('aria-label'), 'Previous speech segment');
  assert.ok(pill.children[1].classList.contains('dlv-caption-stack'));
  assert.equal(pill.children[2].getAttribute('aria-label'), 'Skip to next speech segment');
  assert.equal(speech.querySelector('.dlv-speech-count').textContent, '2/15');
  assert.equal(speech.querySelector('[role="progressbar"]').dataset.loading, 'true');
  assert.equal(speech.querySelector('[role="progressbar"]').hasAttribute('aria-valuenow'), false);
  await act(async () => patch({ speechLoading: false }));
  assert.equal(speech.querySelector('[role="progressbar"]').dataset.loading, 'false');
  position = 5;
  await act(async () => t.mock.timers.tick(100));
  assert.equal(speech.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '50');
  assert.equal(speech.querySelector('.dlv-caption').textContent, 'First second third fourth');
  await act(async () => speech.querySelector('[aria-label="Pause speech"]').click());
  assert.ok(speech.querySelector('[aria-label="Resume speech"]'));
  position = 8;
  await act(async () => t.mock.timers.tick(500));
  assert.equal(speech.querySelector('.dlv-caption').textContent, 'First second third fourth');
  await act(async () => speech.querySelector('[aria-label="Resume speech"]').click());
  assert.equal(speech.querySelector('.dlv-caption').textContent, 'First second third fourth');
  await act(async () => speech.querySelector('[aria-label="Stop all speech"]').click());
  assert.equal(document.querySelector('.dlv-speech-bar'), null);
  assert.ok(document.querySelector('[aria-label="Voice controls"]'));
  assert.equal(state.conversation, true);
});

test('composer microphone toggle leaves real manual playback and speech bar open', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const root = createRoot(document.getElementById('root'));
  let finish;
  let stops = 0;
  const engine = {
    capability: () => ({ supported: true, pause: true, resume: true }),
    speak: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    stop: () => {
      stops++;
      finish?.();
    },
  };
  const c = new VoiceCoordinator({
    settings: { mode: 'headphones' },
    engines: { browser: engine },
    recognition: { capability: () => ({ supported: true }), start() {}, stop() {} },
    meter: {
      capability: () => ({ supported: true }),
      start: () => true,
      stop() {},
      level: () => 0,
    },
    composer: { getDraft: () => '', setDraft() {} },
  });
  t.after(async () => {
    await act(async () => {
      await c.dispose();
      root.unmount();
    });
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  await c.refreshCapabilities();
  await act(async () =>
    root.render(
      <LiveVoiceTranslationProvider>
        <ConversationControls controller={c} />
        <ConversationStatusBar controller={c} />
      </LiveVoiceTranslationProvider>,
    ),
  );
  let playing;
  await act(async () => {
    playing = c.speak('Manual answer', 'turn');
    await new Promise(setImmediate);
  });
  const speech = document.querySelector('.dlv-speech-bar');
  assert.ok(speech);
  const initialStops = stops;
  await act(async () => {
    document.querySelector('.dlv-mic').click();
    await new Promise(setImmediate);
  });
  assert.equal(c.snapshot.listening, true);
  assert.equal(document.querySelector('.dlv-speech-bar'), speech);
  assert.equal(c.snapshot.speechText, 'Manual answer');
  await act(async () => {
    document.querySelector('.dlv-mic').click();
    await new Promise(setImmediate);
  });
  assert.equal(c.snapshot.conversation, false);
  assert.equal(c.snapshot.speaking, true);
  assert.equal(document.querySelector('.dlv-speech-bar'), speech);
  assert.equal(stops, initialStops);
  await act(async () => {
    finish();
    await playing;
  });
  assert.equal(document.querySelector('.dlv-speech-bar'), null);
});

for (const playback of ['automatic', 'paused', 'manual']) {
  test(
    'composer speech toggle cancels ' + playback + ' playback and hides only the speech bar',
    async (t) => {
      const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
      const previous = { window: globalThis.window, document: globalThis.document };
      Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        IS_REACT_ACT_ENVIRONMENT: true,
      });
      dom.window.HTMLCanvasElement.prototype.getContext = () => null;
      const root = createRoot(document.getElementById('root'));
      let finish;
      let stops = 0;
      let spoken = 0;
      const engine = {
        capability: () => ({ supported: true, pause: true, resume: true }),
        speak: () => {
          spoken++;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
        stop: () => {
          stops++;
          finish?.();
        },
        pause: () => true,
      };
      const c = new VoiceCoordinator({
        settings: { mode: 'headphones', segmentGapMs: 0 },
        engines: { browser: engine },
        recognition: { capability: () => ({ supported: true }), start() {}, stop() {} },
        meter: {
          capability: () => ({ supported: true }),
          start: () => true,
          stop() {},
          level: () => 0,
        },
        composer: { getDraft: () => '', setDraft() {} },
      });
      t.after(async () => {
        await act(async () => {
          await c.dispose();
          root.unmount();
        });
        dom.window.close();
        Object.assign(globalThis, previous);
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      });
      await c.startConversation();
      await act(async () =>
        root.render(
          <LiveVoiceTranslationProvider>
            <ConversationControls controller={c} />
            <ConversationStatusBar controller={c} />
          </LiveVoiceTranslationProvider>,
        ),
      );
      await act(async () => {
        if (playback === 'manual') void c.speak('First sentence. Second sentence.', 'manual');
        else c.observeMessage('stream', 'First sentence. Second sentence.\n');
        await new Promise(setImmediate);
        if (playback === 'paused') await c.pauseSpeech();
      });
      assert.ok(document.querySelector('.dlv-speech-bar'));
      assert.ok(c.snapshot.speechSegmentsRemaining > 1);
      const inputBar = document.querySelector('[aria-label="Voice controls"]');
      const toggle = document.querySelector('.dlv-composer-toggle');
      const initialStops = stops;
      assert.equal(toggle.getAttribute('aria-pressed'), 'true');
      await act(async () => {
        toggle.click();
        await new Promise(setImmediate);
      });
      assert.equal(stops, initialStops + 1);
      assert.equal(toggle.getAttribute('aria-pressed'), 'false');
      assert.equal(document.querySelector('.dlv-speech-bar'), null);
      assert.equal(document.querySelector('[aria-label="Voice controls"]'), inputBar);
      assert.equal(c.snapshot.listening, true);
      assert.equal(c.snapshot.conversation, true);
      assert.equal(c.snapshot.speechSegmentsRemaining, 0);
      await act(async () => {
        toggle.click();
        await new Promise(setImmediate);
      });
      assert.equal(toggle.getAttribute('aria-pressed'), 'true');
      assert.equal(document.querySelector('.dlv-speech-bar'), null);
      assert.equal(spoken, 1, 'enabling again does not resume cancelled playback');
    },
  );
}

test('speech bar leaves captions empty before the first segment instead of claiming Speaking', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  let state = {
    speechRunActive: true,
    speechText: null,
    speaking: false,
    paused: false,
    settings: {},
  };
  const listeners = new Set();
  const controller = {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  for (const active of [false, true]) {
    state = { ...state, speaking: active, speechLoading: active };
    await act(async () => {
      root.render(
        <LiveVoiceTranslationProvider>
          <SpeechStatusBar controller={controller} />
        </LiveVoiceTranslationProvider>,
      );
      for (const listener of listeners) listener();
    });
    assert.ok(document.querySelector('.dlv-speech-bar'));
    assert.equal(document.querySelector('.dlv-caption-line').textContent, '');
    assert.equal(document.querySelector('.dlv-caption').title, '');
    if (active)
      assert.equal(document.querySelector('[role="progressbar"]').dataset.loading, 'true');
  }
  await act(async () => {
    state = { ...state, speechText: 'First real segment', speechLoading: false };
    for (const listener of listeners) listener();
  });
  assert.equal(document.querySelector('.dlv-caption-line').textContent, 'First real segment');
});
