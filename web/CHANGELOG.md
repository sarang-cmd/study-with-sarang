# Study with Sarang: the full changelog

Everything that changed, from the first release to version 1.9.1, newest first. Study with Sarang ships as two editions from one source: the **desktop app** (Windows first, macOS) and the **web edition**. The same feature usually lands in both on the same day with a different number.

## Which versions go together

| Date | Desktop | Web | Headline |
| --- | --- | --- | --- |
| 2026-10-25 | 2.1.1 | 1.9.1 | The apps get a home on GitHub: download links, landing page, screenshots |
| 2026-10-16 | 2.1.0 | 1.9.0 | Calmer by default: Essentials, session rhythm, working voice, Flow commands |
| 2026-10-07 | 2.0.0 | 1.8.0 | A student app: subjects, statistics, drift detection, AI tools, study room, puck, monitors |
| 2026-10-06 | 1.7.0 | 1.5.0 | Flow voice assistant, recordings, calm tools, Discord with no setup |
| 2026-10-06 | 1.6.0 | 1.4.0 | Calmer interface, auto-pause, Discord, media icon, voice checks |
| 2026-10-04 | 1.5.1 | 1.3.1 | Media keys follow the most recent player |
| 2026-10-04 | 1.5.0 | 1.3.0 | Achievements, louder, email, signing |
| 2026-10-04 | 1.4.0 | 1.2.0 | Settings, layouts, new tracking |
| 2026-10-03 | 1.3.0 | n/a | In-app updates (desktop only) |
| 2026-10-03 | 1.2.0 | 1.1.0 | Fixes, custom controls, cloud sync |
| 2026-10-03 | 1.1.0 | n/a | Desktop edition |
| 2026-10-01 | 1.0.0 | 1.0.0 | First release (web) |

The two numbers differ because the web edition started earlier and skips what a browser cannot do.

# Web edition history

## 1.11.0 (2026-10-26), one logo on Discord, password reset that works, every setting visible on the website

* Fix: **the Discord status now shows the same logo as the app.** The built-in Discord application sends your chosen app icon as the large image (an https address on study-with-sarang.vercel.app); the card shows a preview of it. If you use your own Application ID, upload the icon in the Discord Developer Portal.
* Fix: **password reset.** The Supabase project still pointed at localhost, so the link in the email led nowhere. The redirect list is fixed on the server and the app now sends the hosted address instead of its private desktop address. The Cloud screen says honestly what happens next.
* New: **every settings page is on the website.** Drift detection, Auto-pause, Discord status, Window and updates and Voice and macros are now listed in the browser too, tagged App, with what they do and a download link, because a web page cannot control other windows or your keyboard outside the tab.

## 1.9.1 (2026-10-25), the apps get a home on GitHub

- **Download links.** The browser version has a **Get the app** link in the top bar and a **Download for Windows** card on the Studio page; both point at the newest GitHub release. The desktop app does not show them, because it already is the app.
- **Updates from GitHub.** The desktop app now looks for new versions in `sarang-cmd/study-with-sarang` out of the box (change or switch off in Settings, Window and updates).
- **Footer links** to Sarang.md and the source code.
- **Landing page** (`landing/`) and a Pages workflow that publishes it, with the web app under `/app/`. See `docs/DEPLOYMENT_GUIDE.md`.
- **Screenshots** for the READMEs and the landing page, made by `scripts/make-screenshots.cjs` from the real app with sample data.
- Nothing else changed in how the app works.

## 1.9.0 (2026-10-16), calmer by default: Essentials, a session rhythm, a voice that works, Flow commands

**Less on screen, by default**
- **Essentials.** The app now starts with a short header (sound, bell, settings, theme), three pages (Studio, Library, Progress), a timer with a goal and your saved mixes. Everything else is one switch away: **Settings, Advanced, Show everything**. Nothing is deleted when you switch; people who already used the app land in Essentials once, with a note in the bell that says where the switch is.
- **The top bar no longer overlaps.** The page switcher sits in its own row of the bar, so it cannot run into the Play button at any window width.
- **Welcome tour** asks "Essentials or everything" instead of three interface levels.

**A rhythm for every session**
- **Before you start:** a small question asks for your goal, the subject and how long (15, 25, 45, 60, 90 or your own minutes). Optionally choose how you will study (blank-page recall, practice questions, explain it aloud, past paper, mixed topics, fix my mistakes) and read why it works. Due reviews are shown there. One click on "Just start" skips it, "Do not ask again" turns it off.
- **After each block:** did you reach the goal, how focused did you feel (1 to 5), do you want a reminder to review this (days 1, 3 and 7), and what next: take the break, another block with the same goal, a new goal, or "I am done for now".
- **Mindful breaks:** every break suggests one thing (look far away, stretch, water, breathe with the guide, a short walk) and reminds you to stay off the scroll. "Another idea" changes it; "Breathe" opens the breathing guide.
- **Presets:** 25/5 and 52/17. Every part has its own switch in Settings, Timer.

**Notifications that show up**
- The check for "is the app in front" used a window state that Electron does not report on Windows, so alerts were swallowed. It now uses real focus. **Settings, Notifications, Send a test notification** says what happened and explains the Start menu shortcut and Focus assist when Windows is blocking it.

**A voice that is not always the system voice**
- Groq retired its old speech model in December 2025, which is why replies silently fell back to the system voice. Groq now uses **Orpheus** (long replies are split to fit its 200 character limit) and **Gemini** voices were added (free tier, many languages including German). Settings, Flow voice and AI has a voice picker, a "Hear a sample" button, and a plain warning when a service fails instead of a silent fallback. You can also pick which Windows voice is used.

**Flow understands everyday sentences ("Flow, pause my music")**
- **Music in other apps (desktop):** pause, resume, next, previous, what is playing; computer volume. Works through the system media controls on Windows, Spotify and Music on macOS, `playerctl` on Linux. "Pause the sound" still means this app's own sound.
- **Sessions:** "study for 45 minutes", "start a 25 minute focus session on optics", "start studying chemistry", "set a timer for 10 minutes", "take a break", "back to work", "how much time is left", "I am done".
- **Goals and to-dos:** "set my goal to...", "add a to-do...", "tick off...", "remind me to review...".
- **Questions answered out loud:** time, date, how long you studied today, streak, goal, to-dos, days until your exam.
- **Move around:** "open progress", "go to the library", "dark mode", "open notifications", "what can I say".
- **Free sentences (desktop):** the Windows recognizer also writes down sentences that are not in its fixed list. Hands-free voice mode acts on them only after the wake word.
- The assistant can use the same commands, with checked arguments. Links from web pages cannot write goals or to-dos.

