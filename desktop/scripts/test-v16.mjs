// 1.6: interface levels, auto-pause rules, Discord status, voice checks, media artwork, loudness. No Windows or browser needed.
import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';
const pass = (m) => console.log(`PASS ${m}`);

// ---- interface level -------------------------------------------------------------------
const ui = await loadModule('src/lib/uiLevel.ts');
assert.equal(ui.FEATURES.length, ui.FEATURE_IDS.length);
for (const level of ['simple', 'standard', 'power']) for (const id of ui.FEATURE_IDS) assert.equal(typeof ui.PRESETS[level][id], 'boolean', `${level}.${id}`);
assert.ok(ui.FEATURE_IDS.every((id) => id === 'compactCards' || ui.PRESETS.power[id]), 'Power shows everything'); assert.equal(ui.PRESETS.power.compactCards, false, 'and keeps nothing in drawers');
const pages = [{ id: 'studio' }, { id: 'library' }, { id: 'progress' }, { id: 'focus' }];
assert.deepEqual(ui.visiblePages(pages, ui.PRESETS.simple).map((p) => p.id), ['studio', 'library']);
assert.deepEqual(ui.visiblePages(pages, ui.PRESETS.standard).map((p) => p.id), ['studio', 'library', 'progress', 'focus']);
assert.equal(ui.visiblePages(pages, { ...ui.PRESETS.power, pageLibrary: false, pageProgress: false, pageFocus: false }).length, 1, 'Studio is always there');
assert.equal(ui.PRESETS.simple.compactCards, true); assert.equal(ui.PRESETS.simple.hdrPalette, false); assert.equal(ui.PRESETS.simple.layers, true);
assert.equal(ui.PRESETS.standard.heroStrip, false); assert.equal(ui.PRESETS.standard.layers, true);
assert.equal(ui.resolveFeatures('custom', { layers: false }).layers, false); assert.equal(ui.resolveFeatures('custom', { layers: false }).pageFocus, true, 'Custom starts from Standard');
assert.equal(ui.resolveFeatures('simple', { heroStrip: true }).heroStrip, false, 'a stored custom choice does not leak into a preset');
assert.deepEqual(ui.sanitizeShow({ layers: false, bogus: true, heroStrip: 'yes' }), { layers: false });
assert.deepEqual(ui.sanitizeShow([1, 2]), {}); assert.equal(ui.sanitizeLevel('zen'), 'standard'); assert.equal(ui.sanitizeLevel('custom'), 'custom');
pass('interface levels: presets, custom, pages, sanitizing');

// ---- prefs -----------------------------------------------------------------------------
const pf = await loadModule('src/lib/prefs.ts');
const d = pf.sanitizePrefs({});
assert.equal(d.uiLevel, 'power', 'existing users see no change'); assert.equal(d.loudness, 'loud'); assert.equal(d.volumeCap, 100); assert.equal(d.mediaArtwork, true); assert.equal(d.startPlaying, false);
assert.equal(d.autoPause.enabled, false, 'auto-pause is off by default'); assert.equal(d.discord.enabled, false, 'Discord is off by default');
const odd = pf.sanitizePrefs({ uiLevel: 'zen', uiPrev: 'simple', volumeCap: 5, fadeIn: 99, fadeOut: -3, loudness: 'x', autoPause: 'no', discord: { appId: 'abc123456789012345678', showTask: true } });
assert.equal(odd.uiLevel, 'power'); assert.equal(odd.uiPrev, 'standard'); assert.equal(odd.volumeCap, 20); assert.equal(odd.fadeIn, 10); assert.equal(odd.fadeOut, 0.05); assert.equal(odd.loudness, 'loud');
assert.equal(odd.autoPause.action, 'pause'); assert.equal(odd.discord.appId, '123456789012345678'); assert.equal(odd.discord.showTask, true);
assert.equal(pf.LOUDNESS_BOOST.loud, 1.6);
pass('prefs: new settings have safe defaults and are sanitized');

