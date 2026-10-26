import { AppIcon } from './AppIcon';
import { ICONS } from '../lib/iconSet';
import { FlaskConical, Bell, CalendarDays, CircleDot, Compass, Workflow, Clapperboard, GraduationCap, Cloud, Database, Flower2, AudioLines, Info, Keyboard, Leaf, MessageCircle, Mic, MonitorSmartphone, Moon, Palette, PauseCircle, SlidersHorizontal, Sparkles, Sun, Timer, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useDesktop } from '../context/DesktopContext';
import { useTimer } from '../context/TimerContext';
import { useTheme } from '../hooks/useTheme';
import { downloadFile, stamp } from '../lib/browser';
import { desktop, isDesktop } from '../lib/desktop';
import { feedback } from '../lib/feedback';
import { getPrefs, replacePrefs, resetPrefs, setPrefs, usePrefs, type IconId, type LayoutId } from '../lib/prefs';
import { sanitizeTimerSettings } from '../lib/tracking';
import { CloudSync } from './CloudSync';
import { MacrosCard } from './desktop/MacrosCard';
import { ShortcutsCard } from './desktop/ShortcutsCard';
import { StreamDeckCard } from './desktop/StreamDeckCard';
import { UpdateCard } from './desktop/UpdateCard';
import { VoiceCard } from './desktop/VoiceCard';
import { WindowCard } from './desktop/WindowCard';
import { Card, Toggle } from './desktop/shared';
import { TimerSettingsForm } from './TimerSettingsForm';
import { Row, Segmented } from './settings/parts';
import { InterfaceTab } from './settings/InterfaceTab';
import { SoundTab } from './settings/SoundTab';
import { AutoPauseCard } from './desktop/AutoPauseCard';
import { DiscordCard } from './desktop/DiscordCard';
import { DesktopOnlyPanel } from './desktop/DesktopOnlyPanel';
import { ensureManifest, getManifest, recordingsVersion, subscribeRecordings } from '../lib/recordings';
import { FlowTab } from './settings/FlowTab';
import { CalmTab } from './settings/CalmTab';
import { SubjectsTab } from './settings/SubjectsTab';
import { StudyRoomTab } from './settings/StudyRoomTab';
import { MonitorsCard, SnapCard } from './desktop/MonitorsCard';
import { AutomationsTab } from './settings/AutomationsTab';
import { DriftTab } from './settings/DriftTab';
import { CalendarTab } from './settings/CalendarTab';
import { AssistantTab } from './settings/AssistantTab';
import { openTour } from '../lib/tutorial';
import { openAiGuide } from './agent/AiGuide';
import { PuckTab } from './settings/PuckTab';
import { AdvancedTab } from './settings/AdvancedTab';
import { NotificationsTab } from './settings/NotificationsTab';

type TabId = 'appearance' | 'interface' | 'sound' | 'autopause' | 'discord' | 'flow' | 'calm' | 'feedback' | 'notifications' | 'subjects' | 'studyroom' | 'puck' | 'automations' | 'drift' | 'calendar' | 'assistant' | 'timer' | 'keys' | 'desktop' | 'voice' | 'cloud' | 'data' | 'about' | 'advanced';
const TABS: { id: TabId; label: string; icon: typeof Palette; desktopOnly?: boolean }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette }, { id: 'interface', label: 'Interface level', icon: Leaf }, { id: 'sound', label: 'Sound', icon: SlidersHorizontal }, { id: 'feedback', label: 'Feedback and Zen', icon: Volume2 }, { id: 'subjects', label: 'Subjects and exams', icon: GraduationCap }, { id: 'studyroom', label: 'Study room', icon: Clapperboard }, { id: 'puck', label: 'Mini player and puck', icon: CircleDot }, { id: 'automations', label: 'Automations', icon: Workflow }, { id: 'drift', label: 'Drift detection', icon: Compass, desktopOnly: true }, { id: 'calendar', label: 'Calendar', icon: CalendarDays }, { id: 'notifications', label: 'Notifications', icon: Bell }, { id: 'timer', label: 'Timer', icon: Timer }, { id: 'flow', label: 'Flow voice and AI', icon: AudioLines }, { id: 'assistant', label: 'Assistant', icon: Sparkles }, { id: 'calm', label: 'Calm and scenes', icon: Flower2 },
  { id: 'keys', label: 'Keys', icon: Keyboard }, { id: 'autopause', label: 'Auto-pause', icon: PauseCircle, desktopOnly: true }, { id: 'discord', label: 'Discord', icon: MessageCircle, desktopOnly: true }, { id: 'desktop', label: 'Window and updates', icon: MonitorSmartphone, desktopOnly: true }, { id: 'voice', label: 'Voice and macros', icon: Mic, desktopOnly: true },
  { id: 'cloud', label: 'Cloud sync', icon: Cloud }, { id: 'data', label: 'Your data', icon: Database }, { id: 'advanced', label: 'Advanced', icon: FlaskConical }, { id: 'about', label: 'About', icon: Info },
];
/** What Settings lists until Advanced is on. */
const ESSENTIAL_TABS: TabId[] = ['appearance', 'sound', 'subjects', 'timer', 'notifications', 'flow', 'keys', 'discord', 'desktop', 'cloud', 'data', 'advanced', 'about'];

