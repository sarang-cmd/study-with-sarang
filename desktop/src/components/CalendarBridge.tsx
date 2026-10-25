import { useEffect, useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { CLOUD_EVENT, isSignedIn } from '../lib/cloud';
import { refreshToken, syncFeed } from '../lib/calendarFeed';
import { usePrefs } from '../lib/prefs';
import { useProfile } from '../lib/subjects';

/** Renders nothing. Keeps the private calendar link up to date a few seconds after every finished block, and when you change what it shows. */
export function CalendarBridge() {
  const timer = useTimer();
  const [prefs] = usePrefs();
  const profile = useProfile();
  const [tick, setTick] = useState(0);
  const cal = prefs.calendar;
  useEffect(() => { const f = () => setTick((n) => n + 1); window.addEventListener(CLOUD_EVENT, f); return () => window.removeEventListener(CLOUD_EVENT, f); }, []);
  useEffect(() => {
    if (!cal.enabled || !isSignedIn()) return;
    const id = window.setTimeout(() => { void syncFeed(timer.sessions, cal); }, 3000);
    return () => window.clearTimeout(id);
  }, [timer.sessions, cal, profile, tick]);
  useEffect(() => { if (cal.enabled && isSignedIn()) void refreshToken(); }, [cal.enabled, tick]);
  return null;
}
