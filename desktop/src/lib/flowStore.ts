import { PROVIDERS, dayKey, type Keys, type ProviderId, type UsageStore } from './flowApi';

/**
 * Where Flow keeps what must not travel: your service keys, a random device id, and today's request count.
 * They live in this browser or this computer only. They are not part of settings export, backups or cloud sync.
 */
const KEYS = 'study-with-sarang:flow-keys';
const USAGE = 'study-with-sarang:flow-usage';
const DEVICE = 'study-with-sarang:flow-device';
const read = (name: string) => { try { return localStorage.getItem(name); } catch { return null; } };
const write = (name: string, value: string) => { try { localStorage.setItem(name, value); } catch { /* Kept for this session. */ } };

const ids: ProviderId[] = PROVIDERS.map((item) => item.id);
export function readKeys(): Keys {
  try {
    const raw = JSON.parse(read(KEYS) ?? '{}') as Record<string, unknown>;
    const out: Keys = {};
    for (const id of ids) if (typeof raw[id] === 'string' && raw[id]) out[id] = (raw[id] as string).trim().slice(0, 400);
    return out;
  } catch { return {}; }
}
export function setKey(id: ProviderId, value: string) {
  const keys = readKeys();
  const clean = value.replace(/\s+/g, '').slice(0, 400);
  if (clean) keys[id] = clean; else delete keys[id];
  write(KEYS, JSON.stringify(keys));
  window.dispatchEvent(new Event('swa-flow-keys'));
}
export const maskKey = (value: string | undefined) => (value ? `${value.slice(0, 4)}${'\u2022'.repeat(8)}${value.slice(-3)}` : '');

export function deviceId(): string {
  let id = read(DEVICE);
  if (!id || !/^[a-z0-9-]{16,64}$/.test(id)) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).toLowerCase();
    write(DEVICE, id);
  }
  return id;
}

export const usageStore: UsageStore = {
  get: () => { try { const v = JSON.parse(read(USAGE) ?? 'null') as { day?: unknown; count?: unknown } | null; return v && typeof v.day === 'string' && typeof v.count === 'number' ? { day: v.day, count: v.count } : null; } catch { return null; } },
  set: (value) => { write(USAGE, JSON.stringify(value)); window.dispatchEvent(new Event('swa-flow-usage')); },
};
export const usedToday = () => { const v = usageStore.get(); return v && v.day === dayKey() ? v.count : 0; };
