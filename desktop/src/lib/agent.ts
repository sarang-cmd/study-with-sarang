/**
 * The assistant that can act inside the app. You write what you want; the AI (your own key) may call "tools",
 * small functions with a fixed list of arguments, to read or change things the way you could by hand.
 * This file is the safe core: argument checking, the loop, confirmations and limits. The tools themselves are in agentTools.ts.
 * It never touches the network itself, so it is tested with a pretend AI.
 */
export interface JsonSchema { type: 'object'; properties: Record<string, PropSchema>; required?: string[] }
export interface PropSchema { type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'; description?: string; enum?: (string | number)[]; minimum?: number; maximum?: number; maxLength?: number; items?: PropSchema; properties?: Record<string, PropSchema>; required?: string[] }
export type ToolGroup = 'read' | 'commands' | 'settings' | 'todos' | 'plan' | 'subjects' | 'automations' | 'macros';
export interface ToolDef {
  name: string; description: string; parameters: JsonSchema; group: ToolGroup;
  /** Changes something (not only reads). Used by the confirmation setting. */
  write: boolean;
  /** One plain sentence for the confirmation card and the action list. */
  summary: (args: Record<string, unknown>) => string;
  run: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface Msg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string }
export type ConfirmMode = 'off' | 'changes' | 'all';
export interface AgentStep { name: string; summary: string; ok: boolean; denied?: boolean; result: string }

export const MAX_ROUNDS = 6;
export const MAX_RESULT_CHARS = 4000;
export const MAX_HISTORY = 24;

/** Checks arguments against the small schema. Returns '' when fine. Unknown properties are refused so a model cannot smuggle extras. */
export function validateArgs(schema: JsonSchema | PropSchema, value: unknown, path = 'arguments'): string {
  const s = schema as PropSchema & { properties?: Record<string, PropSchema>; required?: string[] };
  if (s.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;
    const obj = value as Record<string, unknown>; const props = s.properties ?? {};
    for (const key of Object.keys(obj)) if (!(key in props)) return `${path}.${key} is not an allowed argument`;
    for (const key of s.required ?? []) if (obj[key] === undefined) return `${path}.${key} is required`;
    for (const [key, sub] of Object.entries(props)) if (obj[key] !== undefined) { const bad = validateArgs(sub, obj[key], `${path}.${key}`); if (bad) return bad; }
    return '';
  }
  if (s.type === 'array') {
    if (!Array.isArray(value)) return `${path} must be a list`;
    if (value.length > 40) return `${path} is too long`;
    if (s.items) for (let i = 0; i < value.length; i += 1) { const bad = validateArgs(s.items, value[i], `${path}[${i}]`); if (bad) return bad; }
    return '';
  }
  if (s.type === 'string') { if (typeof value !== 'string') return `${path} must be text`; if (value.length > (s.maxLength ?? 400)) return `${path} is too long`; if (s.enum && !s.enum.includes(value)) return `${path} must be one of ${s.enum.join(', ')}`; return ''; }
  if (s.type === 'boolean') return typeof value === 'boolean' ? '' : `${path} must be true or false`;
  if (s.type === 'number' || s.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${path} must be a number`;
    if (s.type === 'integer' && !Number.isInteger(value)) return `${path} must be a whole number`;
    if (s.minimum !== undefined && value < s.minimum) return `${path} must be at least ${s.minimum}`;
    if (s.maximum !== undefined && value > s.maximum) return `${path} must be at most ${s.maximum}`;
    if (s.enum && !s.enum.includes(value)) return `${path} must be one of ${s.enum.join(', ')}`;
  }
  return '';
}

export interface ChatReply { content: string; tool_calls: ToolCall[] }
export interface AgentDeps {
  chat: (messages: Msg[], tools: ToolDef[]) => Promise<ChatReply>;
  tools: ToolDef[];
  allowed: (tool: ToolDef) => boolean;                       // Your per-group switches
  confirmMode: ConfirmMode;
  confirm: (step: { name: string; summary: string }) => Promise<boolean>;
  onStep?: (step: AgentStep) => void;
  system: string;
  maxRounds?: number;
}
export interface AgentOutcome { reply: string; steps: AgentStep[]; messages: Msg[]; stopped: 'done' | 'rounds' | 'error'; error?: string }

const clip = (text: string) => (text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}... (shortened)` : text);
const needsConfirm = (mode: ConfirmMode, tool: ToolDef) => mode === 'all' || (mode === 'changes' && tool.write);

/** One user message in, a reply out, with as many tool rounds in between as needed (at most six). */
export async function runAgent(history: Msg[], userText: string, deps: AgentDeps): Promise<AgentOutcome> {
  const messages: Msg[] = [...history.filter((m) => m.role !== 'system').slice(-MAX_HISTORY), { role: 'user', content: userText }];
  const steps: AgentStep[] = [];
  const active = deps.tools.filter((t) => deps.allowed(t));
  const rounds = deps.maxRounds ?? MAX_ROUNDS;
  for (let round = 0; round < rounds; round += 1) {
    let reply: ChatReply;
    try { reply = await deps.chat([{ role: 'system', content: deps.system }, ...messages], active); } catch (error) { return { reply: '', steps, messages, stopped: 'error', error: error instanceof Error ? error.message : 'The AI did not answer.' }; }
    if (!reply.tool_calls.length) {
      const text = reply.content.trim();
      messages.push({ role: 'assistant', content: text });
      return { reply: text, steps, messages, stopped: 'done' };
    }
    messages.push({ role: 'assistant', content: reply.content || null, tool_calls: reply.tool_calls });
    for (const call of reply.tool_calls) {
      const tool = active.find((t) => t.name === call.function.name);
      const push = (step: AgentStep, payload: unknown) => { steps.push(step); deps.onStep?.(step); messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: clip(typeof payload === 'string' ? payload : JSON.stringify(payload)) }); };
      if (!tool) { push({ name: call.function.name, summary: `Tried ${call.function.name}`, ok: false, result: 'unknown or switched off' }, { error: `There is no tool called ${call.function.name}, or you switched it off.` }); continue; }
      let args: Record<string, unknown> = {};
      try { const raw = call.function.arguments?.trim(); args = raw ? JSON.parse(raw) : {}; } catch { push({ name: tool.name, summary: tool.name, ok: false, result: 'arguments were not valid JSON' }, { error: 'The arguments were not valid JSON.' }); continue; }
      const bad = validateArgs(tool.parameters, args);
      if (bad) { push({ name: tool.name, summary: tool.name, ok: false, result: bad }, { error: bad }); continue; }
      let summary = tool.name; try { summary = tool.summary(args); } catch { /* Keep the name. */ }
      if (needsConfirm(deps.confirmMode, tool) && !(await deps.confirm({ name: tool.name, summary }))) { push({ name: tool.name, summary, ok: false, denied: true, result: 'you said no' }, { error: 'The user declined this action. Do not try it again; ask what they want instead.' }); continue; }
      try { const result = await tool.run(args); push({ name: tool.name, summary, ok: true, result: clip(JSON.stringify(result ?? { ok: true })).slice(0, 160) }, result ?? { ok: true }); }
      catch (error) { const message = error instanceof Error ? error.message : 'It failed.'; push({ name: tool.name, summary, ok: false, result: message }, { error: message }); }
    }
  }
  return { reply: 'I stopped after several steps. Ask me to continue if there is more to do.', steps, messages, stopped: 'rounds' };
}

