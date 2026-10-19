import React from 'react';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { SettingsCard, SettingsSection } from '../../../../shared/design-system/index.js';
import { RecognitionEngineSettings } from './RecognitionEngineSettings.js';
import { RecognitionFilterSettings } from './RecognitionFilterSettings.js';
import { SilenceDetectionSettings } from './SilenceDetectionSettings.js';
import { VoiceCommandSettings } from './VoiceCommandSettings.js';
import { RecognitionStatus } from './RecognitionStatus.js';
import { RecordingSettings } from './RecordingSettings.js';
export function RecognitionSettingsSection(props: any) {
  const { scoped: settingsLanguage } = useLanguage((ctx) => ctx.settings);
  return (
    <SettingsCard>
      <div className="dlv-settings-card-body">
        <RecognitionStatus {...props} />
        <SettingsSection title={(settingsLanguage as any).layout.transcription()} icon="mic">
          <RecognitionEngineSettings {...props} />
        </SettingsSection>
        <VoiceCommandSettings {...props} />
        <SilenceDetectionSettings {...props} />
        <RecordingSettings {...props} />
        <RecognitionFilterSettings {...props} />
      </div>
    </SettingsCard>
  );
}
