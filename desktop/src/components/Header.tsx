import { AppIcon } from './AppIcon';
import { NotificationBell } from './NotificationBell';
import { DownloadPill } from './DownloadApp';
import { openAgent } from '../lib/agentStore';
import { Cloud, Command, Keyboard, Leaf, Maximize, Minimize, Moon, Pause, Play, Settings, Sparkles, Sun, Waves, Wind } from 'lucide-react';
import { useFeatures } from '../hooks/useFeatures';
import { toggleSimple } from '../lib/uiActions';
import { visiblePages } from '../lib/uiLevel';
import { useSound } from '../context/SoundContext';
import { useActiveSection } from '../hooks/useActiveSection';
import { useFullscreen } from '../hooks/useFullscreen';
import { useTheme } from '../hooks/useTheme';
import { useCloud } from './CloudSync';
import { PAGES, type PageId } from '../lib/router';
import { usePrefs, type LayoutId } from '../lib/prefs';

export const sections = [
  { id: 'sound', label: 'Sound' }, { id: 'timer', label: 'Timer' }, { id: 'layers', label: 'Layers' }, { id: 'mixes', label: 'Mixes' },
  { id: 'tracking', label: 'Tracking' }, { id: 'shield', label: 'Shield' }, { id: 'video', label: 'Video' },
];
const ids = sections.map((section) => section.id);

interface HeaderProps { onZen: () => void; onCalm: () => void; onShortcuts: () => void; onSettings: (tab?: string) => void; onPalette: () => void; layout: LayoutId; page: PageId; onPage: (page: PageId) => void }

