import { useCallback, useEffect, useState } from 'react';
import { desktop, type MonitorConfig, type MonitorsPayload } from '../lib/desktop';

/** The screens, as the desktop shell sees them, kept up to date when a monitor is plugged in or removed. */
export function useMonitors() {
  const [data, setData] = useState<MonitorsPayload | null>(null);
  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    void desktop.monitorsGet().then((p) => { if (alive && p) setData(p); });
    const off = desktop.onMonitors((p) => { if (alive) setData(p); });
    return () => { alive = false; off(); };
  }, []);
  const save = useCallback(async (config: MonitorConfig) => {
    setData((cur) => (cur ? { ...cur, config } : cur));
    const next = await desktop?.monitorsSet(config); if (next) setData(next);
  }, []);
  return { data, save };
}