// ---- loudness and cap ------------------------------------------------------------------
const syn = await loadModule('src/lib/synth.ts');
assert.ok(syn.levelToGain(1) >= 2.4 && syn.levelToGain(1) <= 2.8);
syn.setLoudnessBoost(0); assert.equal(syn.levelToGain(1), 1);
syn.setLoudnessBoost(2.6); assert.ok(Math.abs(syn.levelToGain(1) - 3.6) < 1e-9);
syn.setLoudnessBoost(1.6); syn.setVolumeCap(50); assert.ok(syn.levelToGain(1) < 1.0 && syn.levelToGain(1) > 0.5, 'the cap scales the slider');
syn.setVolumeCap(0); assert.ok(syn.levelToGain(1) > 0, 'the cap cannot mute everything'); syn.setVolumeCap(100);
assert.ok(syn.levelToGain(1) >= 2.4);
pass('loudness range and volume cap');

// ---- auto-pause ------------------------------------------------------------------------
const ap = await loadModule('src/lib/autoPause.ts');
const on = ap.sanitizeAutoPause({ enabled: true });
assert.equal(ap.sanitizeAutoPause({}).enabled, false);
assert.deepEqual(ap.activeReasons(ap.defaultAutoPause, { mic: ['Zoom'], recorders: [], media: [] }), [], 'nothing happens while it is off');
assert.deepEqual(ap.activeReasons(on, { mic: ['C:#Program Files#Zoom#bin#Zoom.exe'], recorders: [], media: [] }), ['Zoom is using the microphone']);
assert.deepEqual(ap.activeReasons(on, { mic: ['C:#Users#me#Study-with-Sarang-1.6.0.exe', 'C:#Windows#System32#WindowsPowerShell#v1.0#powershell.exe'], recorders: [], media: [] }), [], 'our own use of the microphone never counts');
assert.deepEqual(ap.activeReasons(on, { mic: [], recorders: [], media: ['com.sarang.studywithsarang'] }), [], 'our own media session never counts');
assert.deepEqual(ap.activeReasons(on, { mic: [], recorders: ['obs64'], media: [] }), ['obs64 is open']);
assert.deepEqual(ap.activeReasons(on, { mic: [], recorders: ['notepad'], media: [] }), [], 'only listed recorders count');
assert.deepEqual(ap.activeReasons(on, { mic: [], recorders: [], media: ['Chrome'] }), ['Chrome is playing media']);
assert.deepEqual(ap.activeReasons(on, { mic: [], recorders: [], media: ['Spotify.exe'] }), [], 'the ignore list is respected');
assert.deepEqual(ap.activeReasons({ ...on, onMedia: false }, { mic: [], recorders: [], media: ['Chrome'] }), [], 'each situation can be switched off');
assert.deepEqual(ap.activeReasons({ ...on, ignoreApps: '' }, { mic: [], recorders: [], media: ['Spotify.exe'] }), ['Spotify is playing media']);
pass('auto-pause: what counts, own app excluded, ignore list');

const cfg = { ...on, delaySec: 2, resumeDelaySec: 4 };
let m = new ap.AutoPauseMachine();
assert.equal(m.step(0, cfg, true, true), null, 'waits for the delay');
assert.equal(m.step(1500, cfg, true, true), null);
assert.equal(m.step(2000, cfg, true, true), 'pause'); assert.equal(m.held, 'paused');
assert.equal(m.step(3000, cfg, true, false), null, 'keeps holding');
assert.equal(m.step(4000, cfg, false, false), null, 'waits before resuming');
assert.equal(m.step(7000, cfg, false, false), null);
assert.equal(m.step(8000, cfg, false, false), 'resume'); assert.equal(m.held, 'none');
m = new ap.AutoPauseMachine();
assert.equal(m.step(0, cfg, true, true), null); assert.equal(m.step(1000, cfg, false, true), null); assert.equal(m.step(1500, cfg, true, true), null, 'a short blip restarts the delay');
assert.equal(m.step(3400, cfg, true, true), null); assert.equal(m.step(3500, cfg, true, true), 'pause');
m = new ap.AutoPauseMachine();
assert.equal(m.step(0, cfg, true, false), null); assert.equal(m.step(5000, cfg, true, false), null, 'never pauses what is not playing');
assert.equal(m.step(6000, cfg, false, false), null); assert.equal(m.step(20000, cfg, false, false), null, 'and never resumes what it did not pause');
m = new ap.AutoPauseMachine();
m.step(0, cfg, true, true); assert.equal(m.step(2000, cfg, true, true), 'pause');
assert.equal(m.step(3000, cfg, true, true), null, 'you pressed play while it was holding: your choice wins');
assert.equal(m.held, 'none'); assert.equal(m.step(9000, cfg, true, true), null, 'and it does not pause again');
assert.equal(m.step(10000, cfg, false, true), null); m.step(11000, cfg, true, true); assert.equal(m.step(13000, cfg, true, true), 'pause', 'it works again after the cause went away');
m = new ap.AutoPauseMachine(); const noResume = { ...cfg, resume: false };
m.step(0, noResume, true, true); m.step(2000, noResume, true, true); m.step(3000, noResume, false, false);
assert.equal(m.step(8000, noResume, false, false), null, 'resume can be switched off'); assert.equal(m.held, 'none');
m = new ap.AutoPauseMachine(); const lower = { ...cfg, action: 'lower' };
m.step(0, lower, true, true); assert.equal(m.step(2000, lower, true, true), 'lower'); assert.equal(m.held, 'lowered');
assert.equal(m.step(3000, lower, false, true), null); assert.equal(m.step(7000, lower, false, true), 'restore');
m = new ap.AutoPauseMachine(); m.step(0, cfg, true, true); m.step(2000, cfg, true, true);
assert.equal(m.step(2500, { ...cfg, enabled: false }, true, false), 'resume', 'turning it off gives the sound back');
m = new ap.AutoPauseMachine(); m.step(0, lower, true, true); m.step(2000, lower, true, true);
assert.equal(m.step(2500, { ...lower, enabled: false }, true, true), 'restore');
pass('auto-pause timing: delay, blips, resume only its own pause, user override, lower and restore, switching off');