function IconChoice({ value, onChange }: { value: IconId; onChange: (value: IconId) => void }) {
  return <div role="radiogroup" aria-label="App icon" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{ICONS.map((icon) => <button key={icon.id} type="button" role="radio" aria-checked={value === icon.id} onClick={() => onChange(icon.id)} title={icon.blurb}
    className={`group flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-[11px] font-semibold transition-all duration-200 hover:-translate-y-0.5 ${value === icon.id ? 'border-ink bg-raised' : 'border-line hover:border-ink'}`}>
    <AppIcon id={icon.id} size={52} className="transition-transform duration-200 group-hover:scale-105" />{icon.label}</button>)}</div>;
}

function AppearanceTab() {
  const [prefs] = usePrefs();
  const { dark, toggle } = useTheme();
  const { info, state } = useDesktop();
  const windows = info?.platform === 'win32';
  const nativeNow = info?.titlebar === 'overlay';
  const wantNative = state?.behavior.nativeControls ?? false;
  return <div className="grid gap-3">
    <Row label="Theme" hint="Follows your system until you choose."><Segmented label="Theme" value={dark ? 'dark' : 'light'} onChange={(v) => { if ((v === 'dark') !== dark) toggle(); }} options={[{ id: 'light', label: 'Light', icon: <Sun size={12} /> }, { id: 'dark', label: 'Dark', icon: <Moon size={12} /> }]} /></Row>
    <Row label="Layout" hint="New: Studio, Library, Progress and Focus pages. Classic: the original single long page."><Segmented<LayoutId> label="Layout" value={prefs.layout} onChange={(layout) => setPrefs({ layout })} options={[{ id: 'new', label: 'New' }, { id: 'legacy', label: 'Classic' }]} /></Row>
    <div className="rounded-xl border border-line bg-canvas px-3.5 py-3"><p className="text-[11px] font-semibold">App icon</p>
      <p className="mb-3 mt-0.5 text-[10px] leading-snug text-muted">{isDesktop ? 'Changes the icon everywhere the app shows one: window, taskbar, tray, notifications, the media controls and your Start menu and desktop shortcuts. The icon of the .exe file itself is fixed by Windows and keeps the original; pinned taskbar icons update after the app restarts.' : 'Changes the icon in the browser tab, in the header and in media controls.'}</p>
      <IconChoice value={prefs.appIcon} onChange={(appIcon) => setPrefs({ appIcon })} /></div>
    <Toggle label="Custom scrollbar" hint={isDesktop ? "A slim bar that stays clear of the window buttons. Off uses the system scrollbar." : "A slim bar that follows the studio colors. Off uses the browser scrollbar."} checked={prefs.customScrollbar} onChange={(customScrollbar) => setPrefs({ customScrollbar })} />
    {windows && <Row label="Window buttons" hint="Custom draws thin icons that match the app. System uses the Windows ones, which allow the snap layouts menu on Windows 11.">
      <span className="flex flex-wrap items-center gap-2"><Segmented label="Window buttons" value={wantNative ? 'system' : 'custom'} onChange={(v) => { void desktop?.setBehavior({ nativeControls: v === 'system' }); }} options={[{ id: 'custom', label: 'Custom' }, { id: 'system', label: 'System' }]} />
        {wantNative !== nativeNow && <button type="button" className="studio-button" onClick={() => desktop?.relaunch()}>Restart to apply</button>}</span></Row>}
  </div>;
}

