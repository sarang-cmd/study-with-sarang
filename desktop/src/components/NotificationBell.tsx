import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, BellOff, Brain, CheckCheck, Compass, Settings, Sparkles, Target, Timer, Trash2, TriangleAlert, Trophy, X, CalendarClock, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ago, clearNotes, filterNotes, getNotes, getNotifySettings, groupByDay, markAllRead, markRead, removeNote, subscribeNotes, unreadCount, NOTE_KINDS, type Note, type NoteFilter, type NoteKind } from '../lib/notifications';
import { useSettings } from '../context/SettingsContext';

const KIND_ICON: Record<NoteKind, LucideIcon> = { achievement: Trophy, goal: Target, timer: Timer, reminder: CalendarClock, drift: Compass, ai: Sparkles, system: TriangleAlert, info: Info };

/** The bell in the top bar: the unread number, and a list of recent notifications you can filter, read and clear. */
export function NotificationBell({ className }: { className: string }) {
  const notes = useSyncExternalStore(subscribeNotes, getNotes, getNotes);
  const settings = useSyncExternalStore(subscribeNotes, getNotifySettings, getNotifySettings);
  const reduce = useReducedMotion();
  const { openSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NoteFilter>('all');
  const root = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 72, right: 8 });
  const unread = unreadCount(notes);
  const [ring, setRing] = useState(0);
  const last = useRef(unread);
  useEffect(() => { if (unread > last.current) setRing((n) => n + 1); last.current = unread; }, [unread]);
  useEffect(() => {
    const show = () => { const r = root.current?.getBoundingClientRect(); if (r) setPos({ top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) }); setOpen(true); };
    window.addEventListener('swa:open-bell', show);
    return () => window.removeEventListener('swa:open-bell', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (root.current?.contains(t) || panelRef.current?.contains(t)) return; setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);
  const shown = useMemo(() => filterNotes(notes, filter), [notes, filter]);
  const groups = useMemo(() => groupByDay(shown), [shown]);
  const present = useMemo(() => NOTE_KINDS.filter((k) => notes.some((n) => n.kind === k.id)), [notes]);
  const chips: [NoteFilter, string][] = [['all', 'All'], ['unread', `Unread${unread ? ` ${unread}` : ''}`], ...present.map((k): [NoteFilter, string] => [k.id, k.label])];

  return <div ref={root} className="relative">
    <button type="button" onClick={() => { const r = root.current?.getBoundingClientRect(); if (r) setPos({ top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) }); setOpen((v) => !v); }} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} aria-haspopup="dialog" data-testid="bell" data-tip="Notifications" className={`${className} relative`}>
      <motion.span key={ring} animate={reduce || !ring ? undefined : { rotate: [0, -16, 14, -10, 8, 0] }} transition={{ duration: .7 }} className="flex"><Bell size={17} strokeWidth={1.8} /></motion.span>
      <AnimatePresence>{unread > 0 && settings.badge && <motion.span key="b" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} data-testid="bell-badge" className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-ink px-1 text-[9px] font-bold leading-none text-canvas">{unread > 9 ? '9+' : unread}</motion.span>}</AnimatePresence>
      {unread > 0 && !settings.badge && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ink" />}
    </button>
    {createPortal(<AnimatePresence>
      {open && <motion.div ref={panelRef} key="panel" style={{ top: pos.top, right: pos.right }} role="dialog" aria-label="Notifications" data-testid="bell-panel" initial={reduce ? false : { opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .16 }}
        className="fixed z-[130] flex max-h-[min(560px,calc(100vh-100px))] w-[min(400px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-float">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div><h2 className="text-[13px] font-semibold">Notifications</h2><p className="text-[10px] text-muted">{notes.length ? `${unread} unread of ${notes.length}` : 'Nothing yet'}</p></div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={markAllRead} disabled={!unread} aria-label="Mark all as read" data-tip="Mark all as read" className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"><CheckCheck size={15} /></button>
            <button type="button" onClick={() => clearNotes()} disabled={!notes.length} aria-label="Clear all" data-tip="Clear all" className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"><Trash2 size={15} /></button>
            <button type="button" onClick={() => { setOpen(false); openSettings('notifications'); }} aria-label="Notification settings" data-tip="Notification settings" className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-ink"><Settings size={15} /></button>
          </div>
        </div>
        {notes.length > 0 && <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5" role="tablist" aria-label="Filter notifications">
          {chips.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${filter === id ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{label}</button>)}
        </div>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!notes.length && <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted"><BellOff size={22} strokeWidth={1.5} /><p className="text-[12px] font-semibold text-ink">All quiet</p><p className="max-w-[260px] text-[11px] leading-snug">Unlocked achievements, goals you reach, reminders and updates will collect here, so nothing is missed.</p></div>}
          {notes.length > 0 && !shown.length && <p className="px-6 py-8 text-center text-[11px] text-muted">Nothing in this group.</p>}
          {groups.map((g) => <section key={g.label} aria-label={g.label}>
            <h3 className="sticky top-0 bg-canvas/95 px-4 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted backdrop-blur">{g.label}</h3>
            <ul>{g.items.map((n) => <NoteRow key={n.id} n={n} />)}</ul>
          </section>)}
        </div>
      </motion.div>}
    </AnimatePresence>, document.body)}
  </div>;
}

function NoteRow({ n }: { n: Note }) {
  const Icon = n.kind === 'achievement' && n.icon === 'brain' ? Brain : KIND_ICON[n.kind];
  return <li data-testid="note" data-read={n.read} className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-raised ${n.read ? '' : 'bg-surface'}`}>
    <button type="button" onClick={() => markRead(n.id, !n.read)} className="flex min-w-0 flex-1 gap-3 text-left" aria-label={`${n.title || NOTE_KINDS.find((k) => k.id === n.kind)?.label}. ${n.read ? 'Read' : 'Unread'}. Click to toggle.`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${n.read ? 'border-line text-muted' : 'border-ink text-ink'}`}><Icon size={14} strokeWidth={1.8} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2"><span className={`truncate text-[12px] ${n.read ? 'font-medium text-muted' : 'font-semibold'}`}>{n.title || NOTE_KINDS.find((k) => k.id === n.kind)?.label}</span><span className="shrink-0 font-mono text-[9px] text-muted">{ago(n.at)}</span></span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{n.message}</span>
      </span>
      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden="true" />}
    </button>
    <button type="button" onClick={() => removeNote(n.id)} aria-label="Remove notification" className="absolute right-2 top-2 rounded-md p-1 text-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"><X size={12} /></button>
  </li>;
}
