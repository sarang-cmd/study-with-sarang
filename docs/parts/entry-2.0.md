## {{V}} (2026-10-07), a student app: subjects, statistics, drift detection, AI tools, study room, puck, monitors

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
