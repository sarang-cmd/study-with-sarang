/**
 * Every command the app understands, in one format: `id` or `id:argument`.
 * The same text is used by shortcuts, macros, voice, the tray, the command line (--cmd=...) and
 * study-with-sarang:// links, so one button on a Stream Deck can do anything the app can.
 */
export interface CommandDef { id: string; label: string; group: string; arg?: 'volume' | 'mix' | 'macro'; example?: string }

export const COMMANDS: CommandDef[] = [
  { id: 'sound.toggle', label: 'Play or pause sound', group: 'Sound' },
  { id: 'sound.play', label: 'Start sound', group: 'Sound' },
  { id: 'sound.pause', label: 'Stop sound', group: 'Sound' },
  { id: 'sound.next', label: 'Next variation', group: 'Sound' },
  { id: 'volume.up', label: 'Volume up', group: 'Sound' },
  { id: 'volume.down', label: 'Volume down', group: 'Sound' },
  { id: 'volume.set', label: 'Set volume (0 to 100)', group: 'Sound', arg: 'volume', example: 'volume.set:40' },
  { id: 'mix.load', label: 'Load a mix and play it', group: 'Mixes', arg: 'mix', example: 'mix.load:Flow' },
  { id: 'macro.run', label: 'Run a macro', group: 'Mixes', arg: 'macro', example: 'macro.run:Start Flow session' },
  { id: 'timer.toggle', label: 'Start or pause timer', group: 'Timer' },
  { id: 'timer.start', label: 'Start timer', group: 'Timer' },
  { id: 'timer.pause', label: 'Pause timer', group: 'Timer' },
  { id: 'timer.reset', label: 'Reset timer', group: 'Timer' },
  { id: 'timer.skip', label: 'Skip to the next block', group: 'Timer' },
  { id: 'timer.drift', label: 'Mark a distraction', group: 'Timer' },
  { id: 'timer.finish', label: 'Finish and log the session', group: 'Timer' },
  { id: 'music.pause', label: 'Pause my music (Spotify, a video, any other player)', group: 'Music' },
  { id: 'music.play', label: 'Resume my music', group: 'Music' },
  { id: 'music.toggle', label: 'Play or pause my music', group: 'Music' },
  { id: 'music.next', label: 'Next song', group: 'Music' },
  { id: 'music.prev', label: 'Previous song', group: 'Music' },
  { id: 'music.stop', label: 'Stop my music', group: 'Music' },
  { id: 'media.pause', label: 'Pause the other player only (desktop)', group: 'Music' },
  { id: 'system.volume', label: 'Computer volume (up, down or mute)', group: 'Music', example: 'system.volume:down:3' },
  { id: 'timer.session', label: 'Start a focus session (minutes and goal)', group: 'Timer', example: 'timer.session:45;Physics homework' },
  { id: 'timer.countdown', label: 'Start a countdown (minutes)', group: 'Timer', example: 'timer.countdown:10' },
  { id: 'timer.left', label: 'Tell me how much time is left', group: 'Timer' },
  { id: 'break.start', label: 'Take a break now', group: 'Timer' },
  { id: 'break.end', label: 'Back to work', group: 'Timer' },
  { id: 'goal.set', label: 'Set the session goal', group: 'Goals', example: 'goal.set:Finish chapter 3' },
  { id: 'goal.start', label: 'Set the goal and start', group: 'Goals', example: 'goal.start:Revise optics' },
  { id: 'goal.clear', label: 'Clear the session goal', group: 'Goals' },
  { id: 'todo.add', label: 'Add a to-do', group: 'Goals', example: 'todo.add:Hand in lab report' },
  { id: 'todo.done', label: 'Tick off a to-do', group: 'Goals', example: 'todo.done:lab report' },
  { id: 'review.add', label: 'Schedule reviews of a topic', group: 'Goals', example: 'review.add:Optics' },
  { id: 'info', label: 'Ask: time, today, streak, goal, todos, exam, playing, date', group: 'Ask', example: 'info:today' },
  { id: 'page.go', label: 'Go to a page (studio, library, progress, focus)', group: 'View', example: 'page.go:progress' },
  { id: 'theme.set', label: 'Dark or light mode', group: 'View', example: 'theme.set:dark' },
  { id: 'bell.open', label: 'Open notifications', group: 'View' },
  { id: 'help.open', label: 'What can I say?', group: 'View' },
  { id: 'puck.toggle', label: 'Show or hide the floating puck', group: 'View' },
  { id: 'zen.open', label: 'Open Zen view', group: 'View' },
  { id: 'zen.close', label: 'Close Zen view', group: 'View' },
  { id: 'zen.toggle', label: 'Zen view', group: 'View' },
  { id: 'fullscreen.toggle', label: 'Full screen', group: 'View' },
  { id: 'calm.open', label: 'Open the calm screen', group: 'Calm' },
  { id: 'calm.close', label: 'Close the calm screen', group: 'Calm' },
  { id: 'calm.breathe', label: 'Start a breathing guide', group: 'Calm', example: 'calm.breathe:box' },
  { id: 'calm.ground', label: 'Start the grounding exercise', group: 'Calm' },
  { id: 'calm.scene', label: 'Show a calm scene', group: 'Calm', example: 'calm.scene:rain' },
  { id: 'calm.wind', label: 'Wind down: fade out the sound', group: 'Calm', example: 'calm.wind:30' },
  { id: 'ui.simple', label: 'Simple view on or off', group: 'View', example: 'ui.simple:toggle' },
  { id: 'settings.open', label: 'Open settings', group: 'View' },
  { id: 'window.toggle', label: 'Show or hide window', group: 'Window' },
  { id: 'window.show', label: 'Show window', group: 'Window' },
  { id: 'window.hide', label: 'Hide to tray', group: 'Window' },
  { id: 'window.compact', label: 'Collapse to mini bar', group: 'Window', example: 'window.compact:toggle' },
  { id: 'window.expand', label: 'Expand to full window', group: 'Window' },
  { id: 'window.snap', label: 'Snap the window (left, right, top, bottom, a corner, a third or center)', group: 'Window', example: 'window.snap:left' },
  { id: 'window.moveto', label: 'Move the window to a screen', group: 'Window', example: 'window.moveto:primary' },
  { id: 'window.pin', label: 'Always on top', group: 'Window' },
  { id: 'shortcuts.toggle', label: 'Turn global shortcuts on or off', group: 'Shortcuts' },
  { id: 'shortcuts.enable', label: 'Turn global shortcuts on', group: 'Shortcuts' },
  { id: 'shortcuts.disable', label: 'Turn global shortcuts off', group: 'Shortcuts' },
];

export const findCommand = (id: string) => COMMANDS.find((item) => item.id === id);

export function splitCommand(text: string): { id: string; arg: string } {
  const at = text.indexOf(':');
  return at === -1 ? { id: text.trim(), arg: '' } : { id: text.slice(0, at).trim(), arg: text.slice(at + 1).trim() };
}

/** A friendly name for a command, for lists and toasts. */
export function describeCommand(text: string): string {
  const { id, arg } = splitCommand(text);
  const def = findCommand(id);
  return def ? (arg ? `${def.label}: ${arg}` : def.label) : text;
}

/** What to type into a shortcut or a Stream Deck "Open" button. */
export const commandLine = (exe: string, command: string) => `"${exe}" --cmd=${/\s/.test(command) ? `"${command}"` : command}`;

/** study-with-sarang://cmd/mix.load/Flow%20and%20rain */
export function commandLink(command: string, protocol = 'study-with-sarang'): string {
  const { id, arg } = splitCommand(command);
  return `${protocol}://cmd/${id}${arg ? `/${encodeURIComponent(arg)}` : ''}`;
}
