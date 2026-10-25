import { useEffect, useState } from 'react';
import { isDesktop } from './desktop';

declare const __APP_VERSION__: string;
/** The version of this build of the page, taken from package.json when it was built. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export interface WebUpdate { version: string; notes: string }

const parse = (text: unknown) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim()); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
/** True when `a` is a newer release number than `b`. */
export function isNewer(a: unknown, b: unknown): boolean {
  const x = parse(a), y = parse(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

const SKIP_KEY = 'web-update-skip';
const HOUR = 60 * 60 * 1000;

/**
 * Browser only. Asks the site for updates/latest.json (the same small file the desktop app reads) and reports a newer page version.
 * The desktop app has its own updater, so this stays quiet there. Nothing is sent: it is one plain GET of a public file.
 */
export function useWebUpdate() {
  const [found, setFound] = useState<WebUpdate | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (isDesktop || typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return undefined;
    let stop = false;
    const check = async () => {
      try {
        const response = await fetch(new URL('updates/latest.json', document.baseURI).toString(), { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json() as { web?: { version?: string; notes?: string } };
        const version = json.web?.version;
        if (!stop && version && isNewer(version, APP_VERSION) && localStorage.getItem(SKIP_KEY) !== version) setFound({ version, notes: String(json.web?.notes ?? '').slice(0, 800) });
      } catch { /* Offline or no feed: nothing to show. */ }
    };
    const first = window.setTimeout(() => { void check(); }, 4000);
    const every = window.setInterval(() => { void check(); }, HOUR);
    return () => { stop = true; window.clearTimeout(first); window.clearInterval(every); };
  }, []);
  return {
    update: hidden ? null : found,
    later: () => setHidden(true),
    skip: () => { if (found) { try { localStorage.setItem(SKIP_KEY, found.version); } catch { /* Private mode. */ } } setHidden(true); },
  };
}
