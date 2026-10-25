import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SettingsPanel } from '../components/SettingsPanel';
import { useDesktop } from './DesktopContext';
import { applyFavicon } from '../lib/appIcon';
import { desktop } from '../lib/desktop';
import { usePrefs } from '../lib/prefs';


interface SettingsValue { open: boolean; tab: string; openSettings: (tab?: string) => void; closeSettings: () => void }
const Context = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('appearance');
  const [prefs] = usePrefs();
  const { info, state } = useDesktop();
  const openSettings = useCallback((next?: string) => { if (next) setTab(next); setOpen(true); }, []);
  const closeSettings = useCallback(() => setOpen(false), []);

  // The chosen app icon: the tab icon everywhere, plus the window, taskbar and tray icon in the desktop app.
  useEffect(() => { applyFavicon(prefs.appIcon); }, [prefs.appIcon]);
  const shellIcon = state?.behavior.appIcon;
  useEffect(() => {
    if (!desktop || !info || !shellIcon || shellIcon === prefs.appIcon) return;
    void desktop.setBehavior({ appIcon: prefs.appIcon });
  }, [prefs.appIcon, shellIcon, info]);

  const value = useMemo(() => ({ open, tab, openSettings, closeSettings }), [open, tab, openSettings, closeSettings]);
  return <Context.Provider value={value}>{children}{open && <SettingsPanel tab={tab} onTab={setTab} onClose={closeSettings} />}</Context.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(Context);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
