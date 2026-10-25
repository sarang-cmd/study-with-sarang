import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { setSiteStats, siteStatsAvailable, siteStatsEnabled } from '../../lib/siteStats';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Card, Toggle } from '../desktop/shared';
import { InterfaceTab } from './InterfaceTab';

/** The switch behind Essentials. Off: a short, focused app. On: every feature, including the ones still being refined. */
export function AdvancedTab() {
  const [prefs] = usePrefs();
  const [stats, setStats] = useState(siteStatsEnabled());
  return <div className="grid gap-5">
    <Card title="Advanced and experimental" hint="Essentials is how the app starts: a calm studio, a timer with a goal, your progress and your saved mixes. Turn this on to bring everything back.">
      <div className="grid gap-2">
        <Toggle label="Show everything (full feature set)" hint="Adds the Focus page, study room, automations, distraction check, calendar feed, assistant, calm and Zen extras, the other timer modes and all their settings. Some of these are experimental and may change."
          checked={prefs.advanced} onChange={(advanced) => setPrefs({ advanced })} />
      </div>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted"><FlaskConical size={13} className="mt-0.5 shrink-0" aria-hidden="true" />Nothing is deleted when you switch back. Your settings, sessions and data stay exactly as they are.</p>
    </Card>
    {siteStatsAvailable() && <Card title="Site statistics" hint="This website counts anonymous page views and page speed with Vercel Analytics and Speed Insights. No account, no cookies of ours, nothing from the desktop app. The change applies the next time the page loads.">
      <Toggle label="Allow anonymous site statistics" hint="Also off automatically when your browser sends Do Not Track." checked={stats} onChange={(value) => { setSiteStats(value); setStats(value); }} />
    </Card>}
    {prefs.advanced && <InterfaceTab />}
  </div>;
}
