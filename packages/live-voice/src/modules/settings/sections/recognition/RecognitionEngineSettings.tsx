import React from 'react';
import { TRANSCRIPTION_CONTEXT_MAX_LENGTH } from '../../../recognition/transcriptionContext.js';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { QwenSettings } from '../../../core/qwen/QwenSettings.js';
import { recognitionEngineOrder } from '../../../core/engineSelection.js';
import { BrowserModelSettings } from '../../../recognition/local/BrowserModelSettings.js';
import { WhisperSettings } from '../../../recognition/engines/whisper/WhisperSettings.js';
import {
  CheckboxField,
  SelectField,
  SettingsSubcard,
  TextAreaField,
} from '../../../../shared/design-system/index.js';
import { AudioDeviceField } from '../../components/AudioDeviceField.js';
export function RecognitionEngineSettings({
  controller,
  settings,
  capabilities = {},
  updateSettings,
}: any) {
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const { scoped: recognition } = useLanguage((ctx) => ctx.recognition);
  const engine = settings.recognitionEngine || 'browser';
  const setEngine = (next: string) =>
    updateSettings(
      next === 'browser' && settings.recognitionLang === 'auto'
        ? { recognitionEngine: next, recognitionLang: 'pt-BR' }
        : { recognitionEngine: next },
    );
  return (
    <>
      <SelectField
        label={(recognition as any).engine.label()}
        value={engine}
        options={recognitionEngineOrder.map((value) => ({
          value,
          label: {
            browser: (recognition as any).browser.label(),
            'qwen-http': (recognition as any).qwen.label(),
            'whisper-http': (recognition as any).whisper.label(),
            'whisper-browser': (recognition as any).local.whisperLabel(),
            'qwen-browser': (recognition as any).local.qwenLabel(),
          }[value],
        }))}
        onChange={(event) => setEngine(event.target.value)}
      />
      <AudioDeviceField
        kind="audioinput"
        value={settings.inputDeviceId || ''}
        onChange={(value) => updateSettings({ inputDeviceId: value })}
      />
      <SelectField
        label={(recognition as any).language.label()}
        value={settings.recognitionLang || (engine === 'browser' ? 'pt-BR' : 'auto')}
        options={[
          ...(engine === 'browser'
            ? []
            : [{ value: 'auto', label: (recognition as any).language.automatic() }]),
          { value: 'pt-BR', label: 'Português (Brasil)' },
          { value: 'en-US', label: 'English (US)' },
          { value: 'zh-CN', label: (recognition as any).language.options.chinese() },
          { value: 'es-ES', label: (recognition as any).language.options.spanish() },
          { value: 'fr-FR', label: (recognition as any).language.options.french() },
        ]}
        onChange={(event) => updateSettings({ recognitionLang: event.target.value })}
      />
      {engine === 'browser' && (
        <>
          <p>{(recognition as any).browser.help()}</p>
          <CheckboxField
            label={(recognition as any).browser.localProcessing()}
            checked={settings.recognitionProcessLocally !== false}
            onChange={(event) =>
              updateSettings({ recognitionProcessLocally: event.target.checked })
            }
          />
          {settings.recognitionProcessLocally !== false ? (
            <CheckboxField
              label={(recognition as any).browser.autoInstallPack()}
              checked={settings.recognitionAutoInstall !== false}
              onChange={(event) => updateSettings({ recognitionAutoInstall: event.target.checked })}
            />
          ) : (
            <p role="status">{(recognition as any).browser.remoteServiceWarning()}</p>
          )}
        </>
      )}
      {['whisper-browser', 'qwen-browser'].includes(engine) && (
        <BrowserModelSettings
          controller={controller}
          settings={settings}
          updateSettings={updateSettings}
        />
      )}
      {['whisper-http', 'qwen-http'].includes(engine) && (
        <SettingsSubcard title={(commons as any).connection.title()} icon="link">
          {engine === 'whisper-http' ? (
            <WhisperSettings controller={controller} />
          ) : (
            settings.engine !== 'qwen-http' && <QwenSettings controller={controller} />
          )}
          <TextAreaField
            label={(recognition as any).context.label()}
            hint={(recognition as any).context.hint()}
            placeholder={(recognition as any).context.placeholder()}
            value={settings.recognitionContext || ''}
            rows={3}
            maxLength={TRANSCRIPTION_CONTEXT_MAX_LENGTH}
            onCommit={(recognitionContext) => updateSettings({ recognitionContext })}
          />
        </SettingsSubcard>
      )}
    </>
  );
}
