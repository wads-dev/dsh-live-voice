import React from 'react';
import { AttendeeSettings } from '../../../conversation/components/AttendeeControls.js';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { SettingsSection } from '../../../../shared/design-system/index.js';

export function MeetingSourceSettings({
  settings,
  controller,
  updateSettings,
}: {
  settings: any;
  controller?: any;
  updateSettings(value: any): void;
}) {
  const { scoped: language } = useLanguage((ctx) => ctx.settings);
  const { scoped: meeting } = useLanguage((ctx) => ctx.meeting);
  const names = (language as any).sourceNames;
  return (
    <SettingsSection
      title={(meeting as any).title()}
      icon="meeting"
      defaultOpen={false}
      hint={names.help()}
    >
      <AttendeeSettings
        client={controller?.attendee}
        settings={settings}
        updateSettings={updateSettings}
      />
    </SettingsSection>
  );
}
