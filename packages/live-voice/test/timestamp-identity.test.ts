import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimestamp } from '../src/modules/core/timestamp.js';
import {
  createLocalIdentity,
  LOCAL_IDENTITY_KEY,
} from '../src/modules/settings/models/localIdentity.js';
import { createSettingsClient } from '../src/modules/settings/models/settingsStorage.js';
import { MeetingTranscript } from '../src/modules/conversation/models/meetingTranscript.js';
const storage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};
test('date parts, seconds and punctuation are independent; hours and minutes always present', () => {
  const date = new Date(2026, 10, 9, 14, 25, 36);
  assert.equal(formatTimestamp(date), '[2026/11/09 14:25:36]');
  assert.equal(formatTimestamp(date, { timestampYear: false }), '[11/09 14:25:36]');
  const timeOnly = { timestampYear: false, timestampMonth: false, timestampDay: false };
  assert.equal(formatTimestamp(date, timeOnly), '[14:25:36]');
  assert.equal(formatTimestamp(date, { ...timeOnly, timestampSeconds: false }), '[14:25]');
  assert.equal(
    formatTimestamp(date, { timestampPunctuation: false, timestampSeconds: false }),
    '[20261109 1425]',
  );
});
test('client identities stay isolated, reload locally and never enter host requests', async () => {
  const a = storage(),
    b = storage();
  const requests: any[] = [];
  const fetcher = async (_url: any, options: any) => {
    if (options.method === 'PUT') requests.push(JSON.parse(options.body));
    return Response.json({
      ok: true,
      value: { microphoneSourceName: 'Old host name', sharedSourceName: 'Old team' },
    });
  };
  const v = createSettingsClient(fetcher, a),
    l = createSettingsClient(fetcher, b);
  await Promise.all([v.ready, l.ready]);
  assert.equal(v.getSnapshot().microphoneSourceName, 'Me');
  await v.save({ microphoneSourceName: 'Vitor', alwaysShowSourceName: true });
  await l.save({ microphoneSourceName: 'Léo', sharedSourceName: 'Team' });
  assert.deepEqual(requests, []);
  await v.save({ microphoneSourceName: 'Vitor', timestampSeconds: false });
  assert.deepEqual(requests, [{ timestampSeconds: false }]);
  assert.equal(l.getSnapshot().microphoneSourceName, 'Léo');
  const reloaded = createSettingsClient(fetcher, a);
  await reloaded.ready;
  assert.equal(reloaded.getSnapshot().microphoneSourceName, 'Vitor');
  assert.equal(reloaded.getSnapshot().alwaysShowSourceName, true);
});
test('malformed local identity restores defaults; failed writes never publish success', () => {
  const s = storage();
  s.setItem(LOCAL_IDENTITY_KEY, 'bad JSON');
  assert.equal(createLocalIdentity(s).getSnapshot().microphoneSourceName, 'Me');
  const bad = createLocalIdentity({
    getItem: () => null,
    setItem: () => {
      throw Error('quota');
    },
  });
  assert.throws(() => bad.save({ microphoneSourceName: 'Lost' }));
  assert.equal(bad.getSnapshot().microphoneSourceName, 'Me');
});
test('solo microphone can include local name and compact timestamp without rewriting old blocks', () => {
  let draft = '';
  let settings: any = {
    microphoneSourceName: 'Vitor',
    alwaysShowSourceName: true,
    timestampDay: false,
    timestampMonth: false,
    timestampYear: false,
    timestampSeconds: false,
  };
  const t = new MeetingTranscript(
    {
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text;
      },
    },
    () => settings,
  );
  t.setActive('microphone', true);
  t.setSourceTimestamps('microphone', true);
  const onset = new Date(2026, 10, 9, 14, 25, 36).getTime();
  t.append('microphone', 'hello', onset);
  settings = { ...settings, microphoneSourceName: 'Léo' };
  t.append('microphone', 'again', onset, true);
  assert.equal(draft, '[14:25] Vitor: hello\n\n[14:25] Léo: again');
});
