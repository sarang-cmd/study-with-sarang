import { emitAutomation } from '../lib/automations';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { addNote, celebrate, getNotifySettings, isQuiet, osNotify } from '../lib/notifications';
import { applyResults, evaluateAchievements, readStore, writeStore, type AchievementResult, type UnlockStore } from '../lib/achievements';
import { readSavedMixes } from '../lib/mix';
import { getTodos, useTodos } from '../lib/plan';
import { usePrefs } from '../lib/prefs';

let store: UnlockStore = typeof localStorage === 'undefined' ? { seeded: false, unlocked: {} } : readStore();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => store;
function publish(next: UnlockStore) { store = next; writeStore(next); listeners.forEach((fn) => fn()); }

const doneTodos = () => getTodos().filter((t) => t.done).length;
function savedMixCount(): number { try { return readSavedMixes().length; } catch { return 0; } }

/** What is unlocked, and the live results. Safe to use in more than one place. */
export function useAchievementResults(): { results: AchievementResult[]; store: UnlockStore } {
  const { sessions, settings } = useTimer();
  const { listening } = useSound();
  const current = useSyncExternalStore(subscribe, snapshot);
  const todoList = useTodos();
  const results = useMemo(
    () => evaluateAchievements({ sessions, listening, savedMixes: savedMixCount(), goalMinutes: settings.dailyGoalMin, todosDone: doneTodos() }),
    [sessions, listening, settings.dailyGoalMin, current, todoList],
  );
  return { results, store: current };
}

/** Mount once. Records new unlocks and says so with one message and one chime. */
export function useAchievementTracker() {
  const { sessions, settings } = useTimer();
  const { listening } = useSound();
  const [prefs] = usePrefs();
  const todoList = useTodos();
  useEffect(() => {
    if (!prefs.achievements) return;
    const run = () => {
      const results = evaluateAchievements({ sessions, listening, savedMixes: savedMixCount(), goalMinutes: settings.dailyGoalMin, todosDone: doneTodos() });
      const update = applyResults(store, results);
      if (!update.fresh.length && store.seeded) return;
      publish(update.store);
      if (!update.fresh.length) return;
      // Every unlock is kept in the notification centre. After an update many old sessions can count at once: then there is one summary
      // note and only the three finest unlocks get a card, instead of a flood.
      const burst = update.fresh.length > 5;
      if (burst) addNote({ kind: 'achievement', title: `${update.fresh.length} achievements unlocked`, message: 'Your earlier sessions count towards the new achievements. See them on the Progress page.', key: `ach-burst-${Date.now()}` });
      else for (const def of update.fresh) { addNote({ kind: 'achievement', title: `Unlocked: ${def.title}`, message: def.text, tier: def.tier, icon: def.icon, key: `ach-${def.id}` }); osNotify(`Achievement unlocked: ${def.title}`, def.text); }
      if (!prefs.achievementToasts || isQuiet(getNotifySettings().quiet)) return;
      const shown = burst ? [...update.fresh].sort((a, b) => b.tier - a.tier).slice(0, 3) : update.fresh;
      for (const def of shown.slice(0, 5)) emitAutomation('achievement', { title: def.title });
      celebrate(shown.map((def) => ({ id: def.id, title: def.title, text: def.text, icon: def.icon, tier: def.tier, category: def.category })));
    };
    run();
    // Saved mixes live outside the timer data, so look again now and then.
    const timer = window.setInterval(run, 20_000);
    return () => window.clearInterval(timer);
  }, [sessions, listening, settings.dailyGoalMin, prefs.achievements, prefs.achievementToasts, todoList]);
}
