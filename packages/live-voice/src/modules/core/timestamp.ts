export const timestampDefaults = {
  timestampDay: true,
  timestampMonth: true,
  timestampYear: true,
  timestampSeconds: true,
  timestampPunctuation: true,
};
export function normalizeTimestamp(value: any) {
  return Object.fromEntries(
    Object.entries(timestampDefaults).map(([key, fallback]) => [
      key,
      typeof value?.[key] === 'boolean' ? value[key] : fallback,
    ]),
  );
}
/** Fixed local-clock order preserves the legacy default; hours and minutes are mandatory. */
export function formatTimestamp(date: Date, settings: any = {}) {
  const s = { ...timestampDefaults, ...normalizeTimestamp(settings) };
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = [
    s.timestampYear ? String(date.getFullYear()) : '',
    s.timestampMonth ? pad(date.getMonth() + 1) : '',
    s.timestampDay ? pad(date.getDate()) : '',
  ]
    .filter(Boolean)
    .join(s.timestampPunctuation ? '/' : '');
  const time = [
    pad(date.getHours()),
    pad(date.getMinutes()),
    s.timestampSeconds ? pad(date.getSeconds()) : '',
  ]
    .filter(Boolean)
    .join(s.timestampPunctuation ? ':' : '');
  return '[' + (day ? day + ' ' : '') + time + ']';
}
