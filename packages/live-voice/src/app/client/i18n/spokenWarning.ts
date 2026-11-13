import { appDictionaries, type LiveVoiceLocale } from './catalogs/index.js';
import { createFallbackTranslator } from './registerDshLocales.js';
export function warningLanguage(language: string | undefined): LiveVoiceLocale | undefined {
  const value = language?.trim().replaceAll('_', '-').toLowerCase();
  if (!value) return undefined;
  if (value === 'pt' || value.startsWith('pt-')) return 'pt-BR';
  const base = value.split('-')[0];
  return base && base in appDictionaries ? (base as LiveVoiceLocale) : undefined;
}
export function spokenInactivityWarning(
  ttsLanguage: string | undefined,
  uiLanguage: string | undefined,
  seconds: number,
) {
  const spoken = warningLanguage(ttsLanguage);
  const locale = spoken ?? warningLanguage(uiLanguage) ?? 'en';
  return {
    text: createFallbackTranslator(locale)('dsh-live-voice.settings.autoEnd.warning', { seconds }),
    lang: spoken ? ttsLanguage!.replaceAll('_', '-') : locale,
  };
}