**Fixes and small things**
- Reviews are listed in the start question and in a daily bell note when due.
- The first block of the day asks the start question even from the Play button; global shortcuts and the puck never wait for it while the window is hidden.
- New commands are listed under Settings, Keys and in the command palette.

## 1.8.0 (2026-10-07), a student app: subjects, statistics, drift detection, AI tools, study room, puck, monitors

This is one large release. Everything is optional and every part has a switch. Items marked **desktop** need the desktop app; the web edition says so plainly where a browser cannot do something.

**Made for students, not only for IB**
- **Subjects and exams.** Choose your programme: IB Diploma (year DP1 or DP2, **May or November** session, HL or SL per subject), GCSE, IGCSE, CBSE, A Level, AP or "Something else" with your own subjects. Exam countdown, weekly minutes per subject, archive a subject when you finish it. Settings, Subjects and exams. Subjects and to-dos sync with Cloud sync.
- **Session plan.** Pick a subject, set a **goal for each block** and keep a **to-do list** beside the timer. Block goals are marked met or missed in your log.
- **Statistics, many times over.** Progress now has a Statistics lab: exam countdown, subjects, a card for subjects that need attention, weekly time by subject, total focus over time, session length, goals reached, when you study, and records and streaks. Everything can be filtered by date range (7, 30, 90 or 365 days, or all), subject, mode, completed blocks only, blocks with a goal only, and a minimum length.
- **Heatmap per year.** A GitHub-style year view with a year selector (it opens on the current year, or the last year with activity) and the same filters.
- **91 achievements** (was 34), harder to earn, with four tiers, secret ones and a progress ring each.

**Notifications and celebrations**
- **Notification bell** in the top bar with an unread count and kinds (achievement, goal, timer, reminder, drift, AI, system), which Settings, Notifications lets you switch on or off. **Unlock cards** with a short animation and a tier-coloured badge; desktop also sends a system notification.

**Icon, everywhere**
- **App icon choice rebuilt.** Eight icons (Waves, Dot, Ring, Voice, Night, Leaf, Timer, Paper) change the window, taskbar, tray, notifications, in-app logo, media controls, and the Start menu and desktop shortcuts (**desktop**, Windows). The earlier icon switch did not reach all of these; this one does. The icon of the .exe file in Explorer is fixed at build time and cannot change while the app runs.

**Drift detection (desktop)**
- **No-AI mode, like parental controls.** Lists of apps, website domains and window-title words, with ready-made categories (social media, video, games, shopping, news, chat). A grace period (20 s) and a cooldown (3 min) keep it from nagging. What happens is yours to choose, each with its own switch: a message, an entry in the notification list, a system notification, count it as a distraction, a soft sound, pause the focus timer, pause the soundscape. An automation can also react to "Drift is detected". Optionally only during a focus block.
- **Window watcher** (Windows) reads the title and name of the front window. It never reads page contents, and nothing leaves the computer.
- **Browser helper extension** (Brave, Chrome, Edge, any Chromium browser; `extension/`): tells the app, over `127.0.0.1` only and with a private token, which tab is active, so websites are recognised exactly.
- **Optional AI check** with your own key for the cases lists cannot decide. Off by default.

**Study room (Zen mode)**
- **Your own focus-scene video behind the Zen clock instead of (or with) the sound.** Scenes are YouTube links, direct video links or video files that stay on your device. Playlist, loop or shuffle, follow the timer or focus blocks only, dim, blur, fit, clock size. Library, Study room.

**Mini player and puck**
- **The floating mini player** that appears when you scroll is now fully configurable: choose its contents (clock, mode, subject, goal, ring, daily goal, to-dos) and what each button does.
- **A desktop-wide puck (desktop).** The same controls in a small always-on-top window that stays visible over other apps, with pause and skip always one click away. When it shows (never, only after scrolling, always; on the desktop never, when the app is away, while the timer runs, or always), the corner, size, opacity, hiding when idle, the scroll distance and the drag grip are settings.

**Monitors and window (desktop)**
- **Real monitor names** (for example the model name and size) instead of "main" and "secondary", with identify flash.
- **Monitor rules:** keep the app on one chosen screen; when a screen connects or leaves, move the window and optionally open Zen, collapse, or run a command (for example Zen on the second monitor when the laptop connects). Also applied at start-up.
- **Snap fixed.** A snap menu in the title bar and in Settings with 12 layouts (halves, quarters, thirds, centred) that works on the monitor the window is on, and the commands `window.snap:<layout>` for shortcuts, macros, links and the assistant. The earlier snap relied on the Windows-only flyout, which does not exist with custom window buttons.

**Automations (desktop and web)**
- **When something happens, do something:** 20 triggers (block starts or ends, break starts or ends, session saved, daily goal reached, block goal met or missed, days until exams, time of day, drift detected, achievement, Zen opens or closes and more) and the same steps macros use as the action (load a mix, volume, sound, timer, Zen view, window moves, wait). Some triggers (such as drift) need the desktop app. Loop guard, rate limit and a test button. Up to 30 rules.

**AI, for every integration**
- **Provider catalogue** with free options and a plain note on limits: Groq, Google Gemini, OpenRouter (free models), Mistral, GitHub Models, local Ollama or LM Studio, and paid ones (OpenAI, Anthropic, any OpenAI-style address). **First-start walkthrough** and **re-runnable from Settings, About or Flow voice and AI**: pick a provider, open its key page, paste, test.
- **Assistant (agent) with 21 tools.** Chat with your own key and it can do what you can: change settings, load mixes, start timers, set subjects and goals, add to-dos, create automations, open pages, run commands. It cannot read or change keys, tokens or addresses, and cannot quit the app. Confirmation before each change is a switch (off by default).
- **Free quota only for dictation.** The shared Flow Cloud helper is speech-to-text only, 5 requests a day per device. Chat and everything else need your own key.

**Calendar**
- **Study sessions in your own calendar (Google Calendar, Apple Calendar, Outlook).** Settings, Calendar gives you a private link; subscribe once and each saved session appears. Event title, goal, task, distractions, exam date and busy or free are your choice. The link is one per account and can be reset. Needs the Supabase part in the guide (a function and a table).

