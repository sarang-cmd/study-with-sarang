import { useEffect, useRef } from 'react';
import { useSound } from '../context/SoundContext';
import { useDesktop } from '../context/DesktopContext';
import { isDesktop } from '../lib/desktop';
import { positionFor, setSessionPosition, syncMediaSession, titleFor } from '../lib/mediaSession';
import { useTimer } from '../context/TimerContext';
import { phaseLabel } from './TimerSection';
import { usePrefs } from '../lib/prefs';
import { getLive, roomController, useLive } from '../lib/studyRoom';

/**
 * Lets the system media keys reach this app only when it is the player that started most recently (see lib/mediaSession).
 * Desktop: active when the app was started with the "most recent player" setting. Web: active whenever media keys are on.
 */
export function MediaSessionBridge() {
  const sound = useSound();
  const timer = useTimer();
  const desktop = useDesktop();
  const [prefs] = usePrefs();
  const behavior = desktop.state?.behavior;
  const enabled = isDesktop ? Boolean(behavior?.mediaFollowActive) && behavior?.mediaKeys !== false : prefs.mediaKeys;
  const latest = useRef(sound); latest.current = sound;
  const live = useLive(); // the study room video counts as a player too
  const anyPlaying = sound.playing || live.playing;
  const timerActive = timer.running || timer.hasSegment;
  const title = titleFor(prefs.mediaTitle, `${phaseLabel(timer.phase, timer.mode)}${timer.mode === 'pomodoro' && timer.phase === 'focus' ? ` ${timer.cycle + 1}/${timer.settings.cycles}` : ''}`, timerActive, sound.mix.name);
  useEffect(() => {
    syncMediaSession(enabled, { playing: anyPlaying, title, artwork: prefs.mediaArtwork, icon: prefs.appIcon, album: timerActive ? `${timer.mode === 'pomodoro' ? 'Pomodoro' : timer.mode === 'countdown' ? 'Countdown' : 'Stopwatch'}` : 'Focus' },
      { play: () => { if (getLive().active) { if (!getLive().playing) roomController()?.toggle(); } else if (!latest.current.playing) void latest.current.play(); }, pause: () => { if (getLive().active) { if (getLive().playing) roomController()?.toggle(); } else if (latest.current.playing) latest.current.pause(); }, next: () => { if (getLive().active) roomController()?.next(); else latest.current.next(); } });
  }, [enabled, anyPlaying, title, timerActive, timer.mode, prefs.mediaArtwork, prefs.appIcon]);
  // The seek bar follows the session clock, once a second.
  const playingNow = sound.playing || timer.running;
  useEffect(() => {
    if (!enabled) return;
    setSessionPosition(timerActive || timer.running ? positionFor(prefs.mediaSeek, { mode: timer.mode, seconds: timer.seconds, totalSeconds: timer.totalSeconds }) : positionFor(prefs.mediaSeek, { mode: timer.mode, seconds: timer.totalSeconds, totalSeconds: timer.totalSeconds }), playingNow);
  }, [enabled, prefs.mediaSeek, timer.mode, timer.seconds, timer.totalSeconds, timer.running, timerActive, playingNow, title]);
  return null;
}
