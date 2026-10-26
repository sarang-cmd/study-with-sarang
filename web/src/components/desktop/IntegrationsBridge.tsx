import { useEffect, useRef } from 'react';
import { useSound } from '../../context/SoundContext';
import { useTimer } from '../../context/TimerContext';
import { desktop } from '../../lib/desktop';
import { AutoPauseMachine, activeReasons, emptyActivity } from '../../lib/autoPause';
import { activityKey, buildActivity, effectiveAppId } from '../../lib/discord';
import { getIntegrationState, patchIntegrationState } from '../../lib/integrationState';
import { usePrefs } from '../../lib/prefs';
import { notify } from '../ui/toast';

/**
 * Desktop only, renders nothing. Connects the optional integrations to the rest of the app:
 *  - Auto-pause: decides from what the shell reports (see lib/autoPause) and pauses or lowers the sound.
 *  - Discord Rich Presence: builds the status from what the privacy toggles allow and hands it to the shell.
 */
export function IntegrationsBridge() {
  const sound = useSound();
  const timer = useTimer();
  const [prefs] = usePrefs();
  const ap = prefs.autoPause;
  const dc = prefs.discord;
  const latest = useRef({ sound, ap, playing: sound.playing });
  latest.current = { sound, ap, playing: sound.playing };
  const machine = useRef(new AutoPauseMachine());

  // Subscriptions to the shell.
  useEffect(() => {
    const api = desktop;
    if (!api) return;
    const off = [
      api.onActivity((state) => { patchIntegrationState({ activity: state }); evaluate(); }),
      api.onActivityStatus((status) => patchIntegrationState({ activityStatus: status.status, activityMessage: status.message })),
      api.onDiscordStatus((status) => patchIntegrationState({ discordStatus: status.status, discordDetail: status.detail })),
    ];
    void api.integrationStatus().then((status) => { if (status) patchIntegrationState({ activityStatus: status.activity.status, discordStatus: status.discord.status }); });
    return () => off.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The helper runs only while auto-pause is on, and restarts when the recorder list changes.
  useEffect(() => { desktop?.activityConfig({ enabled: ap.enabled, recorders: ap.recorders }); if (!ap.enabled) patchIntegrationState({ activity: emptyActivity }); }, [ap.enabled, ap.recorders]);

  function evaluate() {
    const { sound: s, ap: settings, playing } = latest.current;
    const reasons = activeReasons(settings, getIntegrationState().activity);
    const step = machine.current.step(Date.now(), settings, reasons.length > 0, playing);
    if (step === 'pause') { s.pause(); if (settings.toast) notify({ message: `Sound paused: ${reasons[0]}.`, variant: 'default', id: 'auto-pause' }); }
    else if (step === 'lower') { s.setActivityDuck(settings.lowerTo / 100); if (settings.toast) notify({ message: `Sound lowered to ${settings.lowerTo}%: ${reasons[0]}.`, variant: 'default', id: 'auto-pause' }); }
    else if (step === 'resume') { void s.play(); if (settings.toast) notify({ message: 'Sound resumed.', variant: 'default', id: 'auto-pause' }); }
    else if (step === 'restore') { s.setActivityDuck(1); if (settings.toast) notify({ message: 'Sound back to normal.', variant: 'default', id: 'auto-pause' }); }
    const held = machine.current.held;
    const state = getIntegrationState();
    if (state.holding !== held || (held !== 'none' && state.holdReason !== reasons[0])) patchIntegrationState({ holding: held, holdReason: held === 'none' ? '' : reasons[0] ?? state.holdReason });
  }
  useEffect(() => { const id = window.setInterval(evaluate, 1000); return () => window.clearInterval(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { evaluate(); }, [sound.playing, ap]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (machine.current.held === 'lowered') sound.setActivityDuck(ap.lowerTo / 100); }, [ap.lowerTo, sound]);

  // Discord. A new status is sent only when something visible changed.
  const sent = useRef({ key: '', stamp: 0, cfg: '' });
  useEffect(() => {
    const api = desktop;
    if (!api) return;
    const send = () => {
      const now = Date.now();
      const activity = buildActivity(dc, { playing: sound.playing, mixName: sound.mix.name, timerRunning: timer.running, timerMode: timer.mode, phase: timer.phase, seconds: timer.seconds, task: timer.task, cycle: timer.cycle + 1, cycles: timer.settings.cycles }, now, prefs.appIcon);
      const key = activityKey(activity);
      const stamp = activity?.timestamps ? (activity.timestamps.end ?? activity.timestamps.start ?? 0) : 0;
      const cfg = `${dc.enabled}:${effectiveAppId(dc)}`;
      if (key === sent.current.key && cfg === sent.current.cfg && Math.abs(stamp - sent.current.stamp) <= 3) return;
      sent.current = { key, stamp, cfg };
      api.discordUpdate({ config: { enabled: dc.enabled, appId: effectiveAppId(dc) }, activity });
    };
    send();
    const id = window.setInterval(send, 5000);
    return () => window.clearInterval(id);
  }, [dc, sound.playing, sound.mix.name, timer.running, timer.mode, timer.phase, timer.seconds, timer.task, timer.cycle, timer.settings.cycles, prefs.appIcon]);
  return null;
}