function FeedbackTab() {
  const [prefs] = usePrefs();
  const timer = useTimer();
  return <div className="grid gap-5">
    <Card title="Quick actions" hint="What happens when you skip, reset, go to the next variation, start or pause, from a button, a key, the tray, a shortcut or your voice.">
      <div className="grid gap-2">
        <Toggle label="Show a message" hint="A small toast, for example Skipped to a short break." checked={prefs.toasts} onChange={(toasts) => setPrefs({ toasts })} />
        <Toggle label="Play an interface sound" hint="A soft tick. Different for next, skip, reset, start and pause." checked={prefs.uiSounds} onChange={(uiSounds) => setPrefs({ uiSounds })} />
        <Toggle label="Achievements" hint="Show the Achievements card in Progress and keep track of them." checked={prefs.achievements} onChange={(achievements) => setPrefs({ achievements })} />
        <Toggle label="Achievement messages" hint="A message and a short chime when one unlocks." checked={prefs.achievementToasts} onChange={(achievementToasts) => setPrefs({ achievementToasts })} />
        <Toggle label="Chime when a block ends" hint="Also used when you skip a block." checked={timer.settings.chime} onChange={(chime) => timer.setSettings({ chime })} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="studio-button" onClick={() => feedback('This is how a message sounds', { sound: 'next', id: 'preview' })}>Try it</button>
      </div>
    </Card>
    <Card title="Zen view" hint="Zen has the same controls as the timer card. Choose what it shows.">
      <div className="grid gap-2">
        <Toggle label="Today's goal bar" checked={prefs.zenGoal} onChange={(zenGoal) => setPrefs({ zenGoal })} />
        <Toggle label="Block label" hint="Name what you are working on, right in Zen." checked={prefs.zenTask} onChange={(zenTask) => setPrefs({ zenTask })} />
        <Toggle label="Sound visualizer" checked={prefs.zenVisualizer} onChange={(zenVisualizer) => setPrefs({ zenVisualizer })} />
        <Toggle label="Control buttons" hint="Off leaves a clock only. Space, T, N, S, R and D still work." checked={prefs.zenControls} onChange={(zenControls) => setPrefs({ zenControls })} />
      </div>
    </Card>
  </div>;
}

function KeysTab() {
  const [prefs] = usePrefs();
  const { state, info } = useDesktop();
  const behavior = state?.behavior;
  const setDesk = (patch: Parameters<NonNullable<typeof desktop>['setBehavior']>[0]) => { void desktop?.setBehavior(patch); };
  const windows = info?.platform === 'win32';
  return <div className="grid gap-5">
    <Card title="Media and Pause keys" hint={isDesktop ? 'Play/Pause starts or pauses sound, Next changes the variation and Stop pauses sound.' : 'The key goes to whatever played most recently, like in any browser. Pause a video in another tab and the key controls that video; play here and it controls this page.'}>
      <div className="grid gap-2">
        <Toggle label="Media keys control sound" hint="Play/Pause, Next track and Stop on your keyboard." checked={isDesktop ? behavior?.mediaKeys !== false : prefs.mediaKeys} onChange={(value) => (isDesktop ? setDesk({ mediaKeys: value }) : setPrefs({ mediaKeys: value }))} />
        {isDesktop && <Toggle label="Only the most recently played app" hint="Like a browser: the key goes to whatever played last, so a video in another window can be paused and resumed with it while this app plays in the background. Off makes this app always take the key." checked={behavior?.mediaKeysFollow !== false} onChange={(value) => setDesk({ mediaKeysFollow: value })} />}
        {isDesktop && behavior && (behavior.mediaKeysFollow !== false && behavior.mediaKeys !== false) !== behavior.mediaFollowActive && <p role="status" className="flex flex-wrap items-center gap-3 text-[11px] text-muted">Restart to apply this change. <button type="button" className="studio-button" onClick={() => desktop?.relaunch()}>Restart now</button></p>}
        <Toggle label="Pause/Break key" hint={isDesktop && !windows ? 'Works while the window is focused on this system.' : 'Press Pause/Break to run the action below.'} checked={isDesktop ? behavior?.pauseKey !== false : prefs.pauseKey} onChange={(value) => (isDesktop ? setDesk({ pauseKey: value }) : setPrefs({ pauseKey: value }))} />
        {isDesktop && <Row label="Pause/Break does"><select aria-label="Pause key action" className="field !min-h-8 !w-auto !py-1 text-[11px]" value={behavior?.pauseKeyCommand ?? 'sound.toggle'} onChange={(event) => setDesk({ pauseKeyCommand: event.target.value })}>
          <option value="sound.toggle">Play or pause sound</option><option value="sound.pause">Pause sound</option><option value="timer.toggle">Start or pause timer</option><option value="zen.toggle">Open or close Zen</option><option value="window.toggle">Show or hide window</option></select></Row>}
      </div>
      {windows && state?.pauseKeyStatus === 'error' && <p role="status" className="mt-3 text-[11px] text-muted">{state.pauseKeyMessage || 'The Pause key could not be claimed.'}</p>}
      {isDesktop && !windows && <p className="mt-3 text-[10px] leading-relaxed text-muted">Outside Windows the Pause key only works while the window is focused.</p>}
    </Card>
    {isDesktop ? <><ShortcutsCard /><StreamDeckCard /></> : <p className="rounded-xl border border-line bg-canvas p-4 text-[11px] leading-relaxed text-muted">Press <kbd className="rounded border border-line px-1">?</kbd> anywhere for the list of page shortcuts. Global shortcuts that work from other apps are part of the desktop app.</p>}
  </div>;
}

