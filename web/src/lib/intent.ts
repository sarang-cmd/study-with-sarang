/**
 * Understanding what was said, without any service. Flexible on purpose: "volume full", "volume 100", "set volume to forty",
 * "turn it up a bit", "Flow set Flow volume 40" and "put on Rainy window" all work, in English and German.
 * Anything this cannot place is "unsure", and only then does Flow offer to ask an AI service (see lib/flowApi).
 */
import { matchMore } from './intentMore';
export interface Intent { command: string; label: string; confidence: number; how: 'rule' | 'mix' | 'macro' | 'guess' }
export interface IntentContext { mixNames: string[]; macroNames: string[]; todoNames?: string[]; subjectNames?: string[] }

const WAKE = ['flow', 'sarang', 'saring', 'sarong'];
const FILLER = new Set(['hey', 'hi', 'ok', 'okay', 'please', 'bitte', 'kindly', 'could', 'can', 'would', 'you', 'just', 'now', 'for', 'me', 'mal', 'doch', 'einfach', 'jetzt', 'kannst', 'du', 'ich', 'möchte', 'mochte', 'will', 'want', 'to', 'the', 'a', 'an', 'my', 'der', 'die', 'das', 'den', 'dem', 'bitte', 'thanks', 'danke', 'um', 'uh', 'uhm', 'ähm']);

export const norm = (text: string) => text.toLowerCase().replace(/ß/g, 'ss').replace(/[’']/g, '').replace(/%/g, ' percent ').replace(/[^\p{L}\p{N} -]/gu, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------- numbers
const UNITS: Record<string, number> = {
  zero: 0, null: 0, one: 1, eins: 1, ein: 1, eine: 1, two: 2, zwei: 2, three: 3, drei: 3, four: 4, vier: 4, five: 5, funf: 5, fünf: 5, six: 6, sechs: 6, seven: 7, sieben: 7, eight: 8, acht: 8, nine: 9, neun: 9,
  ten: 10, zehn: 10, eleven: 11, elf: 11, twelve: 12, zwolf: 12, zwölf: 12, thirteen: 13, dreizehn: 13, fourteen: 14, vierzehn: 14, fifteen: 15, funfzehn: 15, fünfzehn: 15, sixteen: 16, sechzehn: 16,
  seventeen: 17, siebzehn: 17, eighteen: 18, achtzehn: 18, nineteen: 19, neunzehn: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, zwanzig: 20, thirty: 30, dreissig: 30, dreißig: 30, forty: 40, vierzig: 40, fifty: 50, funfzig: 50, fünfzig: 50, sixty: 60, sechzig: 60, seventy: 70, siebzig: 70, eighty: 80, achtzig: 80, ninety: 90, neunzig: 90,
};
const DE_COMPOUND = /^(ein|zwei|drei|vier|funf|fünf|sechs|sieben|acht|neun)und(zwanzig|dreissig|dreißig|vierzig|funfzig|fünfzig|sechzig|siebzig|achtzig|neunzig)$/;
const SPECIAL: Record<string, number> = {
  full: 100, max: 100, maximum: 100, maximal: 100, top: 100, voll: 100, everything: 100,
  half: 50, halfway: 50, halb: 50, medium: 50, quarter: 25, viertel: 25,
  mute: 0, silent: 0, stumm: 0, nothing: 0, off: 0, min: 0, minimum: 0, lowest: 5,
};

/** A number from words or digits: "40", "forty", "forty five", "one hundred", "full", "half", "vierzig", "fünfundvierzig". */
export function parseNumber(text: string): number | null {
  const tokens = norm(text).split(' ').filter(Boolean);
  let total: number | null = null, current = 0, seen = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d{1,3}$/.test(t)) { return Math.min(100, Number(t)); }
    if (t === 'all' && tokens[i + 1] === 'the' && tokens[i + 2] === 'way') return 100;
    if (t in SPECIAL) return SPECIAL[t];
    if (t === 'hundred' || t === 'hundert') { current = (current || 1) * 100; seen = true; continue; }
    if (t in TENS) { current += TENS[t]; seen = true; continue; }
    const de = DE_COMPOUND.exec(t);
    if (de) { current += (UNITS[de[1]] ?? 0) + (TENS[de[2]] ?? 0); seen = true; continue; }
    if (t in UNITS) { current += UNITS[t]; seen = true; continue; }
    if (seen) break;
  }
  if (seen) total = current;
  return total === null ? null : Math.min(100, total);
}

