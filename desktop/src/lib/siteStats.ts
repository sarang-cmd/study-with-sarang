import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { isDesktop } from './desktop';

const KEY = 'site-stats';
/** Anonymous page views and page speed from Vercel, on the website only. Never in the desktop app, and never when Do Not Track is on or you switched it off. */
export const siteStatsAvailable = () => typeof window !== 'undefined' && !isDesktop && /\.vercel\.app$/i.test(window.location.hostname);
export const siteStatsEnabled = () => {
  try { if (localStorage.getItem(KEY) === 'off') return false; } catch { /* Private mode: keep the default. */ }
  return navigator.doNotTrack !== '1';
};
export function setSiteStats(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* Private mode. */ } }

/** Starts the two Vercel scripts once, if allowed. Turning the setting off takes effect on the next load. */
export function startSiteStats() {
  if (!siteStatsAvailable() || !siteStatsEnabled()) return;
  try { inject(); injectSpeedInsights(); } catch { /* Statistics are optional. */ }
}
