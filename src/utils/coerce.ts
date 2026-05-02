export function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

export function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map(asString).filter((s): s is string => s !== undefined);
  }
  const single = asString(v);
  return single === undefined ? [] : [single];
}

export function asDate(v: unknown): string | undefined {
  const s = asString(v);
  if (s === undefined) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
