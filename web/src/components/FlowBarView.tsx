import { useEffect, useRef } from 'react';
import type { FlowUi } from '../lib/flow';
import { drawFlow, idleBars, smoothBars } from '../lib/flowViz';

const SIZES = { small: { w: 340, h: 54, text: 12 }, medium: { w: 440, h: 70, text: 13 }, large: { w: 520, h: 92, text: 15 } };

function Viz({ ui, ink }: { ui: FlowUi; ink: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(ui); live.current = ui;
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.scale(dpr, dpr);
    let raf = 0, bars: number[] = new Array(32).fill(0), level = 0;
    const frame = (time: number) => {
      const u = live.current;
      const target = u.phase === 'listening' && u.bars.length ? u.bars : idleBars(32, time).map((v) => (u.phase === 'thinking' ? v + .12 * (1 + Math.sin(time * .008)) : v));
      bars = smoothBars(bars, target); level += ((u.phase === 'listening' ? u.level : .08) - level) * .25;
      drawFlow(ctx, w, h, u.style, bars, level, time, ink, u.phase === 'thinking');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ink, ui.style]);
  return <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />;
}

export function FlowBarView({ ui, onAction, preview = false }: { ui: FlowUi; onAction: (action: 'run' | 'ask' | 'cancel' | 'stop') => void; preview?: boolean }) {
  const dark = ui.dark;
  const ink = dark ? '#f5f5f5' : '#111111';
  const size = SIZES[ui.size];
  const show = ui.phase !== 'idle';
  const status = ui.phase === 'listening' ? (ui.mode === 'handsfree' ? 'Listening. Just speak, I will stop when you pause.' : 'Listening. Release the key when you are done.')
    : ui.phase === 'thinking' ? (ui.message || 'Working it out') : ui.phase === 'done' || ui.phase === 'error' ? ui.message : '';
  const panel = dark ? 'bg-[#0d0d0d]/95 text-neutral-50 border-white/15' : 'bg-white/95 text-neutral-900 border-black/15';
  const subtle = dark ? 'text-neutral-400' : 'text-neutral-500';
  const button = dark ? 'border-white/25 hover:bg-white/10' : 'border-black/25 hover:bg-black/5';
  const solid = dark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800';
  return (
    <div className={`flex h-full w-full ${preview ? 'items-center' : ui.place === 'top' ? 'items-start' : ui.place === 'center' ? 'items-center' : 'items-end'} justify-center`} style={{ fontFamily: 'inherit' }}>
      <style>{`
        @keyframes flow-in { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes flow-dots { 0%, 80%, 100% { opacity: .25; transform: scale(.7); } 40% { opacity: 1; transform: scale(1); } }
        @keyframes flow-pop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .flow-anim { animation: none !important; } }
      `}</style>
      {show && (
        <div className={`flow-anim pointer-events-auto relative overflow-hidden rounded-[22px] border shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur-md ${panel}`} style={{ width: size.w, maxWidth: '96%', animation: 'flow-in .22s cubic-bezier(.2,.9,.3,1.2) both' }} role="status" aria-live="polite">
          {(ui.phase === 'listening' || ui.phase === 'thinking') && (
            <div style={{ height: size.h }} className="px-4 pt-2"><Viz ui={ui} ink={ink} /></div>
          )}
          <div className="px-4 pb-3 pt-1">
            {ui.phase === 'confirm' && ui.confirm ? (
              <div className="space-y-2.5 py-1">
                <p className="text-[13px] leading-snug">{ui.confirm.heard ? <>I heard <b>&ldquo;{ui.confirm.heard}&rdquo;</b>.</> : 'I could not make that out.'} {ui.confirm.guess ? 'Do this, or let the assistant work it out?' : 'Let the assistant work it out?'}</p>
                <div className="flex flex-wrap gap-2">
                  {ui.confirm.guess && <button type="button" onClick={() => onAction('run')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${solid}`}>{ui.confirm.guessLabel || ui.confirm.guess}</button>}
                  {ui.confirm.canAsk && <button type="button" onClick={() => onAction('ask')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${button}`}>Ask the assistant</button>}
                  <button type="button" onClick={() => onAction('cancel')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${button}`}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5" style={{ minHeight: 24 }}>
                {ui.phase === 'done' && <span className="flow-anim inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold" style={{ background: ink, color: dark ? '#000' : '#fff', animation: 'flow-pop .3s ease-out both' }}>&#10003;</span>}
                {ui.phase === 'error' && <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[11px] font-bold" style={{ borderColor: ink }}>!</span>}
                {ui.phase === 'thinking' && <span className="flex flex-none gap-1" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="flow-anim h-1.5 w-1.5 rounded-full" style={{ background: ink, animation: `flow-dots 1s ${i * .15}s infinite` }} />)}</span>}
                <div className="min-w-0 flex-1" style={{ fontSize: size.text }}>
                  {ui.showText && ui.text && ui.phase !== 'error' && <p className="truncate font-semibold">&ldquo;{ui.text}&rdquo;</p>}
                  <p className={`${ui.text && ui.showText && ui.phase !== 'error' ? 'text-[11px]' : ''} ${ui.phase === 'listening' || (ui.text && ui.phase === 'thinking') ? subtle : ''} ${ui.phase === 'done' && !ui.text ? 'font-semibold' : ''} leading-snug`} style={{ overflowWrap: 'anywhere' }}>{status}</p>
                </div>
                {ui.phase === 'listening' && ui.mode === 'handsfree' && <button type="button" onClick={() => onAction('stop')} className={`flex-none rounded-full px-3 py-1 text-[11px] font-semibold ${solid}`}>Done</button>}
                {(ui.phase === 'listening' && ui.mode === 'handsfree') && <button type="button" aria-label="Cancel" onClick={() => onAction('cancel')} className={`flex-none rounded-full border px-2 py-1 text-[11px] font-semibold ${button}`}>&times;</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
