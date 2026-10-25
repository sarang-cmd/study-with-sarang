import { useSyncExternalStore } from 'react';

/**
 * Subjects and curricula. People pick their programme (IB Diploma, GCSE, IGCSE, CBSE, A Level, AP, or their own list)
 * and their subjects; every study session can then be tagged with one, which feeds the per-subject statistics.
 * Subject lists are typical offerings, not an official register: add your own subject any time.
 */
export type CurriculumId = 'ib' | 'gcse' | 'igcse' | 'cbse' | 'alevel' | 'ap' | 'custom';
export type Level = '' | 'HL' | 'SL';
export interface SubjectDef { name: string; short: string; group?: string; levels?: Level[]; core?: boolean }
export interface ExamSeason { id: string; label: string; month: number; day: number } // month 1 to 12; the date is approximate
export interface Curriculum {
  id: CurriculumId; label: string; blurb: string; stages: string[]; seasons: ExamSeason[]; groups: string[]; subjects: SubjectDef[]; levels: boolean; typicalCount?: string;
}

const s = (name: string, short: string, group?: string, extra: Partial<SubjectDef> = {}): SubjectDef => ({ name, short, group, ...extra });
const HLSL: Level[] = ['HL', 'SL'];

const IB_GROUPS = ['1 Language and literature', '2 Language acquisition', '3 Individuals and societies', '4 Sciences', '5 Mathematics', '6 The arts', 'Core'];
const IB: SubjectDef[] = [
  s('Language A: Literature', 'LIT', IB_GROUPS[0], { levels: HLSL }), s('Language A: Language and Literature', 'LAL', IB_GROUPS[0], { levels: HLSL }), s('Literature and Performance', 'L&P', IB_GROUPS[0], { levels: ['SL'] }),
  s('Language B', 'LgB', IB_GROUPS[1], { levels: HLSL }), s('Language ab initio', 'Ab', IB_GROUPS[1], { levels: ['SL'] }), s('Classical Languages', 'CL', IB_GROUPS[1], { levels: HLSL }),
  s('Business Management', 'BM', IB_GROUPS[2], { levels: HLSL }), s('Economics', 'ECO', IB_GROUPS[2], { levels: HLSL }), s('Geography', 'GEO', IB_GROUPS[2], { levels: HLSL }), s('Global Politics', 'GP', IB_GROUPS[2], { levels: HLSL }),
  s('History', 'HIS', IB_GROUPS[2], { levels: HLSL }), s('Psychology', 'PSY', IB_GROUPS[2], { levels: HLSL }), s('Social and Cultural Anthropology', 'SCA', IB_GROUPS[2], { levels: HLSL }),
  s('Digital Society', 'DS', IB_GROUPS[2], { levels: HLSL }), s('Philosophy', 'PHI', IB_GROUPS[2], { levels: HLSL }), s('World Religions', 'WR', IB_GROUPS[2], { levels: ['SL'] }),
  s('Biology', 'BIO', IB_GROUPS[3], { levels: HLSL }), s('Chemistry', 'CHE', IB_GROUPS[3], { levels: HLSL }), s('Physics', 'PHY', IB_GROUPS[3], { levels: HLSL }), s('Computer Science', 'CS', IB_GROUPS[3], { levels: HLSL }),
  s('Design Technology', 'DT', IB_GROUPS[3], { levels: HLSL }), s('Environmental Systems and Societies', 'ESS', IB_GROUPS[3], { levels: ['SL'] }), s('Sports, Exercise and Health Science', 'SEHS', IB_GROUPS[3], { levels: HLSL }),
  s('Mathematics: Analysis and Approaches', 'AA', IB_GROUPS[4], { levels: HLSL }), s('Mathematics: Applications and Interpretation', 'AI', IB_GROUPS[4], { levels: HLSL }),
  s('Visual Arts', 'ART', IB_GROUPS[5], { levels: HLSL }), s('Music', 'MUS', IB_GROUPS[5], { levels: HLSL }), s('Theatre', 'THE', IB_GROUPS[5], { levels: HLSL }), s('Film', 'FLM', IB_GROUPS[5], { levels: HLSL }), s('Dance', 'DAN', IB_GROUPS[5], { levels: HLSL }),
  s('Theory of Knowledge', 'TOK', IB_GROUPS[6], { core: true }), s('Extended Essay', 'EE', IB_GROUPS[6], { core: true }), s('Creativity, Activity, Service', 'CAS', IB_GROUPS[6], { core: true }),
];
const GCSE: SubjectDef[] = [
  s('English Language', 'ENL', 'Core'), s('English Literature', 'ENG', 'Core'), s('Mathematics', 'MAT', 'Core'), s('Combined Science', 'SCI', 'Core'),
  s('Biology', 'BIO', 'Sciences'), s('Chemistry', 'CHE', 'Sciences'), s('Physics', 'PHY', 'Sciences'), s('Computer Science', 'CS', 'Sciences'), s('Statistics', 'STA', 'Sciences'),
  s('History', 'HIS', 'Humanities'), s('Geography', 'GEO', 'Humanities'), s('Religious Studies', 'RS', 'Humanities'), s('Citizenship', 'CIT', 'Humanities'), s('Sociology', 'SOC', 'Humanities'), s('Psychology', 'PSY', 'Humanities'),
  s('French', 'FRE', 'Languages'), s('Spanish', 'SPA', 'Languages'), s('German', 'GER', 'Languages'), s('Italian', 'ITA', 'Languages'), s('Latin', 'LAT', 'Languages'),
  s('Art and Design', 'ART', 'Creative and practical'), s('Design and Technology', 'DT', 'Creative and practical'), s('Drama', 'DRA', 'Creative and practical'), s('Music', 'MUS', 'Creative and practical'),
  s('Food Preparation and Nutrition', 'FOOD', 'Creative and practical'), s('Physical Education', 'PE', 'Creative and practical'), s('Media Studies', 'MED', 'Creative and practical'), s('Business', 'BUS', 'Business'), s('Economics', 'ECO', 'Business'),
];
const IGCSE: SubjectDef[] = [
  s('First Language English', 'ENL', 'Languages'), s('English Literature', 'ENG', 'Languages'), s('French', 'FRE', 'Languages'), s('Spanish', 'SPA', 'Languages'), s('German', 'GER', 'Languages'), s('Arabic', 'ARA', 'Languages'), s('Hindi', 'HIN', 'Languages'),
  s('Mathematics', 'MAT', 'Mathematics'), s('Additional Mathematics', 'AM', 'Mathematics'), s('International Mathematics', 'IM', 'Mathematics'),
  s('Biology', 'BIO', 'Sciences'), s('Chemistry', 'CHE', 'Sciences'), s('Physics', 'PHY', 'Sciences'), s('Co-ordinated Sciences', 'SCI', 'Sciences'), s('Environmental Management', 'EM', 'Sciences'),
  s('Computer Science', 'CS', 'Technology'), s('ICT', 'ICT', 'Technology'), s('Design and Technology', 'DT', 'Technology'),
  s('Business Studies', 'BUS', 'Humanities and business'), s('Economics', 'ECO', 'Humanities and business'), s('Accounting', 'ACC', 'Humanities and business'), s('History', 'HIS', 'Humanities and business'), s('Geography', 'GEO', 'Humanities and business'), s('Sociology', 'SOC', 'Humanities and business'),
  s('Art and Design', 'ART', 'Creative'), s('Music', 'MUS', 'Creative'), s('Drama', 'DRA', 'Creative'), s('Physical Education', 'PE', 'Creative'),
];
const CBSE: SubjectDef[] = [
  s('English', 'ENG', 'Languages'), s('Hindi', 'HIN', 'Languages'), s('Sanskrit', 'SAN', 'Languages'),
  s('Mathematics', 'MAT', 'Mathematics and sciences'), s('Science', 'SCI', 'Mathematics and sciences'), s('Physics', 'PHY', 'Mathematics and sciences'), s('Chemistry', 'CHE', 'Mathematics and sciences'), s('Biology', 'BIO', 'Mathematics and sciences'),
  s('Computer Science', 'CS', 'Mathematics and sciences'), s('Informatics Practices', 'IP', 'Mathematics and sciences'), s('Information Technology', 'IT', 'Mathematics and sciences'),
  s('Social Science', 'SST', 'Humanities and commerce'), s('History', 'HIS', 'Humanities and commerce'), s('Geography', 'GEO', 'Humanities and commerce'), s('Political Science', 'POL', 'Humanities and commerce'), s('Economics', 'ECO', 'Humanities and commerce'),
  s('Accountancy', 'ACC', 'Humanities and commerce'), s('Business Studies', 'BST', 'Humanities and commerce'), s('Psychology', 'PSY', 'Humanities and commerce'), s('Sociology', 'SOC', 'Humanities and commerce'), s('Legal Studies', 'LEG', 'Humanities and commerce'),
  s('Physical Education', 'PE', 'Other'), s('Painting', 'PAI', 'Other'), s('Home Science', 'HS', 'Other'),
];
const ALEVEL: SubjectDef[] = [
  s('Mathematics', 'MAT', 'Mathematics and sciences'), s('Further Mathematics', 'FM', 'Mathematics and sciences'), s('Biology', 'BIO', 'Mathematics and sciences'), s('Chemistry', 'CHE', 'Mathematics and sciences'), s('Physics', 'PHY', 'Mathematics and sciences'), s('Computer Science', 'CS', 'Mathematics and sciences'),
  s('Economics', 'ECO', 'Humanities and social'), s('Business', 'BUS', 'Humanities and social'), s('Psychology', 'PSY', 'Humanities and social'), s('Sociology', 'SOC', 'Humanities and social'), s('History', 'HIS', 'Humanities and social'), s('Geography', 'GEO', 'Humanities and social'), s('Politics', 'POL', 'Humanities and social'), s('Law', 'LAW', 'Humanities and social'),
  s('English Literature', 'ENG', 'Languages and arts'), s('French', 'FRE', 'Languages and arts'), s('Spanish', 'SPA', 'Languages and arts'), s('German', 'GER', 'Languages and arts'), s('Art and Design', 'ART', 'Languages and arts'), s('Music', 'MUS', 'Languages and arts'),
  s('Extended Project', 'EPQ', 'Other'),
];
const AP: SubjectDef[] = [
  s('Calculus AB', 'CAB', 'Mathematics and computer science'), s('Calculus BC', 'CBC', 'Mathematics and computer science'), s('Statistics', 'STA', 'Mathematics and computer science'), s('Computer Science A', 'CSA', 'Mathematics and computer science'), s('Computer Science Principles', 'CSP', 'Mathematics and computer science'),
  s('Biology', 'BIO', 'Sciences'), s('Chemistry', 'CHE', 'Sciences'), s('Physics 1', 'PH1', 'Sciences'), s('Physics 2', 'PH2', 'Sciences'), s('Physics C', 'PHC', 'Sciences'), s('Environmental Science', 'ENV', 'Sciences'),
  s('English Language and Composition', 'ELC', 'English and history'), s('English Literature and Composition', 'ELT', 'English and history'), s('US History', 'USH', 'English and history'), s('World History', 'WH', 'English and history'), s('European History', 'EUH', 'English and history'),
  s('Macroeconomics', 'MAC', 'Social sciences'), s('Microeconomics', 'MIC', 'Social sciences'), s('Psychology', 'PSY', 'Social sciences'), s('US Government and Politics', 'GOV', 'Social sciences'), s('Human Geography', 'HG', 'Social sciences'),
  s('Spanish Language', 'SPA', 'Languages and arts'), s('French Language', 'FRE', 'Languages and arts'), s('Art History', 'AH', 'Languages and arts'), s('Music Theory', 'MT', 'Languages and arts'),
];