**Focus page**
- **The case for starting.** The Focus page now opens with ethos, logos and pathos: why you can trust the technique, why it makes sense, and why it matters to you, with your own record and exam countdown. Honest content, no pressure. **A daily Socratic question** you can turn into the block goal.
- **Neural lock** moved out of the Focus menu: a card on Studio and on Focus. A gentle, optional rhythm under your sound (presets and your own rate), with a short honest note on what the evidence does and does not show. Off by default. Not medical.

**Setup and first start**
- **The installer no longer opens the app by itself** after setup or an update. The finish page now has two plain buttons, **Open Study with Sarang** and **Close setup**; nothing opens until you press Open.
- **Welcome tour** for first-time users (nine short steps: interface level, subjects, first goal and to-do, AI, desktop extras), skippable with Escape, never returns unless asked (Settings, About).
- **One master guide**, `MASTER_GUIDE.md`, with setup, every feature, every backend step and troubleshooting.

**Customisation**
- New switches under Settings, Interface level (26 switches in all) for the neural-lock card, puck, study room, session plan, notification bell and assistant button. Nothing new is forced.

**Tests and honesty**
- New suites `test-v20.mjs` (79 groups), `test-ui20` to `test-ui29` for the real app, and the setup window test.
- **Not verified on real hardware or services:** Windows icon and shortcut updates, YouTube inside the study room, the puck over other apps on real Windows, the snap flyout, monitor hot-plug, the foreground-window watcher, the Brave or Chrome extension in a real browser, the calendar feed on a deployed Supabase, provider model names and free-tier limits (they change; use the in-app model list and Test button), live tool calling against a real provider, and whether the neural-lock tone is comfortable (nobody could listen to it here).

## 1.5.0 (2026-10-06), Flow voice assistant, real recordings, calm tools

- **Flow, a push-to-talk voice assistant.** Settings, Flow assistant. Hold Right Ctrl (changeable) while this page is in front, say what you want, let go. A small bar shows a live picture of your voice. Double-tap for hands-free. Off by default. "Flow volume full", "set volume 40", "start the timer", "rainy window", "I need to breathe", "sleep timer 20 minutes" and German equivalents are understood in the page itself, with no service. Only when Flow is unsure does it ask (your choice: ask me, use the service, never). Own keys for Groq, OpenAI, OpenRouter, Gemini, Anthropic or any OpenAI-style address; an optional key-less Flow Cloud helper (`docs/FLOW_CLOUD.md`); free browser voice for replies.
  - In a browser the key works only while the page is in front (a web page cannot hear a key press in another app), and the browser's own speech recognition is an option (Chrome and Edge). The desktop app works from any window. Browsers that send audio to a service need a key or Flow Cloud for requests Flow cannot read itself.
- **Real recordings for ten sounds** (rain, thunder, waves, wind, fire, birds, crickets, coffee shop, singing bowl, white noise): your own file, files bundled in `public/sounds`, or a cloud address, with the generated sound as the fallback. `npm run sounds:list` and `npm run sounds:fetch` use the Freesound API (CC0 and CC BY, with credits shown in Settings, About). Guide: `docs/SOUNDS.md`. No recordings are bundled in this release; until you add them the generated sounds play.
- **Calm and scenes.** Breathing guide with five patterns, 5-4-3-2-1 grounding, a sleep timer that fades the sound, and six grayscale scenes that move with the sound, respect reduced motion and can act as a screensaver.
- **Media flyout seek bar** shows the time left in the focus block or break (or time passed, or hidden). Title can be the block, the mix or both.
- Not in the browser: Discord status, auto-pause, the sounds folder and the global key (all desktop only).
- Own backend: sync, Flow Cloud and sound hosting can each point at your own Supabase project or web space (`docs/OWN_BACKEND.md`).
- Tests added: `test-recordings.mjs`, `test-v17.mjs`.

## 1.4.0 (2026-10-06), calmer interface and media icon

- **Interface level.** Top bar leaf button for Simple view, plus Settings, Interface level with Simple, Standard, Power and Custom (20 switches). Power is the default and is the app as it was. Nothing is deleted.
- **App icon in media controls** (the system media flyout, lock screen and phone notification shade), with a switch in Settings, Sound.
- **Sound settings:** loudness range, volume cap, fade in and fade out times, and start playing on open (browsers usually block this until a click).
- Not in the browser, because a web page cannot see other programs: auto-pause when you record or watch a video, and Discord status. Both are in the desktop app 1.6.0.
- The desktop-only voice work (checks, microphone test, wake word off by default) is not applicable here.

## 1.3.1 (2026-10-04), media keys follow the most recent player

- **Play/Pause now works like in a browser.** It controls whichever app played most recently, so with Study with Sarang in the background you can still pause and resume the video you are watching. The app announces itself to the system as a media player while sound plays (Media Session) instead of grabbing the key. In the web version the key works while the browser has this page as the active player, even from another tab or app.
- Next track and Stop still work, and only when this app is the active player.

## 1.3.0 (2026-10-04), achievements, louder, email

- **Achievements.** 34 of them in six groups (focus time, streaks, blocks, depth, habits, sound), each a hexagon badge with its own icon, a tier (1 to 4 dots) and a progress ring. They are worked out from data the app already keeps, so they cannot be skipped and they come back on any device. Found in Progress. The first run is silent; later unlocks give one message and a short chime. Both can be switched off in Settings, Feedback and Zen.
- **Louder.** 100% now applies about 8 dB more gain than before, with a gentler curve at low settings, a limiter and a soft clip so loud mixes do not crackle. Not auditioned here (no audio device): please check it by ear and tell me if it needs more or less.
- **The timer pauses the sound.** Pausing the timer pauses the sound, and starting it brings it back. Follows the switch "Start and pause sound with the timer".
- **Cloud sync works out of the box.** The Study with Sarang Supabase project (public URL and publishable key) is built in. Using your own project moved under Advanced.
- **Sign-up with a code.** Create account now asks for the 6 digit code from the confirmation email, with Send a new code.
- **Confirmation link fix (web).** The link no longer leaves a token in the address bar and signs you in only for the account just created in that browser. Needs Site URL and Redirect URLs set in Supabase (`docs/EMAIL_SETUP.md`).
- **Branded emails.** `scripts/build-email-templates.mjs` makes six simple, image-free templates; `scripts/apply-email-templates.mjs` can install them through the Supabase API. `docs/EMAIL_SETUP.md` covers custom SMTP, SPF, DKIM, DMARC and what decides inbox versus spam.
- Tests added: achievements, volume curve, shortcut timing (held key, quick double press, slow keyboards), sign-up confirmation, email links, and a 1.5 UI suite.

