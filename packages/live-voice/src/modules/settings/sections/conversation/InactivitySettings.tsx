import React from 'react';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import {
  CheckboxField,
  NumberField,
  SettingsSection,
} from '../../../../shared/design-system/index.js';
export function InactivitySettings({ settings, updateSettings }: any) {
  const { scoped } = useLanguage((ctx) => ctx.settings);
  const copy = (scoped as any).autoEnd;
  return (
    <SettingsSection title={copy.title()} icon="clock" hint={copy.help()}>
      <CheckboxField
        label={copy.enabled()}
        checked={settings.autoEndEnabled !== false}
        onChange={(event) => updateSettings({ autoEndEnabled: event.target.checked })}
      />
      <NumberField
        label={copy.minutes()}
        value={settings.autoEndMinutes}
        min={0}
        step="any"
        onCommit={(raw) => {
          const minutes = Number(raw);
          if (minutes > 0)
            updateSettings({
              autoEndMinutes: minutes,
              autoEndWarningMinutes: Math.min(settings.autoEndWarningMinutes, minutes / 2),
            });
        }}
      />
      <NumberField
        label={copy.warningMinutes()}
        value={settings.autoEndWarningMinutes}
        min={0}
        max={settings.autoEndMinutes / 2}
        step="any"
        onCommit={(raw) => {
          const minutes = Number(raw);
          if (minutes > 0 && minutes <= settings.autoEndMinutes / 2)
            updateSettings({ autoEndWarningMinutes: minutes });
        }}
      />
    </SettingsSection>
  );
}
