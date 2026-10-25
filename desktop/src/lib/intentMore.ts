/**
 * The "Siri" part of Flow: everyday phrases for music in other apps, the timer, goals, to-dos, questions and navigation.
 * It works on text already lowercased and stripped by `norm` (apostrophes and punctuation are gone: "whats", "im").
 * Phrases it does not recognise fall through to the older rules, so nothing that worked before changes.
 */
import type { Intent } from './intent';

export interface MoreHelpers { parseNumber: (text: string) => number | null; bestName: (wanted: string, names: string[]) => { name: string; score: number } | null }
export interface MoreContext { todoNames?: string[]; subjectNames?: string[] }

const say = (command: string, label: string, confidence = 1): Intent => ({ command, label, confidence, how: 'rule' });
const cap = (s: string) => s.trim().replace(/^./u, (c) => c.toUpperCase()).slice(0, 140);

// ---- time phrases ----------------------------------------------------------------------------
const UNIT = '(?:minutes?|mins?|hours?|hrs?|hr|minuten|minute|stunden?)';
const TIME = `((?:an hour and a half|one and a half hours|half an hour|a half hour|an hour|quarter of an hour|a quarter of an hour|eine halbe stunde|eine stunde|(?:\\d+(?:\\.\\d+)?|[a-z]+(?: [a-z]+)?)\\s*${UNIT}))`;

/** "forty five minutes", "an hour", "1.5 hours", "half an hour" to a number of minutes (1 to 600), or null. */
export function parseMinutes(phrase: string, h: MoreHelpers): number | null {
  const t = phrase.trim();
  if (/^(?:an hour and a half|one and a half hours)$/.test(t)) return 90;
  if (/^(?:half an hour|a half hour|eine halbe stunde)$/.test(t)) return 30;
  if (/^(?:a )?quarter of an hour$/.test(t)) return 15;
  if (/^(?:an hour|eine stunde)$/.test(t)) return 60;
  const m = new RegExp(`^(.+?)\\s*(${UNIT})$`).exec(t);
  if (!m) return null;
  const hours = /^(?:h|std|stund)/.test(m[2]);
  let n: number | null;
  if (/^\d+(?:\.\d+)?$/.test(m[1])) n = Number(m[1]);
  else if (/^(?:a|one) and a half$/.test(m[1])) n = 1.5;
  else n = h.parseNumber(m[1]);
  if (n === null || !(n > 0)) return null;
  const minutes = Math.round(hours ? n * 60 : n);
  return minutes >= 1 && minutes <= 600 ? minutes : null;
}
const mins = (n: number) => (n % 60 === 0 && n >= 60 ? `${n / 60} hour${n === 60 ? '' : 's'}` : `${n} minute${n === 1 ? '' : 's'}`);

// ---- other players ------------------------------------------------------------------------------
const PLAYER = '(?:my music|meine musik|(?:the |this |that |my |some )?(?:songs?|tracks?|videos?|podcasts?|players?|media|spotify|youtube|apple music|audiobook|playlist|lied|song|video)|the music in the background|music in the background)';

function playerIntent(text: string): Intent | null {
  if (new RegExp(`^(?:pause|stop|halt|silence|shut off|turn off|switch off|pausiere|stoppe|mute) ${PLAYER}$`).test(text)) return say('music.pause', 'Pause your music');
  if (new RegExp(`^(?:play|resume|continue|unpause|start|spiel|spiele|weiter) ${PLAYER}$`).test(text)) return say('music.play', 'Resume your music');
  if (/^(?:next|skip)(?: (?:the|this|that|my))? ?(?:song|track|video|episode|one)$|^(?:play )?(?:the )?next (?:song|track|video|episode)$|^skip (?:this )?(?:song|track|one)$|^(?:nachster|nächster|naechster) (?:song|titel|lied)$/.test(text)) return say('music.next', 'Next song');
  if (/^(?:previous|last|prior) (?:song|track)$|^(?:go back|play (?:the )?(?:previous|last) (?:song|track)|play (?:that|it|this) again|replay (?:this )?(?:song|track)|restart (?:this |the )?(?:song|track))$|^(?:vorheriger|vorheriges|letzter) (?:song|titel|lied)$/.test(text)) return say('music.prev', 'Previous song');
  if (/^(?:what(?:s| is)? (?:this|that|playing|currently playing|the song)(?: song| track)?(?: playing)?|what song is (?:this|playing|that)|what am i listening to|which song is this|what(?:s| is) on|was lauft(?: gerade)?|was läuft(?: gerade)?|welches lied ist das)$/.test(text)) return say('info:playing', 'What is playing');
  return null;
}

