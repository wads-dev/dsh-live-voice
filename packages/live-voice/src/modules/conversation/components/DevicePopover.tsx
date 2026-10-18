import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { ContextPopover } from '../../../shared/design-system/feedback/ContextPopover.js';
import { AudioDeviceField } from '../../settings/components/AudioDeviceField.js';

export function DevicePopover({
  kind,
  settings,
  invoke,
  children,
}: React.PropsWithChildren<{
  kind: 'audioinput' | 'audiooutput';
  settings: { inputDeviceId?: string; outputDeviceId?: string; engine?: string };
  invoke(method: string, patch: Record<string, string>): void;
  children: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}>) {
  const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const input = kind === 'audioinput';
  const label = input ? (recognition as any).microphone.device() : (speak as any).output.device();
  const key = input ? 'inputDeviceId' : 'outputDeviceId';
  return (
    <ContextPopover label={label} trigger={children}>
      <AudioDeviceField
        kind={kind}
        value={settings[key] || ''}
        onChange={(value) => invoke('updateSettings', { [key]: value })}
      />
    </ContextPopover>
  );
}
