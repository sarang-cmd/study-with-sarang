import { useSyncExternalStore } from 'react';

/**
 * The session plan: which subject you are studying, what you want to get done (the goal), and a to-do list.
 * The goal and subject are copied into each block you log, so statistics can show what you aimed for and whether you got there.
 */
export type GoalOutcome = '' | 'yes' | 'partly' | 'no';
export interface Todo { id: string; text: string; subject: string; done: boolean; createdAt: string; updatedAt: string; doneAt?: string }
export interface Plan { subject: string; goal: string }
export const emptyPlan = (): Plan => ({ subject: '', goal: '' });

const TODO_KEY = 'study-with-sarang:todos';
const PLAN_KEY = 'study-with-sarang:plan';
export const MAX_TODOS = 200;

export function sanitizeTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(); const out: Todo[] = [];
  for (const item of raw.slice(0, MAX_TODOS)) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.text !== 'string' || !t.text.trim() || seen.has(t.id)) continue;
    seen.add(t.id);
    const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined);
    const created = iso(t.createdAt) ?? new Date(0).toISOString();
    out.push({ id: t.id.slice(0, 60), text: t.text.trim().slice(0, 140), subject: typeof t.subject === 'string' ? t.subject.slice(0, 80) : '', done: t.done === true, createdAt: created, updatedAt: iso(t.updatedAt) ?? created, doneAt: t.done === true ? iso(t.doneAt) : undefined });
  }
  return out;
}
export function sanitizePlan(raw: unknown): Plan {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { subject: typeof r.subject === 'string' ? r.subject.slice(0, 80) : '', goal: typeof r.goal === 'string' ? r.goal.slice(0, 160) : '' };
}

let todos: Todo[] = []; let plan: Plan = emptyPlan();
try { if (typeof localStorage !== 'undefined') { todos = sanitizeTodos(JSON.parse(localStorage.getItem(TODO_KEY) ?? '[]')); plan = sanitizePlan(JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null')); } } catch { /* Start empty. */ }
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((fn) => fn());
const saveTodos = () => { try { localStorage.setItem(TODO_KEY, JSON.stringify(todos)); } catch { /* Kept for this visit. */ } emit(); };
const savePlan = () => { try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch { /* Kept for this visit. */ } emit(); };

export const getTodos = () => todos;
export const getPlan = () => plan;
export const useTodos = () => useSyncExternalStore(subscribe, getTodos, getTodos);
export const usePlan = () => useSyncExternalStore(subscribe, getPlan, getPlan);

let n = 0;
export function addTodo(text: string, subject = '', now = new Date()): Todo | null {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 140); if (!clean || todos.length >= MAX_TODOS) return null;
  const at = now.toISOString();
  const todo: Todo = { id: `${now.getTime().toString(36)}-${(n++).toString(36)}`, text: clean, subject, done: false, createdAt: at, updatedAt: at };
  todos = [...todos, todo]; saveTodos(); return todo;
}
export function toggleTodo(id: string, now = new Date()): Todo | null {
  let changed: Todo | null = null;
  todos = todos.map((t) => { if (t.id !== id) return t; const done = !t.done; changed = { ...t, done, updatedAt: now.toISOString(), doneAt: done ? now.toISOString() : undefined }; return changed; });
  saveTodos(); return changed;
}
export function editTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'subject'>>, now = new Date()) {
  todos = todos.map((t) => (t.id === id ? { ...t, text: (patch.text ?? t.text).trim().slice(0, 140) || t.text, subject: patch.subject ?? t.subject, updatedAt: now.toISOString() } : t)); saveTodos();
}
export function removeTodo(id: string) { todos = todos.filter((t) => t.id !== id); saveTodos(); }
export function clearDoneTodos() { todos = todos.filter((t) => !t.done); saveTodos(); }
export function moveTodo(id: string, dir: -1 | 1) {
  const i = todos.findIndex((t) => t.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= todos.length) return;
  const next = [...todos]; [next[i], next[j]] = [next[j], next[i]]; todos = next; saveTodos();
}
/** To-dos ticked off since a moment in time (used to tell how much a block got done). */
export const todosDoneSince = (sinceIso: string, list: Todo[] = todos) => list.filter((t) => t.done && t.doneAt && t.doneAt >= sinceIso).length;
export function todoCounts(subject?: string, list: Todo[] = todos) {
  const rel = subject === undefined ? list : list.filter((t) => t.subject === subject);
  return { total: rel.length, done: rel.filter((t) => t.done).length, open: rel.filter((t) => !t.done).length };
}
export function setPlan(patch: Partial<Plan>) { plan = sanitizePlan({ ...plan, ...patch }); savePlan(); }
export function resetPlanForTest() { todos = []; plan = emptyPlan(); pending = null; emit(); }

// ---- "did you reach your goal?" after a block ----------------------------------------------------------
export interface Pending { sessionId: string; goal: string; subject: string; minutes: number }
let pending: Pending | null = null;
export const getPending = () => pending;
export const usePending = () => useSyncExternalStore(subscribe, getPending, getPending);
export function setPending(next: Pending | null) { pending = next; emit(); }