// ---------------------------------------------------------------------------------------------- phrasing
function stripWake(text: string, everywhere: boolean): string {
  const tokens = text.split(' ').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (WAKE.includes(t) && (everywhere || out.every((x) => FILLER.has(x)))) continue;
    out.push(t);
  }
  return out.join(' ');
}
const POLITE = new Set(['hey', 'hi', 'ok', 'okay', 'please', 'bitte', 'kindly', 'could', 'can', 'would', 'you', 'just', 'thanks', 'danke', 'um', 'uh', 'uhm', 'ähm', 'kannst', 'du', 'mal', 'doch', 'einfach']);
const dropPolite = (text: string) => text.split(' ').filter((t) => !POLITE.has(t)).join(' ');
const dropFiller = (text: string) => text.split(' ').filter((t) => !FILLER.has(t)).join(' ');

interface Rule { command: string; label: string; test: RegExp }
const r = (command: string, label: string, test: string): Rule => ({ command, label, test: new RegExp(`^(?:${test})$`) });
const SOUNDW = '(?: (?:the )?(?:sound|sounds|music|audio|ambience|ambient|noise|background|klang|ton|musik))?';
const VERBS_PLAY = '(?:play|resume|start|unpause|continue|go|begin|abspielen|spiel|spielen|starte|weiter)';
const VERBS_PAUSE = '(?:pause|stop|halt|silence|shush|hush|mute|be quiet|quiet|off|turn off|switch off|shut up|stopp|stoppe|aus)';
const UP = '(?:louder|volume up|turn it up|turn up(?: (?:the )?(?:volume|sound|music))?|increase|raise|more volume|up|higher|lauter|hoch)';
const DOWN = '(?:quieter|softer|volume down|turn it down|turn down(?: (?:the )?(?:volume|sound|music))?|decrease|lower|less volume|down|too loud|leiser|runter)';
const A_BIT = '(?: (?:a )?(?:bit|little|touch|notch|tad|bisschen|etwas|ein bisschen))?';

