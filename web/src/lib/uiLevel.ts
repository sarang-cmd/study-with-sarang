/**
 * How much of the app is on screen. Three presets and a custom mix:
 *  - Simple:   Studio and Library only. One calm screen, extra controls tucked into "More" drawers.
 *  - Standard: everything you use daily, without the intro strip, key hints and command palette buttons.
 *  - Power:    everything (the app as it was before this setting existed).
 *  - Custom:   your own choice of every item below.
 * Nothing is ever removed, only hidden: switch levels and it all comes back.
 */
export type UiLevel = 'simple' | 'standard' | 'power' | 'custom';
export type PresetLevel = Exclude<UiLevel, 'custom'>;
export type FeatureId =
  | 'pageLibrary' | 'pageProgress' | 'pageFocus'
  | 'heroStrip' | 'soundscape' | 'layers' | 'compactCards' | 'timerModes' | 'timerGoal' | 'timerSettings' | 'timerPlan' | 'puck' | 'neuralLock'
  | 'videoPlaylist' | 'studyRoom' | 'trackingFull' | 'achievementsCard' | 'footerDetail'
  | 'hdrZen' | 'hdrFullscreen' | 'hdrShortcuts' | 'hdrPalette' | 'hdrCloud' | 'hdrTheme' | 'hdrBell' | 'hdrAssistant';

export interface FeatureInfo { id: FeatureId; label: string; hint?: string; group: 'Pages' | 'Studio' | 'Library and progress' | 'Top bar' }

export const FEATURES: FeatureInfo[] = [
  { id: 'pageLibrary', group: 'Pages', label: 'Library page', hint: 'Saved mixes and the video playlist.' },
  { id: 'pageProgress', group: 'Pages', label: 'Progress page', hint: 'Time tracking and achievements.' },
  { id: 'pageFocus', group: 'Pages', label: 'Focus page', hint: 'Distraction shield and the science notes.' },
  { id: 'heroStrip', group: 'Studio', label: 'Intro strip', hint: 'The row of facts above the studio.' },
  { id: 'soundscape', group: 'Studio', label: 'Soundscape card', hint: 'Base sounds and fine tuning.' },
  { id: 'layers', group: 'Studio', label: 'Layer mixer', hint: 'Rain, fire, tones and the other layers.' },
  { id: 'compactCards', group: 'Studio', label: 'Tuck extras into "More" drawers', hint: 'Fine tune and layers stay one click away instead of open.' },
  { id: 'timerModes', group: 'Studio', label: 'Timer modes', hint: 'Pomodoro, stopwatch and countdown. Off keeps the focus timer only.' },
  { id: 'timerGoal', group: 'Studio', label: 'Daily goal bar and block label' },
  { id: 'timerSettings', group: 'Studio', label: 'Timer settings' },
  { id: 'timerPlan', group: 'Studio', label: 'Session plan', hint: 'Pick a subject, set a goal for the block and keep a to-do list.' },
  { id: 'videoPlaylist', group: 'Library and progress', label: 'Video playlist' },
  { id: 'neuralLock', group: 'Studio', label: 'Neural lock card', hint: 'A gentle optional rhythm under your sound, with a short honest explanation.' },
  { id: 'puck', group: 'Studio', label: 'Floating mini player', hint: 'The small timer and sound controls that follow you when you scroll.' },
  { id: 'studyRoom', group: 'Library and progress', label: 'Study room', hint: 'Your own study-with-me videos behind the Zen clock.' },
  { id: 'trackingFull', group: 'Library and progress', label: 'Full tracking dashboard', hint: 'Off shows a short summary: today, streak and the last week.' },
  { id: 'achievementsCard', group: 'Library and progress', label: 'Achievements card' },
  { id: 'footerDetail', group: 'Library and progress', label: 'Footer notes' },
  { id: 'hdrZen', group: 'Top bar', label: 'Zen view button' },
  { id: 'hdrFullscreen', group: 'Top bar', label: 'Full screen button' },
  { id: 'hdrShortcuts', group: 'Top bar', label: 'Keyboard shortcuts button' },
  { id: 'hdrPalette', group: 'Top bar', label: 'Command palette button' },
  { id: 'hdrCloud', group: 'Top bar', label: 'Cloud sync button' },
  { id: 'hdrTheme', group: 'Top bar', label: 'Light and dark button' },
  { id: 'hdrBell', group: 'Top bar', label: 'Notification bell', hint: 'Your unlocks, goals and reminders in one list.' },
  { id: 'hdrAssistant', group: 'Top bar', label: 'Assistant button', hint: 'Chat with an AI (your own key) that can change things in the app for you.' },
];
export const FEATURE_IDS = FEATURES.map((item) => item.id);

export type FeatureMap = Record<FeatureId, boolean>;
const all = (value: boolean): FeatureMap => Object.fromEntries(FEATURE_IDS.map((id) => [id, value])) as FeatureMap;

export const PRESETS: Record<PresetLevel, FeatureMap> = {
  power: { ...all(true), compactCards: false }, // "everything" means nothing is tucked into a drawer
  standard: {
    ...all(true), heroStrip: false, hdrShortcuts: false, hdrPalette: false, footerDetail: false, compactCards: false,
  },
  simple: {
    ...all(false), soundscape: true, layers: true, puck: true, pageLibrary: true, hdrZen: true, hdrTheme: true, timerGoal: true, timerSettings: false, compactCards: true,
    achievementsCard: false,
  },
};

/**
 * Essentials: what the app shows until you turn on Settings > Advanced. A calm studio (sound and timer with a goal),
 * your progress and your saved mixes. Everything else is still there, one switch away.
 */
export const ESSENTIALS: FeatureMap = {
  ...all(false), soundscape: true, layers: true, compactCards: true, puck: true, pageLibrary: true, pageProgress: true,
  timerGoal: true, timerPlan: true, hdrZen: true, hdrBell: true, hdrTheme: true,
};

export const LEVEL_LABELS: Record<UiLevel, string> = { simple: 'Simple', standard: 'Standard', power: 'Power', custom: 'Custom' };
export const LEVEL_BLURBS: Record<UiLevel, string> = {
  simple: 'One calm screen. Studio and Library, with extra controls tucked away.',
  standard: 'Everything you use day to day, without the clutter.',
  power: 'Everything, everywhere.',
  custom: 'Your own choice of every item.',
};

export function sanitizeLevel(value: unknown, fallback: UiLevel = 'standard'): UiLevel {
  return value === 'simple' || value === 'standard' || value === 'power' || value === 'custom' ? value : fallback;
}
/** A saved custom choice: only known ids with true or false. Anything missing falls back to Standard. */
export function sanitizeShow(raw: unknown): Partial<FeatureMap> {
  const out: Partial<FeatureMap> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const id of FEATURE_IDS) { const v = (raw as Record<string, unknown>)[id]; if (typeof v === 'boolean') out[id] = v; }
  return out;
}

export function resolveFeatures(level: UiLevel, show: Partial<FeatureMap>, advanced = true): FeatureMap {
  if (!advanced) return { ...ESSENTIALS };
  if (level !== 'custom') return { ...PRESETS[level] };
  return { ...PRESETS.standard, ...show };
}

/** Pages a level shows, in order. Studio is always there. */
export function visiblePages<T extends { id: string }>(pages: T[], features: FeatureMap): T[] {
  const gate: Record<string, FeatureId | null> = { studio: null, library: 'pageLibrary', progress: 'pageProgress', focus: 'pageFocus' };
  return pages.filter((page) => { const id = gate[page.id]; return id === null || id === undefined ? true : features[id]; });
}
