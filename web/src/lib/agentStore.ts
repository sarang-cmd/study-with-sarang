/** The assistant's conversation. Kept in memory only: closing the app forgets it, and "Clear" forgets it now. */
import type { AgentStep, Msg } from './agent';

export interface ChatItem { id: string; role: 'user' | 'assistant' | 'error'; text: string; steps?: AgentStep[] }
export interface Pending { name: string; summary: string; resolve: (ok: boolean) => void }
export interface AgentState { open: boolean; busy: boolean; items: ChatItem[]; history: Msg[]; pending: Pending | null; live: AgentStep[] }

let state: AgentState = { open: false, busy: false, items: [], history: [], pending: null, live: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
export const subscribeAgent = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getAgent = () => state;
export function patchAgent(patch: Partial<AgentState>) { state = { ...state, ...patch }; emit(); }
let counter = 0;
export const addItem = (item: Omit<ChatItem, 'id'>) => patchAgent({ items: [...state.items, { ...item, id: `m${Date.now()}-${counter++}` }].slice(-80) });
export const openAgent = () => patchAgent({ open: true });
export function closeAgent() { state.pending?.resolve(false); patchAgent({ open: false, pending: null }); }
export function clearAgent() { state.pending?.resolve(false); patchAgent({ items: [], history: [], pending: null, live: [] }); }
export function resetAgentForTest() { state = { open: false, busy: false, items: [], history: [], pending: null, live: [] }; emit(); }