export const CURRICULA: Curriculum[] = [
  { id: 'ib', label: 'IB Diploma (IBDP)', blurb: 'Six subjects plus the core (TOK, EE and CAS). Exams in May or November.', stages: ['DP1', 'DP2'], levels: true, typicalCount: 'Usually six subjects, three or four at Higher Level.',
    seasons: [{ id: 'may', label: 'May', month: 5, day: 2 }, { id: 'nov', label: 'November', month: 10, day: 31 }], groups: IB_GROUPS, subjects: IB },
  { id: 'gcse', label: 'GCSE', blurb: 'England, Wales and Northern Ireland. Summer exams in May and June.', stages: ['Year 9', 'Year 10', 'Year 11'], levels: false,
    seasons: [{ id: 'summer', label: 'Summer (May and June)', month: 5, day: 12 }, { id: 'nov', label: 'November resits', month: 11, day: 5 }], groups: ['Core', 'Sciences', 'Humanities', 'Languages', 'Creative and practical', 'Business'], subjects: GCSE },
  { id: 'igcse', label: 'IGCSE', blurb: 'Cambridge and Edexcel international GCSEs. Exams in May and June, or October and November.', stages: ['Year 9', 'Year 10', 'Year 11'], levels: false,
    seasons: [{ id: 'summer', label: 'May and June', month: 5, day: 1 }, { id: 'autumn', label: 'October and November', month: 10, day: 10 }, { id: 'feb', label: 'February and March', month: 2, day: 15 }], groups: ['Languages', 'Mathematics', 'Sciences', 'Technology', 'Humanities and business', 'Creative'], subjects: IGCSE },
  { id: 'cbse', label: 'CBSE', blurb: 'India. Board exams for classes 10 and 12 run from February to March.', stages: ['Class 9', 'Class 10', 'Class 11', 'Class 12'], levels: false,
    seasons: [{ id: 'board', label: 'Board exams (February and March)', month: 2, day: 15 }, { id: 'supp', label: 'Supplementary (July)', month: 7, day: 15 }], groups: ['Languages', 'Mathematics and sciences', 'Humanities and commerce', 'Other'], subjects: CBSE },
  { id: 'alevel', label: 'A Level', blurb: 'UK sixth form and international A Levels.', stages: ['Year 12', 'Year 13'], levels: false,
    seasons: [{ id: 'summer', label: 'Summer (May and June)', month: 5, day: 12 }, { id: 'nov', label: 'October and November', month: 10, day: 15 }], groups: ['Mathematics and sciences', 'Humanities and social', 'Languages and arts', 'Other'], subjects: ALEVEL },
  { id: 'ap', label: 'AP (Advanced Placement)', blurb: 'College Board courses. Exams in May.', stages: ['Grade 10', 'Grade 11', 'Grade 12'], levels: false,
    seasons: [{ id: 'may', label: 'May', month: 5, day: 5 }], groups: ['Mathematics and computer science', 'Sciences', 'English and history', 'Social sciences', 'Languages and arts'], subjects: AP },
  { id: 'custom', label: 'Something else', blurb: 'University, a professional exam, or your own plan. Add your own subjects.', stages: [], levels: false, seasons: [], groups: [], subjects: [] },
];
export const curriculum = (id: string): Curriculum => CURRICULA.find((c) => c.id === id) ?? CURRICULA[CURRICULA.length - 1];