## 1.2.0 (2026-10-04)

- **Settings panel** from a gear in the top bar (Ctrl+,): theme, layout, app icon, custom scrollbar, feedback, Zen options, timer, keys, cloud sync, data.
- **Two layouts:** New (Studio, Library, Progress, Focus pages) or Classic (the single long page).
- **Bento Tracking** with a full-width heatmap, daily goal, weekday and time-of-day charts, top sounds, session quality, labels and trends.
- **Zen parity:** sound, skip, reset, next variation, today's goal and a settings drawer.
- **Command palette** (Ctrl+K), small messages and soft interface sounds, custom page scrollbar, app icon choice for the browser tab.
- Play/Pause, Next and Stop media keys and Pause/Break control the sound while the page is focused.

## 1.1.0 (2026-10-03)

- **Custom sliders** for every range control, with pointer, touch and keyboard control and a reset on double-click or right-click.
- **Custom right-click menu** for sound, mixes, volume, timer, zen view, full screen, theme and section links. Text fields keep the system menu.
- **Optional Supabase cloud sync** with your own project: sign in with a password or an emailed code and merge mixes, time log, playlist and timer settings across devices. See `SUPABASE.md` and `supabase/schema.sql`. Off until you sign in. Secret keys are refused.
- **YouTube Error 153.** The page now states a referrer policy, and when YouTube refuses an embed, or the page was opened from a file, it explains why and links to the video.
- Privacy text updated to describe the optional sync.

## 1.0.0 (2026-10-01)

First release of Study with Sarang, a separate one-page app in the Sarang family.

- One page that opens on the sound controls. No sign-in, no accounts, no backend.
- Flow featured as the flagship sound, with its own card, controls and visualizer.
- 12 base environments and 26 live-generated layers with per-layer volume, pan and tone.
- Fine-tuning controls, sound timer with fade-out and variation seeds.
- Browser-saved mixes, 14 curated mixes, JSON export and import, full backup and share links.
- Pomodoro, countdown and stopwatch timer, with time tracking, streaks, charts and CSV or JSON export.
- High distractions tools: noise shield, drift counter and exam hall mix.
- Zen view, full screen, mini player, keyboard shortcuts and dark mode.
- Seeded YouTube playlist, with the player loaded lazily.
- Test suites for audio, mixes and tracking (`npm test`).

Not included: movable and pop-out windows.


---

# Desktop edition history (for reference)

## 2.1.0 (2026-10-16), calmer by default: Essentials, a session rhythm, a voice that works, Flow commands

**Less on screen, by default**
- **Essentials.** The app now starts with a short header (sound, bell, settings, theme), three pages (Studio, Library, Progress), a timer with a goal and your saved mixes. Everything else is one switch away: **Settings, Advanced, Show everything**. Nothing is deleted when you switch; people who already used the app land in Essentials once, with a note in the bell that says where the switch is.
- **The top bar no longer overlaps.** The page switcher sits in its own row of the bar, so it cannot run into the Play button at any window width.
- **Welcome tour** asks "Essentials or everything" instead of three interface levels.

**A rhythm for every session**
- **Before you start:** a small question asks for your goal, the subject and how long (15, 25, 45, 60, 90 or your own minutes). Optionally choose how you will study (blank-page recall, practice questions, explain it aloud, past paper, mixed topics, fix my mistakes) and read why it works. Due reviews are shown there. One click on "Just start" skips it, "Do not ask again" turns it off.
- **After each block:** did you reach the goal, how focused did you feel (1 to 5), do you want a reminder to review this (days 1, 3 and 7), and what next: take the break, another block with the same goal, a new goal, or "I am done for now".
- **Mindful breaks:** every break suggests one thing (look far away, stretch, water, breathe with the guide, a short walk) and reminds you to stay off the scroll. "Another idea" changes it; "Breathe" opens the breathing guide.
- **Presets:** 25/5 and 52/17. Every part has its own switch in Settings, Timer.

**Notifications that show up**
- The check for "is the app in front" used a window state that Electron does not report on Windows, so alerts were swallowed. It now uses real focus. **Settings, Notifications, Send a test notification** says what happened and explains the Start menu shortcut and Focus assist when Windows is blocking it.

**A voice that is not always the system voice**
- Groq retired its old speech model in December 2025, which is why replies silently fell back to the system voice. Groq now uses **Orpheus** (long replies are split to fit its 200 character limit) and **Gemini** voices were added (free tier, many languages including German). Settings, Flow voice and AI has a voice picker, a "Hear a sample" button, and a plain warning when a service fails instead of a silent fallback. You can also pick which Windows voice is used.

**Flow understands everyday sentences ("Flow, pause my music")**
- **Music in other apps (desktop):** pause, resume, next, previous, what is playing; computer volume. Works through the system media controls on Windows, Spotify and Music on macOS, `playerctl` on Linux. "Pause the sound" still means this app's own sound.
- **Sessions:** "study for 45 minutes", "start a 25 minute focus session on optics", "start studying chemistry", "set a timer for 10 minutes", "take a break", "back to work", "how much time is left", "I am done".
- **Goals and to-dos:** "set my goal to...", "add a to-do...", "tick off...", "remind me to review...".
- **Questions answered out loud:** time, date, how long you studied today, streak, goal, to-dos, days until your exam.
- **Move around:** "open progress", "go to the library", "dark mode", "open notifications", "what can I say".
- **Free sentences (desktop):** the Windows recognizer also writes down sentences that are not in its fixed list. Hands-free voice mode acts on them only after the wake word.
- The assistant can use the same commands, with checked arguments. Links from web pages cannot write goals or to-dos.

**Fixes and small things**
- Reviews are listed in the start question and in a daily bell note when due.
- The first block of the day asks the start question even from the Play button; global shortcuts and the puck never wait for it while the window is hidden.
- New commands are listed under Settings, Keys and in the command palette.

## Desktop 2.0.0 (2026-10-07), a student app: subjects, statistics, drift detection, AI tools, study room, puck, monitors

This is one large release. Everything is optional and every part has a switch. Items marked **desktop** need the desktop app; the web edition says so plainly where a browser cannot do something.

