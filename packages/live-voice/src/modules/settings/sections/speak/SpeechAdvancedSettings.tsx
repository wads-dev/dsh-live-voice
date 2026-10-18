import React from 'react';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { defaultAgentVoiceContext } from '../../../core/settings.js';
import { QwenSettings } from '../../../core/qwen/QwenSettings.js';
import {
  CheckboxField,
  SettingsSubcard,
  TextAreaField,
} from '../../../../shared/design-system/index.js';
import { AudioDeviceField } from '../../components/AudioDeviceField.js';
export function SpeechAdvancedSettings({
  controller,
  settings,
  speaking,
  updateSettings,
  invoke,
}: any) {
  const { scoped: settingsLanguage } = useLanguage((ctx) => ctx.settings);
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  return (
    <>
      <AudioDeviceField
        kind="audiooutput"
        value={settings.outputDeviceId || ''}
        onChange={(value) => updateSettings({ outputDeviceId: value })}
      />
      {settings.engine === 'qwen-http' && (
        <SettingsSubcard title={(speak as any).qwen.connection()} icon="link">
          <QwenSettings controller={controller} />
        </SettingsSubcard>
      )}
      <SettingsSubcard title={(speak as any).agentContext.label()} icon="settings">
        <CheckboxField
          label={(speak as any).agentContext.enabled()}
          checked={settings.agentVoiceContextEnabled !== false}
          onChange={(event) => updateSettings({ agentVoiceContextEnabled: event.target.checked })}
        />
        <TextAreaField
          label={(speak as any).agentContext.label()}
          value={settings.agentVoiceContext ?? defaultAgentVoiceContext}
          disabled={settings.agentVoiceContextEnabled === false}
          onCommit={(value) => updateSettings({ agentVoiceContext: value })}
        />
        <button
          type="button"
          onClick={() => updateSettings({ agentVoiceContext: defaultAgentVoiceContext })}
        >
          {(speak as any).agentContext.restore()}
        </button>
      </SettingsSubcard>
      <p>{(speak as any).engine.playbackHelp()}</p>
      <div className="dlv-settings-actions">
        <button type="button" onClick={() => invoke('speak', (speak as any).output.testPhrase())}>
          {(speak as any).output.test()}
        </button>
        {speaking && (
          <button type="button" onClick={() => invoke('stopSpeech')}>
            {(speak as any).output.stopTest()}
          </button>
        )}
        <button type="button" onClick={() => invoke('refreshCapabilities', { localOnly: true })}>
          {(settingsLanguage as any).engine.refresh()}
        </button>
      </div>
    </>
  );
}
