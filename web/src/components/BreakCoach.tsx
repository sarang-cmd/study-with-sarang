import { Eye, Footprints, Flower2, GlassWater, Moon, RefreshCw, Sparkles, Wind, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useDesktop } from '../context/DesktopContext';
import { useTimer } from '../context/TimerContext';
import { BREAK_REMINDER, newBreakIdea, useBreakIdea, type BreakKind } from '../lib/session';
import { usePrefs } from '../lib/prefs';

const ICON: Record<BreakKind, LucideIcon> = { eyes: Eye, move: Footprints, breathe: Wind, water: GlassWater, reset: Sparkles, outside: Flower2, rest: Moon };

/** One small, kind idea for the break. Another one on request. Never more than one at a time. */
export function BreakCoach({ compact = false }: { compact?: boolean }) {
  const t = useTimer(); const { run } = useDesktop(); const [prefs] = usePrefs();
  const idea = useBreakIdea();
  const onBreak = t.mode === 'pomodoro' && t.phase !== 'focus';
  const minutes = t.phase === 'long' ? t.settings.longMin : t.settings.shortMin;
  // Opened mid-break (after a reload, say): pick one now.
  useEffect(() => { if (onBreak && prefs.session.breakIdeas && !idea) newBreakIdea(minutes); }, [onBreak, prefs.session.breakIdeas, idea, minutes]);
  if (!onBreak || !prefs.session.breakIdeas || !idea) return null;
  const Icon = ICON[idea.kind];
  return <div className={`rounded-xl border border-line bg-canvas ${compact ? 'p-3' : 'p-4'}`} data-testid="break-coach" aria-live="polite">
    <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted"><Icon size={11} aria-hidden="true" /> Break idea</p>
    <p className="mt-1.5 text-[13px] font-semibold leading-snug" data-testid="break-idea-title">{idea.title}</p>
    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{idea.how}</p>
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {idea.breathe && <button type="button" className="studio-button !min-h-8 text-[11px]" onClick={() => run('calm.breathe')} data-testid="break-breathe"><Wind size={12} /> Breathe with me</button>}
      <button type="button" className="studio-button !min-h-8 text-[11px]" onClick={() => newBreakIdea(minutes)} data-testid="break-another"><RefreshCw size={12} /> Another idea</button>
    </div>
    {!compact && <p className="mt-2.5 text-[10px] leading-relaxed text-muted">{BREAK_REMINDER}</p>}
  </div>;
}
