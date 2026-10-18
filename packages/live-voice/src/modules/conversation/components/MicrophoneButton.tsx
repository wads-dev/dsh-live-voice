import React from 'react';
import { IconButton } from '../../../shared/design-system/index.js';
export type MicrophoneButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  disabled?: boolean;
  'aria-pressed'?: boolean;
  onClick(): void;
};
export function MicrophoneButton(props: MicrophoneButtonProps) {
  const active = Boolean(props['aria-pressed']);
  return (
    <IconButton
      {...props}
      className="dlv-mic dlv-composer-toggle"
      data-toggle-active={String(active)}
      icon={active ? 'mic' : 'micOff'}
    />
  );
}
