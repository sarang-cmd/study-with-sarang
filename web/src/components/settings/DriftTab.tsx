import { Copy, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, Num, Toggle, copyText } from '../desktop/shared';
import { desktop } from '../../lib/desktop';
import { DRIFT_CATEGORIES, DEFAULT_STUDY_WORDS, classify, clearDriftLog, isBrowser, normHost, randomToken, readDriftLog, sanitizeDrift, topDrifts, type DriftLogEntry, type DriftSettings } from '../../lib/drift';
import { useIntegrationState } from '../../lib/integrationState';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { clearDriftAiCache } from '../DriftBridge';
import { notify } from '../ui/toast';
import { SUITE } from '../../lib/suite';

const inp = 'field !min-h-9 text-[12px]';
const lab = 'grid gap-1 text-[11px] font-semibold';
const helperText: Record<string, string> = { off: 'Off.', listening: 'Ready. Waiting for the browser extension.', connected: 'Connected. The extension is reporting the open website.', error: 'Problem.' };
const windowText: Record<string, string> = { off: 'Off.', on: 'Watching the front window.', error: 'Problem.', unsupported: 'Not available on this system (Windows and macOS only).' };

function useLog(): DriftLogEntry[] {
  const [log, setLog] = useState(readDriftLog);
  useEffect(() => { const f = () => setLog(readDriftLog()); window.addEventListener('swa-drift-log', f); return () => window.removeEventListener('swa-drift-log', f); }, []);
  return log;
}

function TryIt({ d }: { d: DriftSettings }) {
  const [app, setApp] = useState(''); const [site, setSite] = useState(''); const [title, setTitle] = useState('');
  const j = app || site || title ? classify({ app: app || (site ? 'brave' : ''), title, host: normHost(site), viaTab: !!site }, d) : null;
  return <div className="grid gap-2 rounded-xl border border-line p-3">
    <p className="text-[11px] font-semibold">Try it: what would the rules say?</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <input className={inp} placeholder="App, e.g. steam" aria-label="Try an app" value={app} onChange={(e) => setApp(e.target.value)} data-testid="drift-try-app" />
      <input className={inp} placeholder="Website, e.g. youtube.com" aria-label="Try a website" value={site} onChange={(e) => setSite(e.target.value)} data-testid="drift-try-site" />
      <input className={inp} placeholder="Window title (optional)" aria-label="Try a title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="drift-try-title" />
    </div>
    {j && <p role="status" data-testid="drift-try-result" className={`rounded-lg border px-3 py-2 text-[11px] ${j.verdict === 'drift' ? 'border-ink bg-raised font-semibold' : 'border-line text-muted'}`}>
      {j.verdict === 'drift' ? `Drift: ${j.why}.` : j.verdict === 'ok' ? `Fine: ${j.why}.` : j.verdict === 'unknown' ? (d.ai ? 'Not on any list. The AI would be asked.' : 'Not on any list, so it is left alone.') : 'Nothing to judge.'}
      {isBrowser(app) && !site && d.titleMatch ? ' (A browser without the helper is judged by its window title only.)' : ''}</p>}
  </div>;
}

