'use strict';
/**
 * One list of commands drives everything: global shortcuts, tray, voice, macros, the command
 * line (for Stream Deck's "Open" action) and study-with-sarang:// links.
 * A command is "id" or "id:argument", for example "volume.set:40" or "mix.load:Flow and rain".
 */
const { PROTOCOL } = require('./common.cjs');

const MAIN_COMMANDS = new Set([
  'window.show', 'window.hide', 'window.toggle', 'window.minimize', 'window.maximize', 'window.close', 'window.compact', 'window.expand', 'window.pin',
  'window.moveto', 'window.snap', 'shortcuts.toggle', 'shortcuts.enable', 'shortcuts.disable', 'app.quit', 'app.login', 'app.update',
  'media.pause', 'media.play', 'media.toggle', 'media.next', 'media.prev', 'media.stop', 'system.volume',
]);
const RENDERER_COMMANDS = new Set([
  'sound.toggle', 'sound.play', 'sound.pause', 'sound.next',
  'volume.up', 'volume.down', 'volume.set',
  'timer.toggle', 'timer.start', 'timer.pause', 'timer.reset', 'timer.skip', 'timer.drift', 'timer.finish', 'puck.toggle',
  'zen.toggle', 'zen.open', 'zen.close', 'fullscreen.toggle', 'settings.open', 'palette.open', 'layout.toggle', 'mix.load', 'macro.run', 'voice.toggle',
  'music.pause', 'music.play', 'music.toggle', 'music.next', 'music.prev', 'music.stop', 'timer.session', 'timer.countdown', 'timer.left', 'break.start', 'break.end',
  'goal.set', 'goal.clear', 'goal.start', 'todo.add', 'todo.done', 'review.add', 'info', 'page.go', 'theme.set', 'bell.open', 'help.open',
  'calm.open', 'calm.close', 'calm.breathe', 'calm.ground', 'calm.scene', 'calm.wind', 'ui.simple',
]);
// Never accepted from links, because any web page can open a link to the app.
const LINK_BLOCKED = new Set(['app.quit', 'app.login', 'app.update', 'window.close', 'todo.add', 'todo.done', 'goal.set', 'goal.clear', 'goal.start', 'review.add', 'system.volume']);

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/** @returns {{id: string, arg: string} | null} */
function parse(text) {
  const raw = clean(text, 160);
  if (!raw) return null;
  const at = raw.indexOf(':');
  const id = (at === -1 ? raw : raw.slice(0, at)).trim();
  const arg = at === -1 ? '' : raw.slice(at + 1).trim();
  if (!MAIN_COMMANDS.has(id) && !RENDERER_COMMANDS.has(id)) return null;
  return { id, arg };
}

/** Finds a command in argv: --cmd=id, --cmd id, or a study-with-sarang:// link. */
function fromArgv(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const item = String(argv[i]);
    if (item.startsWith('--cmd=')) return { source: 'cli', command: parse(item.slice(6)) };
    if (item === '--cmd' && argv[i + 1]) return { source: 'cli', command: parse(argv[i + 1]) };
    if (item.toLowerCase().startsWith(`${PROTOCOL}://`)) return { source: 'link', command: fromUrl(item) };
  }
  return null;
}

/** study-with-sarang://cmd/sound.toggle  or  study-with-sarang://cmd/mix.load/Flow%20and%20rain */
function fromUrl(link) {
  try {
    const url = new URL(link);
    if (url.protocol !== `${PROTOCOL}:`) return null;
    const parts = [url.hostname, ...url.pathname.split('/').filter(Boolean)];
    if (parts[0] === 'cmd') parts.shift();
    if (!parts.length) return null;
    const id = parts.shift();
    const arg = parts.map((part) => decodeURIComponent(part)).join('/');
    const command = parse(arg ? `${id}:${arg}` : id);
    return command && !LINK_BLOCKED.has(command.id) ? command : null;
  } catch { return null; }
}

module.exports = { parse, fromArgv, fromUrl, MAIN_COMMANDS, RENDERER_COMMANDS, LINK_BLOCKED };
