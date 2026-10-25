import { ArrowLeft, ArrowRight, ExternalLink, Plus, X } from 'lucide-react';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';
import { closePopout, openPopout, popoutSupported, usePopout } from '../PuckPopout';
import { PuckView } from '../PuckView';
import { desktop, isDesktop } from '../../lib/desktop';
import { defaultPuck, PUCK_ACTIONS, PUCK_INFO, setPuck, usePuck, type PuckAction, type PuckCorner, type PuckDesk, type PuckInfo, type PuckLabelClick, type PuckMain, type PuckPage, type PuckSize, type PuckState } from '../../lib/puck';

const SAMPLE: PuckState = { title: 'Rain on a window', clock: '18:42', phase: 'Focus', subject: 'Maths AA HL', goal: 'Finish exercise 4B', progress: 0.38, daily: 0.6, todos: 3, timerRunning: true, hasSegment: true, soundPlaying: true, mode: 'pomodoro' };

function move<T>(list: T[], i: number, dir: -1 | 1): T[] { const j = i + dir; if (j < 0 || j >= list.length) return list; const out = [...list]; [out[i], out[j]] = [out[j], out[i]]; return out; }

export function PuckTab() {
  const p = usePuck(); const pop = usePopout();
  const toggleInfo = (id: PuckInfo, on: boolean) => setPuck({ info: on ? [...p.info, id] : p.info.filter((x) => x !== id) });
  const chip = (on: boolean) => `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors ${on ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'}`;
  const available = PUCK_ACTIONS.filter((a) => !p.actions.includes(a.id) && (isDesktop || !a.desktopOnly));
  return <div className="grid gap-5">
    <Card title="Preview" hint="This is how your puck looks right now. Change anything below and it updates.">
      <div className="mt-3 flex min-h-[72px] items-center justify-center rounded-xl border border-line bg-surface p-4" data-testid="puck-preview"><PuckView state={SAMPLE} settings={p} desktop={isDesktop} onAction={() => undefined} /></div>
    </Card>

    <Card title="In the app" hint="The small controls that stay in a corner when you scroll away from the timer and sound.">
      <div className="grid gap-2">
        <Row label="Show the mini player" hint="Off hides it everywhere in the app."><Segmented<PuckPage> label="Mini player in the app" value={p.page} onChange={(page) => setPuck({ page })} options={[{ id: 'off', label: 'Off' }, { id: 'scrolled', label: 'When I scroll' }, { id: 'always', label: 'Always' }]} /></Row>
        {p.page === 'scrolled' && <Slider label="Appears after scrolling" value={p.scrollAfter} min={0} max={2000} step={20} defaultValue={defaultPuck.scrollAfter} onChange={(scrollAfter) => setPuck({ scrollAfter })} format={(v) => `${v} px`} />}
        <Toggle label="Only while something is playing or running" hint="Hides the puck when the sound is off and the timer is stopped." checked={p.idleHide} onChange={(idleHide) => setPuck({ idleHide })} />
      </div>
    </Card>

    <Card title={isDesktop ? 'Over every window' : 'Over other windows'} hint={isDesktop ? 'A small window that floats above all your other apps, so you can pause or skip without opening this one. It never steals the keyboard from what you are typing in.' : 'Your browser can float the puck above other windows while this tab stays open.'}>
      {isDesktop ? <div className="grid gap-2">
        <Row label="Show the floating puck" hint="Away: only while another app is in front. While running: whenever the timer or sound is going. Always: all the time."><Segmented<PuckDesk> label="Floating puck" value={p.desk} onChange={(desk) => setPuck({ desk })} options={[{ id: 'off', label: 'Off' }, { id: 'away', label: 'In other apps' }, { id: 'running', label: 'While running' }, { id: 'always', label: 'Always' }]} /></Row>
        <p className="text-[11px] text-muted">Move it by dragging the grip. It remembers where you leave it, and moves back onto a screen if its monitor goes away.</p>
        <div><button type="button" className="studio-button" onClick={() => desktop?.puckResetPosition()}>Put it back in its corner</button></div>
      </div> : <div className="grid gap-2">
        {popoutSupported() ? <div><button type="button" data-testid="puck-popout" className="studio-button" onClick={() => (pop.open ? closePopout() : void openPopout())}><ExternalLink size={13} /> {pop.open ? 'Close the floating window' : 'Float the puck above other windows'}</button></div>
          : <p className="text-[11px] text-muted">This browser cannot float a window above other apps. Chrome and Edge (version 116 or newer) can. The desktop app can always do it, and also remembers its position.</p>}
      </div>}
    </Card>

    <Card title="What it shows" hint="Pick the words and details beside the buttons.">
      <div className="flex flex-wrap gap-2" role="group" aria-label="What the puck shows">
        {PUCK_INFO.map((i) => <button key={i.id} type="button" aria-pressed={p.info.includes(i.id)} title={i.hint} onClick={() => toggleInfo(i.id, !p.info.includes(i.id))} className={chip(p.info.includes(i.id))}>{i.label}</button>)}
      </div>
    </Card>

    <Card title="What the buttons do" hint="The big button is the one you press most. Add, remove and reorder the small ones.">
      <div className="grid gap-3">
        <Row label="The big button" hint="Start and pause the timer, play and pause the sound, or open Zen."><Segmented<PuckMain> label="Big button" value={p.main} onChange={(main) => setPuck({ main })} options={[{ id: 'timer', label: 'Timer' }, { id: 'sound', label: 'Sound' }, { id: 'zen', label: 'Zen' }]} /></Row>
        <div>
          <p className="text-[11px] font-semibold">Small buttons, in order</p>
          <ul className="mt-2 grid gap-1.5" data-testid="puck-actions">
            {p.actions.length === 0 && <li className="text-[11px] text-muted">None. Only the big button shows.</li>}
            {p.actions.map((id, i) => {
              const a = PUCK_ACTIONS.find((x) => x.id === id)!;
              return <li key={id} data-action={id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[11px]">
                <span className="min-w-0 flex-1"><span className="font-semibold">{a.label}</span><span className="ml-2 text-muted">{a.hint}</span></span>
                <button type="button" aria-label={`Move ${a.label} earlier`} disabled={i === 0} className="rounded-full p-1 hover:bg-surface disabled:opacity-30" onClick={() => setPuck({ actions: move(p.actions, i, -1) })}><ArrowLeft size={13} /></button>
                <button type="button" aria-label={`Move ${a.label} later`} disabled={i === p.actions.length - 1} className="rounded-full p-1 hover:bg-surface disabled:opacity-30" onClick={() => setPuck({ actions: move(p.actions, i, 1) })}><ArrowRight size={13} /></button>
                <button type="button" aria-label={`Remove ${a.label}`} className="rounded-full p-1 hover:bg-surface" onClick={() => setPuck({ actions: p.actions.filter((x) => x !== id) })}><X size={13} /></button>
              </li>;
            })}
          </ul>
          {available.length > 0 && p.actions.length < 8 && <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Add a button">
            {available.map((a) => <button key={a.id} type="button" title={a.hint} onClick={() => setPuck({ actions: [...p.actions, a.id as PuckAction] })} className={chip(false)}><Plus size={12} /> {a.label}</button>)}
          </div>}
        </div>
        <Row label="Clicking the words" hint="What happens when you click the name and clock."><Segmented<PuckLabelClick> label="Clicking the words" value={p.labelClick} onChange={(labelClick) => setPuck({ labelClick })} options={[{ id: 'zen', label: 'Zen' }, ...(isDesktop ? [{ id: 'app' as const, label: 'App' }] : []), { id: 'none', label: 'Nothing' }]} /></Row>
      </div>
    </Card>

    <Card title="Look and place">
      <div className="grid gap-2">
        <Row label="Corner" hint="Where it sits in the app, and where the floating puck starts."><Segmented<PuckCorner> label="Corner" value={p.corner} onChange={(corner) => setPuck({ corner })} options={[{ id: 'bl', label: 'Bottom left' }, { id: 'br', label: 'Bottom right' }, { id: 'tl', label: 'Top left' }, { id: 'tr', label: 'Top right' }]} /></Row>
        <Row label="Size"><Segmented<PuckSize> label="Puck size" value={p.size} onChange={(size) => setPuck({ size })} options={[{ id: 'small', label: 'Small' }, { id: 'normal', label: 'Normal' }, { id: 'large', label: 'Large' }]} /></Row>
        <Slider label="Opacity" value={p.opacity} min={40} max={100} step={5} defaultValue={100} onChange={(opacity) => setPuck({ opacity })} format={(v) => `${v}%`} />
        {isDesktop && <Toggle label="Show the drag grip" hint="Without it the floating puck stays where it is." checked={p.grip} onChange={(grip) => setPuck({ grip })} />}
      </div>
      <div className="mt-3"><button type="button" className="studio-button" onClick={() => setPuck({ ...defaultPuck, desk: p.desk })}>Reset these options</button></div>
    </Card>
  </div>;
}
