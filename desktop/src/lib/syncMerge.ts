/**
 * Pure merge rules for optional cloud sync. Every synced localStorage key is merged three ways:
 * what this device holds now (local), what the cloud holds (remote), and what the two agreed on at
 * the last sync (base). Having a base lets deletions travel without tombstones.
 */
export type SyncKind = 'items' | 'value' | 'max';
export interface SyncKeySpec { kind: SyncKind; sortBy?: string; limit?: number }

const P = 'study-with-sarang:';
/** Device-only state (theme, running timer, voice on/off, shortcuts) is deliberately left out. */
export const SYNC_KEYS: Record<string, SyncKeySpec> = {
  [`${P}mixes`]: { kind: 'items' },
  [`${P}sessions`]: { kind: 'items', sortBy: 'startedAt', limit: 5000 },
  [`${P}video-playlist`]: { kind: 'items', limit: 30 },
  [`${P}timer-settings`]: { kind: 'value' },
  [`${P}listening`]: { kind: 'max' },
  [`${P}macros`]: { kind: 'items', limit: 30 },
  [`${P}automations`]: { kind: 'items', limit: 30 },
  [`${P}subjects`]: { kind: 'value' },
  [`${P}todos`]: { kind: 'items', limit: 200 },
};

type Item = Record<string, unknown> & { id: string };
const parse = (text: string | null): unknown => { if (text === null) return undefined; try { return JSON.parse(text); } catch { return undefined; } };
const asItems = (text: string | null): Item[] => {
  const value = parse(text);
  return Array.isArray(value) ? value.filter((item): item is Item => Boolean(item) && typeof item === 'object' && typeof (item as Item).id === 'string') : [];
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const stamp = (item: Item) => { const raw = item.updatedAt ?? item.createdAt ?? item.startedAt; const time = typeof raw === 'string' ? Date.parse(raw) : Number(raw); return Number.isFinite(time) ? time : 0; };

export interface MergeInput { base: string | null; local: string | null; remote: string | null; localMod: number; remoteMod: number }

function mergeItems(spec: SyncKeySpec, { base, local, remote }: MergeInput): string {
  const b = new Map(asItems(base).map((item) => [item.id, item]));
  const l = new Map(asItems(local).map((item) => [item.id, item]));
  const r = new Map(asItems(remote).map((item) => [item.id, item]));
  const order = [...l.keys(), ...[...r.keys()].filter((id) => !l.has(id))];
  const out: Item[] = [];
  for (const id of order) {
    const inB = b.has(id), a = l.get(id), c = r.get(id), was = b.get(id);
    if (a && c) {
      if (same(a, c)) out.push(a);
      else if (inB && same(a, was)) out.push(c);
      else if (inB && same(c, was)) out.push(a);
      else out.push(stamp(c) > stamp(a) ? c : a);
    } else if (a && !c) {
      // Gone from the cloud: a deletion elsewhere, unless this device changed it since.
      if (!inB || !same(a, was)) out.push(a);
    } else if (c && !a) {
      if (!inB || !same(c, was)) out.push(c);
    }
  }
  if (spec.sortBy) out.sort((x, y) => String(y[spec.sortBy!] ?? '').localeCompare(String(x[spec.sortBy!] ?? '')));
  return JSON.stringify(spec.limit ? out.slice(0, spec.limit) : out);
}

function mergeMax(local: string | null, remote: string | null): string | null {
  const a = parse(local), c = parse(remote);
  if (a === undefined && c === undefined) return null;
  const out: Record<string, number> = {};
  for (const source of [a, c]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.max(out[key] ?? 0, value);
    }
  }
  return JSON.stringify(out);
}

/** Returns the value both sides should end up holding (null means the key is absent). */
export function mergeKey(spec: SyncKeySpec, input: MergeInput): string | null {
  const { base, local, remote, localMod, remoteMod } = input;
  if (spec.kind === 'items') return local === null && remote === null ? null : mergeItems(spec, input);
  if (spec.kind === 'max') return mergeMax(local, remote);
  if (local === remote) return local;
  if (local === null) return remote;
  if (remote === null) return local;
  if (base !== null) {
    if (local === base) return remote;
    if (remote === base) return local;
  }
  return localMod >= remoteMod ? local : remote;
}
