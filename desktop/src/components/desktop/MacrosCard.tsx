import { ArrowDown, ArrowUp, Play, Plus, Trash2, X } from 'lucide-react';
import { useDesktop } from '../../context/DesktopContext';
import { MAX_MACROS, MAX_STEPS, SNAP_VALUES, STEP_TYPES, describeStep, newMacro, starterMacros, type Macro, type MacroStep } from '../../lib/macros';
import { KeyCapture } from '../KeyCapture';
import { Card } from './shared';

export function MacrosCard() {
  const { macros, setMacros, runMacro, macroRunning, mac, shortcutResults, allMixNames } = useDesktop();
  const patch = (id: string, change: Partial<Macro>) => setMacros((list) => list.map((macro) => (macro.id === id ? { ...macro, ...change } : macro)));
  const patchStep = (id: string, index: number, change: Partial<MacroStep>) =>
    setMacros((list) => list.map((macro) => (macro.id === id ? { ...macro, steps: macro.steps.map((step, i) => (i === index ? { ...step, ...change } : step)) } : macro)));
  const move = (id: string, index: number, delta: number) =>
    setMacros((list) => list.map((macro) => {
      if (macro.id !== id) return macro;
      const steps = [...macro.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return macro;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...macro, steps };
    }));
  const names = allMixNames();
  return <Card title="Macros" hint="Chain several actions into one. Run a macro from a shortcut, by voice ('Sarang, run ...'), from the tray menu or from a Stream Deck button.">
    <datalist id="macro-mix-names">{names.map((name) => <option key={name} value={name} />)}</datalist>
    {macros.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11px] text-muted">No macros yet.</p>}
    <ul className="grid gap-2">
      {macros.map((macro) => {
        const result = shortcutResults[`macro:${macro.id}`];
        return <li key={macro.id}>
          <details className="group rounded-xl border border-line bg-canvas">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold">{macro.name}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted">{macro.steps.length ? macro.steps.map(describeStep).join('  >  ') : 'No steps'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={(event) => { event.preventDefault(); runMacro(macro); }} disabled={!macro.steps.length} className="studio-button !min-h-8 !px-3"><Play size={12} />{macroRunning === macro.id ? 'Running' : 'Run'}</button>
              </span>
            </summary>
            <div className="border-t border-line px-3 py-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Name
                <input className="field mt-1 !min-h-9 font-normal normal-case tracking-normal" value={macro.name} maxLength={40} onChange={(event) => patch(macro.id, { name: event.target.value })} />
              </label>
              <ol className="mt-3 grid gap-1.5" aria-label={`Steps of ${macro.name}`}>
                {macro.steps.map((step, index) => {
                  const kind = STEP_TYPES.find((item) => item.type === step.type);
                  return <li key={index} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-5 text-right font-mono text-[10px] text-muted">{index + 1}</span>
                    <select className="field !min-h-8 !w-auto !py-1 text-[11px]" value={step.type} aria-label={`Step ${index + 1} action`} onChange={(event) => patchStep(macro.id, index, { type: event.target.value as MacroStep['type'], value: '' })}>
                      {STEP_TYPES.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                    </select>
                    {kind?.value === 'mix' && <input className="field !min-h-8 !w-40 !py-1 text-[11px]" list="macro-mix-names" placeholder="Mix name" value={step.value} aria-label={`Step ${index + 1} mix`} onChange={(event) => patchStep(macro.id, index, { value: event.target.value })} />}
                    {kind?.value === 'number' && <input className="field !min-h-8 !w-20 !py-1 text-[11px]" type="number" min={step.type === 'wait' ? 1 : 0} max={step.type === 'wait' ? 600 : 100} value={step.value} aria-label={`Step ${index + 1} value`} onChange={(event) => patchStep(macro.id, index, { value: event.target.value })} />}
                    {kind?.value === 'text' && <input className="field !min-h-8 !w-56 !py-1 text-[11px]" maxLength={120} placeholder="Message" value={step.value} aria-label={`Step ${index + 1} message`} onChange={(event) => patchStep(macro.id, index, { value: event.target.value })} />}
                    {kind?.value === 'layout' && <select className="field !min-h-8 !w-auto !py-1 text-[11px]" value={step.value || 'left'} aria-label={`Step ${index + 1} layout`} onChange={(event) => patchStep(macro.id, index, { value: event.target.value })}>{SNAP_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}</select>}
                    <span className="ml-auto flex items-center">
                      <button type="button" onClick={() => move(macro.id, index, -1)} disabled={index === 0} aria-label="Move step up" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised disabled:opacity-30"><ArrowUp size={12} /></button>
                      <button type="button" onClick={() => move(macro.id, index, 1)} disabled={index === macro.steps.length - 1} aria-label="Move step down" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised disabled:opacity-30"><ArrowDown size={12} /></button>
                      <button type="button" onClick={() => setMacros((list) => list.map((item) => (item.id === macro.id ? { ...item, steps: item.steps.filter((_, i) => i !== index) } : item)))} aria-label="Remove step" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised"><X size={12} /></button>
                    </span>
                  </li>;
                })}
              </ol>
              <button type="button" disabled={macro.steps.length >= MAX_STEPS} onClick={() => patch(macro.id, { steps: [...macro.steps, { type: 'play', value: '' }] })} className="studio-button mt-2 !min-h-8"><Plus size={12} />Add step</button>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Global shortcut</p>
                  <div className="mt-1"><KeyCapture value={macro.shortcut} onChange={(accelerator) => patch(macro.id, { shortcut: accelerator })} mac={mac} label={macro.name} /></div>
                  {macro.shortcut && result && !result.ok && <p className="mt-1 text-[10px]">{result.reason}</p>}
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" className="h-4 w-4 accent-ink" checked={macro.voice} onChange={(event) => patch(macro.id, { voice: event.target.checked })} />Allow voice command</label>
                <button type="button" className="studio-button !min-h-8" onClick={() => setMacros((list) => list.filter((item) => item.id !== macro.id))}><Trash2 size={12} />Delete</button>
              </div>
            </div>
          </details>
        </li>;
      })}
    </ul>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="studio-button" disabled={macros.length >= MAX_MACROS} onClick={() => setMacros((list) => [...list, newMacro()])}><Plus size={13} />New macro</button>
      <button type="button" className="studio-button" onClick={() => setMacros((list) => { const have = new Set(list.map((item) => item.id)); return [...list, ...starterMacros().filter((item) => !have.has(item.id))]; })}>Add the starter macros</button>
    </div>
  </Card>;
}
