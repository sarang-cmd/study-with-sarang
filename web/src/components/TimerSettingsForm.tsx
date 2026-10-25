import { Bell, Minus, Plus } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import type { BreakSound, TimerSettings } from '../lib/tracking';
import { setPrefs, usePrefs } from '../lib/prefs';

const presets: { label: string; focus: number; short: number; long: number }[] = [
  { label: '25 / 5 classic', focus: 25, short: 5, long: 15 }, { label: '50 / 10', focus: 50, short: 10, long: 25 },
  { label: '52 / 17', focus: 52, short: 17, long: 30 }, { label: '90 / 20 deep', focus: 90, short: 20, long: 30 }, { label: '15 / 3 sprint', focus: 15, short: 3, long: 10 },
];

export function Stepper({ label, value, min, max, step = 1, unit = 'min', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5">
    <span className="text-[11px] font-semibold">{label}</span>
    <span className="flex items-center gap-1.5">
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Decrease ${label}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-line hover:border-ink disabled:opacity-35"><Minus size={13} /></button>
      <span className="w-[58px] text-center font-mono text-[12px] tabular-nums" aria-live="off">{value}{unit && ` ${unit}`}</span>
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`Increase ${label}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-line hover:border-ink disabled:opacity-35"><Plus size={13} /></button>
    </span>
  </div>;
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5">
    <span className="min-w-0"><span className="block text-[11px] font-semibold">{label}</span>{hint && <span className="mt-0.5 block text-[10px] leading-snug text-muted">{hint}</span>}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
  </label>;
}


/** Every timer option in one place. The timer card, the Zen drawer and Settings all show this same form. */
export function TimerSettingsForm({ narrow = false }: { narrow?: boolean }) {
  const t = useTimer();
  const set = (patch: Partial<TimerSettings>) => t.setSettings(patch);
  return <div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Pomodoro presets">{presets.map((preset) => {
        const active = t.settings.focusMin === preset.focus && t.settings.shortMin === preset.short && t.settings.longMin === preset.long;
        return <button key={preset.label} type="button" aria-pressed={active} onClick={() => set({ focusMin: preset.focus, shortMin: preset.short, longMin: preset.long })} className="studio-button">{preset.label}</button>;
      })}</div>
      <div className={`mt-3 grid gap-2.5 ${narrow ? '' : 'sm:grid-cols-2'}`}>
        <Stepper label="Focus" value={t.settings.focusMin} min={1} max={180} onChange={(focusMin) => set({ focusMin })} />
        <Stepper label="Short break" value={t.settings.shortMin} min={1} max={60} onChange={(shortMin) => set({ shortMin })} />
        <Stepper label="Long break" value={t.settings.longMin} min={1} max={120} onChange={(longMin) => set({ longMin })} />
        <Stepper label="Blocks per set" value={t.settings.cycles} min={2} max={8} unit="" onChange={(cycles) => set({ cycles })} />
        <Stepper label="Countdown" value={t.settings.countdownMin} min={1} max={600} step={5} onChange={(countdownMin) => set({ countdownMin })} />
        <Stepper label="Daily goal" value={t.settings.dailyGoalMin} min={0} max={960} step={15} onChange={(dailyGoalMin) => set({ dailyGoalMin })} />
      </div>
      <div className="mt-3 grid gap-2.5">
        <Toggle label="Start the next block automatically" hint="Breaks and focus blocks follow each other without a click." checked={t.settings.autoNext} onChange={(autoNext) => set({ autoNext })} />
        <Toggle label="Start and pause sound with the timer" hint="Start plays your current mix and pausing the timer pauses it too. Starting again resumes it." checked={t.settings.syncSound} onChange={(syncSound) => set({ syncSound })} />
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5"><span className="text-[11px] font-semibold">During breaks</span>
          <select value={t.settings.breakSound} onChange={(event) => set({ breakSound: event.target.value as BreakSound })} className="field !min-h-8 !w-auto !py-1 text-[11px]"><option value="keep">Keep the sound as is</option><option value="duck">Lower the sound</option><option value="pause">Pause the sound</option></select></label>
        <Toggle label="Chime when a block ends" checked={t.settings.chime} onChange={(chime) => set({ chime })} />
        <p className="px-1 text-[10px] leading-relaxed text-muted">A system notification when a block ends is part of Settings, Notifications (on by default, only while you are in another window).</p>
        <Toggle label="Keep the screen awake" hint="While the timer runs or sound plays. Not every browser supports this." checked={t.settings.wakeLock} onChange={(wakeLock) => set({ wakeLock })} />
      </div>
      {!narrow && <SessionOptions />}
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted"><Bell size={11} /> Timers use the clock, so they stay accurate when this tab is in the background.</p>
  </div>;
}

/** The session rhythm switches: the start question, the wrap-up and the break ideas. */
function SessionOptions() {
  const [prefs] = usePrefs(); const x = prefs.session;
  const set = (patch: Partial<typeof x>) => setPrefs({ session: { ...x, ...patch } });
  return <div className="mt-5 grid gap-2.5 border-t border-line pt-4" data-testid="session-options">
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Session rhythm</p>
    <Toggle label="Ask what I am working on before a block" hint="A short question with a goal and a length when you press Start." checked={x.askStart} onChange={(askStart) => set({ askStart })} />
    {x.askStart && <Toggle label="... and how long" checked={x.askMinutes} onChange={(askMinutes) => set({ askMinutes })} />}
    {x.askStart && <Toggle label="... with study technique ideas" hint="Goal starters such as blank-page recall and practice questions, based on learning research." checked={x.techniques} onChange={(techniques) => set({ techniques })} />}
    <Toggle label="Check in after each block" hint="Did you reach the goal, and what next: another block, a break or done." checked={x.wrapUp} onChange={(wrapUp) => set({ wrapUp })} />
    {x.wrapUp && <Toggle label="... ask how focused I felt (1 to 5)" checked={x.rate} onChange={(rate) => set({ rate })} />}
    {x.wrapUp && <Toggle label="... offer to schedule reviews" hint="Remind me to revisit the topic after 1, 3 and 7 days (spaced review)." checked={x.reviewLater} onChange={(reviewLater) => set({ reviewLater })} />}
    <Toggle label="Mindful ideas for breaks" hint="One small suggestion at a time: look far away, stretch, drink water, breathe." checked={x.breakIdeas} onChange={(breakIdeas) => set({ breakIdeas })} />
    {x.breakIdeas && <Toggle label="... also in the break notification" checked={x.breakNotify} onChange={(breakNotify) => set({ breakNotify })} />}
  </div>;
}
