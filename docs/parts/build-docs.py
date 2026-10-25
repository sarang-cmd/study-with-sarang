#!/usr/bin/env python3
"""Assembles MASTER_GUIDE.md, CHANGELOG.md and VERSION_HISTORY.md for the desktop and web apps from docs/parts."""
import re, os, sys
root = '/home/user/Study-with-Sarang'
parts = f'{root}/docs/parts'
DATE = '2026-10-16'
APPX = [('A', 'SUPABASE.md'), ('B', 'EMAIL_SETUP.md'), ('C', 'CALENDAR.md'), ('D', 'FLOW_CLOUD.md'), ('E', 'OWN_BACKEND.md'), ('F', 'SOUNDS.md'), ('G', 'STREAM_DECK.md'), ('H', 'UPDATES.md'), ('I', 'STORE_AND_SIGNING.md')]
WEB_ZIP = """## 2. What is in the ZIP

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

"""
def demote(text, letter):
    out = []; fence = False
    for line in text.splitlines():
        if line.startswith('```'): fence = not fence
        if not fence and line.startswith('#'):
            m = re.match(r'(#+)\s+(.*)', line)
            if m:
                lv = len(m.group(1))
                title = m.group(2)
                if lv == 1: title = f'Appendix {letter}: {title}'
                line = '#' * min(lv + 1, 6) + ' ' + title
        out.append(line)
    return '\n'.join(out)
def build(app, version, web):
    d = f'{root}/{app}'
    main = open(f'{parts}/master-main.md').read().replace('{{V}}', version).replace('{{DATE}}', DATE)
    if web:
        main = re.sub(r'## 2\. What is in the ZIP\n.*?(?=## 3\. Install)', lambda m: WEB_ZIP, main, flags=re.S)
        main = main.replace('Version ' + version, 'Web edition, version ' + version)
    app_parts = []
    for letter, f in APPX:
        path = f'{d}/docs/{f}'
        if os.path.exists(path): app_parts.append(demote(open(path).read(), letter))
    guide = main.rstrip() + '\n\n' + '\n\n'.join(app_parts) + '\n'
    open(f'{d}/MASTER_GUIDE.md', 'w').write(guide)
    hist = open(f'{d}/VERSION_HISTORY.md').read() if os.path.exists(f'{d}/VERSION_HISTORY.md') else '# Version history\n'
    if f'## {version} ' not in hist:
        entry = open(f'{parts}/entry-2.1.md').read().replace('{{V}}', version)
        head, _, rest = hist.partition('\n\n')
        hist = head + '\n\n' + entry.rstrip() + '\n\n' + rest
        open(f'{d}/VERSION_HISTORY.md', 'w').write(hist)
    return guide
dh = open(f'{root}/desktop/VERSION_HISTORY.md').read(); wh = open(f'{root}/web/VERSION_HISTORY.md').read()
DV, WV = '2.1.0', '1.9.0'
build('desktop', DV, False); build('web', WV, True)
dh = open(f'{root}/desktop/VERSION_HISTORY.md').read(); wh = open(f'{root}/web/VERSION_HISTORY.md').read()
def body(h): return h.split('\n', 1)[1].lstrip('\n')
for app, v in (('desktop', DV), ('web', WV)):
    own, other, other_name = (dh, wh, 'web edition') if app == 'desktop' else (wh, dh, 'desktop edition')
    own_name = 'Desktop edition' if app == 'desktop' else 'Web edition'
    text = f"""# Study with Sarang: the full changelog

Everything that changed, from the first release to version {v}, newest first. Study with Sarang ships as two editions from one source: the **desktop app** (Windows first, macOS) and the **web edition**. The same feature usually lands in both on the same day with a different number.

## Which versions go together

| Date | Desktop | Web | Headline |
| --- | --- | --- | --- |
| 2026-10-16 | 2.1.0 | 1.9.0 | Calmer by default: Essentials, session rhythm, working voice, Flow commands |\n| 2026-10-07 | 2.0.0 | 1.8.0 | A student app: subjects, statistics, drift detection, AI tools, study room, puck, monitors |
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

# {own_name} history

{body(own)}

---

# {'Web' if app == 'desktop' else 'Desktop'} edition history (for reference)

{body(other).replace(chr(10) + '## ', chr(10) + '## ' + ('Web ' if app == 'desktop' else 'Desktop '))}
"""
    os.makedirs(f'{root}/{app}/docs', exist_ok=True)
    open(f'{root}/{app}/CHANGELOG.md', 'w').write(text)
print('built')