function systemVolume(text: string): Intent | null {
  const tokens = text.split(' ');
  if (tokens.length > 9 || !/\b(?:system|computer|pc|laptop|master|windows|rechner)\b/.test(text)) return null;
  const small = /\b(?:bit|little|touch|notch|tad|bisschen|etwas)\b/.test(text);
  if (/\b(?:unmute|entstumm)/.test(text)) return say('system.volume:mute', 'Mute or unmute the computer');
  if (/\b(?:mute|stumm)/.test(text)) return say('system.volume:mute', 'Mute or unmute the computer');
  if (/\b(?:up|louder|raise|increase|higher|lauter)\b/.test(text)) return say(`system.volume:up:${small ? 2 : 5}`, 'Computer volume up');
  if (/\b(?:down|quieter|softer|lower|decrease|leiser|quiet)\b/.test(text)) return say(`system.volume:down:${small ? 2 : 5}`, 'Computer volume down');
  return null;
}

// ---- timer and goals -----------------------------------------------------------------------------
function timerIntent(text: string, h: MoreHelpers): Intent | null {
  const time = (p: string) => parseMinutes(p, h);
  let m = new RegExp(`^(?:(?:set|start|begin|create|run|make)\\s+)?(?:a |an )?(?:timer|countdown|alarm)\\s*(?:for|of)?\\s*${TIME}$`).exec(text)
    || new RegExp(`^(?:(?:set|start|begin|create|run|make)\\s+)?(?:a |an )?${TIME}\\s+(?:timer|countdown|alarm)$`).exec(text)
    || new RegExp(`^(?:remind me in|count down|countdown(?: from| for)?)\\s+${TIME}$`).exec(text);
  if (m) { const n = time(m[1]); if (n) return say(`timer.countdown:${n}`, `Countdown: ${mins(n)}`); }
  // "study physics for 45 minutes"
  m = new RegExp(`^(?:(?:start|begin|lets|let us|i need to|i have to)\\s+)?(?:study|studying|revise|revising|work on|working on|focus on|practice|practise|learn|read|do|finish)\\s+(.+?)\\s+for\\s+${TIME}$`).exec(text);
  if (m) { const n = time(m[2]); if (n && !/\b(?:break|pause)\b/.test(m[1])) return say(`timer.session:${n};${cap(m[1])}`, `${mins(n)}: ${cap(m[1])}`); }
  // "start a 25 minute focus session on optics"
  m = new RegExp(`^(?:(?:start|begin|set|do|run|give me|lets do|let us do|i want|i need)\\s+)?(?:a |an )?${TIME}\\s+(?:focus |study |work |pomodoro |deep work )?(?:session|block|sprint|pomodoro|round|focus|study)(?:\\s+(?:on|about|for|of)\\s+(.+))?$`).exec(text);
  if (m) { const n = time(m[1]); if (n) return say(`timer.session:${n}${m[2] ? `;${cap(m[2])}` : ''}`, `Focus session: ${mins(n)}`); }
  // "focus for 45 minutes", "study for an hour on chemistry"
  m = new RegExp(`^(?:(?:start|begin|do|run|lets|let us|i want to)\\s+)?(?:focus|study|work|concentrate|revise|learn|lernen|arbeiten)\\s+(?:for|fur|für)\\s+${TIME}(?:\\s+(?:on|about)\\s+(.+))?$`).exec(text);
  if (m) { const n = time(m[1]); if (n) return say(`timer.session:${n}${m[2] ? `;${cap(m[2])}` : ''}`, `Focus session: ${mins(n)}`); }
  // "start studying optics", "i want to study optics"
  m = /^(?:(?:start|begin|lets|let us|i want to|i am going to|im going to|i will|help me|time to)\s+)(?:study|studying|revise|revising|work on|working on|focus on|practice|practise|learn|learning)\s+(.+)$/.exec(text);
  if (m && !/\b(?:break|pause|later|tomorrow)\b/.test(m[1]) && m[1].split(' ').length <= 8) return say(`goal.start:${cap(m[1])}`, `Start: ${cap(m[1])}`, .95);
  if (/^(?:how much time is left|how long is left|how much longer|how long (?:do i have )?left|time left|how many minutes (?:are )?left|time remaining|wie lange noch|wie viel zeit bleibt)$/.test(text)) return say('timer.left', 'How much time is left');
  if (/^(?:(?:i )?need a break|take a break|start (?:my )?break|break time|lets take a break|let us take a break|time for a break|pause for a break|pause machen)$/.test(text)) return say('break.start', 'Take a break');
  if (/^(?:end (?:my |the )?break|back to work|break(?: is)? over|lets get back to work|im back|i am back|get back to work|resume work|weiter lernen)$/.test(text)) return say('break.end', 'Back to work');
  if (/^(?:(?:i am|im) (?:done|finished)(?: for (?:now|today|the day))?|(?:finish|end|stop|log|save)(?: this| my| the)?(?: study)? session|stop studying|that is it for today|thats it for today|feierabend)$/.test(text)) return say('timer.finish', 'Finish and log the session');
  return null;
}

