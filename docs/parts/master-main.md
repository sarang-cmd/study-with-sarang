# Study with Sarang: the master guide

Version {{V}} ({{DATE}}). This is the one long guide for Study with Sarang: installing it, using every feature, setting up every optional service, building it, publishing it, and fixing things. Use the contents list to jump. The appendices at the end contain the detailed service guides (Supabase, email, calendar, Flow Cloud, own backend, sounds, Stream Deck, updates, signing), so you never need another file.

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
Study-with-Sarang-{{V}}.exe        the app, installer and uninstaller in one file (Windows)
Study-with-Sarang-{{V}}.exe.sha256 its checksum (the updater verifies it too)
MASTER_GUIDE.md                    this file
README.md, CHANGELOG.md            overview and the full list of changes since the first version
electron/  src/  scripts/  assets/ the source code (main process, React app, tests, icons)
extension/                         the optional browser helper for drift detection
supabase/                          SQL and functions for sync, calendar and dictation
docs/                              the same detailed guides as the appendices, as separate files
package.json, package-lock.json    dependencies and build settings
```

The web edition ZIP has the same source without the Electron parts and the exe. `node_modules`, `dist` and `release` are rebuilt by the commands in chapter 11.

## 3. Install

### Windows

1. Double-click `Study-with-Sarang-{{V}}.exe`.
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