// ---- the person's choices -----------------------------------------------------------------------------
export interface UserSubject { id: string; name: string; short: string; level: Level; curriculum: CurriculumId; custom: boolean; group: string; weeklyMin: number; archived: boolean; core: boolean }
export interface ExamTarget { season: string; year: number; date: string } // date is an optional exact YYYY-MM-DD that overrides the estimate
export interface SubjectProfile { curriculum: CurriculumId; stage: string; exam: ExamTarget; subjects: UserSubject[]; asked: boolean; custom: string[] }
export const emptyProfile = (): SubjectProfile => ({ curriculum: 'ib', stage: '', exam: { season: '', year: 0, date: '' }, subjects: [], asked: false, custom: [] });

const slug = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'subject';
export const subjectId = (cur: string, name: string, level: Level = '') => `${cur}:${slug(name)}${level ? `-${level.toLowerCase()}` : ''}`;
const shortOf = (name: string) => { const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean); return (words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join('') : name.slice(0, 3)).toUpperCase(); };

export function makeSubject(cur: CurriculumId, def: SubjectDef, level: Level = def.levels?.[0] ?? ''): UserSubject {
  return { id: subjectId(cur, def.name), name: def.name, short: def.short, level, curriculum: cur, custom: false, group: def.group ?? '', weeklyMin: 0, archived: false, core: Boolean(def.core) };
}
export function makeCustom(name: string, level: Level = ''): UserSubject | null {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 48); if (!clean) return null;
  return { id: subjectId('custom', clean), name: clean, short: shortOf(clean), level, curriculum: 'custom', custom: true, group: 'My subjects', weeklyMin: 0, archived: false, core: false };
}

