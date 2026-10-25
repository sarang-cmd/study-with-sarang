import { notify } from '../components/ui/toast';
import { getPrefs } from './prefs';
import { playUi, type UiSound } from './synth';

/**
 * One place for the small "something happened" feedback, so a button, a keyboard key, the Zen view, the tray,
 * a global shortcut and voice mode all behave the same. Each part follows its own switch in Settings.
 */
export function feedback(message: string, options: { title?: string; sound?: UiSound | null; id?: string; duration?: number } = {}) {
  const prefs = getPrefs();
  if (prefs.toasts) notify({ title: options.title, message, variant: 'default', id: options.id ?? 'quick', duration: options.duration ?? 1700 });
  if (prefs.uiSounds && options.sound !== null) playUi(options.sound ?? 'tap');
}
