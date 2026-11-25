import type { IdpFieldSpec } from '../idpTypes';

/** Normalises any date format to YYYY-MM-DD for Cosmos DateInput. */
export function toISODateString(raw: string): string {
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parts = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (parts) {
    const [, a, b, y] = parts;
    // second part > 12 → can only be a day → MM/DD/YYYY; otherwise DD/MM/YYYY
    const [mm, dd] = parseInt(b, 10) > 12 ? [a, b] : [b, a];
    return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const yFirst = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (yFirst) return `${yFirst[1]}-${yFirst[2].padStart(2, '0')}-${yFirst[3].padStart(2, '0')}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime()))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  return raw;
}

/** Converts ISO (YYYY-MM-DD) to the same display format as `original`. */
export function formatDateLikeOriginal(isoDate: string, original: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate;
  if (!original) return isoDate;
  const [y, m, d] = isoDate.substring(0, 10).split('-');
  if (/^\d{4}-\d{2}-\d{2}/.test(original)) return isoDate;
  const num = original.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/);
  if (num) {
    const sep = num[2];
    return parseInt(num[3], 10) > 12 ? `${m}${sep}${d}${sep}${y}` : `${d}${sep}${m}${sep}${y}`;
  }
  const yFirst = original.match(/^(\d{4})([/.])\d{1,2}\2\d{1,2}$/);
  if (yFirst) return `${y}${yFirst[2]}${m}${yFirst[2]}${d}`;
  if (/^\d{1,2}\s+[A-Za-z]/.test(original)) {
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    return `${parseInt(d, 10)} ${dt.toLocaleString('en-US', { month: 'short' })} ${y}`;
  }
  if (/^[A-Za-z]/.test(original)) {
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    return `${dt.toLocaleString('en-US', { month: 'short' })} ${parseInt(d, 10)}, ${y}`;
  }
  return isoDate;
}

/** Returns true when fmt is a date display pattern such as "DD/MM/YYYY" or "MM-DD-YYYY". */
export function isDatePattern(fmt: string): boolean {
  return /^(DD|MM|YYYY)[/.-](DD|MM|YYYY)[/.-](DD|MM|YYYY)$/i.test(fmt);
}

/** Formats an ISO date using spec.pattern (or spec.format) display pattern, or falls back to formatDateLikeOriginal. */
export function formatDateBySpec(isoDate: string, spec: IdpFieldSpec, original: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate;
  const fmt = spec.pattern ?? (isDatePattern(spec.format ?? '') ? spec.format : '') ?? '';
  if (isDatePattern(fmt)) {
    const [y, m, d] = isoDate.substring(0, 10).split('-');
    const sepMatch = fmt.match(/^(?:DD|MM|YYYY)([/.-])/i);
    const sep = sepMatch ? sepMatch[1] : '/';
    const upper = fmt.toUpperCase();
    if (upper.startsWith('DD')) return `${d}${sep}${m}${sep}${y}`;
    if (upper.startsWith('MM')) return `${m}${sep}${d}${sep}${y}`;
    return `${y}${sep}${m}${sep}${d}`;
  }
  return formatDateLikeOriginal(isoDate, original);
}

/** Converts any date string to ISO (YYYY-MM-DD) using spec.pattern (or spec.format) display pattern when available. */
export function toISOBySpec(raw: string, spec: IdpFieldSpec): string {
  if (!raw) return '';
  const fmt = spec.pattern ?? (isDatePattern(spec.format ?? '') ? spec.format : '') ?? '';
  if (isDatePattern(fmt)) {
    const sepMatch = fmt.match(/^(?:DD|MM|YYYY)([/.-])/i);
    const sep = sepMatch ? sepMatch[1] : '/';
    const parts = raw.split(sep);
    if (parts.length === 3) {
      const upper = fmt.toUpperCase();
      let y: string;
      let m: string;
      let d: string;
      if (upper.startsWith('DD')) [d, m, y] = parts;
      else if (upper.startsWith('MM')) [m, d, y] = parts;
      else [y, m, d] = parts;
      return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return toISODateString(raw);
}