export function sanitizeProfile(raw: unknown): SubjectProfile {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = emptyProfile();
  const cur = CURRICULA.some((c) => c.id === r.curriculum) ? (r.curriculum as CurriculumId) : d.curriculum;
  const seen = new Set<string>(); const subjects: UserSubject[] = [];
  if (Array.isArray(r.subjects)) for (const item of r.subjects.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const u = item as Record<string, unknown>;
    if (typeof u.id !== 'string' || typeof u.name !== 'string' || !u.name.trim() || seen.has(u.id)) continue;
    seen.add(u.id);
    subjects.push({
      id: u.id.slice(0, 80), name: u.name.slice(0, 60), short: typeof u.short === 'string' && u.short ? u.short.slice(0, 5) : shortOf(u.name),
      level: u.level === 'HL' || u.level === 'SL' ? u.level : '', curriculum: CURRICULA.some((c) => c.id === u.curriculum) ? (u.curriculum as CurriculumId) : 'custom',
      custom: u.custom === true, group: typeof u.group === 'string' ? u.group.slice(0, 40) : '',
      weeklyMin: typeof u.weeklyMin === 'number' && Number.isFinite(u.weeklyMin) ? Math.max(0, Math.min(6000, Math.round(u.weeklyMin))) : 0, archived: u.archived === true, core: u.core === true,
    });
  }
  const e = r.exam && typeof r.exam === 'object' ? (r.exam as Record<string, unknown>) : {};
  const date = typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !Number.isNaN(Date.parse(e.date)) ? e.date : '';
  return {
    curriculum: cur, stage: typeof r.stage === 'string' ? r.stage.slice(0, 20) : '', asked: r.asked === true, subjects,
    exam: { season: typeof e.season === 'string' ? e.season.slice(0, 20) : '', year: typeof e.year === 'number' && e.year > 2000 && e.year < 2100 ? Math.round(e.year) : 0, date },
    custom: Array.isArray(r.custom) ? r.custom.filter((x): x is string => typeof x === 'string').slice(0, 30) : [],
  };
}