**Made for students, not only for IB**
- **Subjects and exams.** Choose your programme: IB Diploma (year DP1 or DP2, **May or November** session, HL or SL per subject), GCSE, IGCSE, CBSE, A Level, AP or "Something else" with your own subjects. Exam countdown, weekly minutes per subject, archive a subject when you finish it. Settings, Subjects and exams. Subjects and to-dos sync with Cloud sync.
- **Session plan.** Pick a subject, set a **goal for each block** and keep a **to-do list** beside the timer. Block goals are marked met or missed in your log.
- **Statistics, many times over.** Progress now has a Statistics lab: exam countdown, subjects, a card for subjects that need attention, weekly time by subject, total focus over time, session length, goals reached, when you study, and records and streaks. Everything can be filtered by date range (7, 30, 90 or 365 days, or all), subject, mode, completed blocks only, blocks with a goal only, and a minimum length.
- **Heatmap per year.** A GitHub-style year view with a year selector (it opens on the current year, or the last year with activity) and the same filters.
- **91 achievements** (was 34), harder to earn, with four tiers, secret ones and a progress ring each.

**Notifications and celebrations**
- **Notification bell** in the top bar with an unread count and kinds (achievement, goal, timer, reminder, drift, AI, system), which Settings, Notifications lets you switch on or off. **Unlock cards** with a short animation and a tier-coloured badge; desktop also sends a system notification.

**Icon, everywhere**
- **App icon choice rebuilt.** Eight icons (Waves, Dot, Ring, Voice, Night, Leaf, Timer, Paper) change the window, taskbar, tray, notifications, in-app logo, media controls, and the Start menu and desktop shortcuts (**desktop**, Windows). The earlier icon switch did not reach all of these; this one does. The icon of the .exe file in Explorer is fixed at build time and cannot change while the app runs.

**Drift detection (desktop)**
- **No-AI mode, like parental controls.** Lists of apps, website domains and window-title words, with ready-made categories (social media, video, games, shopping, news, chat). A grace period (20 s) and a cooldown (3 min) keep it from nagging. What happens is yours to choose, each with its own switch: a message, an entry in the notification list, a system notification, count it as a distraction, a soft sound, pause the focus timer, pause the soundscape. An automation can also react to "Drift is detected". Optionally only during a focus block.
- **Window watcher** (Windows) reads the title and name of the front window. It never reads page contents, and nothing leaves the computer.
- **Browser helper extension** (Brave, Chrome, Edge, any Chromium browser; `extension/`): tells the app, over `127.0.0.1` only and with a private token, which tab is active, so websites are recognised exactly.
- **Optional AI check** with your own key for the cases lists cannot decide. Off by default.

**Study room (Zen mode)**
- **Your own focus-scene video behind the Zen clock instead of (or with) the sound.** Scenes are YouTube links, direct video links or video files that stay on your device. Playlist, loop or shuffle, follow the timer or focus blocks only, dim, blur, fit, clock size. Library, Study room.

**Mini player and puck**
- **The floating mini player** that appears when you scroll is now fully configurable: choose its contents (clock, mode, subject, goal, ring, daily goal, to-dos) and what each button does.
- **A desktop-wide puck (desktop).** The same controls in a small always-on-top window that stays visible over other apps, with pause and skip always one click away. When it shows (never, only after scrolling, always; on the desktop never, when the app is away, while the timer runs, or always), the corner, size, opacity, hiding when idle, the scroll distance and the drag grip are settings.

**Monitors and window (desktop)**
- **Real monitor names** (for example the model name and size) instead of "main" and "secondary", with identify flash.
- **Monitor rules:** keep the app on one chosen screen; when a screen connects or leaves, move the window and optionally open Zen, collapse, or run a command (for example Zen on the second monitor when the laptop connects). Also applied at start-up.
- **Snap fixed.** A snap menu in the title bar and in Settings with 12 layouts (halves, quarters, thirds, centred) that works on the monitor the window is on, and the commands `window.snap:<layout>` for shortcuts, macros, links and the assistant. The earlier snap relied on the Windows-only flyout, which does not exist with custom window buttons.

**Automations (desktop and web)**
- **When something happens, do something:** 20 triggers (block starts or ends, break starts or ends, session saved, daily goal reached, block goal met or missed, days until exams, time of day, drift detected, achievement, Zen opens or closes and more) and the same steps macros use as the action (load a mix, volume, sound, timer, Zen view, window moves, wait). Some triggers (such as drift) need the desktop app. Loop guard, rate limit and a test button. Up to 30 rules.

**AI, for every integration**
- **Provider catalogue** with free options and a plain note on limits: Groq, Google Gemini, OpenRouter (free models), Mistral, GitHub Models, local Ollama or LM Studio, and paid ones (OpenAI, Anthropic, any OpenAI-style address). **First-start walkthrough** and **re-runnable from Settings, About or Flow voice and AI**: pick a provider, open its key page, paste, test.
- **Assistant (agent) with 21 tools.** Chat with your own key and it can do what you can: change settings, load mixes, start timers, set subjects and goals, add to-dos, create automations, open pages, run commands. It cannot read or change keys, tokens or addresses, and cannot quit the app. Confirmation before each change is a switch (off by default).
- **Free quota only for dictation.** The shared Flow Cloud helper is speech-to-text only, 5 requests a day per device. Chat and everything else need your own key.

**Calendar**
- **Study sessions in your own calendar (Google Calendar, Apple Calendar, Outlook).** Settings, Calendar gives you a private link; subscribe once and each saved session appears. Event title, goal, task, distractions, exam date and busy or free are your choice. The link is one per account and can be reset. Needs the Supabase part in the guide (a function and a table).

**Focus page**
- **The case for starting.** The Focus page now opens with ethos, logos and pathos: why you can trust the technique, why it makes sense, and why it matters to you, with your own record and exam countdown. Honest content, no pressure. **A daily Socratic question** you can turn into the block goal.
- **Neural lock** moved out of the Focus menu: a card on Studio and on Focus. A gentle, optional rhythm under your sound (presets and your own rate), with a short honest note on what the evidence does and does not show. Off by default. Not medical.

**Setup and first start**
- **The installer no longer opens the app by itself** after setup or an update. The finish page now has two plain buttons, **Open Study with Sarang** and **Close setup**; nothing opens until you press Open.
- **Welcome tour** for first-time users (nine short steps: interface level, subjects, first goal and to-do, AI, desktop extras), skippable with Escape, never returns unless asked (Settings, About).
- **One master guide**, `MASTER_GUIDE.md`, with setup, every feature, every backend step and troubleshooting.

