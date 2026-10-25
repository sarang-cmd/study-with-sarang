## {{V}} (2026-10-16), calmer by default: Essentials, a session rhythm, a voice that works, Flow commands

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