export const SYSTEM_PROMPT = [
  'You are the assistant inside "Study with Sarang", a focus timer, ambient sound and study planning app for students.',
  'You can read and change the app by calling tools. Use them whenever the user asks you to do, change, set up or look something up in the app. Do not describe steps when you can simply do them.',
  'Call get_app_state first when you need to know the current situation. Call describe_options before using ids you are not sure about (commands, triggers, step types, mix names). Never invent ids.',
  'Make as few tool calls as you can. If a request is ambiguous, ask one short question instead of guessing. If a tool returns an error, read it and fix the arguments once; if it still fails, tell the user plainly.',
  'You cannot see or change API keys, passwords or pairing codes. Never ask for them.',
  'When you are done, say in one to three plain sentences what you did or found. No markdown, no lists unless asked. Answer in the language the user writes in.',
].join('\n');

// ---------------------------------------------------------------------------------------------- your settings for it
export const GROUPS: { id: Exclude<ToolGroup, 'read'>; label: string; hint: string }[] = [
  { id: 'commands', label: 'Run commands', hint: 'Play, pause, volume, timer, Zen, breathing, loading mixes and macros.' },
  { id: 'settings', label: 'Change settings', hint: 'Any option under Settings (not keys, codes or addresses).' },
  { id: 'todos', label: 'To-dos', hint: 'Add, tick off, edit and delete to-dos.' },
  { id: 'plan', label: 'Subject and goal', hint: 'Set what you study and the goal for the next block.' },
  { id: 'subjects', label: 'Subjects and exams', hint: 'Choose subjects, add your own, set the exam session.' },
  { id: 'automations', label: 'Automations', hint: 'Create, switch and delete "when this, do that" rules.' },
  { id: 'macros', label: 'Macros', hint: 'Create and delete multi-step shortcuts.' },
];
export interface AgentSettings { enabled: boolean; confirm: ConfirmMode; groups: Record<Exclude<ToolGroup, 'read'>, boolean>; showSteps: boolean }
export const defaultAgent: AgentSettings = { enabled: true, confirm: 'off', groups: { commands: true, settings: true, todos: true, plan: true, subjects: true, automations: true, macros: true }, showSteps: true };
export function sanitizeAgent(raw: unknown): AgentSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const g = r.groups && typeof r.groups === 'object' ? (r.groups as Record<string, unknown>) : {};
  const groups = { ...defaultAgent.groups };
  for (const k of Object.keys(groups) as (keyof typeof groups)[]) if (typeof g[k] === 'boolean') groups[k] = g[k] as boolean;
  return { enabled: typeof r.enabled === 'boolean' ? r.enabled : true, confirm: r.confirm === 'changes' || r.confirm === 'all' ? r.confirm : 'off', groups, showSteps: typeof r.showSteps === 'boolean' ? r.showSteps : true };
}
export const toolAllowed = (settings: AgentSettings) => (tool: ToolDef) => tool.group === 'read' || settings.groups[tool.group as Exclude<ToolGroup, 'read'>] !== false;
