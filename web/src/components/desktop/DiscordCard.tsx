import { AppIcon } from '../AppIcon';
import { useDesktop } from '../../context/DesktopContext';
import { buildActivity, cleanButtonUrl, defaultDiscord, DEFAULT_APP_ID, isAppId, usingOwnApp, type DiscordSettings } from '../../lib/discord';
import { useIntegrationState } from '../../lib/integrationState';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Card, Toggle } from './shared';

const STATUS: Record<string, string> = { off: 'Off', connecting: 'Connecting to Discord...', waiting: 'Waiting for the Discord app. Open it on this computer.', connected: 'Connected', error: 'Problem' };

export function DiscordCard() {
  const [prefs] = usePrefs();
  const { info } = useDesktop();
  const live = useIntegrationState();
  const dc = prefs.discord;
  const set = (patch: Partial<DiscordSettings>) => setPrefs({ discord: { ...dc, ...patch } });
  const idOk = dc.appId === '' || isAppId(dc.appId);
  const own = usingOwnApp(dc);
  const sample = { playing: true, mixName: 'Flow', timerRunning: true, timerMode: 'pomodoro' as const, phase: 'focus' as const, seconds: 1450, task: 'Calculus past paper', cycle: 2, cycles: 4 };
  const preview = buildActivity({ ...dc, enabled: true }, sample, Date.now(), prefs.appIcon);
  const label = dc.enabled ? (STATUS[live.discordStatus] ?? live.discordStatus) : 'Off';
  const available = info?.platform === 'win32' || info?.platform === 'darwin' || info?.platform === 'linux';
  const buttonBad = dc.buttonUrl !== '' && !cleanButtonUrl(dc.buttonUrl);
  return <div className="grid gap-5">
    <Card title="Discord status" hint="Shows what you choose on your own Discord profile while the Discord app is open on this computer. Off by default. Nothing to set up: switch it on and open Discord. The app talks to Discord on your PC and nothing goes to any server of ours.">
      <Toggle label="Show my activity on Discord" hint={own ? 'Using your own Discord application (Advanced, below).' : 'Appears as "Study with Sarang" on your profile.'} checked={dc.enabled && available} disabled={!available} onChange={(enabled) => set({ enabled })} />
      <p role="status" data-testid="discord-status" className={`mt-2 rounded-lg border border-line px-3 py-2 text-[11px] ${live.discordStatus === 'error' && dc.enabled ? 'font-semibold' : 'text-muted'}`}>
        {label}{dc.enabled && live.discordStatus === 'connected' && live.discordDetail ? ` as ${live.discordDetail}` : ''}{dc.enabled && live.discordStatus === 'error' && live.discordDetail ? `: ${live.discordDetail}` : ''}
      </p>
    </Card>
    <Card title="What others can see" hint="Only what is switched on below ever leaves the app.">
      <div className="grid gap-2">
        <Toggle label="The mix that is playing" hint="For example the name of your current mix." checked={dc.showMix} onChange={(showMix) => set({ showMix })} />
        <Toggle label="A live timer" hint="The time left in a focus block, or the elapsed time of a stopwatch." checked={dc.showTimer} onChange={(showTimer) => set({ showTimer })} />
        <Toggle label="Which block I am on" hint={'For example "Block 2 of 4" while a Pomodoro focus block runs.'} checked={dc.showCycle} onChange={(showCycle) => set({ showCycle })} />
        <Toggle label="What I am working on" hint="The task you typed in the timer. Off by default because it can be personal." checked={dc.showTask} onChange={(showTask) => set({ showTask })} />
        <Toggle label="Keep my status during breaks" hint="Off clears your status while a break runs, so breaks stay private." checked={dc.showBreaks} onChange={(showBreaks) => set({ showBreaks })} />
        <Toggle label="Show a resting status when nothing is playing" hint="Off clears your status when the sound is paused and the timer is stopped." checked={dc.showIdle} onChange={(showIdle) => set({ showIdle })} />
      </div>
      <div className="mt-3 rounded-xl border border-line px-3.5 py-3 text-[11px]" role="group" aria-label="Preview of your status" data-testid="discord-preview">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Preview, while a focus block runs</p>
        {preview?.assets?.large_image && <span className="mt-2 inline-flex items-center gap-2 text-muted" data-testid="discord-logo"><AppIcon size={36} className="rounded-lg" />The picture on your profile is your app icon, so it matches the window and the tray.</span>}
        <p className="mt-1 font-semibold">{preview?.details ?? 'Nothing is shown'}</p>
        {preview?.state && <p className="text-muted">{preview.state}</p>}
        {preview?.timestamps && <p className="text-muted">24:10 left</p>}
        {preview?.buttons?.[0] && <p className="mt-1 inline-block rounded-md border border-line px-2 py-0.5 font-semibold">{preview.buttons[0].label}</p>}
      </div>
    </Card>
    <Card title="Make it yours" hint="Optional wording, a caption and a link button. Leave a field empty to use the default.">
      <div className="grid gap-2">
        <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Top line
          <input className="field mt-1.5 !min-h-9 font-normal" maxLength={60} value={dc.customDetails} onChange={(e) => set({ customDetails: e.target.value })} placeholder="Focusing" />
        </label>
        <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Second line
          <input className="field mt-1.5 !min-h-9 font-normal" maxLength={60} value={dc.customState} onChange={(e) => set({ customState: e.target.value })} placeholder="{mix} · {task}" />
          <span className="mt-1 block text-[10px] font-normal text-muted">Placeholders: {'{mix} {task} {phase} {block} {blocks}'}. A placeholder you keep hidden above stays empty.</span>
        </label>
        <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Picture caption
          <input className="field mt-1.5 !min-h-9 font-normal" maxLength={64} value={dc.largeText} onChange={(e) => set({ largeText: e.target.value })} placeholder="Study with Sarang" />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[11px] font-semibold">Show as
          <select className="field !min-h-8 !w-auto !py-1 text-[11px]" value={dc.activityType} onChange={(e) => set({ activityType: Number(e.target.value) as 0 | 2 | 3 })} aria-label="Show as">
            <option value={0}>Playing</option><option value={2}>Listening to</option><option value={3}>Watching</option>
          </select></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Button label
            <input className="field mt-1.5 !min-h-9 font-normal" maxLength={32} value={dc.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} placeholder="Join me" />
          </label>
          <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Button link (https)
            <input className="field mt-1.5 !min-h-9 font-mono font-normal" maxLength={512} value={dc.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} placeholder="https://" aria-invalid={buttonBad} />
            {buttonBad && <span className="mt-1 block text-[10px] font-normal text-muted">Only https links are allowed.</span>}
          </label>
        </div>
      </div>
      <div className="mt-3"><button type="button" className="studio-button" onClick={() => set({ ...defaultDiscord, enabled: dc.enabled, appId: dc.appId })}>Reset options</button></div>
    </Card>
    <details className="rounded-2xl border border-line bg-surface px-5 py-4" data-testid="discord-advanced" open={own || !idOk}>
      <summary className="cursor-pointer text-[13px] font-semibold tracking-tight">Advanced: use my own Discord application</summary>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">Only if you want your profile to say something other than "Study with Sarang", or to use your own pictures. Create a free application at discord.com/developers/applications, copy its Application ID from General Information and paste it here. Under Rich Presence, Art Assets you can upload pictures; type the name you gave one below.</p>
      <label className="mt-3 block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Application ID
        <input className="field mt-1.5 !min-h-9 font-mono font-normal" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={20} value={dc.appId} onChange={(event) => set({ appId: event.target.value })} placeholder={`Built in: ${DEFAULT_APP_ID}`} aria-invalid={!idOk} />
        {!idOk ? <span className="mt-1 block text-[10px] font-normal text-muted">An Application ID is 17 to 20 digits.</span> : <span className="mt-1 block text-[10px] font-normal text-muted">Leave empty to use the built-in one.</span>}
      </label>
      <label className="mt-2 block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Picture name
        <input className="field mt-1.5 !min-h-9 font-mono font-normal" autoComplete="off" spellCheck={false} maxLength={32} value={dc.imageKey} onChange={(event) => set({ imageKey: event.target.value })} placeholder="icon" />
        <span className="mt-1 block text-[10px] font-normal text-muted">The built-in application has a picture called "icon". Letters, numbers and underscores. Empty shows no picture. Discord can take a few minutes to show a newly uploaded one.</span>
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Small picture name
          <input className="field mt-1.5 !min-h-9 font-mono font-normal" autoComplete="off" spellCheck={false} maxLength={32} value={dc.smallImageKey} onChange={(event) => set({ smallImageKey: event.target.value })} placeholder="optional" />
        </label>
        <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Small picture caption
          <input className="field mt-1.5 !min-h-9 font-normal" maxLength={64} value={dc.smallText} onChange={(event) => set({ smallText: event.target.value })} />
        </label>
      </div>
      {own && <p className="mt-2 text-[10px] text-muted">Your own application is in use. Clear the ID to go back to the built-in one.</p>}
    </details>
  </div>;
}