function goalIntent(text: string, ctx: MoreContext, h: MoreHelpers): Intent | null {
  let m = /^(?:(?:set|change|make|update)\s+)(?:my |the |a |an )?(?:session |study )?goal(?: for (?:this|the) (?:session|block))?(?: to| as| is| be|:)?\s*(.+)$/.exec(text) || /^(?:my )?(?:session |study )?goal (?:is|for (?:this|the) (?:session|block) is)\s+(.+)$/.exec(text) || /^(?:my )?goal (?:today )?(?:is )?to\s+(.+)$/.exec(text);
  if (m) return say(`goal.set:${cap(m[1])}`, `Goal: ${cap(m[1])}`);
  if (/^(?:clear|remove|delete|reset|drop)(?: my| the)?(?: session| study)? goal$/.test(text)) return say('goal.clear', 'Clear the goal');
  m = /^(?:(?:add|create|new|put|make)\s+)(?:a |an |another )?(?:to ?do|task|todo|reminder|to do)(?: item)?(?: called| named| to| for| that says| saying|:)?\s*(.+)$/.exec(text)
    || /^(?:add|put)\s+(.+?)\s+(?:to|on|onto)\s+(?:my |the )?(?:to ?do|todo|to do|task|tasks|list|to ?dos)(?: list)?$/.exec(text)
    || /^(?:remind me to|dont let me forget to|do not let me forget to|i need to remember to|remember to)\s+(.+)$/.exec(text)
    || /^(?:write down|note down|jot down|make a note(?: of| that)?|note)\s+(.+)$/.exec(text);
  if (m && !/^(?:review|revise|study|go over)\b/.test(m[1])) return say(`todo.add:${cap(m[1])}`, `To-do: ${cap(m[1])}`);
  m = /^(?:remind me to (?:review|revise|go over)|schedule (?:a )?(?:review|reviews)(?: of| for| on)?|review later|add (?:a )?review(?: of| for)?)\s+(.+)$/.exec(text);
  if (m) return say(`review.add:${cap(m[1])}`, `Review later: ${cap(m[1])}`);
  m = /^(?:(?:mark|tick|check|cross|finish|complete|done with)\s+)(?:off\s+)?(.+?)(?: as (?:done|finished|complete|completed))?(?: off)?(?: (?:from|on) (?:my )?(?:list|to ?dos?|tasks?))?$/.exec(text);
  if (m && ctx.todoNames?.length) { const best = h.bestName(m[1], ctx.todoNames); if (best && best.score >= .55) return say(`todo.done:${best.name}`, `Done: ${best.name}`, best.score); }
  if (/^(?:what(?:s| is) (?:on )?my (?:to ?do|todo|to do|tasks?)(?: list)?|read (?:me )?my (?:to ?do|todo|to do|tasks?)(?: list)?|how many (?:to ?dos|todos|tasks) (?:do i have|are (?:left|open))(?: left)?|what do i (?:still )?have to do|show my (?:to ?dos?|tasks))$/.test(text)) return say('info:todos', 'My to-dos');
  if (/^(?:what(?:s| is) my (?:session |study )?goal|what am i working on|what(?:s| is) my plan|what(?:s| is) the goal|what should i (?:do|work on))$/.test(text)) return say('info:goal', 'My goal');
  return null;
}

