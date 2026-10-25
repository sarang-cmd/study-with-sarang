import {
  AppWindow, ArrowRightFromLine, Copy, ExternalLink, EyeOff, Flag, Keyboard, Maximize, Minimize, Moon, Music2, Pause, PictureInPicture2, Pin, Play, Power, RefreshCw,
  RotateCcw, Settings, Share2, SkipForward, Sun, Timer as TimerIcon, Volume1, Volume2, VolumeX, Waves,
} from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { useFullscreen } from '../hooks/useFullscreen';
import { useTheme } from '../hooks/useTheme';
import { builtInMixes, readSavedMixes, shareURL } from '../lib/mix';
import { clock } from '../lib/tracking';
import { ContextMenu, type MenuContext, type MenuItem } from './ContextMenu';
import { desktop as nativeDesktop } from '../lib/desktop';
import { notify } from './ui/toast';

export interface DesktopMenuInfo { compact: boolean; pinned: boolean; globalEnabled: boolean; run: (command: string) => void; mac: boolean }

const SECTIONS: [string, string][] = [
  ['sound', 'Sound'], ['timer', 'Timer'], ['layers', 'Layers'], ['mixes', 'Mixes'], ['tracking', 'Tracking'], ['shield', 'Shield'], ['video', 'Video'],
];
const sep = (id: string): MenuItem => ({ type: 'separator', id });

function copyText(text: string, what: string) {
  const done = () => notify({ message: `${what} copied`, variant: 'success', duration: 1600 });
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => document.execCommand?.('copy'));
  else document.execCommand?.('copy');
}

