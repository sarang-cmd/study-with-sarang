import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { useDesktop } from '../../context/DesktopContext';
import { KeyCapture } from '../KeyCapture';
import { Card, Toggle } from './shared';

export function ShortcutsCard() {
  const { bindings, shortcutResults, setAccelerator, resetBindings, state, mac, run } = useDesktop();
  const enabled = state?.globalEnabled ?? true;
  const list = bindings.filter((binding) => !binding.macroId);
  return <Card title="Global shortcuts" hint="Work from any app, even when this window is hidden. Defaults use Ctrl+Alt+Shift so they stay clear of browsers, editors and games.">
    <Toggle label="Global shortcuts are on" hint="Switch off before a game or a screen share. The on and off shortcut below always works." checked={enabled} onChange={(value) => run(value ? 'shortcuts.enable' : 'shortcuts.disable')} />
    <ul className="mt-3 divide-y divide-line rounded-xl border border-line" aria-label="Shortcut list">
      {list.map((binding) => {
        const result = shortcutResults[binding.id];
        const paused = !enabled && !binding.always;
        return <li key={binding.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold">{binding.label}</p>
            <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${result && !result.ok ? 'text-ink' : 'text-muted'}`}>
              {!binding.accelerator ? 'Not assigned'
                : result && !result.ok ? <><TriangleAlert size={11} aria-hidden="true" />{result.reason}</>
                : result?.warning ? <><TriangleAlert size={11} aria-hidden="true" />{result.warning}</>
                : paused ? 'Paused'
                : result?.active ? <><Check size={11} aria-hidden="true" />Active</>
                : 'Waiting'}
            </p>
          </div>
          <KeyCapture value={binding.accelerator} onChange={(accelerator) => setAccelerator(binding.id, accelerator)} mac={mac} label={binding.label} />
        </li>;
      })}
    </ul>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="max-w-[420px] text-[10px] leading-relaxed text-muted">Tip: F13 to F24 and the media keys are never used by other apps, which makes them ideal for a Stream Deck or a macro pad.</p>
      <button type="button" className="studio-button" onClick={resetBindings}><RotateCcw size={13} />Reset to defaults</button>
    </div>
  </Card>;
}
