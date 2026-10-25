import { Eye, MonitorUp, Plus, Trash2 } from 'lucide-react';
import { useMonitors } from '../../hooks/useMonitors';
import { desktop, type MonitorConfig, type MonitorRule } from '../../lib/desktop';
import { useDesktop } from '../../context/DesktopContext';
import { Toggle, Card } from './shared';

/** Where each snap layout sits inside the screen, as fractions (left, top, width, height). Drawn as a tiny picture on the button. */
const FRACTIONS: Record<string, [number, number, number, number]> = {
  left: [0, 0, 0.5, 1], right: [0.5, 0, 0.5, 1], top: [0, 0, 1, 0.5], bottom: [0, 0.5, 1, 0.5], topleft: [0, 0, 0.5, 0.5], topright: [0.5, 0, 0.5, 0.5], bottomleft: [0, 0.5, 0.5, 0.5], bottomright: [0.5, 0.5, 0.5, 0.5],
  'third-left': [0, 0, 1 / 3, 1], 'third-middle': [1 / 3, 0, 1 / 3, 1], 'third-right': [2 / 3, 0, 1 / 3, 1], center: [0.15, 0.1, 0.7, 0.8],
};
export function SnapGlyph({ layout }: { layout: string }) {
  const [x, y, w, h] = FRACTIONS[layout] ?? [0, 0, 1, 1];
  return <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" className="shrink-0"><rect x="0.5" y="0.5" width="21" height="15" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.5" /><rect x={1 + x * 20} y={1 + y * 14} width={w * 20} height={h * 14} rx="1.2" fill="currentColor" /></svg>;
}
export const SNAP_ORDER = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright', 'third-left', 'third-middle', 'third-right', 'center'];
export const SNAP_LABELS: Record<string, string> = { left: 'Left half', right: 'Right half', top: 'Top half', bottom: 'Bottom half', topleft: 'Top left', topright: 'Top right', bottomleft: 'Bottom left', bottomright: 'Bottom right', 'third-left': 'Left third', 'third-middle': 'Middle third', 'third-right': 'Right third', center: 'Centered' };

const THEN_OPTIONS: [string, string][] = [['none', 'Nothing else'], ['zen', 'Open Zen'], ['zen-full', 'Open Zen in full screen'], ['zen-off', 'Close Zen and leave full screen'], ['compact', 'Collapse to the mini bar'], ['expand', 'Expand to the full window'], ...SNAP_ORDER.map((l): [string, string] => [`snap:${l}`, `Snap: ${SNAP_LABELS[l]}`])];
const sel = 'field !min-h-8 !w-auto max-w-[240px] !py-1 text-[11px]';

export function SnapCard() {
  const { run, info } = useDesktop();
  return <Card title="Snap the window" hint="Put the window in half, a quarter or a third of the screen it is on. These work with any window buttons.">
    <div className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-3 xl:grid-cols-4" data-testid="snap-grid">
      {SNAP_ORDER.map((l) => <button key={l} type="button" data-snap={l} onClick={() => run(`window.snap:${l}`)} className="studio-button !justify-start !whitespace-nowrap !px-3"><SnapGlyph layout={l} />{SNAP_LABELS[l]}</button>)}
    </div>
    {info?.platform === 'win32' && <p className="mt-3 text-[11px] leading-relaxed text-muted">Windows 11 also offers its own layouts when you hover the maximize button, and Win + arrow keys always work. For the hover menu, choose "System" under Window buttons above. The "Custom" buttons are drawn by this app, so Windows cannot attach its menu to them.</p>}
  </Card>;
}

