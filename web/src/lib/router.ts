import { useCallback, useEffect, useState } from 'react';

/** The new layout is four pages. The address bar hash picks one (#progress), or a section on one (#tracking). */
export type PageId = 'studio' | 'library' | 'progress' | 'focus';
export const PAGES: { id: PageId; label: string }[] = [
  { id: 'studio', label: 'Studio' }, { id: 'library', label: 'Library' }, { id: 'progress', label: 'Progress' }, { id: 'focus', label: 'Focus' },
];
const SECTION_PAGE: Record<string, PageId> = {
  top: 'studio', sound: 'studio', timer: 'studio', layers: 'studio',
  mixes: 'library', video: 'library', tracking: 'progress', shield: 'focus', science: 'focus', neural: 'focus', reasons: 'focus', cloud: 'studio',
};
const KEY = 'study-with-sarang:page';

/** Which page a hash points at, and the element to scroll to on it (null for a page's own name). */
export function parseHash(hash: string): { page: PageId; anchor: string | null } | null {
  const id = hash.replace(/^#/, '');
  const named = PAGES.find((page) => page.id === id);
  if (named) return { page: named.id, anchor: null };
  if (Object.prototype.hasOwnProperty.call(SECTION_PAGE, id)) return { page: SECTION_PAGE[id], anchor: id === 'top' ? null : id };
  return null; // Empty, a share link (#mix=...) or something else: stay where we are.
}

function remembered(): PageId {
  try { const value = localStorage.getItem(KEY); if (PAGES.some((page) => page.id === value)) return value as PageId; } catch { /* First visit. */ }
  return 'studio';
}

export function useRoute(enabled: boolean): [PageId, (page: PageId) => void] {
  const [page, setPageState] = useState<PageId>(() => (typeof location === 'undefined' ? 'studio' : parseHash(location.hash)?.page ?? remembered()));
  const scrollTo = useCallback((anchor: string | null) => {
    // The page has to render before its section exists, so look again shortly after the switch.
    const go = () => { const element = anchor ? document.getElementById(anchor) : null; if (element) element.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 }); };
    window.requestAnimationFrame(() => window.requestAnimationFrame(go));
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const apply = () => {
      const target = parseHash(location.hash);
      if (!target) return;
      setPageState(target.page);
      try { localStorage.setItem(KEY, target.page); } catch { /* Not remembered. */ }
      scrollTo(target.anchor);
    };
    const first = parseHash(location.hash);
    if (first?.anchor) scrollTo(first.anchor);
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [enabled, scrollTo]);
  const setPage = useCallback((next: PageId) => { if (location.hash === `#${next}`) scrollTo(null); else location.hash = next; }, [scrollTo]);
  return [page, setPage];
}
