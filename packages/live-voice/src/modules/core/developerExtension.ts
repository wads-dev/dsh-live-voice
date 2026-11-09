import type { ComponentType } from 'react';
export const DEVELOPER_KEY = Symbol.for('dsh-live-voice.developer.v1');
export const DEVELOPER_CHANGED = 'dsh-live-voice:developer-changed';
export interface DeveloperExtension {
  version: 1;
  label(): string;
  component: ComponentType;
  /** Optional direct user-gesture launcher. False means popup could not open. */
  open?(request?: { recordingId?: string }): boolean;
}
export function readDeveloperExtension(target: any = globalThis.window): DeveloperExtension | null {
  const extension = target?.[DEVELOPER_KEY];
  return extension?.version === 1 ? extension : null;
}
export function subscribeDeveloperExtension(listener: () => void, target: any = globalThis.window) {
  target?.addEventListener(DEVELOPER_CHANGED, listener);
  return () => target?.removeEventListener(DEVELOPER_CHANGED, listener);
}
export function publishDeveloperExtension(target: any, extension: DeveloperExtension) {
  const ChangedEvent = target.Event ?? Event;
  target[DEVELOPER_KEY] = extension;
  target.dispatchEvent(new ChangedEvent(DEVELOPER_CHANGED));
  return () => {
    if (target[DEVELOPER_KEY] !== extension) return;
    delete target[DEVELOPER_KEY];
    target.dispatchEvent(new ChangedEvent(DEVELOPER_CHANGED));
  };
}