// ---- Discord -----------------------------------------------------------------------------
const dc = await loadModule('src/lib/discord.ts');
const base = { playing: true, mixName: 'Flow', timerRunning: true, timerMode: 'pomodoro', phase: 'focus', seconds: 1500, task: 'Secret essay' };
const full = { ...dc.defaultDiscord, enabled: true, appId: '123456789012345678' };
assert.equal(dc.buildActivity(dc.defaultDiscord, base), null, 'off by default');
assert.ok(dc.buildActivity({ ...full, appId: 'x' }, base), 'an empty or invalid application ID falls back to the built-in one (zero setup)');
let a = dc.buildActivity(full, base, 1_000_000);
assert.equal(a.details, 'Focusing'); assert.equal(a.state, 'Flow'); assert.deepEqual(a.timestamps, { end: 1000 + 1500 });
assert.ok(!JSON.stringify(a).includes('Secret'), 'the task is private unless allowed');
a = dc.buildActivity({ ...full, showTask: true }, base); assert.equal(a.state, 'Flow \u00b7 Secret essay');
a = dc.buildActivity({ ...full, showMix: false, showTimer: false }, base); assert.equal(a.state, undefined); assert.equal(a.timestamps, undefined); assert.equal(a.details, 'Focusing');
a = dc.buildActivity(full, { ...base, phase: 'short' }, 0); assert.equal(a.details, 'Taking a break');
a = dc.buildActivity({ ...full, showTask: true }, { ...base, phase: 'short' }); assert.ok(!(a.state ?? '').includes('Secret'), 'no task during a break');
a = dc.buildActivity(full, { ...base, timerMode: 'stopwatch', seconds: 90 }, 1_000_000); assert.deepEqual(a.timestamps, { start: 1000 - 90 });
a = dc.buildActivity(full, { ...base, timerRunning: false }); assert.equal(a.details, 'Listening to ambient sound'); assert.equal(a.timestamps, undefined);
assert.equal(dc.buildActivity(full, { ...base, playing: false, timerRunning: false }), null, 'nothing to show when idle');
assert.equal(dc.buildActivity({ ...full, showIdle: true }, { ...base, playing: false, timerRunning: false }).details, 'Resting');
assert.equal(dc.buildActivity({ ...full, imageKey: '' }, base).assets, undefined);
assert.equal(dc.buildActivity(full, base).assets.large_image, 'icon');
assert.equal(dc.activityKey(dc.buildActivity(full, base, 0)), dc.activityKey(dc.buildActivity(full, { ...base, seconds: 1400 }, 50_000)), 'the clock alone does not cause an update');
assert.notEqual(dc.activityKey(dc.buildActivity(full, base)), dc.activityKey(dc.buildActivity(full, { ...base, mixName: 'Rain' })));
assert.equal(dc.isAppId('123456789012345678'), true); assert.equal(dc.isAppId('12345'), false);
assert.equal(dc.sanitizeDiscord({ imageKey: 'My Image!' }).imageKey, 'myimage'); assert.equal(dc.sanitizeDiscord(null).enabled, false);
const longName = dc.buildActivity(full, { ...base, mixName: 'x'.repeat(300) }); assert.ok(longName.state.length <= 60);
pass('Discord status: privacy toggles, break, stopwatch, idle, no needless updates');

