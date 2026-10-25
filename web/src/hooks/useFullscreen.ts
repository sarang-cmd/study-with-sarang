import { useCallback, useEffect, useState } from 'react';

export function useFullscreen() {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled !== false && 'requestFullscreen' in document.documentElement;
  useEffect(() => {
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const enter = useCallback(async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); return true; } catch { return false; } }, []);
  const exit = useCallback(async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* Already out. */ } }, []);
  const toggle = useCallback(() => (document.fullscreenElement ? exit() : enter()), [enter, exit]);
  return { active, supported, enter, exit, toggle };
}