function DataTab() {
  const timer = useTimer();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const exportSettings = () => downloadFile(`study-with-sarang-settings-${stamp()}.json`, JSON.stringify({ app: 'study-with-sarang', kind: 'settings', version: 1, exportedAt: new Date().toISOString(), prefs: getPrefs(), timer: timer.settings }, null, 2));
  const importSettings = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || (data as { app?: string }).app !== 'study-with-sarang' || (data as { kind?: string }).kind !== 'settings') throw new Error('not a settings file');
      replacePrefs((data as { prefs?: unknown }).prefs); timer.setSettings(sanitizeTimerSettings((data as { timer?: unknown }).timer));
      setMessage('Settings imported.');
    } catch { setMessage('That file is not a Study with Sarang settings file.'); }
  };
  return <div className="grid gap-5">
    <Card title="Settings backup" hint="Layout, icon, scrollbar, feedback, Zen display and timer options. Mixes, sessions and macros have their own exports where you use them.">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="studio-button" onClick={exportSettings}>Export settings</button>
        <button type="button" className="studio-button" onClick={() => input.current?.click()}>Import settings</button>
        <button type="button" className="studio-button" onClick={() => { if (window.confirm('Reset layout, icon, feedback and Zen display to their defaults?')) { resetPrefs(); setMessage('Display settings reset.'); } }}>Reset display settings</button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSettings(file); event.target.value = ''; }} />
      </div>
      {message && <p role="status" className="mt-3 text-[11px] text-muted">{message}</p>}
    </Card>
    <p className="rounded-xl border border-line bg-canvas p-4 text-[11px] leading-relaxed text-muted">Everything is stored on this device, in the app&apos;s own storage. Cloud sync is off unless you set it up on the Cloud sync tab.</p>
  </div>;
}

function SoundCredits() {
  useSyncExternalStore(subscribeRecordings, recordingsVersion, recordingsVersion);
  useEffect(() => { void ensureManifest(); }, []);
  const files = getManifest()?.files ?? [];
  if (!files.length) return null;
  return <Card title="Sound credits" hint="Real recordings from freesound.org, shared by their authors. Thank you to every one of them.">
    <ul className="grid gap-1.5 text-[11px]" data-testid="about-credits">{files.map((f) => <li key={f.slot} className="rounded-xl border border-line px-3.5 py-2.5"><span className="font-semibold">{f.title ?? f.file}</span>{f.author ? <span className="text-muted"> by {f.author}</span> : null}{f.license ? <span className="text-muted">, {f.license}</span> : null}{f.url ? <span className="mt-0.5 block break-all font-mono text-[10px] text-muted">{f.url}</span> : null}</li>)}</ul>
  </Card>;
}