export function Header({ onZen, onCalm, onShortcuts, onSettings, onPalette, layout, page, onPage }: HeaderProps) {
  const { dark, toggle: toggleTheme } = useTheme();
  const fullscreen = useFullscreen();
  const { playing, toggle } = useSound();
  const cloud = useCloud();
  const scrolled = useActiveSection(ids);
  const f = useFeatures();
  const [prefs] = usePrefs();
  const agentOn = prefs.agent.enabled;
  const simple = prefs.uiLevel === 'simple';
  const tabbed = layout === 'new';
  const gate: Record<string, boolean> = { sound: true, timer: true, layers: f.layers, mixes: f.pageLibrary, tracking: f.pageProgress, shield: f.pageFocus, video: f.videoPlaylist };
  // New layout: four page tabs. Classic layout: the section links of the one long page.
  const items: { id: string; label: string }[] = tabbed ? visiblePages(PAGES, f) : sections.filter((section) => gate[section.id] !== false);
  const active = tabbed ? page : scrolled;
  const activeIndex = items.findIndex((item) => item.id === active);
  const link = (item: { id: string }) => ({ href: `#${item.id}`, onClick: tabbed ? (event: React.MouseEvent) => { event.preventDefault(); onPage(item.id as PageId); } : undefined });
  const iconButton = 'flex h-9 w-9 items-center justify-center rounded-[10px] border border-transparent text-muted transition-colors duration-200 hover:bg-raised hover:text-ink';
  return <header className="sticky top-[var(--titlebar,0px)] z-[70] border-b border-line bg-canvas/95 backdrop-blur-xl no-print">
    <div className="relative flex h-[72px] w-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
      <a href="#top" aria-label="Study with Sarang, back to top" className="group flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-offset-4">
        <AppIcon size={32} className="transition-transform duration-200 group-hover:rotate-[-6deg]" />
        <span className="whitespace-nowrap text-[16px] font-bold tracking-[-0.045em] sm:text-[17px]">
          <span className="min-[480px]:hidden">Study <span className="text-muted">Sarang</span></span>
          <span className="hidden min-[480px]:inline">Study with <span className="text-muted">Sarang</span></span>
        </span>
      </a>

      <nav aria-label="Sections" className="hidden min-w-0 flex-1 justify-center px-2 min-[1280px]:flex">
        <div className="relative grid shrink-0 h-10 w-[var(--navw,560px)] items-center rounded-full border border-line bg-raised p-1" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, ...(tabbed ? { ['--navw' as string]: `${Math.max(1, items.length) * 100}px` } : {}) }}>
          <span aria-hidden="true" className={`absolute bottom-1 left-1 top-1 rounded-full bg-ink shadow-sm transition-[transform,opacity] duration-200 ease-out ${activeIndex < 0 ? 'opacity-0' : ''}`}
            style={{ width: `calc((100% - 8px) / ${items.length})`, transform: `translateX(${Math.max(0, activeIndex) * 100}%)` }} />
          {items.map((section, index) => <a key={section.id} {...link(section)} aria-current={activeIndex === index ? 'true' : undefined}
            className={`relative z-10 flex h-full items-center justify-center rounded-full text-[12px] font-semibold transition-colors duration-200 ${activeIndex === index ? 'text-canvas' : 'text-muted hover:text-ink'}`}>{section.label}</a>)}
        </div>
      </nav>

      <div className="flex items-center gap-1 sm:gap-1.5">
        <DownloadPill />
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause sound' : 'Play sound'} data-tip={playing ? 'Pause sound (Space)' : 'Play sound (Space)'}
          className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-80">
          {playing ? <Pause size={14} /> : <Play size={14} />}<span className="hidden sm:inline">{playing ? 'Pause' : 'Play'}</span>
        </button>
        {prefs.advanced && <button type="button" onClick={toggleSimple} aria-pressed={simple} aria-label="Simple view" data-testid="simple-toggle" data-tip={simple ? 'Simple view is on. Click to go back.' : 'Simple view: a calmer, smaller app'} className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${simple ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}><Leaf size={15} strokeWidth={1.8} /><span className="hidden lg:inline">Simple</span></button>}
        {f.hdrZen && <button type="button" onClick={onCalm} aria-label="Open the calm screen" data-tip="Calm: breathe, scenes, wind down" data-testid="calm-open" className={`${iconButton} border-line`}><Wind size={17} strokeWidth={1.8} /></button>}
        {f.hdrZen && <button type="button" onClick={onZen} aria-label="Open zen view" data-tip="Zen view (Z)" className={`${iconButton} border-line`}><Waves size={17} strokeWidth={1.8} /></button>}
        {f.hdrFullscreen && fullscreen.supported && <button type="button" onClick={() => void fullscreen.toggle()} aria-pressed={fullscreen.active} aria-label={fullscreen.active ? 'Exit full screen' : 'Enter full screen'} data-tip={fullscreen.active ? 'Exit full screen (F)' : 'Full screen (F)'} className={`${iconButton} hidden sm:flex`}>
          {fullscreen.active ? <Minimize size={17} strokeWidth={1.8} /> : <Maximize size={17} strokeWidth={1.8} />}</button>}
        {f.hdrShortcuts && <button type="button" onClick={onShortcuts} aria-label="Keyboard shortcuts" data-tip="Shortcuts (?)" className={`${iconButton} hidden md:flex`}><Keyboard size={17} strokeWidth={1.8} /></button>}
        {f.hdrBell && <NotificationBell className={iconButton} />}
        {f.hdrAssistant && agentOn && <button type="button" onClick={openAgent} aria-label="Assistant" data-testid="agent-open" data-tip="Assistant: ask the app to do things" className={iconButton}><Sparkles size={17} strokeWidth={1.8} /></button>}
        {f.hdrPalette && <button type="button" onClick={onPalette} aria-label="Command palette" data-tip="Command palette (Ctrl+K)" className={`${iconButton} hidden md:flex`}><Command size={17} strokeWidth={1.8} /></button>}
        {f.hdrCloud && <button type="button" onClick={() => onSettings('cloud')} aria-label={cloud.session ? 'Cloud sync, signed in' : 'Cloud sync'} data-tip={cloud.session ? 'Cloud sync (signed in)' : 'Cloud sync (optional)'} className={`${iconButton} relative hidden md:flex`}>
          <Cloud size={17} strokeWidth={1.8} />{cloud.session && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border border-canvas bg-ink" />}
        </button>}
        {f.hdrTheme && <button type="button" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} data-tip={dark ? 'Light mode' : 'Dark mode'} className={iconButton}>
          {dark ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}</button>}
        <button type="button" onClick={() => onSettings()} aria-label="Settings" data-tip="Settings (Ctrl+,)" className={iconButton}><Settings size={17} strokeWidth={1.8} /></button>
      </div>
    </div>
    <nav aria-label="Sections" className="flex gap-1.5 overflow-x-auto border-t border-line px-3 py-2 min-[1280px]:hidden sm:px-6">
      {items.map((section, index) => <a key={section.id} {...link(section)} aria-current={activeIndex === index ? 'true' : undefined}
        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${activeIndex === index ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{section.label}</a>)}
    </nav>
  </header>;
}
