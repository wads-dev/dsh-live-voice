import React from 'react';
import { useLanguage } from '../../../app/client/i18n/index.js';
import { Hint, SelectField } from '../../../shared/design-system/index.js';

/** Catalog discovery only: never probes model health or starts synthesis on Settings mount. */
export function ChatterboxVoiceSettings({ settings, updateSettings }: any) {
  const { scoped: speak } = useLanguage((ctx) => ctx.speak);
  const { scoped: commons } = useLanguage((ctx) => ctx.commons);
  const [revision, refresh] = React.useReducer((n) => n + 1, 0);
  const [voices, setVoices] = React.useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  React.useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void fetch('/api/dsh-live-voice/chatterbox/voices', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.value))
          throw new Error('Invalid catalog');
        if (!controller.signal.aborted) {
          setVoices(result.value);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [revision]);
  const copy = (speak as any).chatterbox;
  return (
    <>
      <div className="dlv-setting-row">
        <span>{copy.label()}</span>
        <Hint label={copy.label()}>{copy.help()}</Hint>
      </div>
      <SelectField
        label={copy.voice()}
        value={settings.voice || ''}
        options={[
          { value: '', label: (commons as any).systemDefault() },
          ...(settings.voice && !voices.some((v) => v.id === settings.voice)
            ? [{ value: settings.voice, label: copy.missingVoice() }]
            : []),
          ...voices.map((v) => ({ value: v.id, label: v.name })),
        ]}
        onChange={(event) => updateSettings({ voice: event.target.value })}
      />
      <button type="button" disabled={status === 'loading'} onClick={() => refresh()}>
        {copy.refresh()}
      </button>
      {status === 'loading' && <p role="status">{copy.loading()}</p>}
      {status === 'error' && <p role="alert">{copy.unavailable()}</p>}
      {status === 'ready' && voices.length === 0 && <p role="status">{copy.empty()}</p>}
    </>
  );
}