const RULES: Rule[] = [
  r('sound.toggle', 'Play or pause the sound', '(?:toggle|play pause|play or pause|pause or play|umschalten)' + SOUNDW),
  r('sound.play', 'Play the sound', `${VERBS_PLAY}${SOUNDW}(?: again)?|unmute|un mute|ton an|musik an|wiedergabe starten|(?:turn|switch) (?:the )?(?:sound|music|it) on`),
  r('sound.pause', 'Pause the sound', `${VERBS_PAUSE}${SOUNDW}|pause (?:the )?(?:sound|music|audio)|ton aus|musik aus|(?:turn|switch) (?:the )?(?:sound|music|it) off`),
  r('sound.next', 'Next variation', '(?:next|skip|change|switch|shuffle|another|weiter|nachster klang|nachste variante)(?: (?:sound|sounds|variation|version|one|track|song|klang|variante))?(?: please)?|something else|something different|change it up|mix it up|new (?:sound|variation)'),
  r('volume.up', 'Volume up', `(?:turn |make |bring |crank )?(?:it |the volume |volume |sound |music )?${UP}${A_BIT}(?: up)?|(?:volume|sound|music) (?:a bit |little )?(?:up|higher|louder)|increase (?:the )?volume|raise (?:the )?volume|(?:a bit |little )?louder`),
  r('volume.down', 'Volume down', `(?:turn |make |bring )?(?:it |the volume |volume |sound |music )?${DOWN}${A_BIT}(?: down)?|(?:volume|sound|music) (?:a bit |little )?(?:down|lower|quieter|softer)|decrease (?:the )?volume|lower (?:the )?volume|(?:a bit |little )?quieter|(?:a bit |little )?softer|too loud|too noisy`),
  r('timer.start', 'Start the timer', `(?:start|begin|launch|run|resume|go)(?: (?:the|a|my|new))? (?:timer|focus|focus timer|pomodoro|session|focus session|work|block|countdown|study)|lets (?:focus|study|work|begin|go)|focus time|time to (?:focus|study|work)|timer (?:start|an)|starte (?:den )?(?:timer|fokus)|fokus starten|timer starten`),
  r('timer.pause', 'Pause the timer', '(?:pause|stop|hold|freeze)(?: (?:the|my))? (?:timer|focus|pomodoro|session|countdown)|timer (?:pause|stop|aus)|timer pausieren|timer anhalten|pause timer'),
  r('timer.reset', 'Reset the timer', '(?:reset|restart|clear)(?: (?:the|my))? (?:timer|focus|pomodoro|session|countdown)|timer (?:reset|restart)|timer zurucksetzen|timer zurücksetzen'),
  r('timer.skip', 'Skip to the next block', '(?:skip|end|finish)(?: (?:the|this|my))? (?:timer|break|block|session|focus|pomodoro|round|phase)|next (?:block|break|session|round|phase)|timer uberspringen|timer überspringen|pause uberspringen|pause überspringen'),
  r('timer.drift', 'Mark a distraction', '(?:i )?(?:drifted|got distracted|am distracted|was distracted|lost focus|lost my focus)|(?:mark|log|note|count)(?: a| the)? (?:distraction|drift)|distracted|distraction|ich war abgelenkt|ablenkung'),
  r('zen.toggle', 'Zen view', '(?:open |close |exit |leave |toggle |show |hide |enter |start |stop )?(?:the )?zen(?: (?:mode|view|screen|on|off))?|zen modus|zen ansicht'),
  r('fullscreen.toggle', 'Full screen', '(?:toggle |enter |exit |leave )?(?:the )?full ?screen(?: mode)?|vollbild'),
  r('window.hide', 'Hide to the tray', '(?:hide|minimize|minimise|close|tuck away)(?: (?:the )?(?:window|app|studio))?|fenster ausblenden|app ausblenden'),
  r('window.show', 'Show the window', '(?:show|open|bring up|bring back|restore|unhide)(?: (?:the )?(?:window|app|studio))?|fenster anzeigen|app anzeigen'),
  r('window.compact', 'Collapse to the mini bar', '(?:mini mode|mini bar|mini player|collapse|go small|make it small|compact(?: mode)?|mini modus|einklappen)'),
  r('window.expand', 'Expand to the full window', '(?:expand|full window|big window|go big|make it big|uncollapse|ausklappen|grosses fenster|großes fenster)'),
  r('shortcuts.disable', 'Turn global shortcuts off', '(?:disable|turn off|switch off|stop) (?:the )?(?:global )?(?:shortcuts|hotkeys|keys)|tastenkurzel ausschalten|tastenkürzel ausschalten'),
  r('shortcuts.enable', 'Turn global shortcuts on', '(?:enable|turn on|switch on|start) (?:the )?(?:global )?(?:shortcuts|hotkeys|keys)|tastenkurzel einschalten|tastenkürzel einschalten'),
  r('voice.toggle', 'Stop listening', '(?:stop|quit|end|disable) (?:listening|voice|voice mode)|nicht mehr zuhoren|nicht mehr zuhören'),
  r('settings.open', 'Open settings', '(?:open |show |go to )?(?:the )?settings|einstellungen(?: offnen| öffnen)?'),
  r('palette.open', 'Open the command palette', '(?:open |show )?(?:the )?(?:command palette|palette|commands)'),
  r('calm.breathe', 'Start a breathing guide', '(?:lets |let us |i need to |help me |time to )?(?:breathe|breathing|take a breath|take a deep breath|breathe with me|breathing exercise|breathing guide|box breathing|calm down|calm me down|relax|help me relax|help me calm down|i am stressed|im stressed|i feel anxious|im anxious|atmen|atemubung|atemübung|beruhige mich)'),
  r('calm.ground', 'Start the grounding exercise', '(?:start |do |begin )?(?:the )?(?:grounding|grounding exercise|five four three two one|5 4 3 2 1|ground me|help me ground)|erde mich'),
  r('calm.open', 'Open the calm screen', '(?:open |show |go to |start )?(?:the )?(?:calm|calm screen|calm view|calm space|scenes|ambient scenes|relax screen)|beruhigen'),
  r('calm.close', 'Close the calm screen', '(?:close|exit|leave|end|stop|hide) (?:the )?(?:calm|calm screen|calm view|breathing|breathing guide|scene|scenes|visuals)'),
  r('ui.simple:on', 'Simple view on', '(?:simple|minimal|minimalist|quiet|calm)(?: (?:view|mode|ui|interface))|(?:go |switch |turn )?(?:to )?simple(?: view)?(?: on)?|simple modus|einfache ansicht'),
  r('ui.simple:off', 'Simple view off', '(?:full|normal|power|complete|everything|back to normal)(?: (?:view|mode|ui|interface))|(?:turn |switch )?simple(?: view| mode)? off|exit simple(?: view| mode)?|show everything|volle ansicht'),
];

