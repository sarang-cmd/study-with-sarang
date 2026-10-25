/**
 * Voice mode listens for a fixed list of phrases (English and German), which is what makes it
 * reliable and private: Windows' own offline recognizer only has to pick from this list, and
 * anything that is not on it is ignored. Mix and macro names are added to the list.
 */
export interface VoiceEntry { command: string; en: string[]; de: string[] }
export interface VoiceSettings { enabled: boolean; wake: string; useWake: boolean; language: 'auto' | 'en' | 'de'; minConfidence: number; freeSpeech: boolean }
export interface VoiceConfig { languages: string[]; phrases: { en: string[]; de: string[] }; wake: { en: string; de: string }; wakes: string[]; useWake: boolean; dictation?: boolean }

import { numberWord } from './intent';
/** Names the assistant answers to. The one you chose comes first. */
export const WAKE_WORDS = ['Flow', 'Sarang'];
export const wakeList = (wake: string) => { const out: string[] = []; for (const word of [wake, ...WAKE_WORDS]) { const w = speakable(word); if (w && !out.some((x) => x.toLowerCase() === w.toLowerCase())) out.push(w); } return out.slice(0, 4); };

/** Keep only what a speech grammar can say: letters, digits, spaces, apostrophes and hyphens. */
export const speakable = (text: string) => text.replace(/[^\p{L}\p{N} '\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
const norm = (text: string) => speakable(text).toLowerCase().replace(/ß/g, 'ss');

export function buildVoiceEntries(mixNames: string[], macroNames: string[]): VoiceEntry[] {
  const fixed: VoiceEntry[] = [
    { command: 'sound.toggle', en: ['toggle sound'], de: ['Ton umschalten'] },
    { command: 'sound.play', en: ['play', 'play sound', 'start sound', 'start music'], de: ['Abspielen', 'Ton an', 'Musik an', 'Wiedergabe starten'] },
    { command: 'sound.pause', en: ['pause', 'pause sound', 'stop sound', 'stop music', 'silence'], de: ['Pause', 'Ton aus', 'Musik aus', 'Stopp'] },
    { command: 'sound.next', en: ['next', 'next sound', 'next variation'], de: ['Weiter', 'Nächster Klang', 'Nächste Variante'] },
    { command: 'volume.up', en: ['louder', 'volume up', 'turn it up'], de: ['Lauter', 'Lautstärke hoch'] },
    { command: 'volume.down', en: ['quieter', 'volume down', 'turn it down'], de: ['Leiser', 'Lautstärke runter'] },
    { command: 'timer.start', en: ['start timer', 'start focus', 'start pomodoro'], de: ['Timer starten', 'Fokus starten'] },
    { command: 'timer.pause', en: ['pause timer', 'stop timer'], de: ['Timer pausieren', 'Timer anhalten'] },
    { command: 'timer.reset', en: ['reset timer'], de: ['Timer zurücksetzen'] },
    { command: 'timer.skip', en: ['skip timer', 'skip break'], de: ['Timer überspringen', 'Pause überspringen'] },
    { command: 'timer.drift', en: ['I drifted', 'mark distraction', 'distracted'], de: ['Ich war abgelenkt', 'Ablenkung'] },
    { command: 'zen.toggle', en: ['zen mode', 'zen view'], de: ['Zen Modus', 'Zen Ansicht'] },
    { command: 'fullscreen.toggle', en: ['full screen'], de: ['Vollbild'] },
    { command: 'window.hide', en: ['hide window', 'hide app'], de: ['Fenster ausblenden', 'App ausblenden'] },
    { command: 'window.show', en: ['show window', 'show app'], de: ['Fenster anzeigen', 'App anzeigen'] },
    { command: 'window.compact', en: ['mini mode', 'collapse'], de: ['Mini Modus', 'Einklappen'] },
    { command: 'window.expand', en: ['expand', 'full window'], de: ['Ausklappen', 'Großes Fenster'] },
    { command: 'shortcuts.disable', en: ['disable shortcuts'], de: ['Tastenkürzel ausschalten'] },
    { command: 'shortcuts.enable', en: ['enable shortcuts'], de: ['Tastenkürzel einschalten'] },
    { command: 'voice.toggle', en: ['stop listening'], de: ['Nicht mehr zuhören'] },
  ];
  // Volume, said many ways: "volume forty", "set volume forty", "set volume to forty", "volume forty percent", "volume full".
  for (let level = 0; level <= 100; level += 5) {
    const en = numberWord(level, 'en'), de = numberWord(level, 'de');
    fixed.push({
      command: `volume.set:${level}`,
      en: [`volume ${en}`, `set volume ${en}`, `set volume to ${en}`, `set the volume to ${en}`, `volume ${en} percent`, `volume to ${en}`],
      de: [`Lautstärke ${de}`, `Lautstärke auf ${de}`, `Setze Lautstärke auf ${de}`, `Lautstärke ${de} Prozent`],
    });
  }
  fixed.push({ command: 'volume.set:100', en: ['volume full', 'volume max', 'volume maximum', 'full volume', 'max volume'], de: ['Lautstärke voll', 'Lautstärke maximal', 'volle Lautstärke'] });
  fixed.push({ command: 'volume.set:50', en: ['volume half', 'half volume', 'volume medium'], de: ['Lautstärke halb', 'halbe Lautstärke'] });
  fixed.push({ command: 'volume.set:0', en: ['volume off', 'volume mute'], de: ['Lautstärke aus', 'Lautstärke stumm'] });
  fixed.push({ command: 'music.pause', en: ['pause my music', 'pause the video', 'pause spotify', 'pause youtube'], de: ['Pausiere meine Musik', 'Pausiere das Video'] });
  fixed.push({ command: 'music.play', en: ['resume my music', 'play my music', 'resume the video'], de: ['Spiele meine Musik', 'Musik fortsetzen'] });
  fixed.push({ command: 'music.next', en: ['next song', 'next track', 'skip this song'], de: ['Nächster Song', 'Nächster Titel'] });
  fixed.push({ command: 'music.prev', en: ['previous song', 'previous track'], de: ['Vorheriger Song', 'Vorheriger Titel'] });
  fixed.push({ command: 'info:playing', en: ['what is playing', 'what song is this'], de: ['Was läuft gerade'] });
  fixed.push({ command: 'break.start', en: ['take a break', 'break time'], de: ['Pause machen'] });
  fixed.push({ command: 'break.end', en: ['back to work', 'end break'], de: ['Weiter lernen'] });
  fixed.push({ command: 'timer.left', en: ['how much time is left', 'time left'], de: ['Wie lange noch'] });
  fixed.push({ command: 'timer.finish', en: ['I am done', 'finish session'], de: ['Ich bin fertig'] });
  fixed.push({ command: 'info:today', en: ['how long did I study today', 'my study time'], de: ['Wie lange habe ich heute gelernt'] });
  fixed.push({ command: 'info:streak', en: ['what is my streak'], de: ['Wie lang ist meine Serie'] });
  fixed.push({ command: 'info:goal', en: ['what is my goal'], de: ['Was ist mein Ziel'] });
  fixed.push({ command: 'info:time', en: ['what time is it'], de: ['Wie spät ist es'] });
  fixed.push({ command: 'theme.set:dark', en: ['dark mode'], de: ['Dunkelmodus'] });
  fixed.push({ command: 'theme.set:light', en: ['light mode'], de: ['Hellmodus'] });
  fixed.push({ command: 'page.go:progress', en: ['open progress'], de: ['Fortschritt öffnen'] });
  fixed.push({ command: 'page.go:library', en: ['open library'], de: ['Bibliothek öffnen'] });
  fixed.push({ command: 'bell.open', en: ['open notifications'], de: ['Benachrichtigungen öffnen'] });
  fixed.push({ command: 'calm.breathe', en: ['breathe', 'start breathing', 'breathing guide', 'calm down'], de: ['Atmen', 'Atemübung starten', 'Beruhige mich'] });
  fixed.push({ command: 'calm.open', en: ['open calm', 'calm screen'], de: ['Ruhe öffnen'] });
  fixed.push({ command: 'calm.close', en: ['close calm', 'stop breathing'], de: ['Ruhe schließen'] });
  fixed.push({ command: 'ui.simple:on', en: ['simple view', 'simple mode', 'minimal view'], de: ['Einfache Ansicht'] });
  fixed.push({ command: 'ui.simple:off', en: ['full view', 'power view'], de: ['Volle Ansicht'] });
  const seen = new Set<string>();
  for (const name of mixNames.map(speakable).filter(Boolean)) {
    if (seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase());
    fixed.push({ command: `mix.load:${name}`, en: [`load ${name}`, `mix ${name}`], de: [`Lade ${name}`, `Mix ${name}`] });
  }
  const macros = new Set<string>();
  for (const name of macroNames.map(speakable).filter(Boolean)) {
    if (macros.has(name.toLowerCase())) continue; macros.add(name.toLowerCase());
    fixed.push({ command: `macro.run:${name}`, en: [`run ${name}`, `macro ${name}`], de: [`Starte ${name}`, `Makro ${name}`] });
  }
  return fixed;
}

export function buildVoiceConfig(entries: VoiceEntry[], wake: string, useWake: boolean, language: 'auto' | 'en' | 'de', dictation = false): VoiceConfig {
  const word = speakable(wake) || 'Flow';
  const dedupe = (list: string[]) => [...new Set(list.map((item) => item.trim()).filter(Boolean))];
  return {
    languages: language === 'auto' ? ['en', 'de'] : [language],
    phrases: { en: dedupe(entries.flatMap((entry) => entry.en)), de: dedupe(entries.flatMap((entry) => entry.de)) },
    wake: { en: word, de: word },
    wakes: wakeList(word),
    useWake,
    dictation,
  };
}

/** Maps recognized text back to a command. Returns null when it is not a known phrase. */
export function matchHeard(heard: string, entries: VoiceEntry[], wake: string, requireWake: boolean): string | null {
  let text = norm(heard);
  if (!text) return null;
  const words = wakeList(wake || 'Flow').map((item) => norm(item));
  const used = words.find((word) => text.startsWith(`${word} `));
  if (requireWake && !used) return null;
  if (used) text = text.slice(used.length).trim();
  for (const entry of entries) for (const phrase of [...entry.en, ...entry.de]) if (norm(phrase) === text) return entry.command;
  return null;
}

export const VOICE_KEY = 'study-with-sarang:voice';
export const defaultVoice: VoiceSettings = { enabled: false, wake: 'Flow', useWake: false, language: 'auto', minConfidence: 0.55, freeSpeech: true };

export function readVoice(): VoiceSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(VOICE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      enabled: raw.enabled === true,
      wake: typeof raw.wake === 'string' && raw.wake.trim() ? raw.wake.slice(0, 24) : defaultVoice.wake,
      useWake: raw.v === 2 && raw.useWake === true, // 1.6: older saved settings fall back to no wake word (see VoiceCard)
      language: raw.language === 'en' || raw.language === 'de' ? raw.language : 'auto',
      minConfidence: raw.v === 2 && typeof raw.minConfidence === 'number' ? Math.max(0.3, Math.min(0.95, raw.minConfidence)) : defaultVoice.minConfidence,
      freeSpeech: raw.freeSpeech !== false,
    };
  } catch { return defaultVoice; }
}
export function writeVoice(settings: VoiceSettings) { try { localStorage.setItem(VOICE_KEY, JSON.stringify({ ...settings, v: 2 })); } catch { /* Kept for this session. */ } }
