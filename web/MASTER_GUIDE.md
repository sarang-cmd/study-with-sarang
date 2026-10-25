# Study with Sarang: the master guide

Web edition, version 1.9.0 (2026-10-16). This is the one long guide for Study with Sarang: installing it, using every feature, setting up every optional service, building it, publishing it, and fixing things. Use the contents list to jump. The appendices at the end contain the detailed service guides (Supabase, email, calendar, Flow Cloud, own backend, sounds, Stream Deck, updates, signing), so you never need another file.

Items marked **desktop** need the desktop app (Windows first, macOS too). The web edition does everything a browser can do and says plainly where it cannot.

## Contents

1. [What it is and who it is for](#1-what-it-is-and-who-it-is-for)
2. [What is in the ZIP](#2-what-is-in-the-zip)
3. [Install](#3-install)
4. [First start and the welcome tour](#4-first-start-and-the-welcome-tour)
5. [Your first study day](#5-your-first-study-day)
6. [Every feature, one by one](#6-every-feature-one-by-one)
7. [AI: free options, setup, the assistant](#7-ai-free-options-setup-and-the-assistant)
8. [Optional online services: sync, calendar, dictation, email](#8-optional-online-services)
9. [Customise everything](#9-customise-everything)
10. [Updates and publishing](#10-updates-and-publishing)
11. [Build and run the source](#11-build-and-run-the-source)
12. [Troubleshooting](#12-troubleshooting)
13. [Privacy and your data](#13-privacy-and-your-data)
14. [What was and was not tested](#14-what-was-and-was-not-tested)
15. [Appendices](#appendices)

## 1. What it is and who it is for

Study with Sarang is a focus studio for students. It gives you live ambient sound (Flow is the flagship), a focus timer with goals and to-dos, subject-aware statistics and an exam countdown, achievements, a calm corner, and, in the desktop app, a floating timer, drift detection, calendar sync and an AI assistant that can set the app up for you.

It is **not only for the IB**. You can pick **IB Diploma** (DP1 or DP2, May or November session, HL or SL), **GCSE**, **IGCSE**, **CBSE**, **A Level**, **AP**, or **Something else** with subjects you type yourself. Nothing about it requires a school, an account or a payment. It is a different product from Sarang.MD and shares only its look.

The principles: everything is **optional and adjustable** (there are 20 interface switches and a Simple, Standard and Power level), nothing is forced, your data stays on your device unless you switch on sync, and AI is always **your own key** except a small free allowance for dictation.

## 2. What is in the ZIP

```
index.html, src/, public/            the app (Vite, React, TypeScript, Tailwind)
MASTER_GUIDE.md                      this file
README.md, CHANGELOG.md              overview and the full list of changes since the first version
scripts/                             tests and helpers (sound download, email templates, checks)
supabase/                            SQL and functions for sync, calendar and dictation
docs/                                the same detailed guides as the appendices, as separate files
package.json, package-lock.json      dependencies and build settings
```

Run `npm ci` and `npm run build`, then upload the contents of `dist/` to any static host (chapter 11). The desktop-only parts of this guide (puck over other apps, monitors, drift watcher, auto-pause, Discord, global shortcuts, installer, updater) are not part of the web edition.

## 3. Install

### Windows

1. Double-click `Study-with-Sarang-1.9.0.exe`.
2. In the setup window press **Install** (no administrator rights, about ten seconds), or **Customize** to choose the folder, shortcuts, open at sign-in and start hidden.
3. When it is finished, the last page offers two buttons, **Open Study with Sarang** and **Close setup**. The app starts only if you press Open. Neither a fresh install nor an update opens the window on its own.
4. It installs to `%LOCALAPPDATA%\Programs\Study with Sarang`, adds Start menu and desktop shortcuts and an entry in Settings, Apps.
5. To update by hand, run the newer exe: setup offers **Update** and keeps your data. **Run once without installing** is the small link on the first page.
6. To uninstall use Windows Settings, Apps. It asks whether to keep your data (`%APPDATA%\Study with Sarang`).

**If Windows shows a warning.** Only some PCs do. The exe is signed with a self-made certificate, which proves it was not altered but is not trusted by Windows, so SmartScreen can say "Windows protected your PC" and "Unknown publisher". Choose **More info**, then **Run anyway**. Appendix I explains how to remove the warning for everyone.

### macOS

Build on a Mac with `npm run dist:mac` (chapter 11). It has not been tested here. Global shortcuts use Cmd + Option + Shift. Voice mode, the foreground-window watcher and the key-hold Flow key are Windows only.

### Web edition

Upload the contents of `dist/` (chapter 11) to any static host with HTTPS. Do not open `index.html` from a folder (`file://`): YouTube and some storage refuse to work there. In a browser, shortcuts and media keys work while the tab is focused, and desktop-only features (puck over other apps, monitors, drift watcher, auto-pause, Discord, global shortcuts) are hidden or explained.

## 4. First start and the welcome tour

On the first start a short **welcome tour** opens by itself (nine steps, about a minute). It asks:

1. How much you want to see: **Essentials** (recommended) or **Everything**. You can change it any time in **Settings, Advanced**.
2. Your programme and subjects (or skip).
3. A first goal and a first to-do.
4. Whether you want an AI helper (opens the AI walkthrough, chapter 7).
5. What the desktop app adds (only shown in the desktop app).

Press **Escape** or **Skip the tour** at any time; skipping is remembered and the tour does not come back. To see it again: **Settings, About, Show the welcome tour again**. The AI walkthrough can be re-run from **Settings, About, Open the AI walkthrough** and from Settings, Flow voice and AI.

## 5. Your first study day

1. Open **Settings (gear, or Ctrl+,), Subjects and exams**. Choose your programme, year or stage, and exam session. Tick your subjects and set HL or SL if the programme has it. Add your own subjects with "Add a subject". The exam date is approximate: you can type your exact date.
2. On **Studio**, choose a sound (or **Flow**) and press **Play**.
3. In the session plan beside the timer pick today's **subject**, write a **goal** for the block ("finish 10 questions on vectors") and add **to-dos**.
4. Press **Start**. A small question asks for your **goal**, the **subject** and **how many minutes** (and, if you like, how you will study). When the block ends, a card asks if you reached the goal, how focused you felt, whether to schedule reviews (days 1, 3 and 7), and what next. The goal is marked **met** or **missed** (your honest answer), and the session is saved with the subject. Breaks suggest one mindful thing to do.
5. Open **Progress** to see the statistics, the yearly heatmap and achievements. Unlocks appear as a card and in the **bell** at the top.
6. If you drift, press **I drifted** (or the shortcut) so it counts in your statistics.

## 6. Every feature, one by one

### Essentials and Advanced
The app starts in **Essentials**: Studio, Library and Progress, the timer with its goal, and a short top bar. **Settings, Advanced, Show everything** brings back every feature (Focus page, study room, automations, distraction check, calendar feed, assistant, the other timer modes, the full set of top bar buttons and the interface switches). Nothing is deleted either way. Features still being refined live behind this switch.

### Session rhythm
- **Before a block** (Settings, Timer, Session questions): goal, subject, minutes, optional technique with a one line reason why it works. "Just start" skips it; "Do not ask again" turns it off. Quick starts from global shortcuts or the puck never wait for it when the window is hidden.
- **After a block:** goal met, focus rating, review reminders, and what next (break, another block with the same goal, new goal, done for now). Reviews follow the spaced schedule of 1, 3 and 7 days and appear in the start question and as a daily bell note.
- **Breaks:** one idea at a time (eyes, move, breathe, water, outside, rest), with a button to open the breathing guide and a reminder to stay off the scroll. Presets 25/5 and 52/17.

### Sound, Flow and the timer
- **Studio page:** 12 base environments, 26 layers with volume, pan and tone, fine-tuning, a sleep timer with fade-out, saved mixes, 14 curated mixes. **Flow** is the flagship sound. Real recordings can replace the generated sounds (Appendix F).
- **Timer:** Pomodoro, countdown or stopwatch, daily goal, long breaks, notifications. The sound can start and pause with the timer.
- **Media keys** (desktop) follow the most recently played app, like a browser, so you can still pause a video you are watching.

### Subjects, exams and the session plan
- Programmes: IB (DP1, DP2, May or November), GCSE, IGCSE, CBSE, A Level, AP, custom. Each subject has a short name, level, optional weekly minutes and can be archived.
- The countdown shows days and weeks to your exam session on Progress, Focus and the Studio.
- Goals and to-dos belong to a block. Subjects and to-dos sync with Cloud sync; the plan itself stays on the device.

### Progress, statistics, heatmap and achievements
- **Statistics lab:** exam countdown, subjects, what needs attention, weekly time by subject, total focus over time, session length, goals reached, when you study, records and streaks. Filter by date range (7, 30, 90, 365 days or all), subject, mode, completed blocks only, blocks with a goal only and minimum length.
- **Heatmap per year:** a GitHub-style grid. The year selector opens on the current year, or the last year that has activity. It uses the same filters.
- **91 achievements** in groups (focus time, streaks, blocks, depth, habits, sound, subjects and more), four tiers, some secret. They are calculated from your own log, so they cannot be skipped and return on any device. The first run is silent; later unlocks show a card, a chime and a bell entry (each optional).

### Notification bell
The bell in the top bar lists unlocks, goals, timer events, reminders, drift notices, AI messages and system notes, with an unread count. **Settings, Notifications** sets how many entries are kept, whether the bell shows an unread number, whether achievements are announced and in which unlock style, how long cards stay, a soft chime, system notifications, and quiet hours. It can be hidden (Interface level).

### Zen view and the study room
- **Zen view** is the full-screen clock. Choose what it shows (goal, block label, visualizer, controls), sound mix and volume, and a settings drawer.
- **Study room (Library, Study room, and Settings, Study room):** play **your own study-with-me style video** behind the Zen clock **instead of the sound** or together with it. Add scenes as a **YouTube link**, a **direct video link** or a **video file that stays on your device**. Settings: scene, sound (replace or mix), video volume, darken, blur, picture fit, clock (big, small or hidden), follow the timer (free, while the timer runs, focus blocks only), what happens when a scene ends (loop one, loop all, shuffle, stop), start when Zen opens, show the scene name.
- Only watch videos you have the right to watch. YouTube owners can disable embedding; the player then offers "Watch on YouTube".

### Calm and scenes
A leaf button opens breathing guides (box, 4-7-8, coherent, relax, your own), a 5-4-3-2-1 grounding exercise, a sleep timer, and six quiet scenes (aurora, rain on glass, starfield, ripples, embers, mist) that can also act as a screensaver.

### The Focus page: the case for starting
The Focus page opens with **ethos, logos and pathos**, three honest reasons to start: why you can trust the techniques (what the evidence does and does not show), why it makes sense (logic, your own numbers), and why it matters to you (your own sentence, your exam countdown). A **daily Socratic question** asks something like "What usually pulls you away, and what will you do instead?" You can use your answer as the block goal, or as the goal and start the timer. Nothing is mandatory.

### Neural lock (optional, off by default)
A card on **Studio** and on **Focus** (it used to be hidden in the Focus menu). It adds a very soft rhythm under your sound at a chosen rate, with presets and your own rate, plus a short honest note: the research on rhythmic sound and attention is mixed, small and not medical. Use headphones at a low volume, stop if it is uncomfortable, and do not use it if you have epilepsy or a similar condition without asking a doctor.

### Mini player and the desktop-wide puck
- **Floating mini player (web and desktop):** when you scroll down, a small player appears at the bottom-left (corner is a setting) with the timer and the sound.
- **Desktop-wide puck (desktop):** the same controls in a small always-on-top window over **any app**, so skip and pause are always one click away. In **Settings, Mini player and puck** choose when it shows (never, only after scrolling, always; on the desktop: never, when the app is away, while the timer runs, always), the **content** (title, clock, mode, subject, goal, ring, daily goal, to-dos), the **buttons** (start or pause, skip, sound, next variation, I drifted, reset, finish, volume, Zen, open the app) and what clicking the label does, plus corner, size, opacity, hiding when idle and the drag grip.

### Monitors, window and snap (desktop)
- **Window and updates:** close to tray, start hidden, remember position, always on top, open at sign-in, glass effect.
- **Real monitor names** (model, size and position) instead of "main" and "secondary". "Identify" flashes the number on each screen.
- **Move to monitor** works from the tray, the settings and the commands.
- **Monitor rules:** "keep the app on one screen", or when a screen connects or leaves: move the window there and optionally open Zen, collapse it, or run a command. Example: when your laptop's second display connects, move the app there and open Zen. Rules also run at start-up when the screen is already connected.
- **Snap layouts:** the grid button in the title bar (and in Settings) offers 12 layouts: halves, quarters, thirds and centred. They work on the monitor the window is on, with custom or system window buttons, and as commands (`window.snap:left`).

### Automations
**Settings, Automations:** when something happens, do something. 20 triggers (a block starts or ends, a break starts or ends, a session is saved, the daily goal is reached, a block goal is met or missed, days until your exams, a time of day, you mark a distraction, sound starts or stops, Zen opens or closes, the app opens, you unlock an achievement, drift is detected), and the same steps macros use (load a mix, volume, sound, timer, Zen, window moves, wait). Up to 30 rules, a loop guard (a rule cannot trigger itself within 1.5 s), a limit of 30 runs a minute, templates, a test button and a log. Examples: "when a focus block ends, pause the sound", "at 22:00 start the sleep timer", "when drift is detected, mark a distraction".

### Drift detection (desktop)
Settings, Drift detection. Three layers, each optional:
1. **Hard-coded, no AI (like parental controls).** Lists of apps, websites and title words, with categories (social media, video, games, shopping, news, chat) and "Try an app / website / title" boxes to test them. A 20 second grace period and a 3 minute cooldown. Choose what happens: a message, a bell entry, a system notification, count it as a distraction, a soft sound, pause the timer, pause the sound. Optionally only during a focus block. It reads the front window's application and title (Windows). Nothing is sent anywhere.
2. **Browser helper (optional extension).** Brave, Chrome, Edge or any Chromium browser. The app runs a tiny server on `127.0.0.1` only. Install: turn on the browser helper in Settings, Drift detection, press the folder button, open `brave://extensions` (Chrome `chrome://extensions`, Edge `edge://extensions`), switch on **Developer mode**, **Load unpacked** and choose the folder, then open the extension's options, paste the **pairing code** and press **Save and test**. Private windows are never reported; you can also report only the website, not the page title.
3. **AI second opinion (optional, off by default).** With your own key, a site or app that is on none of your lists is shown to your AI, which says whether it looks like a distraction. Answers are cached.

### Auto-pause and Discord (desktop)
- **Auto-pause** (off by default): pause or lower the sound when another app uses the microphone, recording software is open, or another app plays media. Delay, resume, lowered level, ignore list.
- **Discord status** (off by default): shows the mix, a timer and optionally your task on your Discord profile. The app ships its own Discord application, so there is nothing to set up; you can use your own Application ID under Advanced.

### Shortcuts, macros, voice, Stream Deck (desktop)
- **Global shortcuts** use Ctrl + Alt + Shift by default (Cmd + Option + Shift on a Mac): +Space play or pause, +P start sound, +S stop, +N next, +Up and +Down volume, +T timer, +D drift, +Z Zen, +H show or hide, +M collapse, +G turn shortcuts on or off. All can be changed in Settings, Keys. The app refuses combinations that browsers or the system use (for example Ctrl+C, Alt+Tab, Ctrl+Shift+T) and says when another app already owns one.
- **Flow voice assistant:** hold **Right Ctrl**, speak, let go. Double-tap for hands-free. Everyday sentences are understood on your computer, free and offline; unclear ones can use a service (your own key, or the free dictation helper). Off by default. Appendix D covers the helper.
- **What you can say (the full list is in Settings, Flow voice and AI):** "Flow, pause my music" (Spotify, a video or a podcast in another app; desktop), "resume my music", "next song", "what is playing", "computer volume down"; "study for 45 minutes", "start a 25 minute focus session on optics", "set a timer for 10 minutes", "take a break", "back to work", "how much time is left", "I am done"; "set my goal to...", "add a to-do...", "tick off...", "remind me to review..."; "how long did I study today", "what is my streak", "when is my exam", "what time is it"; "open progress", "dark mode". "Pause the sound" means this app's own sound; "pause my music" means other apps, and Flow skips its own media session when it looks. With **Understand free sentences** on, the Windows recognizer also writes down sentences that are not in its list; in hands-free voice mode they need the wake word.
- **Voice mode** (English and German, Windows offline recognition) and **macros** (up to 30 macros of 20 steps) live in Settings, Voice and macros; "Run checks" and "Test microphone" explain problems.
- **Stream Deck and other controllers:** hotkeys, `--cmd=` and `study-with-sarang://` links (Appendix G).
- **Command palette:** Ctrl+K searches every action, page, mix and setting.

### Calendar
Settings, Calendar. Study sessions appear in Google Calendar, Apple Calendar or Outlook through a **private link** that belongs to your account, and the calendar is updated after each session. Setup is in Appendix C. Without a server you can still download an `.ics` file. What each event shows (title, goal, task, distractions and sound, exam date, busy or free) is your choice.

### Appearance, icons and interface level
- **App icon:** eight icons (Waves, Dot, Ring, Voice, Night, Leaf, Timer, Paper). The choice changes the in-app logo, window, taskbar and tray icon, notifications, media controls and the Start menu and desktop shortcuts. The icon of the `.exe` file in Explorer is fixed at build time and cannot change while the app runs; pinned taskbar shortcuts may need unpinning and pinning again.
- **Layout:** New (Studio, Library, Progress, Focus) or Classic (the original long page). **Theme**, scrollbar, window buttons.
- **What is shown:** Essentials (default) or everything, in Settings, Advanced. With everything on, the older interface levels (Simple, Standard, Power, Custom with 26 switches) are available there too, and the leaf button flips Simple on and off. Nothing is deleted when you hide it.

## 7. AI: free options, setup and the assistant

Every AI feature in the app works with **your own key**, which stays on your device (it is not synced, exported or shown to the assistant). Nothing is sent until you add a key and use a feature. The one exception is a small free allowance for **dictation only**: 5 voice requests a day through the shared helper (Appendix D). Chat, the assistant, drift AI and voice replies always need your own key.

### The setup walkthrough
It opens from the welcome tour, from **Settings, About, Open the AI walkthrough** and from Settings, Flow voice and AI. It shows the free options with an honest note on limits, opens the provider's key page, lets you paste the key, find the models available to you, press **Test**, and finish. You can re-run it whenever you like to add or change a provider.

### Free and low-cost options (check each provider's page: limits and model names change)
| Provider | What it gives | Get a key |
| --- | --- | --- |
| **Groq** | A free plan with several open models and fast Whisper speech to text. Rate limited. Email sign-up. | console.groq.com/keys |
| **Google Gemini (AI Studio)** | A free tier for the Flash models, no card. Free-tier prompts may be used to improve Google products outside the EU, UK and EEA. | aistudio.google.com/apikey |
| **OpenRouter** | Models whose name ends in `:free`, a few requests a minute and a small daily number (more after a one-time top-up). The free roster changes often. | openrouter.ai/keys |
| **Mistral** | A free "Experiment" plan with a phone check. Data may be used for training on that plan. | console.mistral.ai |
| **GitHub Models** | Free for prototyping with a GitHub account and a token that has the Models permission. | github.com/marketplace/models |
| **Ollama or LM Studio** | Free, private, runs on your own computer, no key. Pick "Custom address" and use `http://localhost:11434/v1` (Ollama). The web edition may need `OLLAMA_ORIGINS` set to the site. | ollama.com |
| OpenAI, Anthropic, any OpenAI-style address | Paid. Works the same way. | their dashboards |

Cerebras and other providers change their free plans without notice, so they are not offered as "free". Model names are editable because vendors rename and retire models; use the model list button and the **Test** button.

### The assistant (agent)
The sparkle button in the top bar (and Settings, Assistant) opens a chat. With your key, it can use **21 tools** to do what you can do: read the app state and the list of options, change any preference (interface level, puck, notifications, study room, drift, neural lock and so on), set the plan, goal and to-dos, add or remove subjects and set the exam session, create, enable or delete automations and macros, and run any command (sound, mixes, timer, Zen, windows, snap, monitors). Examples: "set me up for IB DP1 with Physics HL, Maths AA HL and English, May session", "turn on the neural lock card and make the interface Simple", "when a block ends, pause the sound".

Safety rules (not changeable by the assistant): it **cannot read or change keys, tokens, addresses or cloud settings**, it **cannot quit the app**, and everything it does is listed in a log. **Confirm before each change** is a switch (off by default); you can also turn off whole groups of tools. A daily request limit protects your own quota (default 200).

### Flow voice and AI settings
**Settings, Flow voice and AI:** keys, chosen provider for chat, speech to text and voice replies, models, daily limit, what Flow does when unsure (Ask me, Use the service, Never), and the free dictation helper.

**Voice replies.** Choose **System voice** (pick any installed Windows or macOS voice), **OpenAI** (`gpt-4o-mini-tts`), **Groq** (Orpheus, English only, voices autumn, diana, hannah, austin, daniel, troy) or **Gemini** (30 voices, many languages including German, free tier). A key is needed for the services; the settings say so instead of quietly using the system voice. "Hear a sample" tells you exactly what happened. For German text with an English only service the app uses the system voice on purpose. Models are preview versions and their names change: use the provider page if a model stops working.

## 8. Optional online services

Everything works with no account and no server. These services are optional, and each can point at **your own** Supabase project (Appendix E).

| Service | What it does | Where to set up |
| --- | --- | --- |
| **Cloud sync** | Syncs mixes, time log, subjects, to-dos and settings between devices. Built in: the app already points at the Study with Sarang project. | Settings, Cloud sync; Appendix A |
| **Sign-up emails** | Branded confirmation emails and custom SMTP. | Appendix B |
| **Calendar link** | Your study sessions in your calendar. One table and one function. | Appendix C |
| **Flow Cloud** | Free dictation (5 a day each). One table, one function and a Groq key. | Appendix D |
| **Sound recordings** | Host real recordings. | Appendix F |

Never put a secret or service-role key in the app. The publishable key is public by design.

## 9. Customise everything

- **Settings** (gear, Ctrl+,) has a tab for each area: Appearance, Interface level, Sound, Feedback and Zen, Subjects and exams, Study room, Mini player and puck, Automations, Drift detection, Calendar, Notifications, Timer, Flow voice and AI, Assistant, Calm and scenes, Keys, Auto-pause, Discord, Window and updates, Voice and macros, Cloud sync, Your data, About.
- **Export and import settings** in Your data; reset display settings.
- **Everything the assistant can change, you can change by hand**, and the other way round.
- Nothing is forced: the tour is skippable, achievements and sounds can be silent, every card can be hidden, every integration is off until you switch it on.

## 10. Updates and publishing

The installed Windows app can update itself from GitHub Releases (Appendix H): set `swaUpdate.repo` in `package.json` before building, then for every release raise `version`, build, make the checksum and attach the exe and `.sha256` to a GitHub release tagged `vX.Y.Z`. The updater only accepts GitHub hosts, needs a published SHA-256, checks the file before it runs, and restores the old version if an update fails. The update installer does **not** open the app by itself; it waits for you to press Open.

## 11. Build and run the source

Needs Node 20 or newer.

```bash
npm ci                 # installs exactly what package-lock.json says
npm run dev            # the page alone in a browser (http://localhost:5173)
npm run build          # type check and build into dist/
npm run desktop        # run the built app in Electron (run npm run build first)
npm test               # unit tests, no display needed
npm run test:ui        # drives the real app (needs a display; on Linux it uses xvfb-run)
npm run dist:win       # writes release/Study-with-Sarang-<version>.exe
node scripts/checksum.cjs release   # writes the .sha256 next to it
```

- High compression needs about 2 GB of free memory. If the build stops with "Can't allocate required memory", add swap (Linux: `sudo fallocate -l 3G /var/swapfile && sudo chmod 600 /var/swapfile && sudo mkswap /var/swapfile && sudo swapon /var/swapfile`).
- The first build downloads the Electron runtime. `scripts/after-pack.cjs` writes the icon and version info into the exe, so Wine is not needed.
- `npm run dist:mac` must run on a Mac; `npm run dist:store` on Windows (Appendix I).
- The icon files come from `scripts/make-icons.cjs` (run under a display: `xvfb-run -a npx electron --no-sandbox scripts/make-icons.cjs`).
- The tour is off in automated tests with `SWA_NO_TOUR=1`.
- Web edition: `npm run build` produces a static folder with relative paths that works at a domain root or sub-folder. On GitHub Pages, push `dist/` to `gh-pages`; on Netlify or Cloudflare Pages use `npm run build` and publish `dist`.

Where things are: `src/App.tsx` (pages), `src/components/SettingsPanel.tsx` (tabs), `src/lib/prefs.ts` (choices that live in the page), `src/lib/uiLevel.ts` (feature switches), `electron/app.cjs` (main process wiring), `electron/commands.cjs` and `src/lib/commands.ts` (every command), `src/lib/agentTools.ts` (assistant tools), `supabase/` (SQL and functions). A new setting must be added to the sanitizer in `prefs.ts` (and `electron/settings.cjs` if the main process needs it) or it is dropped.

## 12. Troubleshooting

| Problem | What to do |
| --- | --- |
| Windows says "Unknown publisher" or SmartScreen blocks the file | More info, Run anyway. Appendix I explains permanent fixes. |
| The icon did not change in the Start menu or taskbar | Windows caches icons. Unpin and pin again, or sign out and in. The `.exe` file icon in Explorer cannot change at run time. |
| The tour does not appear | It shows once. Settings, About, Show the welcome tour again. |
| The app opened after I installed | Fixed in this version: setup waits for you. If you pressed Open Study with Sarang on the last page, that is the cause. |
| Media keys do nothing, or control the wrong app | They go to the app that played most recently. Press play in the app you want, then use the key. Settings, Keys. |
| "Flow, pause my music" says no other player is playing | Windows lists only apps that report to the system media controls (Spotify, Chrome, Edge, most video sites). Start something playing, then try again. A browser edition cannot reach other apps at all. |
| No desktop notification appears | Settings, Notifications, Send a test notification. If it says the shortcut is missing, run the installer once (it creates the Start menu shortcut Windows needs). Also check Windows, Focus assist and Notifications for this app. |
| Replies are spoken in the system voice | Settings, Flow voice and AI, Voice replies: pick a service, add its key and press Hear a sample. A red warning explains any failure. |
| The app looks bare | That is Essentials. Settings, Advanced, Show everything brings back every feature. |
| Voice mode does not react | Settings, Voice and macros, Run checks, then Test microphone. The level bar must move when you speak. |
| Flow key (Right Ctrl) does nothing | Turn on Flow in Settings, Flow voice and AI. Needs a microphone; the hold gesture is Windows only. |
| AI says "no key" or "limit" | Run the AI walkthrough; check the key, the model name (use the model list) and the daily limit. Free plans have their own limits; wait or change provider. |
| Free dictation says it is unavailable | The shared helper is deployed by the app owner (Appendix D). Use your own key meanwhile. |
| The assistant refused something | It cannot touch keys, tokens or cloud settings and cannot quit the app. Do those by hand. |
| Drift detection never triggers | Check Settings, Drift detection is on, you are in a focus block if "only during focus" is on, and use "Try an app / website" to test the lists. The window watcher is Windows only. |
| Browser helper says "Waiting for the browser extension" | Paste the pairing code in the extension options and press Save and test. Private windows are never reported. |
| The calendar link shows nothing | Sign in, deploy the calendar SQL and function (Appendix C), save a session, and give your calendar app time to refresh (Google can take hours). |
| Puck not visible over other apps | Settings, Mini player and puck, set the desktop mode to "always" or "while the timer runs". It needs the desktop app. |
| The app is on the wrong monitor | Settings, Window and updates, Monitor rules; check the rule is on and "also at start-up" is ticked. |
| Snap does nothing | Use the grid button in the title bar or Settings. Windows' own snap flyout exists only with System window buttons on Windows 11. |
| Confirmation email link goes to localhost:3000 | Set Site URL and Redirect URLs in Supabase (Appendix B) or use the code from the email. |
| Discord shows nothing | Open the Discord app on the same PC first (not the browser) and check "Share my activity". |
| Auto-pause does nothing | It is off until switched on. The status line lists what it sees. |
| The YouTube player says an error | Some owners disable embedding. Use the Watch on YouTube link. |
| Build: "Can't allocate required memory" | Add swap (chapter 11). |
| Everything looks reset after reinstall | Data lives in `%APPDATA%\Study with Sarang`; the uninstaller only deletes it if you tick the box. |

## 13. Privacy and your data

- Everything stays on the device unless you switch something on: sync (your data goes to the Supabase project), calendar link (the calendar text goes to the project), an AI feature (the text or audio for that request goes to the provider you chose), drift AI (only the app or site name, never page contents), Discord (what you choose to show goes to Discord on your PC).
- Keys, the drift token and pairing code are stored only on the device; they are not synced, exported or visible to the assistant.
- The browser helper talks to `127.0.0.1` only, with a private token, and never reports private windows.
- Study room video files are stored in the browser storage of the app and never uploaded.
- A free-tier provider may use your prompts to improve its products (Gemini outside the EU, Mistral Experiment). Choose a different provider or a local model if that matters to you.
- Export settings and your data in Settings, Your data. Uninstall asks before deleting data.

## 14. What was and was not tested

**Tested in the build environment (Linux, virtual display, local mocks):** every unit test (`npm test`), the real Electron app driven through its windows (Essentials, session start and wrap-up, break ideas, Flow commands sent as the shell sends them, settings, layouts, tour, subjects, statistics, achievements, bell, study room, puck, monitors and snap with fake displays, automations, drift with simulated reports, calendar against a local mock, AI provider flow and agent against a local mock server, neural lock, setup and uninstall windows, updates against a local GitHub mock, sync against a local Supabase mock).

**New in this version and not testable here (real Windows needed):** desktop notifications through the Start menu shortcut, pausing other apps through the system media controls, the free-sentence recognizer, computer volume keys, and the Groq and Gemini voices (live services, preview model names).

**Not tested on real hardware or with real services, so please check on your PC:** the exe on real Windows 10 and 11 and SmartScreen; Windows icon and shortcut updates; the Right Ctrl hold; the microphone and speech recognition; the media flyout; YouTube inside the study room; the puck over other apps on Windows; the snap and monitor hot-plug on real displays; the foreground-window watcher and the browser extension in a real Brave or Chrome; a deployed calendar feed (Google's refresh time included); a deployed Flow Cloud; real provider keys, model names, free-tier limits and live tool calling; real Discord; real email delivery; real Freesound downloads; macOS and the Microsoft Store package; and whether the neural-lock rhythm sounds right and is comfortable (nobody could listen to it here).

## Appendices

The detailed service guides follow. Their text is the same as the files in `docs/`.

## Appendix A: Cloud sync with Supabase (optional)

The studio works with no account and keeps everything on the device. Cloud sync is for people who want the same saved mixes, time log and settings on more than one computer. It uses a Supabase project. The app comes with one already set up (`src/lib/cloudDefaults.ts` holds its public URL and publishable key), and you can switch to your own under Advanced.

### What it does

- Syncs: saved mixes, the time log, minutes listened, the video playlist and the timer settings (the desktop edition also syncs macros).
- Does not sync: theme, the running timer, window and shortcut settings, voice mode, local video files.
- Merges three ways against the last sync, so edits and deletions on one device arrive on the others. If both devices edit the same item, the newer edit wins.
- Signed-in apps merge at start, a few seconds after a change, when the window regains focus and every five minutes. Newer data that arrives while the app is open is applied after a reload (the app asks), so the page never overwrites it with stale state.
- Advanced: replace this device with the cloud copy, replace the cloud copy with this device, delete the cloud copy.

### Using the built-in project

Nothing to do in the app: open Settings, Cloud sync, and sign in or create an account. Creating an account asks for a 6 digit code that is emailed to you. The project owner needs to do the one-time dashboard steps in `docs/EMAIL_SETUP.md` (Site URL, redirect addresses, branded emails, SMTP).

### Set up your own project (about two minutes)

1. Create a project at supabase.com.
2. SQL Editor, New query, paste `supabase/schema.sql`, Run. It creates one table, `study_sync`, with Row Level Security: each user can only read and change their own row.
3. Project Settings, API: copy the **Project URL** and the **anon / publishable key**. In the app open Settings, Cloud sync, Advanced, Use a different Supabase project, and paste both. Or set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env` file before building.
4. Authentication, Providers: keep Email enabled. With "Confirm email" on (recommended) the app asks for the emailed code, and the sign-up email must contain `{{ .Token }}` (the templates in `supabase/email-templates/` do). For the **Email code** option the Magic Link template needs it too.
5. Follow `docs/EMAIL_SETUP.md` for Site URL, redirects and sending real mail.

### Keys

The app never ships or accepts a secret. It refuses the service-role key and `sb_secret_` keys when you paste them. The anon key is public by design; Row Level Security is what protects the data. Sessions are stored in the app's local storage like any web app's.

### Tests

`node scripts/test-cloud.mjs` runs the merge rules and the whole client (sign up with a confirmation code, email links, sign in, email code, token refresh, two devices, deletions, concurrent writers, account isolation, errors) against a small mock of Supabase's Auth and REST endpoints. `scripts/test-features.cjs` drives the real window against the same mock. Neither talks to a real Supabase project, so run through the steps above once with your own project before relying on it.

## Appendix B: Sign-up emails: branded, working links, and reaching the inbox

Everything here is done in the Supabase dashboard or with the scripts in this project. The app code cannot change dashboard settings, and nobody can promise an inbox: Gmail and others decide per message. What you can do is remove every reason for them to say no.

Project reference: `fykzmhxvhdrxvqkkhlnd` (the built-in project).

### 1. Why the confirmation link went to localhost:3000

Supabase builds the link from **Site URL** (default `http://localhost:3000`) unless the app passes a `redirect_to` address that is on the **Redirect URLs** allow list. The web app now passes its own address, but Supabase only honors it when it is on the list, and otherwise falls back to Site URL.

1. Dashboard, **Authentication, URL Configuration**.
2. **Site URL**: the address where the web app is hosted, for example `https://yourname.github.io/study-with-sarang/`.
3. **Redirect URLs**: add the same address (with and without the trailing slash). Add `http://localhost:5173/*` if you test locally.
4. The desktop app has no web address. It asks for the 6 digit code from the email instead, so nothing opens in a browser. If you host the web app, you can also set `WEB_URL` in `src/lib/cloudDefaults.ts` so desktop sign-ups point their link at it.

What happens when the link is opened: the web app removes `#access_token=...` from the address bar immediately, asks Supabase to confirm the token is real, and signs in only if the address belongs to the account that was just created in that same browser. Opened anywhere else (a phone, another browser), it only shows "Email confirmed, now sign in". It never signs you in with a link it did not expect, which blocks a known attack where a stranger's link logs you into their account.

### 2. Branded emails

```bash
node scripts/build-email-templates.mjs            # (re)creates supabase/email-templates/*.html and subjects.json
node scripts/build-email-templates.mjs --check    # CI: fails when the files are out of date
```

Six templates are generated: confirmation, magic link (the Email code tab), recovery, email change, invite and reauthentication. They are plain table HTML with inline CSS (no images, no remote fonts, no tracking pixels), show the code in large type with a button underneath, and are short on purpose.

To install them either:

- **Dashboard (no tokens):** Authentication, Emails. For each template paste the matching file and set the subject from `subjects.json`.
- **Script:** create a personal access token at supabase.com/dashboard/account/tokens, then

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-email-templates.mjs --dry-run
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-email-templates.mjs --site-url https://your.site/app/ --redirect https://your.site/app/
```

It calls `PATCH /v1/projects/{ref}/config/auth` and changes only the subject, template and (if you pass them) Site URL and redirect fields. It does not touch anything else. The token is read from the environment and never stored. Reauthentication bodies are skipped unless you add `--include-reauthentication`. I could not run this against your project, so use `--dry-run` first and check the dashboard afterwards.

The password recovery email exists for completeness. The app has no "forgot password" screen yet; use the **Email code** tab to sign in if a password is lost.

### 3. Reaching the inbox (the part that matters most)

**Supabase's built-in sender is for testing.** It is heavily rate limited and, in current projects, only delivers to members of your Supabase team. Real users need your own SMTP provider.

1. **Use a domain you own** and a provider such as Resend, Brevo, Postmark or Amazon SES. In Supabase: Authentication, Emails, SMTP Settings, enable custom SMTP, enter the host, port, user and password from the provider.
2. **Sender:** an address on your domain, such as `hello@yourdomain.com`, sender name `Study with Sarang`. Not a free-mail address, not a `noreply@` on a domain you have not verified.
3. **Authenticate the domain.** The provider shows DNS records to add. All three must pass:
   - **SPF** (a TXT record naming the provider),
   - **DKIM** (a TXT or CNAME record with the provider's key),
   - **DMARC** (a TXT record on `_dmarc`, start with `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`, tighten later).
4. **Turn off link and open tracking** at the provider. Rewritten links look like phishing to filters and also break one-time links.
5. **Keep the message simple.** The templates have a clear subject, one short paragraph, a code and a button, no images and no marketing words. That is what filters like.
6. **Test before real users.** Send a sign-up to a Gmail address and open Show original: SPF, DKIM and DMARC should all say PASS. Send one to mail-tester.com for a score.
7. **No domain yet?** For a small private group you can use a Gmail or Google Workspace account as the SMTP server (`smtp.gmail.com`, port 465, an app password). It is limited to a few hundred messages a day, and recipients see a Gmail sender, but it lands in inboxes reliably. It is a stop-gap, not a product setup.

**Primary versus Updates versus Promotions.** Gmail files transactional mail (confirmations, codes) under Updates in many cases, however well it is sent, and that is Gmail's choice. Spam folder avoidance is something you can control with the steps above. Moving it to Primary is up to the recipient: drag one message to Primary once and answer "do this for future messages". The code in the subject (`Your Study with Sarang code: 123456`) also shows in notifications, so people see it even if the email sits in Updates.

**Rate limits.** Supabase limits auth emails per project and per address. If someone asks for several codes quickly the app says "Too many emails were requested. Wait a minute and try again."

### 4. A short checklist

- [ ] Site URL and Redirect URLs set
- [ ] Templates installed (confirmation and magic link at least), "Confirm email" left on
- [ ] Custom SMTP on your own domain, SPF, DKIM and DMARC passing
- [ ] Tracking off at the provider
- [ ] Sign-up test to Gmail and Outlook: arrives, code works in the desktop app, link works in the web app

## Appendix C: Your study sessions in your calendar (optional, one-time setup)

Settings, Calendar gives each signed-in person a **private calendar link**. Subscribe to it once in Google Calendar, Apple Calendar or Outlook and every saved study session shows up as an event, updated after each session. The link is random, one per account, and can be replaced at any time with "New link" (the old link stops working).

### Set it up (about 5 minutes, once, by the person who runs the Supabase project)

1. In Supabase, open **SQL editor**, paste `supabase/calendar.sql` and run it. It creates `calendar_feeds` (one row per user: the secret token and the calendar text) with Row Level Security.
2. Deploy the function that serves the link. Calendar apps cannot send headers, so a function hands out the text for one exact token:

   ```
   supabase functions deploy calendar-feed --no-verify-jwt
   ```

3. In the app, sign in (Settings, Cloud sync), open Settings, Calendar and switch on **Keep my private calendar link up to date**. Copy the link.

### Subscribe

- **Google Calendar:** Other calendars, plus, From URL, paste the link. (Google refreshes subscribed calendars every few hours, sometimes up to a day; that is Google's schedule.)
- **Apple Calendar:** File, New Calendar Subscription. **Outlook:** Add calendar, Subscribe from web.

### What each event contains (all optional)

Title, your goal for the block, the task name, distractions and sound, your exam date, and whether it shows as busy or free. Nothing else leaves the app. Anyone who has the link can read the calendar, so treat it like a password and use Reset link if it leaks.

### Without Supabase

Settings, Calendar can also download an `.ics` file of your sessions that you import by hand. It will not update by itself.

## Appendix D: Flow Cloud: the free shared dictation helper (optional, one-time setup)

Flow understands clear commands on your computer, for free. **Flow Cloud** is a small Supabase function that turns speech into text (Whisper on Groq) for people who have no AI key. **It covers dictation only.** Chat, the assistant, drift checks and every other AI feature use each person's own key (see the AI chapter of the master guide). The free allowance is **5 requests a day per device** (20 per network address) so the shared Groq key cannot run up a bill.

You do not need it. If you skip it, the "Flow Cloud" choice says it is not set up, and own keys work as usual.

### Set it up (about 10 minutes)

1. Create a free Groq key at https://console.groq.com/keys. It never goes into the app or the repository.
2. In Supabase, open **SQL editor**, paste `supabase/flow_cloud.sql` and run it. It creates a private counter table and an atomic function.
3. Install the Supabase CLI, log in, link your project, then deploy. The app sends the publishable key, which is not a JWT, so JWT verification must be off. The counters, not the JWT, protect the function:

   ```
   supabase secrets set GROQ_API_KEY=gsk_your_key_here
   supabase functions deploy flow-assist --no-verify-jwt
   ```

4. Done. The app finds it at `<your project url>/functions/v1/flow-assist`. To use another project, paste its address in **Settings, Flow voice and AI, Flow Cloud, Different address**.

### Limits (all optional secrets, with defaults)

| Secret | Default | Meaning |
| --- | --- | --- |
| `FLOW_PER_DEVICE` | 5 | Dictation requests per device per day (UTC). |
| `FLOW_PER_IP` | 20 | Per network address, so reinstalling does not reset the allowance. Addresses are salted and hashed. |
| `FLOW_GLOBAL_DAILY` | 500 | A ceiling for the whole service, so the bill and your Groq quota are bounded whatever happens. |
| `FLOW_SALT` | `flow` | Any random text. Used when hashing addresses. |
| `FLOW_STT_MODEL` | `whisper-large-v3-turbo` | Change when Groq renames the model. |

The function answers `403` to `?action=chat`: chat is deliberately not offered. The app also keeps its own count, only to show it to the person; the server is the real limit.

### Privacy

Audio is sent to the function only when Flow was unsure about a command (or you chose "Use the service"). The function forwards it to Groq and keeps nothing: only counters are stored, with a random device id and a hashed network address. Say so in your privacy text if you publish the app.

### Check it

```
curl -i -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/flow-assist?action=chat" \
  -H "content-type: application/json" -H "x-flow-device: 0123456789abcdef0123" -d '{}'
```

A `403` with "speech to text only" means the policy works. To test dictation, send a short audio file with `?action=transcribe` and `--data-binary @clip.webm` (a `200` with `text` means it works; `429` means the counters are doing their job; `503` means `GROQ_API_KEY` is missing).

## Appendix E: Using your own backend (optional, for the future)

Everything works with no backend at all. Three optional pieces can use a server, and each can point at **your own** Supabase project or web space instead of the built-in one. Nothing here needs a code change: it is configuration, so the same app can later move to your own infrastructure.

| Piece | What it does | Where it is configured | Setup guide |
| ----- | ------------ | ---------------------- | ----------- |
| Cloud sync | Syncs mixes, time log and settings between devices | Settings > Cloud sync > Advanced (or "Set up your own Supabase project") | `docs/SUPABASE.md`, `supabase/schema.sql` |
| Flow Cloud | A shared key-less dictation helper for Flow (5 requests a day each, speech to text only) | Settings, Flow voice and AI, Flow Cloud, Different address. By default it is `<Supabase project>/functions/v1/flow-assist`, so it follows the sync project. | `docs/FLOW_CLOUD.md`, `supabase/flow_cloud.sql`, `supabase/functions/flow-assist` |
| Sound recordings | Hosts the ten recordings so the app stays small | Settings > Sound > Real recordings > Cloud address | `docs/SOUNDS.md` |

### What a build can preset

`src/lib/cloudDefaults.ts` holds the public Supabase URL and publishable key (also settable with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time). Flow Cloud and the sound base address are derived from them, so one project is enough for all three. Never put a secret or service-role key into the app; the Groq key lives only as a secret of the edge function.

### A suggested plan

1. **Now:** nothing. Own Groq keys work for Flow, bundled or local files work for sounds, sync uses the built-in project.
2. **When you want key-less Flow:** run `supabase/flow_cloud.sql`, set `GROQ_API_KEY`, deploy `flow-assist` with `--no-verify-jwt`, set the secrets for limits. Watch your Groq usage; the global ceiling (`FLOW_GLOBAL_DAILY`) bounds the cost.
3. **When the app grows:** move sounds to a public Storage bucket, point the cloud address at it, and ship a smaller installer.
4. **Moving everything to a new project:** create it, run the three SQL files (`schema.sql`, `flow_cloud.sql`), deploy the function, upload the sounds, change `cloudDefaults.ts` (or the build variables), rebuild. People who set their own project in Settings are unaffected.

### Privacy notes to include if you publish

- Sync stores what the person syncs, under their account, protected by Row Level Security.
- Flow Cloud receives audio or text only when Flow was unsure and the person allowed it, forwards it to Groq, and stores only counters (random device id, hashed network address, count per day).
- Sound downloads from your bucket reveal an IP address to your host, like any file download.

## Appendix F: Real recordings for the ambience sounds (setup guide)

Ten of the sounds can be real recordings instead of generated ones: **rain, thunder, waves, wind, fire, birds, crickets, coffee shop, singing bowl, white noise**. Until a recording exists for one of them, the generated sound keeps playing, so nothing is ever silent and nothing breaks if a file is missing.

Where a recording can come from, in the order the app looks:

| # | Source | Who it is for |
| - | ------ | ------------- |
| 1 | **Your own file**, chosen in Settings > Sound > Real recordings (stored in this browser or on this computer) | Anyone, instantly, no setup |
| 2 | **The sounds folder** (desktop only): Settings > Sound > Open the sounds folder, then drop `rain.mp3` and so on in | Desktop users who like files |
| 3 | **Bundled**: files in `public/sounds/` when the app is built | You, as the publisher: everyone gets them offline |
| 4 | **Cloud**: any web folder (Supabase Storage, GitHub Pages, any CDN), downloaded once and kept | You, if you do not want a 30 MB larger app |
| 5 | The generated sound | Always the fallback |

Settings > Sound > Real recordings shows which source each sound uses right now and lets people check, replace or remove each one.

### File names

`rain`, `thunder`, `waves`, `wind`, `fire`, `birds`, `crickets`, `coffee-shop`, `singing-bowl`, `white-noise` plus one of `.mp3 .ogg .wav .flac .m4a .aac .opus .webm`.

### Good recordings

- **1 to 5 minutes** each. The app blends the end into the start (Loop blend, 3 s by default), so the loop has no click, but a longer file repeats less obviously.
- Steady, no sudden bangs, no speech you can follow, no music. Thunder and birds can have events; just avoid one very loud crack.
- MP3 at 128 to 192 kbps is plenty. About 1 MB per minute.
- Memory: a decoded minute is about 10 MB in mono and 20 MB in stereo. The app keeps the five most recently used recordings in memory and decodes the rest on demand (Settings lets you change this).

### The quick way: download from freesound.org

1. Create a free Freesound account and request an API key at https://freesound.org/apiv2/apply (choose "Token" for the type of key).
2. In the project folder:

   ```
   # Windows PowerShell
   $env:FREESOUND_TOKEN = "your-key"
   npm run sounds:list        # shows the best candidates for each sound, with licence and rating
   npm run sounds:fetch       # downloads the top pick for every sound that has no file yet
   npm run sounds:fetch -- rain=123456     # use a specific Freesound sound id for a slot
   npm run sounds:fetch -- --license cc0   # only CC0 (no credit needed)
   npm run sounds:fetch -- --slots rain,thunder --force
   ```

   macOS and Linux: `FREESOUND_TOKEN=your-key npm run sounds:fetch`.
3. The files land in `public/sounds/`. The author, title, licence and link of each go to `public/sounds/credits.json`, and a `manifest.json` is generated. The app shows these credits in Settings > About and Settings > Sound.
4. Build as usual (`npm run build` regenerates the manifest first). Or just run `npm run dev`.

What the script does and does not do:

- It uses the Freesound API with your token and only picks sounds under **CC0** or **CC BY** (no non-commercial ones), 60 to 600 seconds long, sorted by number of ratings. Use `--list` and pick by hand if you disagree with a choice.
- It downloads Freesound's high-quality MP3 preview (about 128 kbps), which a token may fetch directly. Original-quality downloads need a sign-in (OAuth2), which this tool deliberately does not do. You can always download an original in the browser and put it in `public/sounds/` yourself; run `npm run sounds` afterwards to refresh the manifest.
- Your token is read from the environment and never written anywhere.

### Licences, briefly

- **CC0**: no credit required.
- **CC BY**: you must credit the author. The app does that for bundled and cloud files through `credits.json` (see Settings > About). Keep the file when you publish.
- **CC BY-NC** and **Sampling+**: not for a published app that might be used commercially; the script avoids them.
- Always check the licence on the sound's own page. Authors can change it, and this guide is not legal advice.

### Option 3, bundled: details

Put the files and `credits.json` in `public/sounds/`. `credits.json` looks like this (written for you by the fetch script):

```json
{ "rain": { "title": "Rain on a tin roof", "author": "someone", "license": "CC BY 4.0", "url": "https://freesound.org/s/123456/", "freesoundId": 123456, "seconds": 190 } }
```

`npm run sounds` turns the files plus credits into `public/sounds/manifest.json`. It runs before every build by itself (`prebuild`). The app downloads nothing at run time for bundled files; the desktop app serves them from inside the installed program.

Size: ten 3 minute MP3s are about 30 MB. If that is too much for the web app, use option 4 instead, or keep recordings out of the web build and ship them only in the desktop one.

### Option 4, cloud: details

Any https folder that contains the ten files (and optionally a `manifest.json` for credits) works. With Supabase:

1. Storage > New bucket > name `sounds` > **Public bucket**.
2. Upload the ten files. Optionally upload `manifest.json` (from `public/sounds/`).
3. In the app: Settings > Sound > Real recordings > Cloud address > "Use my Supabase storage (bucket called sounds)" (fills in `<project url>/storage/v1/object/public/sounds`).

Each file is downloaded once on first use and kept on the device (the browser's cache or the desktop app's cache), so it works offline afterwards. Cross-origin hosts must allow it (Supabase public buckets do).

### If something does not play

Open Settings > Sound > Real recordings and press **Check** next to the sound. It says what failed: file not found at the address, a format the browser cannot decode, or a file that is too short to loop. Nothing else is affected, because the generated sound takes over.

## Appendix G: Stream Deck and external keyboards

Three ways, from most to least reliable. The Settings panel in the app (Keys tab) builds the exact text for you (pick an action, press Copy).

### 1. Hotkey action (works with any programmable keyboard too)

In the Stream Deck software add **Hotkey** and press the combination from the Global shortcuts list, for example Ctrl + Alt + Shift + Space for play or pause. If your keyboard or Stream Deck can send F13 to F24, those keys never clash with anything, so you can assign F13 to the app's shortcut and send F13 from the button. Change a shortcut in Settings, Keys, by clicking it and pressing the new keys.

### 2. Open action with a shortcut file

Stream Deck's Open action starts a file. To pass a command, make a Windows shortcut:

1. Right-click the desktop, **New, Shortcut**.
2. Target: `"C:\Users\YOU\AppData\Local\Programs\Study with Sarang\Study with Sarang.exe" --cmd=sound.toggle`
3. Point the Stream Deck Open action at that shortcut.

If the app is running the command arrives at once. If it is not, the app starts quietly in the tray and runs the command, without opening a window.

### 3. Link

`study-with-sarang://cmd/sound.toggle`, `study-with-sarang://cmd/volume.set/40`, `study-with-sarang://cmd/mix.load/Flow%20and%20rain`. Works from a Website action or any tool that opens a URL. Windows or the browser asks once whether to allow it. Links cannot quit the app or change the sign-in setting.

### Commands

| Group | Commands |
| --- | --- |
| Sound | `sound.toggle`, `sound.play`, `sound.pause`, `sound.next` |
| Volume | `volume.up`, `volume.down`, `volume.set:0-100` |
| Timer | `timer.toggle`, `timer.start`, `timer.pause`, `timer.reset`, `timer.skip`, `timer.drift` |
| View | `zen.toggle`, `fullscreen.toggle` |
| Mixes and macros | `mix.load:<name>`, `macro.run:<name>` |
| Window | `window.show`, `window.hide`, `window.toggle`, `window.compact`, `window.compact:toggle`, `window.expand`, `window.pin:on/off`, `window.moveto:<number>` |
| App | `shortcuts.toggle`, `shortcuts.enable`, `shortcuts.disable`, `app.quit` and `app.login:on/off` (command line only) |

Stream Deck hardware was not available for testing here. The command line, link and hotkey paths were tested with real processes and real key presses.

## Appendix H: Updates

The installed app can update itself from **GitHub Releases**, and keeps the animated setup you already know.

### What the person sees

1. A few seconds after start (and every six hours while it runs) the app asks GitHub for the latest release. Turn this off in Settings, Window and updates, Updates, "Check in the background". There is also a **Check now** button and a "Check for updates" item in the tray menu.
2. If the version is newer, a notification appears and a small window shows the release notes with **Update now**, **Later** and **Skip this version**. Nothing installs without a click.
3. **Update now** downloads the setup file, checks its SHA-256 against the one published with the release, and only then starts it. The app closes, the animated installer shows the progress, replaces the files and reopens the app.
4. Saved mixes, the time log and every setting stay (they live outside the install folder). Shortcuts that exist stay, and a desktop shortcut the person deleted is not brought back. The "open at sign-in" choice is kept as it is now.
5. If anything fails, the previous version is moved back and the installer says so. The old version is only set aside, never deleted, until the new one is fully in place.

Copies that were not installed with the setup (run once from the exe) and the macOS build can see that an update exists, but open the release page instead of replacing themselves. The Microsoft Store build is updated by the Store and has the card turned off.

### Publishing a release (you)

1. Put your repository in `package.json` as `"swaUpdate": { "repo": "owner/repository" }` before building (people can also type it in the app). The repository must be **public**, because the app does not carry a token.
2. Raise `version` in `package.json` (plain `x.y.z`).
3. Build: `npm run dist:win`, then `node scripts/checksum.cjs` (writes `release/Study-with-Sarang-x.y.z.exe.sha256`).
4. On GitHub create a release with the tag `vx.y.z` (same number, with a `v`). Write the release notes in the description; they are shown in the update window. Do not mark it as a draft or pre-release.
5. Attach exactly two files: `Study-with-Sarang-x.y.z.exe` and `Study-with-Sarang-x.y.z.exe.sha256`. (GitHub's own SHA-256 "digest" for the file is also accepted if the checksum file is missing.)

A release without a checksum is refused by the app.

### What this protects, and what it does not

- It rejects downloads that are damaged, cut short, not a Windows program, larger than expected or do not match the published SHA-256. It only talks to GitHub over https, and only follows redirects to GitHub's own file hosts.
- The checksum comes from the same release as the file, so it protects against a bad download, **not** against someone who gets into your GitHub account. That needs code signing with a certificate you control, and the app verifying the signature. The exe is now signed (see `docs/STORE_AND_SIGNING.md`), but the updater does not check that signature yet, so treat the checksum as damage protection only.
- The first build that contains the updater is 1.3.0. Anyone on an older version installs 1.3.0 by hand once, then updates themselves.

### Tests

- `node scripts/test-update.cjs` (part of `npm test`): version rules, GitHub address rules, release parsing, downloads and every refusal case, the updater's decisions, background checks and the rollback of a failed install, all against a local stand-in for GitHub.
- `xvfb-run -a node scripts/test-update-ui.cjs`: the real app finds an update, shows the window and hands over to the installer.
- `xvfb-run -a node scripts/test-setup-ui.cjs`: the installer in update mode (success, failure, bad folder).
- Not tested here: the real GitHub API, a real Windows replace of a running install, and how Windows reacts to the signed file.

## Appendix I: Microsoft Store, signing and macOS

### Microsoft Store (preferred distribution)

The Store signs the package for you, so there is no SmartScreen warning and updates are handled for you. It cannot be built on Linux, so this is a short job on your Windows PC.

1. Register a Microsoft Partner Center developer account (a one-time fee for individuals) and reserve the name **Study with Sarang**.
2. In Partner Center open **Product identity** and copy the *Package/Identity/Name* and *Package/Identity/Publisher* values.
3. Put them in `package.json` under `build.appx` (`identityName` and `publisher`, replacing the two REPLACE_WITH values).
4. `npm install`, then `npm run dist:store`. This creates `release/Study-with-Sarang-<version>.appx`. The tile images in `assets/appx` are already generated.
5. Upload the package in Partner Center and complete the listing. Describe the global shortcuts and the microphone use (voice mode) in the notes.

Things to check in a Store build (they could not be tried here):

- **Open at sign-in.** Packaged apps start at sign-in through a *startup task* declared in the package manifest. electron-builder does not add one by default, so the sign-in switch may do nothing in a Store build until the manifest includes it. Verify on the Store build and, if needed, add the extension through a custom appx manifest.
- **Setup window.** Store builds skip the custom setup, because the Store installs the app. The app detects the Store package and goes straight to the main window.
- **The `study-with-sarang://` link** needs the protocol declared in the manifest as well.
- Microsoft reviewers may ask why a background app registers global shortcuts. They do not log keys, and only the listed combinations are registered.

### Signing the downloadable exe

#### What this project does now

`scripts/sign-exe.cjs` signs the finished exe (SHA-256, with a timestamp when the timestamp server is reachable) using `osslsigncode`, or Windows' own `Set-AuthenticodeSignature` on a PC. It reads the certificate from `SWA_SIGN_PFX` and `SWA_SIGN_PASSWORD`, so no key lives in the source. Release order matters: build, **sign**, then `node scripts/checksum.cjs` (signing changes the file, so the checksum comes last).

```bash
bash scripts/make-signing-cert.sh signing          # once: creates a self-signed certificate (5 years)
SWA_SIGN_PFX=signing/study-with-sarang-signing.pfx SWA_SIGN_PASSWORD="$(cat signing/PASSWORD.txt)" node scripts/sign-exe.cjs release/Study-with-Sarang-1.7.0.exe
```

The default build keeps `win.signAndEditExecutable: false` on purpose: it lets the project build on Linux without wine, and the icon and version info are written by `scripts/after-pack.cjs`. Only the outer file you distribute is signed. The program unpacked from it at run time is not.

#### Be clear about what a self-signed certificate does

- It proves the file was not modified after signing, and gives it a fixed publisher name, `Study with Sarang`.
- Windows does **not** trust it. SmartScreen still treats the file as from an unknown publisher on a PC that has not seen it, and the signature shows as "not trusted" in the file's Properties.
- On your own PCs you can make Windows trust it: double-click `study-with-sarang-signing.cer`, Install Certificate, Local Machine, "Trusted Publishers" and "Trusted Root Certification Authorities". Only do this on machines you own. Never ask other people to install a root certificate for you.
- The public certificate for this build is `docs/study-with-sarang-signing.cer` (SHA-256 fingerprint `2A:3F:0E:1A:65:28:8B:7F:EC:26:30:63:D2:0B:B3:E3:73:B9:03:C2:E7:F6:D4:7E:E2:41:3C:DF:6D:74:31:4B`). It contains no secret.
- The 1.7.0 exe was signed on a build machine with no internet access, so it carries **no timestamp**. Such a signature stops validating when the certificate expires (2031-10-03). Sign again with network access (the script then adds a timestamp) when you rebuild.
- Keep the `.pfx` and its password private. Anyone who has them can sign a file as "Study with Sarang". They are not in the release ZIPs.

#### How to get rid of the warning for everyone

| Option | Cost and conditions | Result |
| --- | --- | --- |
| Microsoft Store | One-time developer fee, review by Microsoft | No SmartScreen warning at all; Microsoft signs the package. |
| Certificate from a public authority (OV), for example from a Certum, Sectigo or DigiCert reseller | About 100 to 300 USD a year, works worldwide, identity check | Publisher name shown. SmartScreen reputation still builds over weeks of clean downloads (EV no longer gives an instant pass). |
| Azure Artifact Signing (formerly Trusted Signing) | About 10 USD a month. Organizations in the EU, US, Canada and UK; individuals only in the US and Canada | Short-lived certificates, Microsoft-trusted. Reputation still builds. |
| SignPath Foundation | Free for open source projects that meet its rules | Trusted signature for a public repository. |

With a purchased or issued certificate, use the same two variables (`SWA_SIGN_PFX`, `SWA_SIGN_PASSWORD`) or sign with `signtool` and then run the checksum script. Hardware-token certificates (most OV and EV ones today) cannot be exported to a `.pfx`; sign on the PC where the token is plugged in with `signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 /a <exe>`.

### macOS

`npm run dist:mac` must run on a Mac and produces a universal DMG. It could not be built or run here, so it is untested. The code paths are written for it: inset traffic lights, the system vibrancy material, Cmd-based shortcuts, a standard app menu and the Dock behavior (the app keeps running in the menu bar when the window closes).

- **Liquid Glass.** Electron's own `vibrancy` option uses the system material. Apple's new Liquid Glass controls would need a native addon plus a macOS 26 SDK, which cannot be verified without a Mac running macOS 26, so it is not included and the app does not claim it. If you want to try it later, the title bar and the mini bar are the two places to start. Both are already their own components.
- **Signing and notarization** need an Apple Developer ID. Set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for electron-builder.
- Voice mode is Windows only for now.
- The default shortcuts use Cmd + Option + Shift. Closing the window keeps the app running in the menu bar, and clicking the Dock icon brings the window back.

### Android

Not part of this version. The web app inside this project is already responsive. A later Android app can wrap `dist/` with Capacitor and use a foreground service for audio, but global shortcuts and the tray do not exist there.
