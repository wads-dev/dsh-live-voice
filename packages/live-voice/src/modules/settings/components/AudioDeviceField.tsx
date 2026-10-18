import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { SelectField } from '../../../shared/design-system/index.js';
import { createDeviceOptions, useAudioDevices } from '../hooks/useAudioDevices.js';

/** The same persisted device preference in Settings and composer quick controls. */
export function AudioDeviceField({
  kind,
  value,
  onChange,
  autoFocus = false,
}: {
  kind: 'audioinput' | 'audiooutput';
  value: string;
  onChange(value: string): void;
  autoFocus?: boolean;
}) {
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const devices = useAudioDevices();
  const input = kind === 'audioinput';
  const label = input ? (recognition as any).microphone.device() : (speak as any).output.device();
  const options = createDeviceOptions(
    devices,
    kind,
    (commons as any).systemDefault(),
    input ? label : (speak as any).output.fallbackName(),
  );
  // Do not display a saved, temporarily disconnected device as the system default.
  if (value && !options.some((option) => option.value === value)) {
    options.push({ value, label: value });
  }
  return (
    <SelectField
      label={label}
      value={value}
      options={options}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