**Customisation**
- New switches under Settings, Interface level (26 switches in all) for the neural-lock card, puck, study room, session plan, notification bell and assistant button. Nothing new is forced.

**Tests and honesty**
- New suites `test-v20.mjs` (79 groups), `test-ui20` to `test-ui29` for the real app, and the setup window test.
- **Not verified on real hardware or services:** Windows icon and shortcut updates, YouTube inside the study room, the puck over other apps on real Windows, the snap flyout, monitor hot-plug, the foreground-window watcher, the Brave or Chrome extension in a real browser, the calendar feed on a deployed Supabase, provider model names and free-tier limits (they change; use the in-app model list and Test button), live tool calling against a real provider, and whether the neural-lock tone is comfortable (nobody could listen to it here).

## Desktop 1.7.0 (2026-10-06), Flow voice assistant, real recordings, calm tools, Discord with no setup

- **Flow, a push-to-talk voice assistant.** Settings, Flow assistant. Hold **Right Ctrl** (changeable to another key or chord), say what you want, let go. A small bar appears at the bottom (or top or middle) with a live picture of your voice (wave, bars, orb or ring), never takes keyboard focus, and goes away on its own. A quick tap or a shortcut such as Ctrl+C stays silent and does nothing. **Double-tap** for hands-free: speak, and Flow stops when you pause; a tap or Esc ends it too. Off by default.
  - **Understanding.** "Flow volume full", "set volume 40", "turn it up", "quieter", "mute", "start the timer", "skip the break", "rainy window", "run Start Flow session", "I need to breathe", "sleep timer 20 minutes", "simple view" and German equivalents ("Lautstärke fünfzig") are all understood on your computer, with no service, no network and no cost. Saved mixes and macros are recognised by name.
  - **Only when Flow is truly unsure** does it consider a service. A setting chooses **Ask me** (a small question: do the closest command, or let the assistant work it out), **Use the service** or **Never**. Recordings with no speech never leave the device.
  - **Your own key.** Paste a key for Groq (Whisper plus a chat model), OpenAI, OpenRouter, Gemini, Anthropic or any OpenAI-style address (Ollama and LM Studio work on this computer). Keys stay on the device, are not synced or exported, and model names are editable because vendors rename them. A daily limit (default 50) protects your own quota.
  - **Flow Cloud, a key-less shared helper** (optional, one-time setup by you): a Supabase edge function (`supabase/functions/flow-assist`) with a per-device, per-network and global daily limit and the Groq key kept server-side. Guide: `docs/FLOW_CLOUD.md`. Until it is deployed the choice says so plainly and own keys work as usual.
  - **Voice replies.** Free system voice by default (speed, pitch, volume), or a service voice with your own key. Flow can read answers aloud and optionally say what it did.
  - Web: works while the page is in front, with the browser's speech recognition as an option. Desktop: works from any app. macOS and Linux have no key-release events, so the key toggles instead of holding.
- **Real recordings for ten sounds** (rain, thunder, waves, wind, fire, birds, crickets, coffee shop, singing bowl, white noise). Sources in order: your own file, the desktop sounds folder, files bundled in `public/sounds`, a cloud address (Supabase Storage or any web folder), then the generated sound as the fallback, so nothing ever goes silent. Seamless loop blend, loudness matching, mono to save memory and a cache of recent recordings. `npm run sounds:list` and `npm run sounds:fetch` use the Freesound API to find and download CC0 or CC BY recordings with credits (shown in Settings, About). Guide: `docs/SOUNDS.md`. **No recordings are bundled in this release**, because they need your Freesound key; until you add them the generated sounds play.
- **Calm and scenes.** A leaf button opens a calm screen: **breathing guide** (box, 4-7-8, coherent, relax, or your own timings, optional tone and counter), a 5-4-3-2-1 **grounding** exercise, a **sleep timer** that fades the sound and dims the screen, and six quiet grayscale **scenes** (aurora, rain on glass, starfield, ripples, embers, mist) that can move with the sound, respect reduced motion, and act as a screensaver. An optional intention line. Voice and keys: "I need to breathe", "sleep timer 30 minutes".
- **Media flyout seek bar** now shows the session clock: time left in the focus block (25:00) or break (5:00), or time passed, or hidden. Title can be the block, the mix or both.
- **Discord with zero setup.** The app ships with its own Discord application, so switching the toggle on is all a person does. New customisation: top and second line text with placeholders, activity type (Playing, Listening, Watching), a button with your link, picture captions and live preview. **Advanced**: use your own application ID and picture names.
- **Own backend, later.** Sync, Flow Cloud and sound hosting can each point at your own Supabase project or web space without code changes. Guide: `docs/OWN_BACKEND.md`.
- Voice mode's default wake word is now Flow ("Sarang" still works).
- Tests added: `test-recordings.mjs`, `test-v17.mjs` (understanding, gesture, voice activity, the Flow engine with fakes, services and limits, calm maths, seek bar, Discord options), `test-v17.cjs` (key helper, bar window, web requests, sound folder, Discord sanitising), `test-ui17.cjs` (the real app).
- **Not verified on real hardware:** the Right Ctrl hold on Windows, the real microphone and speech recognition, a real Groq key, a deployed Flow Cloud function, real Freesound downloads (the tool is tested against a local copy of the API) and Discord with the real app.

## Desktop 1.6.0 (2026-10-06), calmer interface, auto-pause, Discord, media icon, voice checks

