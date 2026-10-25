/**
 * The tools the assistant may use. Each one does what you could do by hand in the app, through the same stores and the
 * same cleaning functions, so the assistant can never store something the app would not accept.
 * Not reachable by the assistant, on purpose: API keys, the pairing code, server addresses, clearing your data, quitting.
 */
import type { ToolDef } from './agent';
import { COMMANDS } from './commands';
import { ALLOWED_IDS, validateCommand } from './flowApi';
import { TRIGGERS, getAutomations, newAutomation, setAutomations, MAX_AUTOMATIONS, type Automation, type TriggerId } from './automations';
import { STEP_TYPES, MAX_MACROS, newMacro, sanitizeMacros, type Macro } from './macros';
import { getPrefs, sanitizePrefs, setPrefs, type Prefs } from './prefs';
import { addTodo, editTodo, getPlan, getTodos, removeTodo, setPlan, toggleTodo } from './plan';
import { CURRICULA, activeSubjects, addCustomSubject, curriculum, getProfile, removeSubject, setProfile, toggleSubject, type CurriculumId } from './subjects';
import { sanitizeTimerSettings, type TimerSettings } from './tracking';
import { FEATURES } from './uiLevel';

export interface AgentRuntime {
  execute: (command: string) => void;
  timer: { running: boolean; phase: string; mode: string; seconds: number; task: string; settings: TimerSettings; setSettings: (patch: Partial<TimerSettings>) => void };
  sound: { playing: boolean; volume: number };
  mixNames: () => string[];
  macros: () => Macro[];
  setMacros: (next: Macro[]) => void;
  desktop: boolean;
}

/** Settings the assistant may never read or write: they point data somewhere, or are secrets. */
export const BLOCKED_PATHS = ['drift.token', 'drift.port', 'drift.helper', 'flow.customUrl', 'flow.cloudUrl', 'flow.keyCodes', 'flow.keyId', 'discord.appId', 'recordings.cloudBase', 'agent.enabled', 'agent.confirm', 'agent.groups'];
const isBlocked = (path: string) => BLOCKED_PATHS.some((b) => path === b || path.startsWith(`${b}.`));

