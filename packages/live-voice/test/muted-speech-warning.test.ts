// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceCoordinator } from '../src/modules/core/coordinator.js';
function fixture(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const c = new VoiceCoordinator({
    recognition: { stop: async () => {}, activityManaged: true },
    meter: { stop: async () => {} },
    engines: {},
    composer: { getDraft: () => '', setDraft: () => assert.fail('muted draft') },
    settings: { mode: 'headphones' },
  });
  c.patch({ listening: true, muted: true });
  t.after(() => c.dispose());
  return c;
}
test('four seconds of detected speech warns before any transcript or chunk arrives', (t) => {
  const c = fixture(t);
  c.patch({ inputSpeechActive: true, recognizing: true });
  t.mock.timers.tick(3999);
  assert.equal(c.snapshot.mutedSpeechWarning, false);
  t.mock.timers.tick(1);
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  c.patch({ inputSpeechActive: false, recognizing: false, pendingTranscriptionRequests: 1 });
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  t.mock.timers.tick(2999);
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  t.mock.timers.tick(1);
  assert.equal(c.snapshot.mutedSpeechWarning, false);
});
test('speech resuming during hide debounce keeps warning and restarts the silence deadline', (t) => {
  const c = fixture(t);
  c.patch({ inputSpeechActive: true });
  t.mock.timers.tick(4000);
  c.patch({ inputSpeechActive: false });
  t.mock.timers.tick(2000);
  c.patch({ inputSpeechActive: true });
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  t.mock.timers.tick(5000);
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  c.patch({ inputSpeechActive: false });
  t.mock.timers.tick(2999);
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  t.mock.timers.tick(1);
  assert.equal(c.snapshot.mutedSpeechWarning, false);
});
test('chunk results never reset a continuous detected-speech interval', (t) => {
  const c = fixture(t);
  c.patch({ inputSpeechActive: true, recognizing: true });
  t.mock.timers.tick(2000);
  c.onResult({ final: 'a chunk' });
  t.mock.timers.tick(2000);
  assert.equal(c.snapshot.mutedSpeechWarning, true);
  c.onResult({ final: 'another chunk' });
  assert.equal(c.snapshot.mutedSpeechWarning, true);
});
test('silence resets continuous duration; pending requests and long text cannot trigger warning', (t) => {
  const c = fixture(t);
  c.patch({ inputSpeechActive: true });
  t.mock.timers.tick(3000);
  c.patch({ inputSpeechActive: false, pendingTranscriptionRequests: 1 });
  c.onResult({ final: 'long text '.repeat(100) });
  t.mock.timers.tick(20000);
  assert.equal(c.snapshot.mutedSpeechWarning, false);
  c.patch({ inputSpeechActive: true });
  t.mock.timers.tick(3999);
  assert.equal(c.snapshot.mutedSpeechWarning, false);
  t.mock.timers.tick(1);
  assert.equal(c.snapshot.mutedSpeechWarning, true);
});
test('unmute, stop and navigation clear immediately', (t) => {
  const c = fixture(t);
  for (const patch of [{ muted: false }, { listening: false }, { navigation: true }]) {
    c.navigationPaused = false;
    c.patch({ muted: true, listening: true, inputSpeechActive: true });
    t.mock.timers.tick(4000);
    assert.equal(c.snapshot.mutedSpeechWarning, true);
    if (patch.navigation) c.navigationPaused = true;
    c.patch(patch.navigation ? {} : patch);
    assert.equal(c.snapshot.mutedSpeechWarning, false);
  }
});