export function MonitorsCard() {
  const { data, save } = useMonitors();
  const { run } = useDesktop();
  if (!data) return null;
  const { list, config } = data;
  const update = (patch: Partial<MonitorConfig>) => void save({ ...config, ...patch });
  const nameOf = (key: string) => list.find((m) => m.key === key)?.name ?? config.seen[key]?.name ?? 'Unknown screen';
  const options = [...list.map((m) => ({ key: m.key, label: m.name })), ...Object.keys(config.seen).filter((k) => !list.some((m) => m.key === k)).map((k) => ({ key: k, label: `${config.seen[k].name} (not connected)` }))];
  const setRule = (id: string, patch: Partial<MonitorRule>) => update({ rules: config.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const addRule = () => update({ rules: [...config.rules, { id: `r${Date.now().toString(36)}`, enabled: true, on: 'connect', monitor: '', moveTo: 'trigger', then: 'none', atStart: false }] });
  return <Card title="Screens" hint="Your screens, named by what they are instead of main and secondary. Rename them, choose where the app lives, and set what happens when a screen is plugged in or removed.">
    <ul className="grid gap-2" data-testid="monitor-list">
      {list.map((m, i) => <li key={m.key} data-monitor={m.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-[11px]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[12px] font-bold text-canvas">{i + 1}</span>
        <span className="min-w-[140px] flex-1"><span className="block font-semibold">{m.name}</span><span className="block text-muted">{m.width} x {m.height}{m.scale !== 1 ? ` at ${Math.round(m.scale * 100)}%` : ''}{m.primary ? ' · Windows main display' : ''}{m.current ? ' · the app is here' : ''}</span></span>
        <input aria-label={`Name for screen ${i + 1}`} className="field !min-h-8 !w-[150px] !py-1 text-[11px]" placeholder={m.natural || 'Your own name'} maxLength={40} defaultValue={m.nickname} onBlur={(e) => { const v = e.target.value.trim(); if (v !== m.nickname) { const names = { ...config.names }; if (v) names[m.key] = v; else delete names[m.key]; update({ names }); } }} />
        <button type="button" className="studio-button !min-h-8" disabled={m.current} onClick={() => run(`window.moveto:${m.id}`)}><MonitorUp size={13} />Move here</button>
      </li>)}
    </ul>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="studio-button" onClick={() => desktop?.monitorsIdentify()}><Eye size={13} />Show which is which</button>
      <label className="flex items-center gap-2 text-[11px] font-semibold">Keep the app on
        <select aria-label="Keep the app on one screen" className={sel} value={config.onlyOn} onChange={(e) => update({ onlyOn: e.target.value })}>
          <option value="">Any screen</option>{options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
    </div>
    {config.onlyOn && <p className="mt-2 text-[11px] text-muted">If the window ends up on another screen, it moves back to {nameOf(config.onlyOn)}. If that screen is not connected, the window stays where it is.</p>}

    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2"><h4 className="text-[12px] font-semibold">When a screen connects or leaves</h4>
        <button type="button" className="studio-button !min-h-8" data-testid="add-monitor-rule" onClick={addRule} disabled={config.rules.length >= 12}><Plus size={13} />Add a rule</button></div>
      <p className="mt-1 text-[11px] text-muted">For example: when your external monitor connects, move the app there and open Zen in full screen. When it leaves, come back to your laptop screen and close Zen.</p>
      <ul className="mt-3 grid gap-2" data-testid="monitor-rules">
        {config.rules.length === 0 && <li className="text-[11px] text-muted">No rules yet.</li>}
        {config.rules.map((r) => <li key={r.id} data-rule={r.id} className="grid gap-2 rounded-lg border border-line p-3 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <input type="checkbox" role="switch" aria-label="Rule on" checked={r.enabled} onChange={(e) => setRule(r.id, { enabled: e.target.checked })} className="h-4 w-4 accent-ink" />
            <span className="font-semibold">When</span>
            <select aria-label="Which screen" className={sel} value={r.monitor} onChange={(e) => setRule(r.id, { monitor: e.target.value })}><option value="">any screen</option>{options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
            <select aria-label="Connects or leaves" className={sel} value={r.on} onChange={(e) => setRule(r.id, { on: e.target.value as 'connect' | 'disconnect', moveTo: e.target.value === 'connect' ? 'trigger' : 'primary', atStart: false })}><option value="connect">connects</option><option value="disconnect">is removed</option></select>
            <button type="button" aria-label="Delete this rule" className="ml-auto rounded-full p-1.5 hover:bg-surface" onClick={() => update({ rules: config.rules.filter((x) => x.id !== r.id) })}><Trash2 size={13} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">move the app to</span>
            <select aria-label="Move the app to" className={sel} value={r.moveTo} onChange={(e) => setRule(r.id, { moveTo: e.target.value })}>
              {r.on === 'connect' && <option value="trigger">that screen</option>}<option value="primary">the Windows main screen</option><option value="keep">nowhere (stay)</option>{options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <span className="font-semibold">then</span>
            <select aria-label="Then do" className={sel} value={r.then} onChange={(e) => setRule(r.id, { then: e.target.value })}>{THEN_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          </div>
          {r.on === 'connect' && <Toggle label="Also when the app starts and that screen is already connected" checked={r.atStart} onChange={(atStart) => setRule(r.id, { atStart })} disabled={!r.monitor} hint={r.monitor ? undefined : 'Pick a screen above first.'} />}
        </li>)}
      </ul>
    </div>
  </Card>;
}
