import React from 'react';
import { ChatterboxVoiceSettings } from '../../../speak/chatterbox/ChatterboxVoiceSettings.js';
import {
  preferredBrowserVoice,
  groupBrowserVoices,
  speechEngineSelectionPatch,
  type BrowserVoice,
} from '../../models/browserVoiceSelection.js';
import { useLanguage } from '../../../../app/client/i18n/index.js';
import { qwenVoices } from '../../../core/settings.js';
import { speakingEngineOrder } from '../../../core/engineSelection.js';
import { NumberField, SelectField, TextField } from '../../../../shared/design-system/index.js';
export function SpeechEngineSettings({
  settings,
  capabilities,
  updateSettings,
  hostPlatform,
}: any) {
  const locale = typeof window === 'undefined' ? '' : window.navigator.language;
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const engine = settings.engine || 'browser';
  const browserVoices: readonly BrowserVoice[] = capabilities?.browser?.voices || [];
  const capability = capabilities?.[engine];

  const defaultBrowserVoice = preferredBrowserVoice(browserVoices, locale);
  const sortedBrowserOptions = groupBrowserVoices(browserVoices, locale).map((group) => ({
    label: group.language || (commons as any).unknownLanguage(),
    options: group.voices.map((voice) => ({
      value: voice.voiceURI || voice.name,
      label:
        (voice.voiceURI || voice.name) === defaultBrowserVoice
          ? voice.name + ' (' + (speak as any).browser.defaultVoice() + ')'
          : voice.name,
    })),
  }));

  return (
    <>
      <SelectField
        label={(speak as any).engine.label()}
        value={engine}
        options={speakingEngineOrder(hostPlatform).map((value) => ({
          value,
          label: {
            say: (speak as any).macos.label(),
            browser: (speak as any).browser.label(),
            'qwen-http': (speak as any).qwen.label(),
            'chatterbox-http': (speak as any).chatterbox.label(),
          }[value],
        }))}
        onChange={(event) => {
          updateSettings(
            speechEngineSelectionPatch(engine, event.target.value, browserVoices, locale),
          );
        }}
      />
      {engine === 'browser' && (
        <SelectField
          label={(speak as any).browser.voice()}
          value={settings.voice || ''}
          options={[
            { value: '', label: (commons as any).systemDefault() },
            ...sortedBrowserOptions,
          ]}
          onChange={(event) => updateSettings({ voice: event.target.value })}
        />
      )}
      {engine === 'say' && (
        <>
          <TextField
            label={(speak as any).macos.voice()}
            value={settings.voice || ''}
            placeholder={(commons as any).systemDefault()}
            onCommit={(value) => updateSettings({ voice: value.trim() })}
          />
          <p className="dlv-setting-description">{(speak as any).macos.voiceHelp()}</p>
        </>
      )}
      {engine === 'qwen-http' && (
        <SelectField
          label={(speak as any).qwen.voice()}
          value={settings.voice || qwenVoices[0].value}
          options={qwenVoices}
          onChange={(event) => updateSettings({ voice: event.target.value })}
        />
      )}
      {engine === 'chatterbox-http' && (
        <ChatterboxVoiceSettings settings={settings} updateSettings={updateSettings} />
      )}
      <label>
        {(speak as any).volume.label()} ({Math.round((settings.volume ?? 1) * 100)}%)
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.volume ?? 1}
          aria-label={(speak as any).volume.label()}
          onInput={(event) => updateSettings({ volume: Number(event.currentTarget.value) })}
        />
      </label>
      <p className="dlv-setting-description">{(speak as any).volume.help()}</p>
      <div className="dlv-field-pair">
        <NumberField
          label={(speak as any).rate.label() + ' (×)'}
          min={0.1}
          max={3}
          step={0.1}
          value={settings.rate ?? 1}
          onCommit={(value) => updateSettings({ rate: Number(value) })}
        />
        <NumberField
          label={(speak as any).segmentGap.label() + ' (ms)'}
          min={0}
          max={2000}
          step={50}
          value={settings.segmentGapMs ?? 400}
          onCommit={(value) => updateSettings({ segmentGapMs: Number(value) })}
        />
      </div>
      {capability?.supported === false && (
        <p role="status">{capability.reason || (commons as any).engine.failure()}</p>
      )}
    </>
  );
}
