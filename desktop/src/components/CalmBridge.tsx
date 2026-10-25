import { useEffect, useRef, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { notify } from './ui/toast';
import { windDownLevel, windDownVeil } from '../lib/calm';
import { closeCalm, finishWindDown, getCalmView, openCalm, stopWindDown } from '../lib/calmState';
import { usePrefs } from '../lib/prefs';
import { CalmOverlay, useWindDown } from './CalmOverlay';

/**
 * Keeps the calm features alive while the calm screen is closed: the wind-down fade (and its dimming veil), the screensaver after a period
 * without input, and the intention reminder when a timer starts. Renders the calm screen itself.
 */
export function CalmBridge() {
  const sound = useSound();
  const timer = useTimer();
  const [prefs] = usePrefs();
  const c = prefs.calm;
  const wind = useWindDown();
  const [veil, setVeil] = useState(0);
  const veilOff = useRef(false);
  const latest = useRef({ sound, timer, c });
  latest.current = { sound, timer, c };

  // ---- wind-down ---------------------------------------------------------------------------
  useEffect(() => {
    if (!wind) { latest.current.sound.setDuckSource('wind', 1); setVeil(0); veilOff.current = false; return; }
    const w = wind;
    const step = () => {
      const now = Date.now();
      if (w.done) { setVeil(w.dim && !veilOff.current ? .85 : 0); return; }
      latest.current.sound.setDuckSource('wind', Math.max(.0001, windDownLevel(w, now)));
      setVeil(veilOff.current ? 0 : windDownVeil(w, now));
      if (now >= w.endsAt) {
        latest.current.sound.pause();
        latest.current.sound.setDuckSource('wind', 1);
        finishWindDown();
        notify({ title: 'Sleep well', message: 'The sound has faded out and paused.', variant: 'success', id: 'wind-done', duration: 6000 });
      }
    };
    step();
    const id = setInterval(step, 1000);
    return () => clearInterval(id);
  }, [wind]);
  // Any movement or key brings the screen back and ends a finished wind-down.
  useEffect(() => {
    if (!wind || (!wind.done && veil < .05)) return;
    let armed = false; const arm = setTimeout(() => { armed = true; }, 800);
    const wake = () => { if (!armed) return; if (wind.done) stopWindDown(); else { veilOff.current = true; setVeil(0); } };
    window.addEventListener('pointermove', wake); window.addEventListener('keydown', wake); window.addEventListener('pointerdown', wake);
    return () => { clearTimeout(arm); window.removeEventListener('pointermove', wake); window.removeEventListener('keydown', wake); window.removeEventListener('pointerdown', wake); };
  }, [wind, veil < .05]);

  // ---- screensaver -------------------------------------------------------------------------
  useEffect(() => {
    if (!c.screensaver) return;
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    const id = setInterval(() => {
      if (document.hidden || getCalmView().open) { return; }
      if (Date.now() - last >= c.screensaverMinutes * 60_000) { last = Date.now(); openCalm({ tab: 'scene', saver: true }); }
    }, 5000);
    return () => { events.forEach((name) => window.removeEventListener(name, touch)); clearInterval(id); };
  }, [c.screensaver, c.screensaverMinutes]);

  // ---- intention ---------------------------------------------------------------------------
  const was = useRef(timer.running);
  useEffect(() => {
    if (timer.running && !was.current && c.intentionOn && c.intention && timer.phase === 'focus') notify({ title: 'Your intention', message: c.intention, variant: 'default', id: 'intention', duration: 5000 });
    was.current = timer.running;
  }, [timer.running, timer.phase, c.intentionOn, c.intention]);

  useEffect(() => () => closeCalm(), []);
  return <>
    <CalmOverlay />
    {veil > 0.01 && <div aria-hidden="true" data-testid="veil" className="pointer-events-none fixed inset-0 z-[95] bg-black transition-opacity duration-1000" style={{ opacity: veil }} />}
  </>;
}