/** Builds the items for whatever was right-clicked and hands them to the menu. */
export function AppContextMenu({ onZen, zenOpen, onShortcuts, onSettings, desktop }: { onZen: () => void; zenOpen: boolean; onShortcuts: () => void; onSettings: () => void; desktop?: DesktopMenuInfo }) {
  const sound = useSound();
  const timer = useTimer();
  const fullscreen = useFullscreen();
  const { dark, toggle: toggleTheme } = useTheme();

  const build = (ctx: MenuContext): MenuItem[] => {
    const items: MenuItem[] = [];

    // What is under the pointer comes first.
    if (ctx.selection) items.push({ id: 'copy-selection', label: 'Copy', hint: desktop?.mac ? '⌘C' : 'Ctrl+C', icon: <Copy size={13} />, onSelect: () => copyText(ctx.selection, 'Text') });
    if (ctx.link) {
      const href = ctx.link.href;
      const external = /^https?:/i.test(href) && new URL(href).origin !== location.origin;
      if (external) items.push({ id: 'open-link', label: 'Open link in browser', icon: <ExternalLink size={13} />, onSelect: () => { window.open(href, '_blank', 'noopener,noreferrer'); } });
      if (/^https?:/i.test(href)) items.push({ id: 'copy-link', label: 'Copy link address', icon: <Copy size={13} />, onSelect: () => copyText(href, 'Link') });
    }
    if (ctx.slider) {
      const label = ctx.slider.getAttribute('aria-label') ?? 'Slider';
      const fallback = ctx.slider.getAttribute('data-default');
      items.push({ type: 'label', id: 'slider', label: `${label}: ${ctx.slider.getAttribute('aria-valuetext') ?? ctx.slider.getAttribute('aria-valuenow')}` });
      items.push({ id: 'reset-slider', label: 'Reset to default', icon: <RotateCcw size={13} />, disabled: fallback === null, onSelect: () => { ctx.slider?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); } });
    }
    if (items.length) items.push(sep('after-target'));

    // The mini bar is only 104 px tall, so it shows the system menu (the same one as the tray icon).
    if (desktop?.compact) {
      nativeDesktop?.popupMenu();
      return [];
    }

    const mixes = (): MenuItem[] => {
      const saved = readSavedMixes();
      const list: MenuItem[] = [{ type: 'label', id: 'built', label: 'Built in' }, ...builtInMixes.map((item): MenuItem => ({ id: item.id, label: item.mix.name, checked: sound.activeId === item.id, onSelect: () => sound.loadMix(item.mix, item.id, { play: true }) }))];
      if (saved.length) list.push(sep('mine-sep'), { type: 'label', id: 'mine', label: 'Your mixes' }, ...saved.slice(0, 20).map((item): MenuItem => ({ id: item.id, label: item.name, checked: sound.activeId === item.id, onSelect: () => sound.loadMix(item.mix, item.id, { play: true }) })));
      return list;
    };
    const level = sound.mix.volume;
    items.push(
      { type: 'label', id: 'l-sound', label: 'Sound' },
      { id: 'toggle', label: sound.playing ? 'Pause sound' : 'Play sound', hint: 'Space', icon: sound.playing ? <Pause size={13} /> : <Play size={13} />, onSelect: sound.toggle },
      { id: 'next', label: 'Next variation', hint: 'N', icon: <SkipForward size={13} />, onSelect: sound.next },
      { id: 'mixes', label: 'Switch mix', icon: <Music2 size={13} />, items: mixes() },
      { id: 'volume', label: `Volume ${level}%`, icon: level === 0 ? <VolumeX size={13} /> : level < 50 ? <Volume1 size={13} /> : <Volume2 size={13} />, items: [
        { id: 'v-up', label: 'Louder', hint: ']', onSelect: () => sound.setVolume(level + 5) },
        { id: 'v-down', label: 'Quieter', hint: '[', onSelect: () => sound.setVolume(level - 5) },
        sep('v-s'),
        ...[0, 25, 50, 75, 100].map((value): MenuItem => ({ id: `v-${value}`, label: value === 0 ? 'Mute (0%)' : `${value}%`, checked: level === value, onSelect: () => sound.setVolume(value) })),
      ] },
      { id: 'share', label: 'Copy share link for this mix', icon: <Share2 size={13} />, onSelect: () => copyText(shareURL(sound.mix), 'Share link') },
      { type: 'label', id: 'l-timer', label: 'Timer' },
      { id: 'timer', label: timer.running ? 'Pause timer' : 'Start timer', hint: 'T', icon: <TimerIcon size={13} />, onSelect: timer.toggle },
      { id: 'timer-more', label: `Timer ${clock(timer.seconds)}`, icon: <RefreshCw size={13} />, items: [
        { id: 't-reset', label: 'Reset', onSelect: timer.reset },
        { id: 't-skip', label: 'Skip to the next phase', onSelect: timer.skip },
        { id: 't-drift', label: 'I drifted', hint: 'D', icon: <Flag size={13} />, disabled: !timer.hasSegment, onSelect: timer.markDistraction },
      ] },
      sep('s1'),
      { type: 'label', id: 'l-view', label: 'View' },
      { id: 'zen', label: zenOpen ? 'Close zen view' : 'Open zen view', hint: 'Z', icon: <Waves size={13} />, onSelect: onZen },
      ...(fullscreen.supported ? [{ id: 'fullscreen', label: fullscreen.active ? 'Exit full screen' : 'Full screen', hint: 'F', icon: fullscreen.active ? <Minimize size={13} /> : <Maximize size={13} />, onSelect: () => void fullscreen.toggle() } as MenuItem] : []),
      { id: 'theme', label: dark ? 'Switch to light mode' : 'Switch to dark mode', icon: dark ? <Sun size={13} /> : <Moon size={13} />, onSelect: toggleTheme },
      { id: 'goto', label: 'Go to section', icon: <ArrowRightFromLine size={13} />, items: SECTIONS.map(([id, label]): MenuItem => ({
        id, label,
        // The address bar hash takes care of switching pages in the tabbed layout and scrolling in the classic one.
        onSelect: () => { if (location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else location.hash = id; },
      })) },
      { id: 'settings', label: 'Settings', hint: 'Ctrl+,', icon: <Settings size={13} />, onSelect: onSettings },
      { id: 'keys', label: 'Keyboard shortcuts', hint: '?', icon: <Keyboard size={13} />, onSelect: onShortcuts },
    );
    if (desktop) {
      items.push(
        sep('s2'), { type: 'label', id: 'l-win', label: 'Window' },
        { id: 'compact', label: 'Collapse to mini bar', icon: <PictureInPicture2 size={13} />, onSelect: () => desktop.run('window.compact') },
        { id: 'pin', label: 'Keep on top', icon: <Pin size={13} />, checked: desktop.pinned, onSelect: () => desktop.run('window.pin') },
        { id: 'hide', label: 'Hide to tray', icon: <EyeOff size={13} />, onSelect: () => desktop.run('window.hide') },
        { id: 'global', label: 'Global shortcuts', icon: <AppWindow size={13} />, checked: desktop.globalEnabled, onSelect: () => desktop.run(desktop.globalEnabled ? 'shortcuts.disable' : 'shortcuts.enable') },
        { id: 'quit', label: 'Quit Study with Sarang', icon: <Power size={13} />, onSelect: () => desktop.run('app.quit') },
      );
    }
    return items;
  };
  return <ContextMenu build={build} />;
}
