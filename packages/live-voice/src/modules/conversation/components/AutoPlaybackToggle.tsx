import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { IconButton } from '../../../shared/design-system/index.js';
import { DevicePopover } from './DevicePopover.js';
export function AutoPlaybackToggle({ state, invoke, error }: any) {
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
  const active = state.settings.announceAssistantMessages !== false;
  const headphones = state.settings.mode === 'headphones';
  const modeLabel = !active
    ? (commons as any).off()
    : headphones
      ? (recognition as any).headphoneMode.label()
      : (recognition as any).speakerMode.label();
  const nextLabel = !active
    ? (recognition as any).speakerMode.label()
    : headphones
      ? (commons as any).off()
      : (recognition as any).headphoneMode.label();
  const nextSettings = !active
    ? { announceAssistantMessages: true, mode: 'speaker' }
    : headphones
      ? { announceAssistantMessages: false }
      : { announceAssistantMessages: true, mode: 'headphones' };
  const count = state.speechSegmentsRemaining || 0;
  const title =
    count > 0
      ? (speak as any).autoPlayback[count === 1 ? 'remainingOne' : 'remainingOther']({
          state: modeLabel,
          count,
        })
      : (speak as any).autoPlayback.status({
          state: modeLabel,
        });
  return (
    <DevicePopover kind="audiooutput" settings={state.settings} invoke={invoke}>
      <IconButton
        className="dlv-composer-toggle"
        aria-pressed={active}
        data-toggle-active={String(active)}
        label={title}
        title={error || title + ' — ' + (speak as any).autoPlayback.nextMode({ mode: nextLabel })}
        icon={!active ? 'speakerOff' : headphones ? 'headphones' : 'speaker'}
        data-audio-mode={!active ? 'off' : headphones ? 'headphones' : 'speaker'}
        onClick={() => invoke('updateSettings', nextSettings)}
      />
    </DevicePopover>
  );
}