const SCENES: [string, string[]][] = [['aurora', ['aurora', 'northern lights']], ['rain', ['rain on glass', 'rain scene', 'raindrops on glass', 'rain on the window']], ['stars', ['stars', 'starfield', 'night sky']], ['ripples', ['ripples', 'water', 'pond']], ['embers', ['embers', 'fire', 'campfire']], ['drift', ['drift', 'fog', 'mist']]];

function volumeIntent(text: string): Intent | null {
  // Anything that mentions volume (or a level) and carries a number or "full", "half", "mute".
  const m = /^(?:set |put |make |change |turn |bring |adjust |schalte |stelle |mach )?(?:it |sound |music |audio |ton |musik )?(?:the )?(?:volume|lautstarke|lautstärke|level|loudness|it)(?: (?:level|to|at|on|auf|up to|down to|=))*\s*(.*)$/.exec(text);
  const hasVolume = /\b(volume|lautstarke|lautstärke|level|loudness)\b/.test(text);
  const reversed = /^(.*?)\s*(?:percent|prozent)?\s*(?:volume|lautstarke|lautstärke)$/.exec(text);
  const setIt = /^(?:set|put|make|turn|bring|change) (?:it|that|this|them) (?:(?:to|at|up to|down to) )?(.+)$/.exec(text);
  const tail = hasVolume ? (m?.[1] ?? reversed?.[1] ?? '') : (setIt?.[1] ?? '');
  const n = tail ? parseNumber(tail) : (hasVolume ? parseNumber(text.replace(/volume|lautstarke|lautstärke/g, '')) : null);
  if (n === null || !(hasVolume || setIt)) return null;
  return { command: `volume.set:${n}`, label: `Set the volume to ${n}%`, confidence: 1, how: 'rule' };
}

const levenshtein = (a: string, b: string) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const similarity = (a: string, b: string) => (a || b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1);

export function bestName(wanted: string, names: string[]): { name: string; score: number } | null {
  const w = norm(wanted);
  if (!w) return null;
  let best: { name: string; score: number } | null = null;
  for (const name of names) {
    const n = norm(name);
    if (!n) continue;
    const score = n === w ? 1 : (n.includes(w) && w.length >= 3) || (w.includes(n) && n.length >= 3) ? .9 : similarity(n, w);
    if (!best || score > best.score) best = { name, score };
  }
  return best;
}

