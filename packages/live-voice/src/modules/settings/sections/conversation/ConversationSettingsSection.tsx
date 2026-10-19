import React from 'react';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { SettingsCard, SettingsSection } from '../../../../shared/design-system/index.js';
import { DeliverySettings } from './DeliverySettings.js';
import { MeetingSourceSettings } from './MeetingSourceSettings.js';
import { ShortcutSettings } from './ShortcutSettings.js';
import { VoiceModeSettings } from './VoiceModeSettings.js';
import { ConversationDelaySettings } from './ConversationDelaySettings.js';
import { PlaybackPolicySettings } from '../speak/PlaybackPolicySettings.js';
export function ConversationSettingsSection(props: {
  settings: any;
  controller?: any;
  updateSettings(value: any): void;
}) {
  const { scoped: settingsLanguage } = useLanguage((ctx) => ctx.settings);
  const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
  return (
    <SettingsCard>
      <div className="dlv-settings-card-body">
        <SettingsSection title={(settingsLanguage as any).layout.delivery()} icon="send">
          <DeliverySettings {...props} />
        </SettingsSection>
        <SettingsSection title={(settingsLanguage as any).layout.listening()} icon="headphones">
          <VoiceModeSettings {...props} />
          <PlaybackPolicySettings {...props} />
          <ConversationDelaySettings {...props} />
        </SettingsSection>
        <MeetingSourceSettings {...props} />
        <SettingsSection
          title={(settingsLanguage as any).layout.shortcut()}
          icon="keyboard"
          hint={
            <>
              {(settingsLanguage as any).shortcuts.help()}
              <br />
              <br />
              {(recognition as any).holdToTalk.help()}
            </>
          }
        >
          <ShortcutSettings {...props} />
        </SettingsSection>
      </div>
    </SettingsCard>
  );
}
