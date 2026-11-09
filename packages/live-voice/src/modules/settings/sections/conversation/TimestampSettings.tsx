import React from 'react';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { CheckboxField, SettingsSection } from '../../../../shared/design-system/index.js';
import { DraftField } from '../../../../shared/design-system/forms/DraftField.js';
import { formatTimestamp } from '../../../core/timestamp.js';
export function TimestampSettings({ settings, updateSettings }: any) {
  const { scoped } = useLanguage((ctx) => ctx.settings);
  const copy = (scoped as any).timestamp;
  return (
    <SettingsSection title={copy.title()} icon="clock" hint={copy.help()}>
      {['Day', 'Month', 'Year', 'Seconds', 'Punctuation'].map((part) => {
        const key = 'timestamp' + part;
        return (
          <CheckboxField
            key={key}
            label={copy[part.toLowerCase()]()}
            checked={settings[key] !== false}
            onChange={(event) => updateSettings({ [key]: event.target.checked })}
          />
        );
      })}
      <output aria-label={copy.preview()}>
        {formatTimestamp(new Date(2026, 10, 9, 14, 25, 36), settings)}
      </output>
      <CheckboxField
        label={copy.alwaysName()}
        checked={settings.alwaysShowSourceName === true}
        onChange={(event) => updateSettings({ alwaysShowSourceName: event.target.checked })}
      />
      <DraftField
        label={(scoped as any).sourceNames.microphone()}
        value={settings.microphoneSourceName}
        maxLength={80}
        onCommit={(microphoneSourceName) => updateSettings({ microphoneSourceName })}
      />
      <DraftField
        label={(scoped as any).sourceNames.shared()}
        value={settings.sharedSourceName}
        maxLength={80}
        onCommit={(sharedSourceName) => updateSettings({ sharedSourceName })}
      />
    </SettingsSection>
  );
}
