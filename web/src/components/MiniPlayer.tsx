import { useEffect, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { usePuckState } from '../hooks/usePuckState';
import { pageVisible, usePuck, type PuckAction } from '../lib/puck';
import { PuckView } from './PuckView';
import { PuckPopout, usePopout } from './PuckPopout';
import { isDesktop } from '../lib/desktop';

const CORNER = { bl: 'bottom-5 left-3 sm:left-5', br: 'bottom-5 right-3 sm:right-5', tl: 'top-16 left-3 sm:left-5', tr: 'top-16 right-3 sm:right-5' } as const;

/** Runs a puck button inside the page. */
export function usePuckActions(onZen: () => void) {
  const sound = useSound(); const t = useTimer();
  return (action: PuckAction) => {
    switch (action) {
      case 'timer': t.toggle(); return;
      case 'skip': t.skip(); return;
      case 'sound': sound.toggle(); return;
      case 'next': sound.next(); return;
      case 'drift': t.markDistraction(); return;
      case 'reset': t.reset(); return;
      case 'finish': t.finish(); return;
      case 'volup': sound.nudgeVolume(5); return;
      case 'voldown': sound.nudgeVolume(-5); return;
      case 'zen': onZen(); return;
      default: return;
    }
  };
}

/** Keeps the essentials in reach once you scroll away from the main controls (a setting, with many options). */
export function MiniPlayer({ onZen, zen = false }: { onZen: () => void; zen?: boolean }) {
  const settings = usePuck();
  const state = usePuckState();
  const run = usePuckActions(onZen);
  const popout = usePopout();
  const [y, setY] = useState(0);
  useEffect(() => {
    const update = () => setY(window.scrollY);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const desktop = isDesktop;
  const onLabel = () => { if (settings.labelClick === 'zen') onZen(); else if (settings.labelClick === 'app') window.focus(); };
  return (
    <>
      {pageVisible(settings, y, state, zen) && !popout.open && (
        <div className={`fixed z-[65] max-w-[calc(100vw-24px)] arrive no-print ${CORNER[settings.corner]}`}>
          <PuckView state={state} settings={settings} desktop={desktop} onAction={run} onLabel={onLabel} />
        </div>
      )}
      <PuckPopout state={state} settings={settings} onAction={run} onLabel={onLabel} />
    </>
  );
}
