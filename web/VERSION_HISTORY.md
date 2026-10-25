# Version history

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
