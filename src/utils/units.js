/** Millimetres per unit. Everything converts through mm. */
export const MM_PER_UNIT = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
};

/** Labels for the unit dropdowns: value → text. */
export const UNIT_LABELS = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: 'inch',
};

/**
 * Convert a length measured in the file's own units to the display unit.
 * `display === 'file'` means "show the raw number from the file".
 */
export function convertLength(value, fileUnit, display) {
  if (display === 'file') return value;
  return (value * MM_PER_UNIT[fileUnit]) / MM_PER_UNIT[display];
}

/**
 * Format a length with a sensible number of decimals for its magnitude:
 * 1234.5 mm → "1234.5", 12.345 → "12.35", 0.01234 → "0.0123".
 */
export function formatNumber(v) {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(3);
}

export function formatLength(value, fileUnit, display) {
  const v = convertLength(value, fileUnit, display);
  const suffix = display === 'file' ? 'units' : UNIT_LABELS[display];
  return `${formatNumber(v)} ${suffix}`;
}

/** Human-readable byte size: 1536 → "1.50 KB". */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : v < 10 ? 2 : 1)} ${units[i]}`;
}

/** 12345678 → "12,345,678" */
export const formatCount = (n) => Math.round(n).toLocaleString('en-US');