const MIX_VERB = /^(?:load|play|start|put on|switch to|change to|go to|open|use|mix|select|choose|bring up|play me|give me|lade|spiel|spiele|starte|offne|öffne|mix)\s+(?:the |my |a |mix |sound |soundscape |preset |den |die |das )*(.+?)(?: mix| preset| soundscape)?$/;
const MACRO_VERB = /^(?:run|do|execute|trigger|macro|starte|fuhre aus|führe aus|makro)\s+(?:the |my |macro |makro )*(.+?)(?: macro| makro)?$/;

function windIntent(text: string): Intent | null {
  if (!/\b(?:sleep timer|wind down|winddown|fade out|good night|gute nacht|einschlaftimer|einschlaf timer|schlaftimer)\b/.test(text)) return null;
  if (/\b(?:cancel|stop|abort|end|abbrechen|beenden|aus)\b/.test(text) && /\b(?:timer|wind down|winddown|fade)\b/.test(text)) return { command: 'calm.wind:off', label: 'Cancel the wind-down', confidence: 1, how: 'rule' };
  const m = /(\d+|[a-zäöü]+(?: [a-zäöü]+)?) ?(minutes|minute|mins|min|minuten|hours|hour|stunden|stunde)\b/.exec(text);
  let minutes = 0;
  if (m) { const v = parseNumber(m[1]); if (v) minutes = /^h|stund/.test(m[2]) ? v * 60 : v; }
  if (/half an hour|halbe stunde/.test(text)) minutes = 30;
  const label = minutes ? `Wind down over ${minutes} minutes` : 'Wind down';
  return { command: minutes ? `calm.wind:${Math.min(240, minutes)}` : 'calm.wind', label, confidence: 1, how: 'rule' };
}

function match(text: string, ctx: IntentContext): Intent | null {
  const more = matchMore(text, ctx, { parseNumber, bestName });
  if (more) return more;
  const wind = windIntent(text);
  if (wind) return wind;
  for (const rule of RULES) if (rule.test.test(text)) {
    return { command: rule.command, label: rule.label, confidence: 1, how: 'rule' };
  }
  const volume = volumeIntent(text);
  if (volume) return volume;
  const scene = /^(?:show|open|start|play|switch to|go to|put on|set)\s+(?:the )?(.+?)(?: scene| screen| visual| visuals)?$/.exec(text);
  if (scene) for (const [id, words] of SCENES) if (words.some((word) => scene[1] === word || scene[1].includes(word))) return { command: `calm.scene:${id}`, label: `Calm scene: ${id}`, confidence: 1, how: 'rule' };
  const macro = MACRO_VERB.exec(text);
  if (macro) { const best = bestName(macro[1], ctx.macroNames); if (best && best.score >= .72) return { command: `macro.run:${best.name}`, label: `Run macro ${best.name}`, confidence: best.score, how: 'macro' }; }
  const mix = MIX_VERB.exec(text);
  if (mix) {
    const best = bestName(mix[1], ctx.mixNames);
    if (best && best.score >= .72) return { command: `mix.load:${best.name}`, label: `Load the mix ${best.name}`, confidence: best.score, how: 'mix' };
    const m2 = bestName(mix[1], ctx.macroNames);
    if (m2 && m2.score >= .8) return { command: `macro.run:${m2.name}`, label: `Run macro ${m2.name}`, confidence: m2.score, how: 'macro' };
  }
  // A mix name on its own ("rainy window", "deep focus") loads it when it is a close match.
  const only = bestName(text, ctx.mixNames);
  if (only && only.score >= .88 && text.length >= 4) return { command: `mix.load:${only.name}`, label: `Load the mix ${only.name}`, confidence: only.score, how: 'mix' };
  return null;
}

