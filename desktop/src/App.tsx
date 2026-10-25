import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { FlowCard, Hero, HeroStrip } from './components/Hero';
import { Soundscape } from './components/Soundscape';
import { TimerSection } from './components/TimerSection';
import { LayerMixer } from './components/LayerMixer';
import { MixLibrary } from './components/MixLibrary';
import { Achievements } from './components/Achievements';
import { MediaSessionBridge } from './components/MediaSessionBridge';
import { IntegrationsBridge } from './components/desktop/IntegrationsBridge';
import { TrackingSummary } from './components/TrackingSummary';
import { useFeatures } from './hooks/useFeatures';
import { chooseLevel, toggleSimple } from './lib/uiActions';
import { visiblePages } from './lib/uiLevel';
import { useAchievementTracker } from './hooks/useAchievements';
import { TimeTracking } from './components/TimeTracking';
import { ProgressLab } from './components/ProgressLab';
import { TimeTrackingLegacy } from './components/TimeTrackingLegacy';
import { ShieldSection } from './components/ShieldSection';
import { VideoPlaylist } from './components/VideoPlaylist';
import { StudyRoomLibrary } from './components/StudyRoomLibrary';
import { getLive, roomController } from './lib/studyRoom';
import { FocusScience } from './components/FocusScience';
import { FocusReasons } from './components/FocusReasons';
import { NeuralLock } from './components/NeuralLock';
import { ZenView } from './components/ZenView';
import { MiniPlayer } from './components/MiniPlayer';
import { PuckBridge } from './components/PuckBridge';
import { AutomationBridge } from './components/AutomationBridge';
import { DriftBridge } from './components/DriftBridge';
import { CalendarBridge } from './components/CalendarBridge';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { TooltipOverlay } from './components/TooltipOverlay';
import { TitleBar } from './components/TitleBar';
import { CompactBar } from './components/CompactBar';
import { CommandPalette, type PaletteAction } from './components/CommandPalette';
import { CustomScrollbar } from './components/CustomScrollbar';
import { AppContextMenu } from './components/AppContextMenu';
import { UpdatePrompt } from './components/UpdatePrompt';
import Toaster from './components/ui/toast';
import { getPrefs } from './lib/prefs';
import { GoalCheck } from './components/GoalCheck';
import { SessionFlow } from './components/SessionFlow';
import { Celebration } from './components/Celebration';
import { SoundProvider, useSound } from './context/SoundContext';
import { TimerProvider, useTimer } from './context/TimerContext';
import { DesktopProvider, useDesktop } from './context/DesktopContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { useTheme } from './hooks/useTheme';
import { feedback } from './lib/feedback';
import { notify } from './components/ui/toast';
import { onAuthNotice } from './lib/cloud';
import { setPrefs, usePrefs } from './lib/prefs';
import { PAGES, useRoute } from './lib/router';
import { readSavedMixes } from './lib/mix';
import { useFullscreen } from './hooks/useFullscreen';
import { builtInMixes } from './lib/mix';
import { isDesktop } from './lib/desktop';
import { CalmBridge } from './components/CalmBridge';
import { FlowBridge } from './components/FlowBridge';
import { AgentPanel } from './components/agent/AgentPanel';
import { AiGuide } from './components/agent/AiGuide';
import { Tutorial } from './components/Tutorial';
import { DownloadCard } from './components/DownloadApp';
import { SUITE } from './lib/suite';
import { beginWindDown, openCalm } from './lib/calmState';

