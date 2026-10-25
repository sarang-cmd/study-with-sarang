# Plan: Study with Sarang 2.0 (desktop) and 1.8 (web)

How this file is used: every request gets a section here with numbered steps. A step is marked done only when its code is written, type-checked and tested. After each step I post a short update in the chat. Future requests are appended as new sections ("Request N") so nothing is lost.

Decisions from the questions (2026-10-06): one big release; cleanup moves and never deletes; all three drift layers; subscribe-link calendar plus .ics export; AI agent without confirmation prompts (a switch in Settings lets people turn confirmations back on); puck, monitors and automations all included.

Release names: desktop **2.0.0**, web **1.8.0**. Both get every feature a browser can do. Desktop-only (a web page cannot do these): global puck, monitor rules and snap, window-based drift detection, taskbar and tray icon, Windows shortcuts. State this honestly in the UI and the changelog.

## Request 2 (done, 2.0.0 / 1.8.0)

| # | Step | Where | Status |
| - | ---- | ----- | ------ |
| 0 | Plan, workspace cleanup into `Study-with-Sarang/{desktop,web,docs,releases}` and `Archive/` | files | done |
| 1 | App icon that really changes: settings, window, taskbar, tray, shortcuts, notifications, web favicon | desktop + web | done |
| 2 | Notification centre (bell, history, filters), unlock toasts and animations | both | done |
| 3 | Achievements: many more, harder, tiers, secret ones, unlock animation | both | done |
| 4 | Subjects and curricula (IB DP1/DP2 with session, GCSE, IGCSE, CBSE, custom), session goal and to-do per session | both | done |
| 5 | Statistics: per subject, per year heatmap with year picker, filters, many more charts | both | done |
| 6 | Zen study room: play a study-with-me video or loop instead of sound | both | done |
| 7 | Puck: desktop-wide floating window, customisable content and buttons, always able to skip and pause | desktop (in-page version for web) | done |
| 8 | Monitors: real names, rules, open Zen on monitor X, snap fix | desktop | done |
| 9 | Automations: when X then Y rules | both where possible | done |
| 10 | Drift detection: built-in lists, browser companion extension over localhost, optional AI check | desktop (+ extension) | done |
| 11 | Calendar: private subscribe feed per user, .ics export | both (feed needs sync account) | done |
| 12 | AI: provider free-options list, setup walkthrough (re-runnable), tool-calling agent, free-tier policy (Flow Cloud for dictation only, 5 a day) | both | done |
| 13 | First-run tutorial, setup no longer auto-opens the app, Focus page: ethos / logos / pathos and Socratic framing, neural locking surfaced | both | done |
| 14 | Docs: one master guide, full changelog from the beginning, README | docs | done |
| 15 | Tests in both chains, web mirror, build, sign, ZIP, clean releases folder | both | done |

## Request 3: calmer app, session rhythm, working voice (desktop 2.1.0 / web 1.9.0)

Decisions: Essentials is the default (one switch, Settings > Advanced, brings the full 2.0 feature set back; nothing is deleted); Discord stays exactly as it is; research sources: Dunlosky et al. on practice testing and spaced practice, Pomodoro 25/5 and 52/17, healthy break guidance (20-20-20, stretch, water, breathing, no scrolling).

| # | Step | Where | Status |
| - | ---- | ----- | ------ |
| R3-1 | Real desktop notifications: fix window-in-front check, test button that reports what Windows said | desktop (web uses browser notifications) | done |
| R3-2 | Essentials by default, Settings > Advanced / Experimental, header no longer overlaps | both | done |
| R3-3 | Session start (goal, subject, minutes, technique), wrap-up (goal met, focus rating, reviews at 1/3/7 days, what next), mindful break ideas | both | done |
| R3-4 | Voice fix: Groq Orpheus (PlayAI was retired), Gemini TTS, voice picker, honest errors instead of silent system voice | both | done (live services untested here) |
| R3-5 | Siri-like Flow: music in other apps, sessions, timers, goals, to-dos, questions, navigation, free sentences, assistant uses the same commands | desktop (browser: honest limits) | done (Windows parts untested here) |
| R3-6 | Docs, web mirror 1.9.0, tests in both chains, build, sign, ZIP, archive 2.0.0 / 1.8.0 | both | done |

## Request 4: the Sarang suite (GitHub, landing page, Sarang.md textbook and desktop app)

Decisions (from the questions asked): the GitHub token is used from the shell only and never written to a file; download links go on the Study with Sarang web app (top bar and Studio page) and on the Sarang.md top bar and Focus page; Sarang.md desktop is the same shell as Study with Sarang with the course inside plus a small focus timer and sound, and a link to Study with Sarang; Units 1 and 2 (32 topics) are rewritten as textbook lessons of 2,000 words or more each, with an IB-style question bank and mark schemes whose answers are checked by computer. Infrastructure first, then the textbook, then one final Sarang.md release that contains it.