/** What was said, as a command the app understands, or null when it is not clear. Never guesses: see guessIntent. */
export function parseIntent(heard: string, ctx: IntentContext): Intent | null {
  const base = norm(heard);
  if (!base) return null;
  const tries = [stripWake(base, false), stripWake(base, true), dropPolite(stripWake(base, true)), dropFiller(stripWake(base, true))];
  for (const t of [...new Set(tries)]) { if (!t) continue; const found = match(t, ctx); if (found) return found; }
  return null;
}

// A softer reading for the "do you mean ...?" step: keywords instead of whole phrases.
const KEYWORDS: { command: string; label: string; words: string[]; need?: string[] }[] = [
  { command: 'volume.up', label: 'Volume up', words: ['louder', 'lauter', 'up', 'increase', 'raise', 'higher'], need: ['volume', 'sound', 'music', 'it', 'louder', 'lauter'] },
  { command: 'volume.down', label: 'Volume down', words: ['quieter', 'leiser', 'down', 'decrease', 'lower', 'softer'], need: ['volume', 'sound', 'music', 'it', 'quieter', 'leiser', 'softer'] },
  { command: 'sound.pause', label: 'Pause the sound', words: ['pause', 'stop', 'silence', 'quiet', 'mute', 'off', 'aus', 'stopp'] },
  { command: 'sound.play', label: 'Play the sound', words: ['play', 'start', 'resume', 'unmute', 'on', 'an', 'spiel', 'abspielen'] },
  { command: 'sound.next', label: 'Next variation', words: ['next', 'another', 'different', 'change', 'weiter', 'else'] },
  { command: 'timer.start', label: 'Start the timer', words: ['timer', 'focus', 'pomodoro', 'study', 'work', 'session', 'fokus'] },
  { command: 'timer.skip', label: 'Skip to the next block', words: ['skip', 'break', 'block'] },
  { command: 'zen.toggle', label: 'Zen view', words: ['zen'] },
  { command: 'calm.breathe', label: 'Start a breathing guide', words: ['breathe', 'breathing', 'calm', 'relax', 'stressed', 'anxious', 'panic', 'atmen'] },
  { command: 'ui.simple:on', label: 'Simple view on', words: ['simple', 'minimal', 'clutter', 'busy', 'distracting'] },
];
export function guessIntent(heard: string, ctx: IntentContext): Intent | null {
  const text = dropFiller(stripWake(norm(heard), true));
  if (!text) return null;
  const sure = parseIntent(heard, ctx);
  if (sure) return sure;
  const tokens = new Set(text.split(' '));
  let best: Intent | null = null, bestScore = 0;
  for (const item of KEYWORDS) {
    const hits = item.words.filter((w) => tokens.has(w)).length;
    if (!hits) continue;
    if (item.need && !item.need.some((w) => tokens.has(w))) continue;
    const score = hits / Math.max(2, tokens.size);
    if (score > bestScore) { bestScore = score; best = { command: item.command, label: item.label, confidence: Math.min(.7, .3 + score / 2), how: 'guess' }; }
  }
  const mix = bestName(text, ctx.mixNames);
  if (mix && mix.score >= .55 && mix.score > bestScore) return { command: `mix.load:${mix.name}`, label: `Load the mix ${mix.name}`, confidence: Math.min(.7, mix.score * .7), how: 'guess' };
  return best;
}

/** Speakable number phrases for the Windows recognizer: volume 0 to 100 in steps of 5, as words. */
export function numberWord(n: number, lang: 'en' | 'de'): string {
  const en = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const enTens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const de = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  const deTens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
  if (n >= 100) return lang === 'en' ? 'one hundred' : 'hundert';
  if (n < 20) return lang === 'en' ? en[n] : de[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (lang === 'en') return u ? `${enTens[t]} ${en[u]}` : enTens[t];
  return u ? `${de[u] === 'eins' ? 'ein' : de[u]}und${deTens[t]}` : deTens[t];
}