- **Interface level.** A leaf button in the top bar flips between **Simple** and the level you had before. Settings, Interface level has three presets and a Custom mix of 20 switches (pages, studio cards, timer extras, top bar buttons, footer). Simple shows Studio and Library only, a timer without modes and settings, layers and fine tune inside "More" drawers, and a short weekly summary instead of the full dashboard. Standard drops the intro strip, the shortcut and palette buttons and the footer notes. **Power is the default and is the app as it was.** Nothing is deleted: switching levels brings everything back, and Settings is always reachable. This is separate from Zen view. Also in the command palette (Ctrl+K, "simple").
- **Auto-pause (desktop, Windows detection).** Your sound keeps playing while you watch videos, as before. Settings, Auto-pause adds an **opt-in** switch: pause or lower the volume when another app uses the microphone (calls, recording), when recording software is open, or when another app plays media. You set the delay, whether it resumes, the lowered level, an ignore list (music players, pre-filled) and the recorder list. It only resumes what it paused itself, and if you press play while it is holding the sound, your choice wins until the other app stops. Detection reads status flags only: it never records audio and never looks at windows. Limits: Windows does not say whether a recorder is actually recording (only that it is open), and does not say whether media is a video or music (use the ignore list).
- **Discord status (desktop, opt-in).** Settings, Discord. Shows the mix, a live timer and optionally your task on your own Discord profile. You create a free application in the Discord Developer Portal and paste its Application ID, so the name on your profile is yours. Talks to the Discord app on your PC over its local pipe; nothing goes to a server of ours. The task is off by default and a preview shows exactly what is sent.
- **App icon in the media flyout.** The media controls now receive the app icon (96 to 512 px), which fixes flyouts that showed only a play button while paused. Switch in Settings, Sound. Web and desktop.
- **Voice mode.** I could not reproduce your problem without Windows, so this release makes the cause visible instead of guessing:
  - **Run checks** (Settings, Voice and macros) tests PowerShell, the Windows speech library, installed recognizers, the three microphone privacy switches and whether the default microphone opens, and gives a fix for each. **Copy report** puts the result on the clipboard.
  - **Test microphone** runs the recognizer without turning voice mode on, with a live level meter, what it is hearing, and counters for recognized and not understood sounds. Level stuck at zero means the microphone or its permission; a moving level with "not understood" means the words or the wake word.
  - **The wake word is now off by default** and strictness is lower (55% instead of 72%). Windows often mishears an unusual name like "Sarang", which made every command fail. Older saved voice settings are reset to this once; turn the wake word back on if you want it.
  - A silent PowerShell failure used to look like a 20 second timeout. The error text is now shown, and a heard command shows a small "Heard ..." message.
- **More settings.** Settings, Sound: loudness range (Gentle, Balanced, Loud, Maximum), a volume cap, separate fade in and fade out times, and start playing when the app opens (desktop always; a browser only if it allows sound without a click).
- Tests added: `test-v16.mjs` (levels, auto-pause rules and timing, Discord status, voice checks, artwork, loudness), `test-v16.cjs` (Discord pipe protocol with a fake Discord, activity helper, voice events) and `test-ui16.cjs` (the whole interface in the app, including simulated auto-pause reports). The three PowerShell helpers were syntax checked and the activity helper's process logic was run under PowerShell 7 on Linux. **Not verified on real Windows:** the microphone and media-session detection, the Discord connection to a real Discord app, the speech recognizer and the Fluent Flyout picture.

## Desktop 1.5.1 (2026-10-04), media keys follow the most recent player

- **Play/Pause now works like in a browser.** It controls whichever app played most recently, so with Study with Sarang in the background you can still pause and resume the video you are watching. The app announces itself to the system as a media player while sound plays (Media Session) instead of grabbing the key. Desktop: new switch "Only the most recently played app" (default on, restart to apply); turn it off for the old behavior. Web: the same, through the browser.
- Next track and Stop still work, and only when this app is the active player.
- The Pause/Break key is unchanged: it always controls this app, because it is not a media key.

## Desktop 1.5.0 (2026-10-04), achievements, louder, email and signing

- **Achievements.** 34 of them in six groups (focus time, streaks, blocks, depth, habits, sound), each a hexagon badge with its own icon, a tier (1 to 4 dots) and a progress ring. They are worked out from data the app already keeps, so they cannot be skipped and they come back on any device. Found in Progress. The first run is silent; later unlocks give one message and a short chime. Both can be switched off in Settings, Feedback and Zen.
- **Louder.** 100% now applies about 8 dB more gain than before, with a gentler curve at low settings, a limiter and a soft clip so loud mixes do not crackle. Not auditioned here (no audio device): please check it by ear and tell me if it needs more or less.
- **The timer pauses the sound.** Pausing the timer pauses the sound, and starting it brings it back. Follows the switch "Start and pause sound with the timer".
- **Shortcut fix.** Pressing a global shortcut twice quickly (for example with Ctrl and Shift held) now fires both times. Held keys still count once: the app reads your Windows key repeat delay and rate and follows the repeat stream instead of ignoring everything for 0.7 s. Volume shortcuts still repeat.
- **Cloud sync works out of the box.** The Study with Sarang Supabase project (public URL and publishable key) is built in. Using your own project moved under Advanced.
- **Sign-up with a code.** Create account now asks for the 6 digit code from the confirmation email, with Send a new code. Works in the desktop app and the web version.
- **Confirmation link fix (web).** The link no longer leaves a token in the address bar and signs you in only for the account just created in that browser. Needs Site URL and Redirect URLs set in Supabase (`docs/EMAIL_SETUP.md`).
- **Branded emails.** `scripts/build-email-templates.mjs` makes six simple, image-free templates; `scripts/apply-email-templates.mjs` can install them through the Supabase API. `docs/EMAIL_SETUP.md` covers custom SMTP, SPF, DKIM, DMARC and what decides inbox versus spam.
- **Code signing.** The exe is signed with a self-signed certificate (`scripts/sign-exe.cjs`, `scripts/make-signing-cert.sh`). That does not remove the Windows SmartScreen warning for other people; the real options are in `docs/STORE_AND_SIGNING.md`. The SmartScreen note moved out of the install steps into its own "If Windows shows a warning" section.
- Tests added: achievements, volume curve, shortcut timing (held key, quick double press, slow keyboards), sign-up confirmation, email links, and a 1.5 UI suite.

## Desktop 1.4.0 (2026-10-04), settings, layouts and a new Tracking

