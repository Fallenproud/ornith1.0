/**
 * ULTIMATE ORNITH 1.0 — Norwegian Locale & Internationalization Engine
 */

export const DEFAULT_LOCALE = 'nb-NO';

export function formatDateTime(isoString: string, locale: string = DEFAULT_LOCALE): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string, locale: string = DEFAULT_LOCALE): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatNumber(num: number, decimals: number = 2, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(num: number, decimals: number = 1, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