// ---- voice checks -----------------------------------------------------------------------
const vd = await loadModule('src/lib/voiceDiagnosis.ts');
const good = { ok: true, psVersion: '5.1', languageMode: 'FullLanguage', os: '10.0.22631.0', speechLoaded: true, recognizers: ['en-US'], micOpen: true, micUser: 'Allow', micMachine: 'Allow', micDesktopApps: 'Allow', inputDevices: ['Microphone (USB)'] };
assert.ok(vd.interpretDiagnosis(good, 'auto').every((c) => c.status === 'ok'));
const status = (d, language, id) => vd.interpretDiagnosis(d, language).find((c) => c.id === id).status;
assert.equal(status({ ...good, micDesktopApps: 'Deny' }, 'auto', 'privacy'), 'fail');
assert.ok(vd.interpretDiagnosis({ ...good, micDesktopApps: 'Deny' }, 'auto').find((c) => c.id === 'privacy').fix.includes('desktop apps'));
assert.equal(status({ ...good, recognizers: [] }, 'auto', 'recognizer'), 'fail');
assert.equal(status({ ...good, recognizers: ['fr-FR'] }, 'auto', 'recognizer'), 'fail');
assert.equal(status(good, 'de', 'recognizer'), 'fail', 'German chosen but only English installed');
assert.equal(status({ ...good, recognizers: ['de-DE'] }, 'auto', 'recognizer'), 'ok');
assert.equal(status({ ...good, micOpen: false, micError: 'No audio input' }, 'auto', 'mic'), 'fail');
assert.equal(status({ ...good, languageMode: 'ConstrainedLanguage' }, 'auto', 'ps'), 'fail');
assert.equal(status({ ...good, inputDevices: [] }, 'auto', 'devices'), 'warn');
assert.equal(vd.interpretDiagnosis({ ok: false, error: 'boom' }, 'auto')[0].status, 'fail');
assert.ok(vd.diagnosisReport(good, vd.interpretDiagnosis(good, 'auto')).includes('Raw:'));
pass('voice checks turn Windows facts into a checklist with fixes');

// ---- media artwork -----------------------------------------------------------------------
const ms = await loadModule('src/lib/mediaSession.ts');
const art = ms.artworkList('https://app.example/study/index.html');
assert.deepEqual(art.map((x) => x.sizes), ['96x96', '128x128', '256x256', '512x512']);
assert.equal(art[0].src, 'https://app.example/study/icons/default/art-96.png'); assert.ok(art.every((x) => x.type === 'image/png'));
assert.equal(ms.artworkList('app://studio/index.html', 'moon')[3].src.endsWith('/icons/moon/art-512.png'), true);
assert.equal(ms.artworkList('app://studio/index.html')[3].src, 'app://studio/icons/default/art-512.png');
pass('media artwork URLs follow the page location');

// ---- voice defaults --------------------------------------------------------------------
const vo = await loadModule('src/lib/voice.ts');
assert.equal(vo.defaultVoice.useWake, false); assert.equal(vo.defaultVoice.minConfidence, 0.55);
const cfgV = vo.buildVoiceConfig(vo.buildVoiceEntries(['Flow'], []), 'Sarang', false, 'auto');
assert.equal(cfgV.useWake, false); assert.ok(cfgV.phrases.en.includes('pause'));
assert.equal(vo.matchHeard('pause', vo.buildVoiceEntries([], []), 'Sarang', false), 'sound.pause');
assert.equal(vo.matchHeard('Sarang pause', vo.buildVoiceEntries([], []), 'Sarang', false), 'sound.pause', 'the wake word is allowed but not needed');
assert.equal(vo.matchHeard('pause', vo.buildVoiceEntries([], []), 'Sarang', true), null);
pass('voice: no wake word by default, lower strictness');
console.log('Verified 1.6 libraries.');
