import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { ErrorMessage } from '../../../shared/design-system/index.js';
import { useConversationActions, useConversationController } from '../hooks/index.js';
import { MicrophoneButton } from './MicrophoneButton.js';
import { microphoneAction } from '../models/microphoneAction.js';
import { AutoPlaybackToggle } from './AutoPlaybackToggle.js';
import { DevicePopover } from './DevicePopover.js';

export type ConversationControlsProps = { controller: any };
export function ConversationControls({ controller }: ConversationControlsProps) {
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const state = useConversationController<any>(controller);
  const { invoke, error, clearError } = useConversationActions(controller);
  const busy = state.conversation || state.listening || state.starting || state.recognizing;

  // Starting is the explicit operational check; stale health must not block a retry.
  const label = busy ? (commons as any).conversation.end() : (commons as any).conversation.start();
  return (
    <>
      <AutoPlaybackToggle state={state} invoke={invoke} error={error} />
      <DevicePopover kind="audioinput" settings={state.settings} invoke={invoke}>
        <MicrophoneButton
          label={label}
          aria-pressed={Boolean(busy)}
          onClick={() => invoke(microphoneAction(state))}
        />
      </DevicePopover>
      <ErrorMessage
        error={error}
        dismissLabel={(commons as any).dismissError()}
        dismissText={(commons as any).dismiss()}
        onDismiss={clearError}
      />
    </>
  );
}