// ---- exams ---------------------------------------------------------------------------------------------
/** The next few exam sessions for a programme, starting from today. */
export function upcomingSessions(cur: CurriculumId, now = new Date(), count = 6): { season: string; year: number; label: string }[] {
  const c = curriculum(cur); const out: { season: string; year: number; label: string; at: number }[] = [];
  for (let year = now.getFullYear(); year <= now.getFullYear() + 3; year++) for (const season of c.seasons) {
    const at = new Date(year, season.month - 1, season.day).getTime();
    if (at >= now.getTime() - 40 * 86_400_000) out.push({ season: season.id, year, label: `${season.label} ${year}`, at });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, count).map(({ season, year, label }) => ({ season, year, label }));
}
/** The exam date: the exact one if the person typed it, otherwise an estimate from the session (the start of the exam period). */
export function examDate(profile: SubjectProfile): Date | null {
  if (profile.exam.date) { const [y, m, d] = profile.exam.date.split('-').map(Number); return new Date(y, m - 1, d); }
  const season = curriculum(profile.curriculum).seasons.find((x) => x.id === profile.exam.season);
  return season && profile.exam.year ? new Date(profile.exam.year, season.month - 1, season.day) : null;
}
export function daysUntil(date: Date | null, now = new Date()): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
}
export function countdownLabel(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `${-days} days since the exam period began`;
  if (days === 0) return 'Exams start today';
  const weeks = Math.floor(days / 7);
  return days < 14 ? `${days} days to go` : `${days} days to go (${weeks} weeks)`;
}
/** A friendly note on IB choices. It never blocks anything. */
export function ibNotes(subjects: UserSubject[]): string[] {
  const main = subjects.filter((u) => u.curriculum === 'ib' && !u.core && !u.archived);
  if (!main.length) return [];
  const hl = main.filter((u) => u.level === 'HL').length; const notes: string[] = [];
  if (main.length !== 6) notes.push(`You have ${main.length} subjects chosen. The Diploma is usually six.`);
  if (hl < 3 || hl > 4) notes.push(`${hl} at Higher Level. The usual range is three or four.`);
  return notes;
}