function Studio() {
  const sound = useSound();
  const timer = useTimer();
  const fullscreen = useFullscreen();
  const [zen, setZen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const desktop = useDesktop();
  const enteredFullscreen = useRef(false);
  const [prefs] = usePrefs();
  useAchievementTracker();
  useEffect(() => onAuthNotice((n) => notify({ title: n.title, message: n.message, variant: n.kind === 'error' ? 'error' : 'success', id: 'auth-notice', duration: 9000 })), []);
  const settings = useSettings();
  const theme = useTheme();
  const [palette, setPalette] = useState(false);
  const tabbed = prefs.layout === 'new';
  const [routed, setPage] = useRoute(tabbed);
  const f = useFeatures();
  // A page the current interface level hides falls back to the Studio (the address and saved choice stay as they were).
  const page = visiblePages(PAGES, f).some((item) => item.id === routed) ? routed : 'studio';
  useEffect(() => { document.documentElement.dataset.ui = prefs.uiLevel; }, [prefs.uiLevel]);

  const openZen = useCallback(() => {
    setZen(true);
    if (fullscreen.supported && !document.fullscreenElement) { enteredFullscreen.current = true; void fullscreen.enter(); }
  }, [fullscreen]);
  const closeZen = useCallback(() => {
    setZen(false);
    if (enteredFullscreen.current) { enteredFullscreen.current = false; void fullscreen.exit(); }
  }, [fullscreen]);

  // Keep the latest handlers reachable from one stable key listener.
  const navRef = useRef({ f, tabbed, setPage });
  navRef.current = { f, tabbed, setPage };
  const handlers = useRef({ sound, timer, zen, openZen, closeZen, fullscreen, settings, prefs });
  handlers.current = { sound, timer, zen, openZen, closeZen, fullscreen, settings, prefs };
  useEffect(() => {
    desktop.registerUi({
      toggleZen: () => { if (handlers.current.zen) handlers.current.closeZen(); else handlers.current.openZen(); },
      openZen: () => { if (!handlers.current.zen) handlers.current.openZen(); },
      closeZen: () => { if (handlers.current.zen) handlers.current.closeZen(); },
      toggleFullscreen: () => { void handlers.current.fullscreen.toggle(); },
      openSettings: (tab) => handlers.current.settings.openSettings(tab),
      togglePalette: () => setPalette((value) => !value),
      goPage: (id) => { const ok = visiblePages(PAGES, navRef.current.f).some((item) => item.id === id); if (!ok) { notify({ message: 'That page is hidden in Essentials. Settings > Advanced shows everything.', variant: 'default', duration: 3000 }); return; } if (navRef.current.tabbed) navRef.current.setPage(id as never); else location.hash = ({ studio: 'sound', library: 'mixes', progress: 'tracking', focus: 'shield' } as Record<string, string>)[id] ?? 'sound'; },
      toggleLayout: () => { const next = handlers.current.prefs.layout === 'new' ? 'legacy' : 'new'; setPrefs({ layout: next }); feedback(next === 'new' ? 'New layout' : 'Classic layout', { sound: 'tap', id: 'layout' }); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onCtrl = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key === 'k' || event.key === 'K') { event.preventDefault(); setPalette((value) => !value); }
      else if (event.key === ',') { event.preventDefault(); handlers.current.settings.open ? handlers.current.settings.closeSettings() : handlers.current.settings.openSettings(); }
    };
    window.addEventListener('keydown', onCtrl);
    return () => window.removeEventListener('keydown', onCtrl);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input:not([type="range"]):not([type="checkbox"]), textarea, select, [contenteditable="true"]')) return;
      const h = handlers.current;
      const key = event.key;
      if (key === ' ' || key === 'Spacebar') {
        // Let focused buttons, links and sliders keep their own Space behavior.
        if (target?.closest('button, a, summary, [role="slider"], input[type="range"], input[type="checkbox"]')) return;
        event.preventDefault(); if (getLive().active) roomController()?.toggle(); else h.sound.toggle();
      } else if (key === 't' || key === 'T') h.timer.toggle();
      else if (key === 'z' || key === 'Z') { if (h.zen) h.closeZen(); else h.openZen(); }
      else if (key === 'f' || key === 'F') void h.fullscreen.toggle();
      else if (key === 'n' || key === 'N') h.sound.next();
      else if (key === 'd' || key === 'D') h.timer.markDistraction();
      else if (key === '[') h.sound.nudgeVolume(-5);
      else if (key === ']') h.sound.nudgeVolume(5);
      else if (key === '?') setShortcuts((value) => !value);
      else if (/^[1-9]$/.test(key) && builtInMixes[Number(key) - 1]) {
        const item = builtInMixes[Number(key) - 1];
        h.sound.loadMix(item.mix, item.id);
        feedback(`Loaded ${item.mix.name}`, { sound: 'start', id: 'sound' });
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadByName = useCallback((id: string, name: string, mix: Parameters<typeof sound.loadMix>[0]) => {
    sound.loadMix(mix, id, { play: true });
    feedback(`Loaded ${name}`, { sound: 'start', id: 'sound' });
  }, [sound]);
  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [
      { id: 'sound', group: 'Sound', label: sound.playing ? 'Pause sound' : 'Play sound', hint: 'Space', run: () => sound.toggle() },
      { id: 'next', group: 'Sound', label: 'Next variation', hint: 'N', run: () => sound.next() },
      { id: 'volup', group: 'Sound', label: 'Volume up', hint: ']', run: () => sound.nudgeVolume(5) },
      { id: 'voldown', group: 'Sound', label: 'Volume down', hint: '[', run: () => sound.nudgeVolume(-5) },
      { id: 'timer', group: 'Timer', label: timer.running ? 'Pause timer' : 'Start timer', hint: 'T', run: () => timer.toggle() },
      { id: 'skip', group: 'Timer', label: 'Skip to the next block', keywords: 'next', run: () => timer.skip() },
      { id: 'reset', group: 'Timer', label: 'Reset timer', run: () => timer.reset() },
      { id: 'drift', group: 'Timer', label: 'I drifted', hint: 'D', keywords: 'distraction', run: () => timer.markDistraction() },
      { id: 'zen', group: 'View', label: zen ? 'Close zen view' : 'Open zen view', hint: 'Z', run: () => { if (zen) closeZen(); else openZen(); } },
      { id: 'calm', group: 'Calm', label: 'Open the calm screen', keywords: 'relax scenes screensaver', run: () => openCalm({ tab: 'scene' }) },
      { id: 'breathe', group: 'Calm', label: 'Breathing guide', keywords: 'calm box breathing 478 relax stress', run: () => openCalm({ tab: 'breathe' }) },
      { id: 'ground', group: 'Calm', label: 'Grounding exercise (5-4-3-2-1)', keywords: 'calm anxious panic', run: () => openCalm({ tab: 'ground' }) },
      { id: 'wind', group: 'Calm', label: 'Wind down: fade the sound out', keywords: 'sleep timer calm', run: () => { openCalm({ tab: 'wind' }); } },
      { id: 'wind-go', group: 'Calm', label: `Start the wind-down now (${prefs.calm.windMinutes} min)`, keywords: 'sleep timer fade', run: () => beginWindDown() },
      { id: 'fullscreen', group: 'View', label: 'Full screen on or off', hint: 'F', run: () => void fullscreen.toggle() },
      { id: 'theme', group: 'View', label: theme.dark ? 'Switch to light mode' : 'Switch to dark mode', keywords: 'theme appearance', run: theme.toggle },
      { id: 'layout', group: 'View', label: tabbed ? 'Switch to the classic layout' : 'Switch to the new layout', keywords: 'layout legacy tabs', run: () => { const next = tabbed ? 'legacy' : 'new'; setPrefs({ layout: next }); } },
      { id: 'simple', group: 'View', label: prefs.uiLevel === 'simple' ? 'Leave simple view' : 'Simple view (calmer, smaller app)', keywords: 'minimal calm interface level', run: () => toggleSimple() },
      ...(['standard', 'power'] as const).map((level): PaletteAction => ({ id: `level-${level}`, group: 'View', label: `Interface level: ${level === 'standard' ? 'Standard' : 'Power'}`, keywords: 'simple minimal calm interface', run: () => chooseLevel(level) })),
      ...visiblePages(PAGES, f).map((item): PaletteAction => ({ id: `page-${item.id}`, group: 'Go to', label: item.label, keywords: 'page', run: () => { if (tabbed) setPage(item.id); else location.hash = ({ studio: 'sound', library: 'mixes', progress: 'tracking', focus: 'shield' } as const)[item.id]; } })),
      { id: 'set', group: 'Settings', label: 'Open settings', hint: 'Ctrl+,', run: () => settings.openSettings() },
      ...(['appearance', 'interface', 'sound', 'feedback', 'timer', 'keys', 'cloud', 'data'] as const).map((tab): PaletteAction => ({ id: `set-${tab}`, group: 'Settings', label: `Settings: ${tab === 'feedback' ? 'feedback and Zen' : tab === 'interface' ? 'interface level' : tab === 'cloud' ? 'cloud sync' : tab}`, run: () => settings.openSettings(tab) })),
      { id: 'keys', group: 'Help', label: 'Keyboard shortcuts', hint: '?', run: () => setShortcuts(true) },
      ...builtInMixes.map((item): PaletteAction => ({ id: `mix-${item.id}`, group: 'Mix', label: item.mix.name, keywords: 'load play', run: () => loadByName(item.id, item.mix.name, item.mix) })),
      ...readSavedMixes().map((item): PaletteAction => ({ id: `saved-${item.id}`, group: 'Saved', label: item.name, keywords: 'load play mix', run: () => loadByName(item.id, item.name, item.mix) })),
    ];
    if (desktop.available) {
      list.push(
        { id: 'w-compact', group: 'Window', label: 'Collapse to mini bar', run: () => desktop.run('window.compact') },
        { id: 'w-hide', group: 'Window', label: 'Hide to tray', run: () => desktop.run('window.hide') },
        { id: 'w-pin', group: 'Window', label: desktop.state?.pinned ? 'Unpin from top' : 'Keep on top', run: () => desktop.run('window.pin') },
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound.playing, timer.running, zen, theme.dark, tabbed, palette, prefs.calm.windMinutes, desktop.available, desktop.state?.pinned, sound.activeId]);

  const menu = <AppContextMenu onZen={() => { if (zen) closeZen(); else openZen(); }} zenOpen={zen} onShortcuts={() => setShortcuts(true)} onSettings={() => settings.openSettings()}
    desktop={desktop.available ? { compact: Boolean(desktop.state?.compact), pinned: Boolean(desktop.state?.pinned), globalEnabled: desktop.state?.globalEnabled ?? true, run: (command) => desktop.run(command), mac: desktop.mac } : undefined} />;

  if (desktop.state?.compact) return <><CompactBar />{menu}{palette && <CommandPalette actions={actions} onClose={() => setPalette(false)} />}</>;

  const wide = 'mx-auto w-full max-w-[1160px] px-5 pb-28 sm:px-9 lg:px-12 xl:px-16';
  const layers = !f.layers ? null : f.compactCards
    ? <details className="group mt-6 rounded-2xl border border-line bg-surface px-5 py-4 sm:px-7">
        <summary className="flex items-center justify-between gap-3 text-[14px] font-semibold tracking-tight">More sounds and layers<span className="font-mono text-[10px] font-normal uppercase tracking-wider text-muted">rain, fire, tones</span></summary>
        <div className="[&>section]:mt-5 [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0"><LayerMixer /></div>
      </details>
    : <LayerMixer />;
  return <>
    <TitleBar />
    <CustomScrollbar />
    <Header onZen={openZen} onCalm={() => openCalm({ tab: 'breathe' })} onShortcuts={() => setShortcuts(true)} onSettings={(tab) => settings.openSettings(tab)} onPalette={() => setPalette(true)} layout={prefs.layout} page={page} onPage={setPage} />
    <main>
      {tabbed ? <>
        {page === 'studio' && <>
          {f.heroStrip && <HeroStrip onZen={openZen} />}
          <div className={`${wide} pt-8`}>
            <div className="grid items-start gap-6 xl:grid-cols-[1.08fr_.92fr]">
              <div className="grid gap-6"><FlowCard compact /><Soundscape />{f.neuralLock && <NeuralLock compact />}</div>
              <TimerSection />
            </div>
            {layers}
            <DownloadCard />
          </div>
        </>}
        {page === 'library' && <div className={`${wide} pt-4`}><MixLibrary />{f.videoPlaylist && <VideoPlaylist />}{f.studyRoom && <StudyRoomLibrary onZen={openZen} />}</div>}
        {page === 'progress' && <div className={`${wide} pt-4`}>{f.trackingFull ? <><TimeTracking /><ProgressLab /></> : <TrackingSummary />}{f.achievementsCard && <Achievements />}</div>}
        {page === 'focus' && <div className={`${wide} pt-4`}><FocusReasons /><NeuralLock /><ShieldSection onZen={openZen} /><FocusScience /></div>}
      </> : <>
        {f.heroStrip ? <Hero onZen={openZen} /> : <div className="pt-6" />}
        <div className={`${wide} pt-14`}>
          <div className="grid items-start gap-6 xl:grid-cols-[1.08fr_.92fr]">
            <Soundscape />
            <TimerSection />
          </div>
          {layers}
          {f.pageLibrary && <MixLibrary />}
          {f.pageProgress && <><TimeTrackingLegacy /></>}
          {f.pageProgress && f.achievementsCard && <Achievements />}
          {f.pageFocus && <><FocusReasons /><NeuralLock /></>}
          {f.pageFocus && <ShieldSection onZen={openZen} />}
          {f.videoPlaylist && <VideoPlaylist />}
          {f.studyRoom && <StudyRoomLibrary onZen={openZen} />}
          {f.pageFocus && <FocusScience />}
          <DownloadCard />
        </div>
      </>}
    </main>
    <footer className="border-t border-line px-5 py-6 text-[11px] text-muted sm:px-9 lg:px-12 xl:px-16 no-print">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3">
        <p className={f.footerDetail ? '' : 'hidden'}><strong className="text-ink">Study with Sarang</strong> · a standalone focus studio. No account needed, no tracking. Cloud sync is optional and uses your own Supabase project.</p>
        <p className="flex items-center gap-4"><button type="button" onClick={() => settings.openSettings()} className="font-semibold underline underline-offset-4">Settings</button><button type="button" onClick={() => setShortcuts(true)} className="font-semibold underline underline-offset-4">Keyboard shortcuts</button><a href={SUITE.md.siteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Sarang.md (IB maths)</a><a href={SUITE.study.repoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Source on GitHub</a><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="font-semibold underline underline-offset-4">Back to top</button></p>
      </div>
    </footer>
    <MediaSessionBridge />
    {isDesktop && <IntegrationsBridge />}
    {f.puck && <MiniPlayer zen={zen} onZen={() => { if (zen) closeZen(); else openZen(); }} />}
    <AutomationBridge zen={zen} />
    <DriftBridge />
    <CalendarBridge />
    {isDesktop && <PuckBridge />}
    {isDesktop && <UpdatePrompt />}
    {zen && <ZenView onClose={closeZen} />}
    {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
    {palette && <CommandPalette actions={actions} onClose={() => setPalette(false)} />}
    {menu}
  </>;
}

export default function App() {
  return <SoundProvider><TimerProvider><DesktopProvider><SettingsProvider>
    <Studio />
    <CalmBridge />
    <FlowBridge />
    <AgentPanel />
    <AiGuide />
    <Tutorial />
    <TooltipOverlay />
    <Toaster />
    <GoalCheck />
    <SessionFlow />
    <Celebration onOpenProgress={() => { location.hash = getPrefs().layout === 'new' ? 'progress' : 'tracking'; }} />
  </SettingsProvider></DesktopProvider></TimerProvider></SoundProvider>;
}