function askIntent(text: string): Intent | null {
  if (/^(?:what time is it|whats the time|what is the time|time please|current time|tell me the time|wie spat ist es|wie spät ist es|wie viel uhr ist es|wieviel uhr)$/.test(text)) return say('info:time', 'What time is it');
  if (/^(?:what(?:s| is) (?:the )?date(?: today)?|what day is it(?: today)?|what is today|welcher tag ist heute|welches datum)$/.test(text)) return say('info:date', 'Today\'s date');
  if (/^(?:how (?:long|much)(?: time)? (?:have i|did i|i have) (?:studied|study|focused|worked|been studying)(?: today| so far)?|how much have i (?:done|studied|focused|worked)(?: today| so far)?|study time(?: today)?|my study time(?: today)?|how am i doing(?: today)?|how was my day|wie lange habe ich heute gelernt)$/.test(text)) return say('info:today', 'How much you studied today');
  if (/^(?:what(?:s| is) my streak|how long is my streak|my streak|how many days in a row|streak)$/.test(text)) return say('info:streak', 'Your streak');
  if (/^(?:when is my (?:next )?(?:exam|test)|how many days (?:until|till|to|left until) (?:my )?(?:next )?(?:exam|exams|test)|how long (?:until|till) (?:my )?(?:next )?(?:exam|test)|days until (?:my )?(?:next )?(?:exam|test)|exam countdown|wann ist meine prufung|wann ist meine prüfung)$/.test(text)) return say('info:exam', 'Days until your exam');
  if (/^(?:what can (?:you|i) (?:do|say)|what can i ask(?: you)?|help|show (?:me )?(?:the )?commands|list (?:the )?commands|what commands (?:do you know|are there)|was kann ich sagen|hilfe)$/.test(text)) return say('help.open', 'What you can say');
  return null;
}

const PAGES: [string, string[]][] = [['studio', ['studio', 'home', 'sounds', 'the studio']], ['library', ['library', 'study room', 'my library', 'videos', 'bibliothek']], ['progress', ['progress', 'statistics', 'stats', 'my progress', 'my stats', 'heatmap', 'fortschritt']], ['focus', ['focus', 'focus reasons', 'reasons', 'my reasons']]];
function navIntent(text: string): Intent | null {
  const m = /^(?:go to|open|show|take me to|switch to|go back to|bring up|zeig|zeige|offne|öffne)\s+(?:the |my |me )*(.+?)(?: page| tab| view| screen)?$/.exec(text);
  if (m) for (const [id, words] of PAGES) if (words.includes(m[1])) return say(`page.go:${id}`, `Go to ${id}`);
  if (/^(?:dark mode|night mode|go dark|switch to dark(?: mode)?|turn on dark mode|enable dark mode|dunkel(?:modus)?)$/.test(text)) return say('theme.set:dark', 'Dark mode');
  if (/^(?:light mode|day mode|go light|switch to light(?: mode)?|turn on light mode|enable light mode|hell(?:modus)?)$/.test(text)) return say('theme.set:light', 'Light mode');
  if (/^(?:toggle|switch|change)(?: the)? (?:theme|colou?rs?|mode)$/.test(text)) return say('theme.set:toggle', 'Switch the theme');
  if (/^(?:(?:open|show|check) (?:my )?(?:notifications|bell|messages|alerts|inbox)|any (?:notifications|news)|what did i miss)$/.test(text)) return say('bell.open', 'Open notifications');
  return null;
}

/** First match wins. Order matters: specific timer phrases before the generic "start studying". */
export function matchMore(text: string, ctx: MoreContext, h: MoreHelpers): Intent | null {
  return playerIntent(text) || systemVolume(text) || timerIntent(text, h) || goalIntent(text, ctx, h) || askIntent(text) || navIntent(text);
}

/** Example phrases for the "Things you can say" list and for the Windows recognizer's grammar. */
export const SIRI_EXAMPLES: { group: string; say: string[] }[] = [
  { group: 'Your music (other apps)', say: ['Flow, pause my music', 'Flow, resume my music', 'Flow, next song', 'Flow, previous song', 'Flow, what is playing', 'Flow, computer volume down', 'Flow, mute the computer'] },
  { group: 'Sessions', say: ['Flow, study for 45 minutes', 'Flow, start a 25 minute focus session on optics', 'Flow, start studying chemistry', 'Flow, take a break', 'Flow, back to work', 'Flow, how much time is left', 'Flow, I am done'] },
  { group: 'Timers', say: ['Flow, set a timer for 10 minutes', 'Flow, countdown 5 minutes'] },
  { group: 'Goals and to-dos', say: ['Flow, set my goal to finish chapter three', 'Flow, add a to-do hand in the lab report', 'Flow, remind me to review optics', 'Flow, tick off lab report', 'Flow, what is on my to-do list'] },
  { group: 'Ask', say: ['Flow, how long did I study today', 'Flow, what is my streak', 'Flow, when is my exam', 'Flow, what time is it', 'Flow, what is my goal'] },
  { group: 'Move around', say: ['Flow, open progress', 'Flow, go to the library', 'Flow, dark mode', 'Flow, open notifications', 'Flow, what can I say'] },
];