// ---- the store -----------------------------------------------------------------------------------------
export const SUBJECTS_KEY = 'study-with-sarang:subjects';
let profile: SubjectProfile = emptyProfile();
try { if (typeof localStorage !== 'undefined') profile = sanitizeProfile(JSON.parse(localStorage.getItem(SUBJECTS_KEY) ?? 'null')); } catch { /* Start empty. */ }
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getProfile = () => profile;
export function setProfile(next: Partial<SubjectProfile>) {
  profile = sanitizeProfile({ ...profile, ...next });
  try { localStorage.setItem(SUBJECTS_KEY, JSON.stringify(profile)); } catch { /* Kept for this visit. */ }
  listeners.forEach((fn) => fn());
}
export const useProfile = () => useSyncExternalStore(subscribe, getProfile, getProfile);
export const activeSubjects = (p: SubjectProfile = profile) => p.subjects.filter((u) => !u.archived);
export function toggleSubject(def: SubjectDef, cur: CurriculumId, on: boolean) {
  const id = subjectId(cur, def.name);
  if (!on) { setProfile({ subjects: profile.subjects.filter((u) => u.id !== id) }); return; }
  if (profile.subjects.some((u) => u.id === id)) return;
  setProfile({ subjects: [...profile.subjects, makeSubject(cur, def)] });
}
export function addCustomSubject(name: string, level: Level = ''): boolean {
  const made = makeCustom(name, level); if (!made || profile.subjects.some((u) => u.id === made.id)) return false;
  setProfile({ subjects: [...profile.subjects, made] }); return true;
}
export function updateSubject(id: string, patch: Partial<UserSubject>) { setProfile({ subjects: profile.subjects.map((u) => (u.id === id ? { ...u, ...patch, id: u.id } : u)) }); }
export function removeSubject(id: string) { setProfile({ subjects: profile.subjects.filter((u) => u.id !== id) }); }
export function resetSubjectsForTest() { profile = emptyProfile(); listeners.forEach((fn) => fn()); }

/** How a subject appears in lists: "Physics HL". Unknown ids (a deleted subject) show as their id's tail. */
export function subjectLabel(id: string, p: SubjectProfile = profile): string {
  const u = p.subjects.find((x) => x.id === id);
  if (u) return u.level ? `${u.name} ${u.level}` : u.name;
  return id ? id.split(':').pop()!.replace(/-/g, ' ') : 'No subject';
}
export function subjectShort(id: string, p: SubjectProfile = profile): string {
  const u = p.subjects.find((x) => x.id === id); return u ? `${u.short}${u.level ? ` ${u.level}` : ''}` : id ? id.split(':').pop()!.slice(0, 4).toUpperCase() : '·';
}