function AboutTab() {
  const { info } = useDesktop();
  return <div className="grid gap-5">
    <Card title="Study with Sarang" hint="A focus studio for students (IB, GCSE, IGCSE, CBSE, A Level, AP or your own subjects): sound, a timer with goals and to-dos, statistics and more. No account needed, and nothing is tracked.">
      <dl className="grid gap-2 text-[11px]">
        <div className="flex justify-between gap-4 rounded-xl border border-line px-3.5 py-2.5"><dt className="text-muted">Version</dt><dd className="font-mono font-semibold">{info ? info.version : 'web'}</dd></div>
        {info && <div className="flex justify-between gap-4 rounded-xl border border-line px-3.5 py-2.5"><dt className="text-muted">Platform</dt><dd className="font-mono font-semibold">{info.platform}{info.installed ? ', installed' : info.store ? ', Store' : ''}</dd></div>}
      </dl>
      <p className="mt-3 text-[10px] leading-relaxed text-muted">The Focus page explains why steady sound can help. It is an explanation, not a promise.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="studio-button" onClick={() => { openTour(); }} data-testid="about-tour">Show the welcome tour again</button><button type="button" className="studio-button" onClick={() => openAiGuide()}>Open the AI walkthrough</button></div>
    </Card>
    <SoundCredits />
  </div>;
}

/** Settings as a dialog with a tab per topic. Opened from the gear in the top bar, Ctrl+, or the command palette. */
export function SettingsPanel({ tab, onTab, onClose }: { tab: string; onTab: (tab: string) => void; onClose: () => void }) {
  const [prefs] = usePrefs();
  const tabs = TABS.filter((item) => (prefs.advanced || ESSENTIAL_TABS.includes(item.id) || item.id === tab));
  const active = (tabs.find((item) => item.id === tab) ?? tabs[0]).id;
  const close = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (document.querySelector('[data-testid="tour"], [data-testid="aiguide"]')) return; /* a window above Settings takes Escape first */ event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, [onClose]);
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [active]);
  const content: Record<TabId, ReactNode> = {
    appearance: <AppearanceTab />, interface: <InterfaceTab />, sound: <SoundTab />, autopause: <AutoPauseCard />, discord: <DiscordCard />, flow: <FlowTab />, notifications: <NotificationsTab />, subjects: <SubjectsTab />, studyroom: <StudyRoomTab />, puck: <PuckTab />, automations: <AutomationsTab />, drift: <DriftTab />, calendar: <CalendarTab />, assistant: <AssistantTab />, calm: <CalmTab />, feedback: <FeedbackTab />, timer: <Card title="Timer" hint="The same options as the Timer card and Zen."><TimerSettingsForm /></Card>,
    keys: <KeysTab />, desktop: <div className="grid gap-5"><WindowCard /><MonitorsCard /><SnapCard /><UpdateCard /></div>, voice: <div className="grid gap-5"><VoiceCard /><MacrosCard /></div>,
    cloud: <CloudSync number="" embedded extraSynced={isDesktop ? 'macros' : undefined} />, data: <DataTab />, about: <AboutTab />, advanced: <AdvancedTab />,
  };
  const title = tabs.find((item) => item.id === active)?.label ?? 'Settings';
  return <div className="fixed inset-0 z-[125] flex items-center justify-center bg-ink/40 p-3 backdrop-blur-sm sm:p-6" style={{ paddingTop: 'calc(var(--titlebar, 0px) + 12px)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="settings-heading" data-testid="settings-panel" className="flex h-[min(720px,100%)] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float arrive sm:flex-row">
      <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-canvas p-2 sm:w-[210px] sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3">
        <p className="hidden px-2.5 pb-2 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted sm:block">Settings</p>
        {tabs.map(({ id, label, icon: Icon, desktopOnly }) => <button key={id} type="button" aria-current={active === id ? 'page' : undefined} onClick={() => onTab(id)}
          className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${active === id ? 'bg-ink text-canvas' : 'text-muted hover:bg-raised hover:text-ink'}`}><Icon size={14} />{label}{desktopOnly && !isDesktop && <span className="ml-auto rounded-full border border-current px-1.5 text-[8.5px] font-semibold uppercase tracking-wider opacity-70">App</span>}</button>)}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 id="settings-heading" className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <button ref={close} type="button" onClick={onClose} aria-label="Close settings" className="flex h-9 w-9 items-center justify-center rounded-full border border-line hover:border-ink"><X size={15} /></button></div>
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto p-5">{!isDesktop && TABS.find((item) => item.id === active)?.desktopOnly ? <DesktopOnlyPanel id={active} /> : content[active]}</div>
      </div>
    </div>
  </div>;
}
