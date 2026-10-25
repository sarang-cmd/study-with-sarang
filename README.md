# Study with Sarang

[![Tests](https://github.com/sarang-cmd/study-with-sarang/actions/workflows/ci.yml/badge.svg)](https://github.com/sarang-cmd/study-with-sarang/actions/workflows/ci.yml)

A calm focus studio for students. Live ambient sound, a goal-first timer, mindful breaks, honest progress and, on Windows, a desktop app with real notifications, media keys and voice commands. Free, offline, no account, no tracking.

**[Landing page](https://sarang-cmd.github.io/study-with-sarang/) · [Open in your browser](https://sarang-cmd.github.io/study-with-sarang/app/) · [Download for Windows](https://github.com/sarang-cmd/study-with-sarang/releases/latest) · [Deployment guide](docs/DEPLOYMENT_GUIDE.md)**

![The Study with Sarang studio](landing/assets/studio-light.png)

## Download

| Edition | Where |
| --- | --- |
| **Windows 10/11 (64-bit)** | [Latest release](https://github.com/sarang-cmd/study-with-sarang/releases/latest): `Study-with-Sarang-<version>.exe` (one file, animated installer, no admin rights). Direct link that never changes: [`Study-with-Sarang-Windows.exe`](https://github.com/sarang-cmd/study-with-sarang/releases/latest/download/Study-with-Sarang-Windows.exe). |
| **Browser** | [sarang-cmd.github.io/study-with-sarang/app](https://sarang-cmd.github.io/study-with-sarang/app/), or host the web ZIP from the release anywhere static. |
| macOS, Linux, Android | Not available yet. macOS builds are possible from the same code but untested. |

The Windows exe is signed with a self-made certificate, so SmartScreen asks once (More info, then Run anyway). Compare the SHA-256 on the release page with `Get-FileHash .\Study-with-Sarang-*.exe`.

## What it does

- **Essentials by default.** Three pages, one timer, a few icons. Settings, Advanced, **Show everything** brings back every feature.
- **A rhythm for each session.** Start asks for a goal and minutes. The wrap-up asks if you reached it, how focused you felt and what next. Reviews are scheduled at 1, 3 and 7 days.
- **Mindful breaks.** One gentle idea at a time: look far away, stretch, water, breathing. No scrolling.
- **Sound made on your device.** 12 environments and 26 layers, generated live. No recordings, no brainwave claims.
- **Honest progress.** Weekly summary, year heatmap, streaks, goals and 91 achievements, stored on your device.
- **Flow, the voice assistant (desktop).** "Flow, pause my music." Hold a key and speak. Voice engines: system, OpenAI, Groq Orpheus, Gemini.
- **Subjects and exams.** IB, GCSE, IGCSE, CBSE, A Level, AP or your own, with an exam countdown.
- **Desktop extras.** Real notifications, a mini bar that stays on top, media keys that follow the last player, tray, optional Discord presence, updates from GitHub with SHA-256 checks.
- **Private.** Optional cloud sync uses your own Supabase project; API keys never leave the device.

| | |
| --- | --- |
| ![Start dialog](landing/assets/session-start.png) | ![Wrap-up](landing/assets/session-wrap.png) |
| ![Break idea](landing/assets/break-coach.png) | ![Progress](landing/assets/progress-full.png) |

## Repository layout

| Folder | What is in it |
| --- | --- |
| `desktop/` | The Windows app: Vite, React, TypeScript, Tailwind, Electron. `MASTER_GUIDE.md` is the long guide, `CHANGELOG.md` lists every change. |
| `web/` | The browser edition of the same source (no Electron parts). Version numbers differ: desktop 2.1.1 goes with web 1.9.1. |
| `landing/` | The landing page (plain HTML and CSS) and the screenshots used by every README. |
| `docs/` | `PLAN.md` (the plan for each request), `DEPLOYMENT_GUIDE.md`, `SUITE.md` (how the Sarang apps fit together). |
| `.github/workflows/` | `ci.yml` (tests) and `pages.yml` (publishes the landing page and the web app). |

## Build it yourself

Requires Node.js 20+.

```bash
# the browser edition
cd web && npm ci && npm run dev

# the Windows app (develop)
cd desktop && npm ci && npm run build && npx electron .

# tests
cd desktop && npm test          # fast checks
cd desktop && npm run test:ui   # full UI tests, needs a display (on Linux: xvfb-run)

# a release build (on Windows, or Linux with Wine-free electron-builder as used here)
cd desktop && npm run build && npx electron-builder --win --x64
```

`docs/DEPLOYMENT_GUIDE.md` covers publishing the landing page, the web app and a release.

## Part of the Sarang suite

[Sarang.md](https://github.com/sarang-cmd/sarang.md) is the sibling app: an IB Mathematics AA course with textbook-length lessons and an IB-style question bank. Same design, same settings layout, same desktop shell. See [docs/SUITE.md](docs/SUITE.md).

## Honest limits

Windows toasts, other-app media control, Windows speech recognition and live Groq or Gemini voices cannot be tested outside Windows and a real key; they are built and unit-tested, but report anything odd as an issue. Study with Sarang is independent and not affiliated with the IB.
