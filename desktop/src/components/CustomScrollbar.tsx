import { useEffect, useRef, useState } from 'react';
import { usePrefs } from '../lib/prefs';

interface Metrics { thumbTop: number; thumbHeight: number; trackHeight: number; max: number; show: boolean }
const none: Metrics = { thumbTop: 0, thumbHeight: 0, trackHeight: 0, max: 0, show: false };

/**
 * The page's own scrollbar. It starts below the title bar, so it never runs under the window buttons, and it follows
 * the studio's colors. The page still scrolls natively (wheel, touch, keyboard); this only draws and drags the bar.
 */
export function CustomScrollbar() {
  const [prefs] = usePrefs();
  const [m, setM] = useState<Metrics>(none);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const on = prefs.customScrollbar;

  useEffect(() => {
    document.documentElement.classList.toggle('scrollbar-custom', on);
    return () => document.documentElement.classList.remove('scrollbar-custom');
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const measure = () => {
      const doc = document.documentElement;
      const locked = document.body.style.overflow === 'hidden';
      const view = window.innerHeight, total = doc.scrollHeight;
      const trackHeight = track.current?.clientHeight || view;
      if (locked || total <= view + 1) { setM(none); return; }
      const thumbHeight = Math.max(40, Math.round(trackHeight * (view / total)));
      const max = total - view;
      const thumbTop = Math.round((window.scrollY / max) * (trackHeight - thumbHeight));
      setM((old) => (old.show && old.thumbTop === thumbTop && old.thumbHeight === thumbHeight && old.trackHeight === trackHeight ? old : { thumbTop, thumbHeight, trackHeight, max, show: true }));
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    const styles = new MutationObserver(measure);
    styles.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    styles.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    const poll = window.setInterval(measure, 1500); // Content that grows without a resize, such as lists loading.
    return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); resize.disconnect(); styles.disconnect(); window.clearInterval(poll); };
  }, [on]);

  if (!on) return null;
  const free = Math.max(1, m.trackHeight - m.thumbHeight);
  const onThumbDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, scroll: window.scrollY };
  };
  const onThumbMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = event.clientY - drag.current.y;
    window.scrollTo({ top: drag.current.scroll + (delta / free) * m.max, behavior: 'instant' as ScrollBehavior });
  };
  const onTrackDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const above = event.clientY - rect.top < m.thumbTop;
    window.scrollBy({ top: (above ? -1 : 1) * window.innerHeight * 0.9, behavior: 'smooth' });
  };
  return <div ref={track} aria-hidden="true" data-testid="custom-scrollbar" onPointerDown={onTrackDown}
    className={`group fixed bottom-0 right-0 z-[85] w-[14px] no-print no-drag ${m.show ? '' : 'pointer-events-none opacity-0'}`} style={{ top: 'var(--titlebar, 0px)' }}>
    <div onPointerDown={onThumbDown} onPointerMove={onThumbMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      className="absolute right-[3px] w-[7px] cursor-default rounded-full bg-faint/50 transition-[width,background-color] duration-150 hover:w-[9px] hover:bg-muted active:w-[9px] active:bg-muted group-hover:bg-faint/80"
      style={{ top: m.thumbTop, height: m.thumbHeight }} />
  </div>;
}