- **Fixed the window buttons overlapping the page scrollbar.** The page now has its own slim scrollbar that starts below the title bar. It can be switched off.
- **Custom window buttons** (thin minimize, maximize and close icons that match the studio), with System buttons as a switch.
- **Settings panel** opened from a gear in the top bar (or Ctrl+,), replacing the Desktop section at the bottom. Tabs: Appearance, Feedback and Zen, Timer, Keys, Window and updates, Voice and macros, Cloud sync, Your data, About. Cloud sync moved here too.
- **Layouts.** New: Studio, Library, Progress and Focus pages (address hashes `#studio`, `#library`, `#progress`, `#focus`; old section links still work). Classic: the previous single long page. Switch in Settings, in the palette or from the right-click menu.
- **Bento Tracking.** The 16-week heatmap now fills its card and shows more weeks on wide screens. New cards: daily goal ring and goal streak, 7, 14 and 30 day chart, weekday averages, time of day, top sounds, session quality, labels, week-on-week trends. The old Tracking is kept for the Classic layout.
- **Zen parity.** Sound mix and volume, skip, reset, next variation, today's goal bar, block label, a settings drawer, and messages. Each part can be turned off.
- **Command palette** (Ctrl+K): search every action, page, mix and setting.
- **Feedback.** Small messages and soft interface sounds for skip, next, reset, start, pause and more, each with its own switch.
- **App icon choice:** Current, or the Classic dark dot, for the window, taskbar and tray (the file icon of the exe is fixed by Windows).
- **Media keys and Pause/Break.** Play/Pause, Next and Stop control the sound from any app (they can be released in Settings, Keys). Pause/Break runs an action of your choice (Windows helper; elsewhere while the window is focused).
- The Update prompt now appears above the Settings panel; `window.close` can no longer be sent by a `study-with-sarang://` link.
- Quality of life: "Loaded X" messages for digit keys, a footer with Settings, Shortcuts and Back to top, settings export and import, reset of display settings.
- New `SETUP_AND_DEPLOYMENT_GUIDE.md`. Tests added: `test-keys.cjs`, `test-insights.mjs`, `test-ui14.cjs`.
- The web edition (1.2.0) receives the same interface.

## Desktop 1.3.0 (2026-10-03), updates

- **Update from inside the app (Windows).** The installed app checks GitHub Releases (at start and every six hours, or with Check now or the tray item), shows the release notes and asks. Update now downloads the setup, verifies its SHA-256, then runs the same animated installer in update mode, which keeps your mixes, settings and shortcut choices and reopens the app. A failed update puts the previous version back. See `docs/UPDATES.md` for how to publish a release.
- New Updates card in the Desktop section (repository, background checks, Check now) and a Check for updates tray item.
- The installer now sets the old version aside and restores it if anything fails, instead of deleting it first.
- `scripts/checksum.cjs` writes the `.sha256` file the updater needs. Tests: `test-update.cjs`, `test-update-ui.cjs`, update-mode cases in `test-setup-ui.cjs`.
- The update repository is empty until you set `swaUpdate.repo` in `package.json` (or type it in the app), so no update checks happen by default.

## Desktop 1.2.0 (2026-10-03), fixes, custom controls and cloud sync

- **Fixed YouTube "Error 153, video player configuration error".** The desktop window serves the app from its own address, and YouTube refuses an embed that arrives without a Referer header. The window now identifies itself on the embed request, and the page also states a referrer policy. If YouTube still refuses a video (for example the owner turned embedding off) the player shows a short note with a Watch on YouTube link. Opening the web build from a file is explained instead of failing silently.
- **Custom sliders.** Every range control is now the studio's own slider: pointer and touch dragging, a value bubble while dragging, a centre mark for pan and tone, full keyboard control (arrows, Page Up and Down, Home, End), double-click or right-click to reset.
- **Custom right-click menu.** Play and pause, next variation, switch mix, volume, timer, zen view, full screen, theme, go to a section, keyboard shortcuts, and in the desktop edition collapse, keep on top, hide to tray, global shortcuts and quit. It adapts to what is under the pointer (selected text, links, sliders), keeps the system menu in text fields, works with the keyboard and stays inside the window. The mini bar shows the same menu as the tray icon.
- **Optional Supabase cloud sync.** Bring your own Supabase project, sign in with a password or an emailed code, and merge mixes, time log, playlist, timer settings (and macros on the desktop) across devices. See `docs/SUPABASE.md` and `supabase/schema.sql`. Off until you sign in; secret keys are refused.
- Header cloud button, privacy text updated to match.
- The `build/` resource folder is now `assets/` (icons, tray images, Store tiles), so build tools and editors that skip folders named `build` no longer drop it.

## Desktop 1.1.0 (2026-10-03), desktop edition

Study with Sarang as a native desktop app (Electron), with the same design as the web app.

- One executable that is the installer, the uninstaller and the app. Animated setup window with Install, Customize and Repair, Start menu and desktop shortcuts, an entry in Settings, Apps, and a clean uninstall that keeps your data unless you ask otherwise.
- Tray icon, close to tray, collapse to a 460 by 104 mini bar, always on top, one-monitor memory with safe recovery when a monitor disappears.
- Open at sign-in, with an option to start hidden.
- Global shortcuts (Ctrl + Alt + Shift by default) that work while the app is hidden, can be rebound, are checked against system and browser combinations, and can be turned on and off with their own shortcut.
- Macros of up to 20 steps, runnable from shortcuts, voice, the tray, the command line and links.
- Stream Deck and external keyboard support through hotkeys, `--cmd=` command lines and `study-with-sarang://` links.
- Voice mode in English and German using Windows' offline speech recognition (Windows only).
- Windows 11 Mica backdrop and native caption buttons, macOS inset title bar and vibrancy.
- Security: the page has no Node access, content security policy without inline scripts, external navigation blocked, commands validated.
- Tests for shortcuts, commands, macros, voice, placement, settings, installer logic, the setup window and the real running app (`npm test`, `npm run test:electron`).

Not included: Apple Liquid Glass controls (needs a native addon that could not be checked), a code signature, the Microsoft Store package and the macOS build (they need Windows and macOS machines), Android.

## Desktop 1.0.0 (2026-10-01), web edition

First release of Study with Sarang, a separate one-page app in the Sarang family.

- One page that opens on the sound controls. No sign-in, no accounts, no backend.
- Flow featured as the flagship sound, with its own card, controls and visualizer.
- 12 base environments and 26 live-generated layers with per-layer volume, pan and tone.
- Fine-tuning controls, sound timer with fade-out and variation seeds.
- Browser-saved mixes, 14 curated mixes, JSON export and import, full backup and share links.
- Pomodoro, countdown and stopwatch timer, with time tracking, streaks, charts and CSV or JSON export.
- High distractions tools: noise shield, drift counter and exam hall mix.
- Zen view, full screen, mini player, keyboard shortcuts and dark mode.
- Seeded YouTube playlist, with the player loaded lazily.
- Test suites for audio, mixes and tracking (`npm test`).

Not included: movable and pop-out windows.

