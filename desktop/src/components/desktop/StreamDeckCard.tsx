import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useDesktop } from '../../context/DesktopContext';
import { COMMANDS, commandLine, commandLink } from '../../lib/commands';
import { notify } from '../ui/toast';
import { Card, copyText } from './shared';

export function StreamDeckCard() {
  const { info, macros, allMixNames } = useDesktop();
  const [id, setId] = useState('sound.toggle');
  const [arg, setArg] = useState('');
  const def = COMMANDS.find((item) => item.id === id);
  const command = def?.arg && arg.trim() ? `${id}:${arg.trim()}` : id;
  const exe = info?.exePath ?? 'C:\\Users\\YOU\\AppData\\Local\\Programs\\Study with Sarang\\Study with Sarang.exe';
  const line = commandLine(exe, command);
  const link = commandLink(command, info?.protocol);
  const copy = (text: string, what: string) => { void copyText(text, () => notify({ message: `${what} copied`, variant: 'success', duration: 1800 })); };
  const options = def?.arg === 'mix' ? allMixNames() : def?.arg === 'macro' ? macros.map((m) => m.name) : [];
  return <Card title="Stream Deck and other controllers" hint="Three ways to press a button and have the app react, with the window hidden or not.">
    <ol className="grid gap-2 text-[11px] leading-relaxed text-muted">
      <li className="rounded-lg border border-line px-3 py-2"><strong className="text-ink">1. Hotkey action.</strong> Add a Stream Deck "Hotkey" button, press the same combination as in Global shortcuts above (F13 to F24 are ideal, then assign that key to the action).</li>
      <li className="rounded-lg border border-line px-3 py-2"><strong className="text-ink">2. Open action with a shortcut file.</strong> The Open action starts a file. Make a Windows shortcut (right-click the desktop, New, Shortcut) whose target is the command line below, then point the Open action at that shortcut. It reaches the running app instantly, or starts it quietly in the tray.</li>
      <li className="rounded-lg border border-line px-3 py-2"><strong className="text-ink">3. Link.</strong> Use a Website action or any tool that opens a URL with the link below. The first time, Windows or your browser asks whether to allow it.</li>
    </ol>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <label className="text-[11px] font-semibold">Action
        <select className="field mt-1 !min-h-9 font-normal" value={id} onChange={(event) => { setId(event.target.value); setArg(''); }}>
          {COMMANDS.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.label}</option>)}
        </select>
      </label>
      {def?.arg && <label className="text-[11px] font-semibold">{def.arg === 'volume' ? 'Level (0 to 100)' : def.arg === 'mix' ? 'Mix name' : 'Macro name'}
        <input className="field mt-1 !min-h-9 font-normal" list="sd-options" value={arg} onChange={(event) => setArg(event.target.value)} placeholder={def.example?.split(':')[1]} />
        <datalist id="sd-options">{options.map((name) => <option key={name} value={name} />)}</datalist>
      </label>}
    </div>
    <div className="mt-3 grid gap-2">
      {[['Command line', line], ['Link', link]].map(([label, text]) => <div key={label} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p><p className="mt-0.5 break-all font-mono text-[10px]">{text}</p></div>
        <button type="button" className="studio-button !min-h-8 shrink-0" onClick={() => copy(text, label)}><Copy size={12} />Copy</button>
      </div>)}
    </div>
    {!info?.exePath && <p className="mt-2 text-[10px] leading-relaxed text-muted">The path shown is the usual install location. Install the app with the setup, then the exact path appears here.</p>}
  </Card>;
}
