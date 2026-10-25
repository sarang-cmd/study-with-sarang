import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Badge } from './Achievements';
import type { IconKey } from '../lib/achievements';
import { getNotifySettings, onCelebrate, subscribeNotes, type CelebrateItem } from '../lib/notifications';
import { playUi } from '../lib/synth';
import { getPrefs } from '../lib/prefs';

const TIER = ['', 'Bronze', 'Silver', 'Gold', 'Platinum'];
/** Little shards that fly out of the badge. Grayscale, deterministic, skipped when reduced motion is on. */
const SHARDS = Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2 + (i % 3) * .2; const d = 90 + (i * 37) % 70; return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (i * 53) % 360, s: 4 + (i * 7) % 6, delay: (i % 5) * .02 }; });

/** Shows each unlocked achievement as it happens: a full card with the badge drawing itself in, or a small card in the corner. */
export function Celebration({ onOpenProgress }: { onOpenProgress: () => void }) {
  const [queue, setQueue] = useState<CelebrateItem[]>([]);
  const reduce = useReducedMotion();
  const timer = useRef<number | undefined>(undefined);
  const current = queue[0];
  const mode = useSyncExternalStore(subscribeNotes, getNotifySettings, getNotifySettings).celebrate;
  useEffect(() => onCelebrate((items) => setQueue((q) => [...q, ...items])), []);
  const next = useCallback(() => setQueue((q) => q.slice(1)), []);
  useEffect(() => {
    if (!current) return;
    if (getPrefs().uiSounds) playUi('achieve');
    timer.current = window.setTimeout(next, getNotifySettings().celebrateSeconds * 1000);
    return () => window.clearTimeout(timer.current);
  }, [current, next]);
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); next(); } };
    document.addEventListener('keydown', onKey, true); return () => document.removeEventListener('keydown', onKey, true);
  }, [current, next]);
  if (mode === 'off') return null;
  const full = mode === 'full';
  return <AnimatePresence mode="wait">
    {current && (full
      ? <motion.div key={current.id} role="alertdialog" aria-label={`Achievement unlocked: ${current.title}`} data-testid="celebration" className="fixed inset-0 z-[140] flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={next}>
        <motion.div onMouseDown={(e) => e.stopPropagation()} initial={reduce ? false : { scale: .8, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: .96, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="relative w-[min(380px,100%)] overflow-hidden rounded-3xl border border-ink bg-canvas px-8 pb-7 pt-9 text-center shadow-float">
          <button type="button" onClick={next} aria-label="Dismiss" className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-raised hover:text-ink"><X size={15} /></button>
          {!reduce && <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[90px] h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2">
            <motion.div className="h-full w-full rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent, rgb(var(--ink) / .16), transparent 28%, rgb(var(--ink) / .12), transparent 60%, rgb(var(--ink) / .16), transparent)', WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 68%)', maskImage: 'radial-gradient(circle, #000 20%, transparent 68%)' }} animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} />
          </div>}
          <div className="relative mx-auto flex h-[110px] w-[110px] items-center justify-center">
            {!reduce && SHARDS.map((s, i) => <motion.span key={i} aria-hidden="true" className="absolute left-1/2 top-1/2 rounded-[2px] bg-ink" style={{ width: s.s, height: s.s }} initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }} animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], rotate: s.r }} transition={{ duration: 1.1, delay: .25 + s.delay, ease: 'easeOut' }} />)}
            <motion.div initial={reduce ? false : { scale: .2, rotate: -40, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: .1 }}>
              <Badge icon={current.icon as IconKey} tier={current.tier} progress={1} unlocked size={104} />
            </motion.div>
          </div>
          <motion.p className="relative mt-5 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-muted" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .45 }}>Achievement unlocked · {TIER[current.tier]}</motion.p>
          <motion.h2 className="relative mt-1.5 text-[24px] font-semibold tracking-tight" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .52 }}>{current.title}</motion.h2>
          <motion.p className="relative mt-1.5 text-[13px] leading-snug text-muted" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .6 }}>{current.text}</motion.p>
          <div className="relative mt-6 flex justify-center gap-2.5">
            <button type="button" className="studio-button" onClick={() => { next(); onOpenProgress(); }}>See all</button>
            <button type="button" className="studio-button !bg-ink !text-canvas" onClick={next} autoFocus>{queue.length > 1 ? `Next (${queue.length - 1} more)` : 'Nice'}</button>
          </div>
          <motion.div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-ink" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: getNotifySettings().celebrateSeconds, ease: 'linear' }} />
        </motion.div>
      </motion.div>
      : <motion.div key={current.id} role="status" data-testid="celebration-small" className="fixed bottom-4 right-4 z-[140] flex w-[min(340px,calc(100vw-32px))] items-center gap-3 overflow-hidden rounded-2xl border border-ink bg-canvas p-3.5 shadow-float" initial={reduce ? false : { x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
        <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: .1 }}><Badge icon={current.icon as IconKey} tier={current.tier} progress={1} unlocked size={52} /></motion.div>
        <div className="min-w-0 flex-1"><p className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted">Unlocked · {TIER[current.tier]}</p><p className="truncate text-[13px] font-semibold">{current.title}</p><p className="text-[11px] leading-snug text-muted">{current.text}</p></div>
        <button type="button" onClick={next} aria-label="Dismiss" className="self-start rounded-md p-1 text-muted hover:text-ink"><X size={13} /></button>
        {!reduce && <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-10 -skew-x-12 bg-ink/10" initial={{ left: '-20%' }} animate={{ left: '120%' }} transition={{ duration: .9, delay: .25 }} />}
      </motion.div>)}
  </AnimatePresence>;
}
