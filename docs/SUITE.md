# The Sarang suite

Two apps, one design, built to feel like one product.

| | **Study with Sarang** | **Sarang.md** |
| --- | --- | --- |
| Purpose | Focus studio: sound, timer, breaks, progress, voice | IB Mathematics AA course: lessons, question bank, mark schemes, tutor |
| Web | `sarang-md.vercel.app/study-with-sarang/` | `sarang-md.vercel.app` |
| Desktop | Windows exe (Electron) | Windows exe (Electron) |
| Hosting | Vercel project `study-with-sarang` | Vercel project `sarang.md` |
| Downloads | `sarang-md.vercel.app/study-with-sarang/downloads/` | `sarang-md.vercel.app/downloads/` |
| Updates | Feed at `study-with-sarang.vercel.app/updates/latest.json`, SHA-256 checked | Feed at `sarang-md.vercel.app/updates/latest.json`, SHA-256 checked |

## What is shared

- **Design.** Grayscale only, the same tokens (`--canvas`, `--surface`, `--raised`, `--ink`, `--muted`, `--faint`, `--line`), close-tracked editorial headings, monospaced eyebrow labels, light and dark themes, motion that respects `prefers-reduced-motion`.
- **Header pattern.** Logo left, page switcher in the middle, a few quiet icons and a `Get the app` link right (browser only).
- **Settings layout.** A left tab list in a side panel, **Appearance** first, **Advanced** near the end, **About** last.
- **Desktop shell.** The same animated installer (Install, Customize, Repair, Update), shortcuts, tray, signed exe, and an updater that reads a feed from the website and verifies a SHA-256 before installing.
- **Privacy.** Local first. Optional cloud sync is the user's own Supabase project. Keys stay on the device.
- **Ethos.** Calm, honest, optional. Nothing forced, no gamified pressure, no claims that cannot be backed.
- **Cross links.** Each app links to the other in its footer and About page, and each README names the suite.

## Naming and files

| | Study with Sarang | Sarang.md |
| --- | --- | --- |
| App id | `com.sarang.studywithsarang` | `com.sarang.sarangmd` |
| Exe | `Study-with-Sarang-<version>.exe` | `Sarang-md-<version>.exe` |
| Stable download name | `Study-with-Sarang-Windows.exe` | `Sarang-md-Windows.exe` |
| Version rule | desktop and web have their own numbers; the changelog says which go together | same |

## Adding a third app

Copy the desktop shell, change `appId`, product name, icon and update repo in `package.json`, keep the tokens in `src/index.css`, and add a row to this table.
