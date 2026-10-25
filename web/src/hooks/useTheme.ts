import { useCallback, useEffect, useState } from 'react';

const KEY = 'study-with-sarang:theme';
/** Switches the page to dark or light and remembers it. */
export function applyTheme(next: boolean) {
  document.documentElement.classList.toggle('dark', next);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#0b0b0b' : '#ffffff');
  try { localStorage.setItem(KEY, next ? 'dark' : 'light'); } catch { /* Theme lasts for this visit. */ }
}
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  // Several parts of the page use this hook (header, right-click menu), so follow the page itself.
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    applyTheme(next);
    setDark(next);
  }, []);
  return { dark, toggle };
}
