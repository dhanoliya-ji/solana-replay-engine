export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function shortAddress(value: string | null | undefined, lead = 4, tail = 4) {
  if (!value) return 'Unknown';
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function formatInteger(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value >= 0 ? '+' : ''}${formatNumber(value, digits)}%`;
}

export function formatSol(value: number | null | undefined, digits = 3) {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value >= 0 ? '+' : ''}${formatNumber(value, digits)} SOL`;
}

export function formatTimestamp(value: number | null | undefined) {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}

export function toSol(value: string | number | null | undefined) {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 1e9;
}

export function toTokenUnits(value: string | number | null | undefined) {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function safeNumber(value: string | number | null | undefined) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