export function DriftTab() {
  const [prefs] = usePrefs();
  const live = useIntegrationState();
  const log = useLog();
  const d = prefs.drift;
  const set = (patch: Partial<DriftSettings>) => setPrefs({ drift: sanitizeDrift({ ...d, ...patch }) });
  const [show, setShow] = useState(false);
  const desktopApp = Boolean(desktop);
  const winOk = live.driftWindow !== 'unsupported';
  const enableHelper = (on: boolean) => set({ helper: on, token: on && !d.token ? randomToken() : d.token });
  const install = async (browser: 'chrome' | 'edge' | 'brave') => {
    const result = await desktop?.driftInstall(browser);
    notify({ message: !result ? 'Could not prepare the helper folder.' : `${result.opened ? 'Opened the extensions page.' : 'Opened the helper folder.'} ${result.copied ? 'The folder path is copied: switch on Developer mode, choose Load unpacked and paste it.' : `Choose Load unpacked and pick ${result.folder}.`}`, variant: result ? 'success' : 'error', id: 'drift-install' });
  };
  const pairNow = async () => {
    if (!d.helper) { set({ helper: true, token: d.token || randomToken() }); await new Promise((resolve) => setTimeout(resolve, 900)); }
    const result = await desktop?.driftPair();
    if (!result?.ok) notify({ message: result?.why ?? 'Turn on the browser helper first, then try again.', variant: 'error', id: 'drift-pair' });
  };
  const openFolder = async () => { const folder = await desktop?.driftExtension(); notify({ message: folder ? `Opened ${folder}. In your browser open the extensions page, switch on Developer mode, choose Load unpacked and pick this folder.` : 'Could not open the folder.', variant: folder ? 'success' : 'error', id: 'drift-ext', duration: 12000 }); };

  return <div className="grid gap-5">
    <Card title="Drift detection" hint="Notices when you wander off while a focus block runs, like parental controls you set for yourself. Off by default. It runs on this computer, uses no AI unless you add it below, and you decide what counts and what happens.">
      <Toggle label="Notice when I drift" hint={desktopApp ? 'Reads only the name of the front program and its window title (and the website, if you add the browser helper). Nothing is recorded or sent anywhere.' : 'This needs the desktop app, because a web page cannot see other programs. Here, the timer already counts every time you leave this tab.'} checked={d.enabled} disabled={!desktopApp} onChange={(enabled) => set({ enabled })} />
      {d.enabled && <p role="status" data-testid="drift-status" className="mt-2 rounded-lg border border-line px-3 py-2 text-[11px] text-muted">
        {windowText[live.driftWindow] ?? ''} {live.driftMessage && live.driftHelper !== 'off' ? '' : live.driftMessage}
        {live.driftNow ? ` Now: ${live.driftNow.label} (${live.driftNow.verdict === 'drift' ? 'counts as drift' : live.driftNow.verdict === 'ok' ? 'fine' : 'not on any list'}${live.driftNow.seconds > 4 ? `, ${live.driftNow.seconds} s` : ''}).` : ''}</p>}
      {!winOk && desktopApp && <p className="mt-2 text-[11px] text-muted">This system cannot report the front window. The browser helper below still works.</p>}
    </Card>

    <Card title="What counts as drift" hint="Switch whole groups on or off, then add your own. Names are not case sensitive. Separate items with commas.">
      <div className="grid gap-2 sm:grid-cols-2">
        {DRIFT_CATEGORIES.map((c) => <Toggle key={c.id} label={c.label} hint={c.hint} checked={d.categories[c.id] === true} onChange={(on) => set({ categories: { ...d.categories, [c.id]: on } })} />)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={lab}>Also drift: apps<input className={inp} value={d.blockApps} placeholder="for example: spotify, steam" onChange={(e) => set({ blockApps: e.target.value })} data-testid="drift-block-apps" /></label>
        <label className={lab}>Also drift: websites<input className={inp} value={d.blockSites} placeholder="for example: example.com" onChange={(e) => set({ blockSites: e.target.value })} data-testid="drift-block-sites" /></label>
        <label className={lab}>Also drift: words in a window title<input className={inp} value={d.blockWords} placeholder="for example: memes, highlights" onChange={(e) => set({ blockWords: e.target.value })} /></label>
        <label className={lab}>Study words (a title with one never counts)<input className={inp} value={d.studyWords} onChange={(e) => set({ studyWords: e.target.value })} data-testid="drift-study-words" /></label>
        <label className={lab}>Never drift: apps<input className={inp} value={d.allowApps} placeholder="for example: notion, obsidian" onChange={(e) => set({ allowApps: e.target.value })} /></label>
        <label className={lab}>Never drift: websites<input className={inp} value={d.allowSites} placeholder="for example: khanacademy.org" onChange={(e) => set({ allowSites: e.target.value })} data-testid="drift-allow-sites" /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" className="text-[11px] font-semibold underline underline-offset-4" onClick={() => set({ studyWords: DEFAULT_STUDY_WORDS })}>Restore the study words</button></div>
      <div className="mt-3"><Toggle label="Judge browsers by their window title" hint="A best guess when the browser helper is not connected: a title that mentions YouTube or Instagram counts. The helper below is exact." checked={d.titleMatch} onChange={(titleMatch) => set({ titleMatch })} /></div>
      <div className="mt-4"><TryIt d={d} /></div>
    </Card>

    <Card title="When it happens" hint="You choose how loud it is. Each of these is separate.">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lab}>Stay this long before it counts (seconds)<Num min={3} max={600} value={d.graceSec} onChange={(graceSec) => set({ graceSec })} data-testid="drift-grace" /></label>
        <label className={lab}>At most one alert every (minutes)<Num min={1} max={120} value={d.cooldownMin} onChange={(cooldownMin) => set({ cooldownMin })} data-testid="drift-cooldown" /></label>
        <div className="sm:pt-5"><Toggle label="Only during a focus block" checked={d.focusOnly} onChange={(focusOnly) => set({ focusOnly })} /></div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Toggle label="Show a message here" hint="With a button to allow that app or site for now." checked={d.onToast} onChange={(onToast) => set({ onToast })} />
        <Toggle label="Add to the notification list" checked={d.onNote} onChange={(onNote) => set({ onNote })} />
        <Toggle label="System notification" hint="Shows even when this window is hidden." checked={d.onSystem} onChange={(onSystem) => set({ onSystem })} />
        <Toggle label="Count it as a distraction" hint="Once per stay. It shows in your block summary and statistics." checked={d.onMark} onChange={(onMark) => set({ onMark })} />
        <Toggle label="Play a soft sound" checked={d.onChime} onChange={(onChime) => set({ onChime })} />
        <Toggle label="Pause the focus timer" checked={d.onPause} onChange={(onPause) => set({ onPause })} />
        <Toggle label="Pause the soundscape" checked={d.onSoundPause} onChange={(onSoundPause) => set({ onSoundPause })} />
      </div>
      <p className="mt-3 text-[11px] text-muted">Want more, like opening the breathing guide or moving the window? Use the trigger "Drift is detected" under Automations.</p>
    </Card>

    <Card title="Browser helper (optional)" hint="A small extension for Brave, Chrome, Edge and other Chromium browsers. It tells this app the exact website of your open tab, over a private connection that never leaves this computer. Private windows are never reported.">
      <Toggle label="Accept the browser helper" checked={d.helper} disabled={!desktopApp} onChange={enableHelper} />
      {d.helper && <div className="mt-3 grid gap-3">
        <p role="status" data-testid="drift-helper-status" className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted">{helperText[live.driftHelper] ?? ''} {live.driftHelper === 'error' ? live.driftMessage : ''}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className={lab}>Pairing code
            <span className="flex gap-2"><input className={`${inp} font-mono`} readOnly type={show ? 'text' : 'password'} value={d.token} data-testid="drift-token" aria-label="Pairing code" />
              <button type="button" className="studio-button !min-h-9 !px-3" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
              <button type="button" aria-label="Copy pairing code" className="studio-button !min-h-9 !px-3" onClick={() => void copyText(d.token, () => notify({ message: 'Pairing code copied.', variant: 'success', id: 'drift-copy' }))}><Copy size={13} /></button>
              <button type="button" aria-label="New pairing code" title="Make a new code (the extension must be updated)" className="studio-button !min-h-9 !px-3" onClick={() => set({ token: randomToken() })}><RefreshCw size={13} /></button></span></label>
          <label className={lab}>Port<Num min={1024} max={65535} value={d.port} onChange={(port) => set({ port })} data-testid="drift-port" /></label>
        </div>
        <ol className="grid list-decimal gap-1 pl-5 text-[11px] leading-relaxed text-muted">
          <li>Press <b>Install the helper</b> for your browser. The app opens its extensions page and copies the folder path. Switch on Developer mode, choose Load unpacked and paste the path.</li>
          <li>Press <b>Pair the extension</b> here, then press <b>Connect to the app</b> in the helper's page. No code to copy.</li>
        </ol>
        <div className="flex flex-wrap gap-2" data-testid="drift-install">
          {(['chrome', 'edge', 'brave'] as const).map((b) => <button key={b} type="button" className="studio-button !min-h-9" data-testid={`drift-install-${b}`} onClick={() => void install(b)}><ExternalLink size={13} />Install the helper in {b === 'chrome' ? 'Chrome' : b === 'edge' ? 'Edge' : 'Brave'}</button>)}
          <button type="button" className="studio-button !min-h-9 studio-button-primary" data-testid="drift-pair" onClick={() => void pairNow()}>Pair the extension</button>
          <button type="button" className="studio-button !min-h-9" onClick={() => void openFolder()}>Open the folder</button>
        </div>
        {live.driftPairing && <p role="status" data-testid="drift-pairing" className="rounded-lg border border-ink px-3 py-2 text-[11px] font-semibold">Waiting for the extension. Press Connect to the app in its page. This closes by itself after two minutes.</p>}
        <p className="text-[10px] leading-relaxed text-muted">Browsers do not allow a program to install an extension silently, so the last step, Load unpacked, is yours. After that the app keeps the folder current: each time Study with Sarang updates, it refreshes the files, and your browser picks them up when it restarts. The helper is for Chrome, Edge, Brave and other Chromium browsers. The same page, with the download, is at <span className="font-mono">{SUITE.study.downloadsUrl.replace('https://', '')}</span>.</p>
      </div>}
    </Card>

    <Card title="AI second opinion (optional)" hint="Off by default. When on, a website or app that is on none of your lists is shown to your own AI service, which says whether it looks like a distraction. Answers are remembered, so each site is asked about once.">
      <Toggle label="Ask my AI about things the rules do not know" hint="Uses your own key from Settings, Flow voice and AI. It never uses the free shared service." checked={d.ai} onChange={(ai) => set({ ai })} />
      {d.ai && <div className="mt-3 grid gap-3">
        <Toggle label="Also send the window title" hint="Off: only the app name or website is sent, plus your subject and goal if set. On: the title too, which is more accurate but can contain private words." checked={d.aiSendTitle} onChange={(aiSendTitle) => set({ aiSendTitle })} />
        <label className={`${lab} max-w-xs`}>At most this many questions per hour<Num min={1} max={120} value={d.aiPerHour} onChange={(aiPerHour) => set({ aiPerHour })} /></label>
        <div><button type="button" className="studio-button !min-h-9" onClick={() => { clearDriftAiCache(); notify({ message: 'The AI will be asked again about unknown sites.', variant: 'success', id: 'drift-ai-clear' }); }}>Forget what the AI decided</button></div>
      </div>}
    </Card>

    <Card title="Drift log" hint="The last drifts this device noticed. Only here, never uploaded.">
      {log.length === 0 ? <p className="text-[11px] text-muted" data-testid="drift-log-empty">Nothing yet.</p> : <>
        <p className="mb-2 text-[11px] text-muted" data-testid="drift-top">{topDrifts(log).map((t) => `${t.label}: ${t.count}`).join(' · ')}</p>
        <ul className="grid max-h-56 gap-1 overflow-y-auto" data-testid="drift-log">{[...log].reverse().slice(0, 40).map((e) => <li key={`${e.at}-${e.label}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line px-3 py-1.5 text-[11px]">
          <span><b>{e.label}</b> <span className="text-muted">{e.category ? `(${e.category})` : ''}</span></span><span className="text-muted">{new Date(e.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span></li>)}</ul>
        <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold underline underline-offset-4" onClick={clearDriftLog}><Trash2 size={12} />Clear the log</button></>}
    </Card>
  </div>;
}
