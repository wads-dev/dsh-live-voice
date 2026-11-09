import { normalizeSourceName } from '../../core/settings.js';
export const LOCAL_IDENTITY_KEY = 'dsh-live-voice.identity';
export const localIdentityDefaults = {
  microphoneSourceName: 'Me',
  sharedSourceName: 'Them',
  alwaysShowSourceName: false,
};
export const localIdentityKeys = Object.keys(localIdentityDefaults);
export function normalizeLocalIdentity(value: any) {
  return {
    microphoneSourceName: normalizeSourceName(value?.microphoneSourceName, 'Me'),
    sharedSourceName: normalizeSourceName(value?.sharedSourceName, 'Them'),
    alwaysShowSourceName: value?.alwaysShowSourceName === true,
  };
}
/** Identity is deliberately browser-local, never imported from host preferences. */
export function createLocalIdentity(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let value = { ...localIdentityDefaults };
  try {
    if (!storage && typeof window !== 'undefined') storage = window.localStorage;
    value = normalizeLocalIdentity(JSON.parse(storage?.getItem(LOCAL_IDENTITY_KEY) || '{}'));
  } catch {
    /* Restricted storage keeps safe in-memory defaults. */
  }
  return {
    getSnapshot: () => value,
    save(patch: any) {
      const next = normalizeLocalIdentity({ ...value, ...patch });
      // Do not claim persistence if quota/security prevents the write.
      if (!storage) throw Error('local-identity-storage-unavailable');
      storage.setItem(LOCAL_IDENTITY_KEY, JSON.stringify(next));
      value = next;
    },
  };
}
