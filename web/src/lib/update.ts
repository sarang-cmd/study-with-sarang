import { useEffect, useSyncExternalStore } from 'react';
import { desktop, type UpdateState } from './desktop';

let current: UpdateState | null = null;
let started = false;
const listeners = new Set<() => void>();
const set = (next: UpdateState | null) => { if (next) { current = next; listeners.forEach((listener) => listener()); } };

function start() {
  if (started || !desktop?.update) return;
  started = true;
  void desktop.update.get().then(set);
  desktop.update.onState(set);
}

/** The shared update state from the desktop shell. Null in a browser. */
export function useUpdate() {
  useEffect(start, []);
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current);
}

export const updateApi = {
  check: async () => set(await (desktop?.update.check() ?? Promise.resolve(null))),
  install: async () => set(await (desktop?.update.install() ?? Promise.resolve(null))),
  skip: async () => set(await (desktop?.update.skip() ?? Promise.resolve(null))),
  dismiss: async () => set(await (desktop?.update.dismiss() ?? Promise.resolve(null))),
  setConfig: async (config: { repo?: string; auto?: boolean }) => set(await (desktop?.update.setConfig(config) ?? Promise.resolve(null))),
};

export const megabytes = (bytes: number) => (!bytes ? '' : bytes < 1048576 ? 'under 1 MB' : `${Math.round(bytes / 1048576)} MB`);
