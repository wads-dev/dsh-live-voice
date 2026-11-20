import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceInactivity } from '../src/modules/conversation/models/inactivity.js';
import { normalizeSettings } from '../src/modules/core/settings.js';
function fixture() {
  let now = 1000,
    ended = 0;
  const warnings: number[] = [];
  const clock = new VoiceInactivity({
    now: () => now,
    warn: (seconds) => {
      warnings.push(seconds);
      return 'Voice capture ends soon please continue listening';
    },
    end: () => {
      ended++;
    },
  });
  const settings = normalizeSettings({});
  const tick = (seconds = 0, busy = false, active = true, generating = false) => {
    // Simulate an awake event loop rather than suspension.
    for (let i = 0; i < seconds; i++) {
      now += 1000;
      clock.tick(active, busy, settings, generating);
    }
    if (!seconds) clock.tick(active, busy, settings, generating);
  };
  tick();
  return {
    clock,
    settings,
    tick,
    warnings,
    jump: (ms: number) => {
      now += ms;
    },
    ended: () => ended,
  };
}
test('defaults, fractional minutes, 50% maximum and no absolute warning cap', () => {
  assert.equal(normalizeSettings({}).autoEndEnabled, true);
  assert.equal(normalizeSettings({}).autoEndPauseWhileResponding, true);
  assert.equal(normalizeSettings({ autoEndPauseWhileResponding: false }).autoEndPauseWhileResponding, false);
  assert.equal(normalizeSettings({}).autoEndMinutes, 5);
  assert.equal(normalizeSettings({}).autoEndWarningMinutes, 1);
  assert.equal(
    normalizeSettings({ autoEndMinutes: 5, autoEndWarningMinutes: 4 }).autoEndWarningMinutes,
    2.5,
  );
  assert.equal(
    normalizeSettings({ autoEndMinutes: 60, autoEndWarningMinutes: 25 }).autoEndWarningMinutes,
    25,
  );
  for (const value of [0, -1, NaN, Infinity, '5'])
    assert.equal(normalizeSettings({ autoEndMinutes: value }).autoEndMinutes, 5);
});
test('one warning at four minutes then full ending at five', () => {
  const f = fixture();
  f.tick(239);
  assert.equal(f.warnings.length, 0);
  f.tick(1);
  assert.deepEqual(f.warnings, [60]);
  f.tick(59);
  assert.equal(f.ended(), 0);
  f.tick(1);
  assert.equal(f.ended(), 1);
  assert.equal(f.clock.getSnapshot().phase, 'ended');
});
test('nonempty recognition from any source and explicit continue reset the global clock', () => {
  const f = fixture();
  f.tick(240);
  f.clock.recognized('hello');
  f.tick(239);
  assert.equal(f.warnings.length, 1);
  f.tick(1);
  f.clock.keepAlive();
  f.tick(239);
  assert.equal(f.ended(), 0);
});
test('empty results and matching warning echo do not keep capture alive', () => {
  const f = fixture();
  f.tick(240);
  assert.equal(f.clock.recognized('Voice capture ends soon please continue listening'), false);
  f.clock.recognized('  ');
  f.tick(60);
  assert.equal(f.ended(), 1);
});
test('assistant generation pauses and resumes the whole inactivity countdown', () => {
  const f = fixture();
  f.tick(239);
  f.tick(30, false, true, true);
  // The assistant is still generating; no warning is shown and elapsed time is frozen.
  for (let i = 0; i < 180; i++) {
    f.jump(1000);
    f.clock.tick(true, false, f.settings, true);
  }
  assert.equal(f.warnings.length, 0);
  f.tick(1);
  assert.deepEqual(f.warnings, [60]);
  f.tick(59);
  assert.equal(f.ended(), 0);
  f.tick(1);
  assert.equal(f.ended(), 1);
});
test('recognized text during generation resets inactivity from response completion', () => {
  const f = fixture();
  f.tick(239);
  for (let i = 0; i < 180; i++) {
    f.jump(1000);
    f.clock.tick(true, false, f.settings, true);
  }
  f.clock.recognized('I heard you');
  f.tick(180, false, true);
  assert.equal(f.ended(), 0);
  assert.equal(f.warnings.length, 0);
});
test('disabling generation pause leaves automatic ending unchanged', () => {
  const f = fixture();
  f.settings.autoEndPauseWhileResponding = false;
  f.tick(300, false, true);
  assert.equal(f.ended(), 1);
});
test('generation beginning during a warning preserves its remaining countdown', () => {
  const f = fixture();
  f.tick(240);
  assert.deepEqual(f.warnings, [60]);
  for (let i = 0; i < 120; i++) {
    f.jump(1000);
    f.clock.tick(true, false, f.settings, true);
  }
  f.tick(30);
  assert.equal(f.ended(), 0);
  assert.equal(f.clock.getSnapshot().remaining, 30);
});
test('recognition at the deadline gets bounded grace', () => {
  const f = fixture();
  f.tick(299);
  f.tick(30, true);
  assert.equal(f.ended(), 0);
  f.tick(1, true);
  assert.equal(f.ended(), 1);
});
test('pending recognition completing with text cancels ending', () => {
  const f = fixture();
  f.tick(299);
  f.tick(10, true);
  f.clock.recognized('I came back');
  f.tick(100);
  assert.equal(f.ended(), 0);
  assert.equal(f.clock.getSnapshot().phase, 'idle');
});
test('suspension gives a fresh warning window rather than immediate shutdown', () => {
  const f = fixture();
  f.jump(7200000);
  f.tick();
  assert.deepEqual(f.warnings, [60]);
  f.tick(59);
  assert.equal(f.ended(), 0);
  f.tick(1);
  assert.equal(f.ended(), 1);
});
test('disable and explicit stop clear warnings without automatic ending', () => {
  const f = fixture();
  f.tick(240);
  f.settings.autoEndEnabled = false;
  f.tick(60);
  assert.equal(f.ended(), 0);
  assert.equal(f.clock.getSnapshot().phase, 'idle');
  f.settings.autoEndEnabled = true;
  f.tick(240);
  f.tick(1, false, false);
  assert.equal(f.clock.getSnapshot().phase, 'idle');
});