| # | Step | Where | Status |
| - | ---- | ----- | ------ |
| R4-0 | Clean the workspace (old archives, old releases), look at the sarang.md repo | workspace | done |
| R4-1 | Study with Sarang 2.1.1 / 1.9.1: Download pill and card, footer links, updater repo, screenshots | both | done |
| R4-2 | Landing page, Pages workflow, CI, root README, SUITE.md, DEPLOYMENT_GUIDE.md | repo | done |
| R4-3 | Repo `sarang-cmd/study-with-sarang`: description, topics, push, release v2.1.1, Pages on | GitHub | done |
| R4-4 | Sarang.md: Download links, About, suite links, version 1.1.0 | web | done (web 1.1.0, pill, Focus card, Settings card) |
| R4-5 | Textbook Unit 1 Number and Algebra, 16 topics of 2,000+ words | Sarang.md | todo |
| R4-6 | Textbook Unit 2 Functions, 16 topics of 2,000+ words | Sarang.md | todo |
| R4-7 | Question bank for Units 1 and 2 with mark schemes, answers verified by computer | Sarang.md | todo |
| R4-8 | Sarang.md desktop app (own name, icon, id, installer, updater, timer and sound) | desktop | done (desktop 1.0.0, signed, updater tested) |
| R4-9 | Sarang.md README, screenshots, description, topics, push, release | GitHub | done (release v1.0.0, README, 17 topics, live on Vercel via main) |


## Request 6: Vercel only, one address, downloads, accounts, helper (desktop 2.2.0 / web 1.10.0, Sarang.md 1.1.0 / 1.2.0)

Decisions: two Vercel projects stay (`study-with-sarang`, `sarang.md`); `sarang-md.vercel.app/study-with-sarang/` shows Study; no GitHub for hosting, downloads or updates (the Helper also gets a GitHub Release copy); Speed Insights and Web Analytics stay; Supabase and env vars untouched; the textbook is published.

| Step | What | Where | Status |
| --- | --- | --- | --- |
| R6-1 | Audit with the Vercel connector, report duplicates and inconsistencies | Vercel | done |
| R6-2 | One address: Study path on `sarang-md.vercel.app`, redirects, suite links | both | done and live |
| R6-3 | Download pages, feeds, checksums, in-app Get the app banner | `site/`, both apps | done, tested (`node site/test-site.mjs`) |
| R6-4 | Update check from the website feed, update popup (desktop and web) | both apps | done, tested |
| R6-5 | Setup says Study with Sarang (not Flow); Voice icon is the default | both apps | done |
| R6-6 | Focus studio banner "Sarang.md outside the browser"; no scrollbars in Sarang.md | Sarang.md | done |
| R6-7 | Forgot password, eight HTML email templates, invite user, Resend guide | both apps, `docs/EMAIL_AND_ACCOUNTS.md` | done, tested with a mock Supabase |
| R6-8 | Study cleaner UI, also in full mode | Study | done |
| R6-9 | Helper extension 1.1.0: new icon, real page, one-click pairing, guided install, shipped with each release | Study | done, tested without a real Chromium |
| R6-10 | GitHub workflows retired, docs and READMEs moved to Vercel links | repos | done |
| R6-11 | Release builds, deploy both sites, verify live URLs | Vercel | done (live 2026-10-25; bridge GitHub releases v2.2.0 and v1.1.0 for old installs) |

## Rules for every step

- Everything is optional and finely adjustable. Nothing new is on by default if it could surprise someone (notifications and tutorial are on for first run, with a clear off switch).
- No em dashes in new user-facing text.
- Keys never leave the device; no secret keys in source.
- Add tests with the feature. Run `tsc` after each edit.
- The Simple, Standard and Power interface levels decide what is visible; new features register in `useFeatures` so Simple stays calm.

## Future requests

Append "Request N" with its own table. Keep `docs/CHANGELOG.md` and `docs/MASTER_GUIDE.md` updated in the same step as the feature.

## Request 7: Units 4 and 5, more questions, Ask orb (Sarang.md web 1.3.0)

1. Write the 33 textbook chapters for Units 4 and 5 in the Units 1 to 3 format, each at least 2,000 prose words. Done: 211,392 words across all 83 chapters, checked by `scripts/count-textbook.mjs`.
2. Question bank. The outline quotes 3,981 questions, which cannot be reproduced. Scope chosen: two long-form, multi-part questions for each of the 33 new codes (66 questions, 482 marks) with M, A, R and AG mark schemes. Every stated number is recomputed by `npm run build:long`. Done.
3. Add the MorphOrb thinking orb as an "Ask" overlay in the Sarang.md top bar. Done; the answer step is local and hands off to the tutor.
4. Not done: redeploying Sarang.md to Vercel (needs the owner's Vercel token), a desktop rebuild with the new content, and long-form questions for Units 1 to 3.
