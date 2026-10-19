import { defaultQwenVoice } from '../../core/settings.js';

/** Settings policy for the local voices exposed by BrowserSpeakingEngine. */
export interface BrowserVoice {
  readonly name: string;
  readonly voiceURI?: string;
  readonly lang?: string;
}

function baseLanguage(language: string | undefined): string {
  return (language ?? '').trim().replace(/_/g, '-').split('-')[0].toLowerCase();
}

export function isNaturalVoice(voice: BrowserVoice): boolean {
  return /\bnatural\b/i.test(voice.name);
}

/** Natural label, browser language family, then name. Never mutates discovery data. */
export function rankBrowserVoices<T extends BrowserVoice>(
  voices: readonly T[],
  browserLanguage?: string,
): T[] {
  const language = baseLanguage(browserLanguage);
  const matches = (voice: BrowserVoice) =>
    Boolean(language) && baseLanguage(voice.lang) === language;
  return [...voices].sort(
    (a, b) =>
      Number(isNaturalVoice(b)) - Number(isNaturalVoice(a)) ||
      Number(matches(b)) - Number(matches(a)) ||
      a.name.localeCompare(b.name),
  );
}

/** Language sections prioritize the browser language; voices retain Natural/name ranking. */
export function groupBrowserVoices<T extends BrowserVoice>(
  voices: readonly T[],
  browserLanguage?: string,
): { language: string; voices: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const voice of rankBrowserVoices(voices, browserLanguage)) {
    const language = baseLanguage(voice.lang);
    const group = groups.get(language) ?? [];
    group.push(voice);
    groups.set(language, group);
  }
  const preferredLanguage = baseLanguage(browserLanguage);
  return [...groups]
    .map(([language, voices]) => ({ language, voices }))
    .sort(
      (a, b) =>
        Number(Boolean(preferredLanguage) && b.language === preferredLanguage) -
          Number(Boolean(preferredLanguage) && a.language === preferredLanguage) ||
        Number(!a.language) - Number(!b.language) ||
        a.language.localeCompare(b.language),
    );
}

export function preferredBrowserVoice(
  voices: readonly BrowserVoice[],
  browserLanguage?: string,
): string | undefined {
  const voice = rankBrowserVoices(voices, browserLanguage).find(isNaturalVoice);
  return voice ? voice.voiceURI || voice.name : undefined;
}

/** Only an explicit engine transition may select a default; renders/discovery cannot. */
export function speechEngineSelectionPatch(
  currentEngine: string,
  nextEngine: string,
  voices: readonly BrowserVoice[],
  browserLanguage?: string,
): { engine: string; voice?: string } {
  if (nextEngine !== currentEngine) {
    if (nextEngine === 'chatterbox-http') return { engine: nextEngine, voice: '' };
    if (currentEngine === 'chatterbox-http')
      return {
        engine: nextEngine,
        voice:
          nextEngine === 'qwen-http'
            ? defaultQwenVoice
            : nextEngine === 'browser'
              ? (preferredBrowserVoice(voices, browserLanguage) ?? '')
              : '',
      };
  }
  const voice =
    nextEngine === 'browser' && currentEngine !== 'browser'
      ? preferredBrowserVoice(voices, browserLanguage)
      : undefined;
  return { engine: nextEngine, ...(voice === undefined ? {} : { voice }) };
}
