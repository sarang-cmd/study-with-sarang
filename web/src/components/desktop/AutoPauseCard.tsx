import { DEFAULT_IGNORE, DEFAULT_RECORDERS, defaultAutoPause, type AutoPauseSettings } from '../../lib/autoPause';
import { useDesktop } from '../../context/DesktopContext';
import { useIntegrationState } from '../../lib/integrationState';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Slider } from '../Slider';
import { Row, Segmented } from '../settings/parts';
import { Card, Toggle } from './shared';

export function AutoPauseCard() {
  const [prefs] = usePrefs();
  const { info } = useDesktop();
  const live = useIntegrationState();
  const ap = prefs.autoPause;
  const set = (patch: Partial<AutoPauseSettings>) => setPrefs({ autoPause: { ...ap, ...patch } });
  const supported = (info?.platform ?? '') === 'win32';
  const seen = [...live.activity.mic.map((n) => `${n} (microphone)`), ...live.activity.recorders.map((n) => `${n} (recorder)`), ...live.activity.media.map((n) => `${n} (media)`)];
  return <div className="grid gap-5">
    <Card title="Pause when something else needs your ears" hint="Off by default. Your sound keeps playing while you watch videos or listen to anything else. Turn this on if you want it to step aside when you record, take a call or play a video in another app.">
      <Toggle label="Auto-pause" hint={supported ? 'Reads only status flags from Windows (which apps use the microphone, which recorders run, which apps play media). It never records audio or looks at windows.' : 'Detection needs Windows. On this system it cannot see other apps yet.'} checked={ap.enabled && supported} disabled={!supported} onChange={(enabled) => set({ enabled })} />
      {ap.enabled && <p role="status" className="mt-2 rounded-lg border border-line px-3 py-2 text-[11px] text-muted" data-testid="autopause-status">
        {live.holding === 'paused' ? `Holding the sound paused: ${live.holdReason || 'something else is active'}.`
          : live.holding === 'lowered' ? `Holding the sound lower: ${live.holdReason || 'something else is active'}.`
          : !supported ? 'This system cannot report what other apps are doing yet, so nothing will trigger.'
          : live.activityStatus === 'error' ? live.activityMessage
          : live.activityStatus === 'on' ? (live.activityMessage || 'Watching. Nothing to react to right now.')
          : 'Starting...'}
        {seen.length > 0 && <span className="mt-1 block text-[10px]">Seen right now: {seen.slice(0, 5).join(', ')}</span>}
      </p>}
    </Card>
    <Card title="What counts" hint="Pick the situations. Each one is checked about every two seconds.">
      <div className="grid gap-2">
        <Toggle label="Another app is using the microphone" hint="Calls, dictation, screen recorders with audio. Windows shows the same status as the microphone dot." checked={ap.onMic} onChange={(onMic) => set({ onMic })} />
        <Toggle label="Recording software is open" hint="Open, not necessarily recording: Windows does not tell other apps whether a recorder is recording. Edit the list below." checked={ap.onRecorder} onChange={(onRecorder) => set({ onRecorder })} />
        <Toggle label="Another app is playing media" hint="A video or music in a browser or player (anything that shows up in the Windows volume flyout). Windows does not say whether it is a video or music, so use the ignore list for music apps." checked={ap.onMedia} onChange={(onMedia) => set({ onMedia })} />
      </div>
    </Card>
    <Card title="What it does">
      <div className="grid gap-2">
        <Row label="Action"><Segmented<'pause' | 'lower'> label="Auto-pause action" value={ap.action} onChange={(action) => set({ action })} options={[{ id: 'pause', label: 'Pause' }, { id: 'lower', label: 'Lower volume' }]} /></Row>
        {ap.action === 'lower' && <Slider label="Lower to" value={ap.lowerTo} min={0} max={80} step={5} defaultValue={defaultAutoPause.lowerTo} onChange={(lowerTo) => set({ lowerTo })} format={(value) => `${value}% of normal`} />}
        <Slider label="Wait before acting" value={ap.delaySec} min={0} max={30} defaultValue={defaultAutoPause.delaySec} onChange={(delaySec) => set({ delaySec })} format={(value) => `${value} s`} hint="A short notification sound will not trigger anything if it ends within this time." />
        <Toggle label={ap.action === 'pause' ? 'Resume when it is over' : 'Restore volume when it is over'} hint="Only resumes sound that auto-pause paused itself. If you paused it yourself, it stays paused. If you press play while it is holding the sound, your choice wins until the other app stops." checked={ap.resume} onChange={(resume) => set({ resume })} disabled={ap.action === 'lower'} />
        <Slider label="Wait before resuming" value={ap.resumeDelaySec} min={0} max={120} defaultValue={defaultAutoPause.resumeDelaySec} onChange={(resumeDelaySec) => set({ resumeDelaySec })} format={(value) => `${value} s`} />
        <Toggle label="Tell me what happened" hint="A small message when it pauses, lowers or resumes." checked={ap.toast} onChange={(toast) => set({ toast })} />
      </div>
    </Card>
    <Card title="Lists" hint="Names are matched loosely and without capital letters. Separate with commas.">
      <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Never react to these apps
        <textarea className="field mt-1.5 min-h-16 font-normal" value={ap.ignoreApps} onChange={(event) => set({ ignoreApps: event.target.value })} aria-label="Apps to ignore" />
        <span className="mt-1 flex items-center justify-between text-[10px] font-normal text-muted">Music players, for example.<button type="button" className="underline underline-offset-2" onClick={() => set({ ignoreApps: DEFAULT_IGNORE })}>Reset</button></span>
      </label>
      <label className="mt-2 block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Recording software (process names)
        <textarea className="field mt-1.5 min-h-16 font-normal" value={ap.recorders} onChange={(event) => set({ recorders: event.target.value })} aria-label="Recording software" />
        <span className="mt-1 flex items-center justify-between text-[10px] font-normal text-muted">The name in Task Manager without ".exe".<button type="button" className="underline underline-offset-2" onClick={() => set({ recorders: DEFAULT_RECORDERS })}>Reset</button></span>
      </label>
    </Card>
  </div>;
}
