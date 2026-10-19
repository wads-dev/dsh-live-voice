/** Decimal SI units, capped at TB. Formatting follows the DSH UI locale, never STT/TTS. */
export function formatBytes(bytes: number, locale = 'en'): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  // Promote when rounding would otherwise display 1000 KB/MB/GB.
  if (Math.round(value * 10) / 10 >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return (
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false }).format(value) +
    ' ' +
    units[unit]
  );
}