export type Leaf = boolean | number | string;
/** Every simple setting as "section.name": value. Lists are left out. */
export function flattenSettings(value: unknown, prefix = '', out: Record<string, Leaf> = {}): Record<string, Leaf> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') out[path] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) flattenSettings(v, path, out);
  }
  return out;
}
const getAt = (obj: unknown, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
function setAt<T>(obj: T, path: string, value: unknown): T {
  const copy = structuredClone(obj) as Record<string, unknown>; const keys = path.split('.'); let o = copy;
  for (const k of keys.slice(0, -1)) { o[k] = (o[k] && typeof o[k] === 'object' ? { ...(o[k] as object) } : {}) as Record<string, unknown>; o = o[k] as Record<string, unknown>; }
  o[keys[keys.length - 1]] = value; return copy as T;
}

/** The whole settings view for the assistant: prefs plus timer settings plus the "show this feature" switches. */
export function settingsView(prefs: Prefs, timer: TimerSettings): Record<string, Leaf> {
  const out = flattenSettings(prefs);
  for (const f of FEATURES) out[`uiShow.${f.id}`] = prefs.uiShow[f.id] ?? false;
  delete out.uiPrev;
  Object.assign(out, flattenSettings(timer, 'timer'));
  for (const key of Object.keys(out)) if (isBlocked(key)) delete out[key];
  return out;
}

export interface ApplyResult { ok: boolean; message?: string; applied?: Leaf; clamped?: boolean }
/** Applies one setting through the same cleaning as the settings screens. Pure apart from the two callbacks. */
export function applySetting(path: string, value: unknown, prefs: Prefs, timer: TimerSettings, write: { prefs: (patch: Partial<Prefs>) => void; timer: (patch: Partial<TimerSettings>) => void }): ApplyResult {
  if (isBlocked(path)) return { ok: false, message: 'That setting is not available to the assistant. Change it yourself under Settings.' };
  const view = settingsView(prefs, timer);
  if (!(path in view)) return { ok: false, message: `There is no setting called ${path}. Use list_settings to see the names.` };
  const current = view[path];
  if (typeof value !== typeof current) return { ok: false, message: `${path} needs a ${typeof current} value, not ${typeof value}.` };
  if (typeof value === 'string' && value.length > 400) return { ok: false, message: 'That text is too long.' };
  if (path.startsWith('timer.')) {
    const key = path.slice(6); const cleaned = sanitizeTimerSettings({ ...timer, [key]: value }); const applied = (cleaned as unknown as Record<string, Leaf>)[key];
    write.timer({ [key]: applied } as Partial<TimerSettings>); return { ok: true, applied, clamped: applied !== value };
  }
  if (path.startsWith('uiShow.')) {
    const id = path.slice(7); const next = { ...prefs.uiShow, [id]: value as boolean };
    const clean = sanitizePrefs({ ...prefs, uiShow: next, uiLevel: 'custom' });
    write.prefs({ uiShow: clean.uiShow, uiLevel: 'custom', advanced: true }); return { ok: true, applied: Boolean(clean.uiShow[id as keyof typeof clean.uiShow]), clamped: false, message: 'The interface level is now Custom.' };
  }
  const clean = sanitizePrefs(setAt(prefs, path, value));
  const applied = getAt(clean, path) as Leaf; const top = path.split('.')[0] as keyof Prefs;
  write.prefs({ [top]: clean[top] } as Partial<Prefs>);
  return { ok: true, applied, clamped: applied !== value };
}

/** Models send everything as text; turn it into the type the setting has. Anything odd stays text so the type check refuses it. */
export function coerce(value: unknown, current: Leaf | undefined): unknown {
  if (typeof value !== 'string') return value;
  if (typeof current === 'boolean') { const v = value.trim().toLowerCase(); return ['true', 'on', 'yes', '1'].includes(v) ? true : ['false', 'off', 'no', '0'].includes(v) ? false : value; }
  if (typeof current === 'number') { const n = Number(value.trim().replace(',', '.')); return value.trim() !== '' && Number.isFinite(n) ? n : value; }
  return value;
}

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string' as const, description, ...extra });
const obj = (properties: Record<string, never> | Record<string, unknown>, required: string[] = []) => ({ type: 'object' as const, properties: properties as never, required });

const findSubject = (text: string) => {
  const t = text.trim().toLowerCase(); if (!t) return '';
  const list = activeSubjects();
  const hit = list.find((u) => u.id === text || u.name.toLowerCase() === t || u.short.toLowerCase() === t || `${u.name} ${u.level}`.toLowerCase() === t) ?? list.find((u) => u.name.toLowerCase().includes(t));
  return hit?.id ?? null;
};

export function buildTools(rt: AgentRuntime): ToolDef[] {
  const mixNames = () => rt.mixNames(); const macroNames = () => rt.macros().map((m) => m.name);
  const t = (x: ToolDef) => x;
  return [
    t({ name: 'get_app_state', group: 'read', write: false, description: 'The current situation: timer, sound, subject and goal, open to-dos, chosen subjects, exam, automations, macros and mix names.', parameters: obj({}), summary: () => 'Looked at the app',
      run: () => {
        const plan = getPlan(); const profile = getProfile(); const todos = getTodos();
        return {
          timer: { running: rt.timer.running, phase: rt.timer.phase, mode: rt.timer.mode, secondsLeftOrElapsed: Math.round(rt.timer.seconds), task: rt.timer.task },
          sound: { playing: rt.sound.playing, volumePercent: Math.round(rt.sound.volume * 100) }, plan,
          todos: { open: todos.filter((x) => !x.done).length, done: todos.filter((x) => x.done).length, first: todos.slice(0, 15).map((x) => ({ id: x.id, text: x.text, done: x.done, subject: x.subject })) },
          subjects: activeSubjects().map((u) => ({ id: u.id, name: u.name, level: u.level })), curriculum: profile.curriculum, stage: profile.stage, exam: profile.exam,
          automations: getAutomations().map((a) => ({ id: a.id, name: a.name, enabled: a.enabled })), macros: macroNames(), mixes: mixNames(), desktopApp: rt.desktop, interfaceLevel: getPrefs().uiLevel,
        };
      } }),
    t({ name: 'describe_options', group: 'read', write: false, description: 'The allowed values: commands, automation triggers, step types, curricula with exam seasons.', parameters: obj({}), summary: () => 'Looked up the options',
      run: () => ({
        commands: COMMANDS.filter((c) => ALLOWED_IDS.has(c.id) && !['app.quit', 'app.login', 'app.update'].includes(c.id)).map((c) => `${c.id}${c.arg ? ':<arg>' : ''} (${c.label})`),
        triggers: TRIGGERS.filter((x) => rt.desktop || !x.desktopOnly).map((x) => ({ id: x.id, label: x.label, param: x.param })),
        stepTypes: STEP_TYPES.filter((x) => rt.desktop || !x.desktopOnly).map((x) => ({ type: x.type, value: x.value ?? 'none' })),
        curricula: CURRICULA.map((c) => ({ id: c.id, label: c.label, stages: c.stages, seasons: c.seasons.map((s) => s.id), subjects: c.subjects.slice(0, 80).map((s) => s.name) })),
        mixes: mixNames(), macros: macroNames(),
      }) }),
    t({ name: 'run_command', group: 'commands', write: true, description: 'Run an app command exactly as a shortcut or voice command would, for example sound.play, volume.set:40, timer.start, mix.load:<mix name>, zen.open, calm.breathe:box, macro.run:<macro name>. Use describe_options for the list.', parameters: obj({ command: str('id or id:argument', { maxLength: 120 }) }, ['command']),
      summary: (a) => `Ran ${String(a.command)}`, run: (a) => { const valid = validateCommand(String(a.command), { mixNames: mixNames(), macroNames: macroNames() }); if (!valid) throw new Error('That command is not allowed or its argument is wrong. Use describe_options.'); rt.execute(valid); return { ran: valid }; } }),
    t({ name: 'list_settings', group: 'read', write: false, description: 'Settings you can change, as "section.name": current value. Optional section filter such as sound, puck, notify, calm, drift, calendar, timer, flow, uiShow.', parameters: obj({ section: str('start of the name, e.g. "drift"', { maxLength: 40 }) }), summary: (a) => `Listed settings${a.section ? ` for ${String(a.section)}` : ''}`,
      run: (a) => { const view = settingsView(getPrefs(), rt.timer.settings); const sec = String(a.section ?? '').toLowerCase(); const entries = Object.entries(view).filter(([k]) => !sec || k.toLowerCase().startsWith(sec)); return { count: entries.length, settings: Object.fromEntries(entries.slice(0, 160)), note: entries.length > 160 ? 'Shortened. Ask for one section.' : undefined }; } }),
    t({ name: 'set_setting', group: 'settings', write: true, description: 'Change one setting. The value must be the same type as the current one (true or false, a number, or text). The answer says what was really applied; out-of-range numbers are brought into range.', parameters: obj({ path: str('name from list_settings', { maxLength: 80 }), value: str('new value as text: true or false, a number such as 45, or words', { maxLength: 400 }) }, ['path', 'value']),
      summary: (a) => `Set ${String(a.path)} to ${String(a.value)}`, run: (a) => { const r = applySetting(String(a.path), coerce(a.value, settingsView(getPrefs(), rt.timer.settings)[String(a.path)]), getPrefs(), rt.timer.settings, { prefs: setPrefs, timer: rt.timer.setSettings }); if (!r.ok) throw new Error(r.message); return r; } },
    ),
    t({ name: 'list_todos', group: 'read', write: false, description: 'Your to-dos with ids.', parameters: obj({ status: str('open, done or all', { enum: ['open', 'done', 'all'] }) }), summary: () => 'Listed to-dos', run: (a) => getTodos().filter((x) => (a.status === 'done' ? x.done : a.status === 'all' ? true : !x.done)).slice(0, 60).map((x) => ({ id: x.id, text: x.text, done: x.done, subject: x.subject })) }),
    t({ name: 'add_todo', group: 'todos', write: true, description: 'Add a to-do. Subject is optional (a subject name from get_app_state).', parameters: obj({ text: str('what to do', { maxLength: 140 }), subject: str('subject name', { maxLength: 80 }) }, ['text']), summary: (a) => `Added the to-do "${String(a.text)}"`,
      run: (a) => { const sub = a.subject ? findSubject(String(a.subject)) : ''; if (sub === null) throw new Error('No such subject among your chosen subjects.'); const todo = addTodo(String(a.text), sub); if (!todo) throw new Error('Could not add it (empty, or the list is full).'); return { id: todo.id, text: todo.text }; } }),
    t({ name: 'update_todo', group: 'todos', write: true, description: 'Tick off or reopen a to-do, or change its text.', parameters: obj({ id: str('to-do id', { maxLength: 80 }), done: { type: 'boolean' as never }, text: str('new text', { maxLength: 140 }) }, ['id']), summary: (a) => `Updated a to-do${a.done === true ? ' (done)' : ''}`,
      run: (a) => { const cur = getTodos().find((x) => x.id === a.id); if (!cur) throw new Error('No to-do with that id.'); if (typeof a.text === 'string' && a.text.trim()) editTodo(cur.id, { text: a.text }); if (typeof a.done === 'boolean' && a.done !== cur.done) toggleTodo(cur.id); return { ok: true }; } }),
    t({ name: 'delete_todo', group: 'todos', write: true, description: 'Delete a to-do.', parameters: obj({ id: str('to-do id', { maxLength: 80 }) }, ['id']), summary: () => 'Deleted a to-do', run: (a) => { if (!getTodos().some((x) => x.id === a.id)) throw new Error('No to-do with that id.'); removeTodo(String(a.id)); return { ok: true }; } }),
    t({ name: 'set_plan', group: 'plan', write: true, description: 'Set the subject and/or the goal for the next focus block. Empty text clears it.', parameters: obj({ subject: str('subject name, or empty', { maxLength: 80 }), goal: str('goal text', { maxLength: 140 }) }), summary: (a) => `Set ${a.subject !== undefined ? `subject "${String(a.subject)}"` : ''}${a.subject !== undefined && a.goal !== undefined ? ' and ' : ''}${a.goal !== undefined ? `goal "${String(a.goal)}"` : ''}`,
      run: (a) => { const patch: { subject?: string; goal?: string } = {}; if (a.subject !== undefined) { const id = findSubject(String(a.subject)); if (id === null) throw new Error('No such subject among your chosen subjects. Add it first with add_subject.'); patch.subject = id; } if (a.goal !== undefined) patch.goal = String(a.goal); setPlan(patch); return getPlan(); } }),
    t({ name: 'add_subject', group: 'subjects', write: true, description: 'Add a subject you study. If its name matches the chosen curriculum it is added as that subject, otherwise as your own custom subject.', parameters: obj({ name: str('subject name', { maxLength: 60 }), level: str('HL, SL or empty', { enum: ['HL', 'SL', ''] }) }, ['name']), summary: (a) => `Added the subject ${String(a.name)}`,
      run: (a) => { const cur = getProfile().curriculum; const def = curriculum(cur).subjects.find((s) => s.name.toLowerCase() === String(a.name).trim().toLowerCase()); if (def) { toggleSubject(def, cur, true); return { added: def.name }; } if (!addCustomSubject(String(a.name), (a.level as '' | 'HL' | 'SL') || '')) throw new Error('Could not add it (empty, or it already exists).'); return { added: String(a.name), custom: true }; } }),
    t({ name: 'remove_subject', group: 'subjects', write: true, description: 'Stop studying a subject (removes it from your list).', parameters: obj({ name: str('subject name', { maxLength: 80 }) }, ['name']), summary: (a) => `Removed the subject ${String(a.name)}`, run: (a) => { const id = findSubject(String(a.name)); if (!id) throw new Error('No such subject.'); removeSubject(id); return { removed: id }; } }),
    t({ name: 'set_exam', group: 'subjects', write: true, description: 'Set the programme, stage and the exam session (for example IB, May 2027). Use describe_options for curricula and season ids.', parameters: obj({ curriculum: str('curriculum id', { enum: CURRICULA.map((c) => c.id) }), stage: str('stage', { maxLength: 40 }), season: str('exam season id', { maxLength: 20 }), year: { type: 'integer' as never, minimum: 2024, maximum: 2045 }, date: str('exact date YYYY-MM-DD or empty', { maxLength: 10 }) }), summary: () => 'Set the exam session',
      run: (a) => { const cur = (a.curriculum as CurriculumId | undefined) ?? getProfile().curriculum; const c = curriculum(cur); if (a.season && !c.seasons.some((s) => s.id === a.season)) throw new Error(`Season must be one of ${c.seasons.map((s) => s.id).join(', ')}.`); if (a.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(a.date))) throw new Error('Date must look like 2027-05-06.'); const p = getProfile(); setProfile({ curriculum: cur, ...(a.stage !== undefined ? { stage: String(a.stage) } : {}), exam: { season: (a.season as string) ?? p.exam.season, year: (a.year as number) ?? p.exam.year, date: a.date !== undefined ? String(a.date) : p.exam.date } }); return getProfile().exam; } }),
    t({ name: 'list_automations', group: 'read', write: false, description: 'Your automations (when X happens, do Y).', parameters: obj({}), summary: () => 'Listed automations', run: () => getAutomations().map((a) => ({ id: a.id, name: a.name, enabled: a.enabled, trigger: a.trigger.type, limit: a.limit, steps: a.steps.map((s) => (s.value ? `${s.type}:${s.value}` : s.type)) })) }),
    t({ name: 'create_automation', group: 'automations', write: true, description: 'Create an automation. trigger.type from describe_options; trigger.time "HH:MM" for at-time, trigger.minutes for focus-end or block-logged, trigger.days for exam-days. Steps use types from describe_options with a value where needed (mix name, number, message text, layout).',
      parameters: obj({ name: str('short name', { maxLength: 60 }), trigger: obj({ type: str('trigger id', { enum: TRIGGERS.map((x) => x.id) }), time: str('HH:MM', { maxLength: 5 }), minutes: { type: 'integer' as never, minimum: 0, maximum: 600 }, days: { type: 'integer' as never, minimum: 0, maximum: 730 } }, ['type']), steps: { type: 'array' as never, items: obj({ type: str('step type', { enum: STEP_TYPES.map((x) => x.type) }), value: str('value', { maxLength: 120 }) }, ['type']) as never }, limit: str('always, daily or hourly', { enum: ['always', 'daily', 'hourly'] }), weekdays: { type: 'array' as never, items: { type: 'integer' as never, minimum: 0, maximum: 6 } as never, description: '0 = Sunday ... 6 = Saturday; empty = every day' } }, ['name', 'trigger', 'steps']),
      summary: (a) => `Created the automation "${String(a.name)}"`,
      run: (a) => { if (getAutomations().length >= MAX_AUTOMATIONS) throw new Error('The limit of automations is reached.'); const trig = a.trigger as { type: TriggerId; time?: string; minutes?: number; days?: number }; const made = newAutomation({ name: String(a.name), trigger: { type: trig.type, time: trig.time ?? '22:00', minutes: trig.minutes ?? 0, days: trig.days ?? 30 }, steps: (a.steps as { type: never; value?: string }[]).map((s) => ({ type: s.type, value: s.value ?? '' })), limit: (a.limit as Automation['limit']) ?? 'always', when: { weekdays: (a.weekdays as number[]) ?? [], from: '', to: '', subject: '', sound: 'any', timer: 'any' } }); setAutomations((cur) => [...cur, made]); return { id: made.id, name: made.name, steps: made.steps.length }; } }),
    t({ name: 'set_automation_enabled', group: 'automations', write: true, description: 'Switch an automation on or off.', parameters: obj({ id: str('automation id', { maxLength: 80 }), enabled: { type: 'boolean' as never } }, ['id', 'enabled']), summary: (a) => `${a.enabled ? 'Switched on' : 'Switched off'} an automation`, run: (a) => { if (!getAutomations().some((x) => x.id === a.id)) throw new Error('No automation with that id.'); setAutomations((cur) => cur.map((x) => (x.id === a.id ? { ...x, enabled: a.enabled === true } : x))); return { ok: true }; } }),
    t({ name: 'delete_automation', group: 'automations', write: true, description: 'Delete an automation.', parameters: obj({ id: str('automation id', { maxLength: 80 }) }, ['id']), summary: () => 'Deleted an automation', run: (a) => { if (!getAutomations().some((x) => x.id === a.id)) throw new Error('No automation with that id.'); setAutomations((cur) => cur.filter((x) => x.id !== a.id)); return { ok: true }; } }),
    t({ name: 'create_macro', group: 'macros', write: true, description: 'Create a macro: a named list of steps (same step types as automations) you can run by voice, shortcut or command.', parameters: obj({ name: str('macro name', { maxLength: 60 }), steps: { type: 'array' as never, items: obj({ type: str('step type', { enum: STEP_TYPES.map((x) => x.type) }), value: str('value', { maxLength: 120 }) }, ['type']) as never } }, ['name', 'steps']), summary: (a) => `Created the macro "${String(a.name)}"`,
      run: (a) => { const list = rt.macros(); if (list.length >= MAX_MACROS) throw new Error('The limit of macros is reached.'); const base = newMacro(); const made = sanitizeMacros([{ ...base, name: String(a.name), steps: (a.steps as { type: string; value?: string }[]).map((s) => ({ type: s.type, value: s.value ?? '' })) }])[0]; if (!made) throw new Error('Could not make that macro.'); rt.setMacros([...list, made]); return { id: made.id, name: made.name, steps: made.steps.length }; } }),
    t({ name: 'delete_macro', group: 'macros', write: true, description: 'Delete a macro by name.', parameters: obj({ name: str('macro name', { maxLength: 60 }) }, ['name']), summary: (a) => `Deleted the macro ${String(a.name)}`, run: (a) => { const list = rt.macros(); const hit = list.find((m) => m.name.toLowerCase() === String(a.name).toLowerCase()); if (!hit) throw new Error('No macro with that name.'); rt.setMacros(list.filter((m) => m.id !== hit.id)); return { ok: true }; } }),
  ];
}
