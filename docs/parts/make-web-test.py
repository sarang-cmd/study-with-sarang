#!/usr/bin/env python3
"""Makes web/scripts/test-v20.mjs from the desktop one by dropping every group that needs the Electron shell."""
import re
root = '/home/user/Study-with-Sarang'
src = open(f'{root}/desktop/scripts/test-v20.mjs').read().split('\n')
blocks = []; cur = []
for line in src:
    if line and not line[0].isspace() and line[0] not in '})' and cur and not cur[-1].startswith('//') :
        blocks.append(cur); cur = []
    elif line and not line[0].isspace() and line[0] not in '})' and cur and cur[-1].startswith('//'):
        pass
    cur.append(line)
blocks.append(cur)
SHELL_NAMES = ['ids', 'puckMain', 'mon', 'driftShell']
def needs_shell(text):
    if 'electron/' in text or 'assets/' in text or '.build.' in text or 'swaUpdate' in text or 'electron\\/' in text or 'SWA_NO_TOUR' in text: return True
    return any(re.search(rf'\b{n}\.', text) for n in SHELL_NAMES)
kept = []; dropped = 0
for b in blocks:
    t = '\n'.join(b)
    first = next((l for l in b if l and not l.startswith('//')), '')
    if first.startswith('await ok(') or re.match(r'const \w+ = require\(', first):
        if needs_shell(t): dropped += 1; continue
    kept.append(t)
out = '\n'.join(kept).replace('// 2.0 tests, grouped by feature.', '// 2.0 tests for the web edition (the groups that need the Electron shell are in the desktop edition).')
open(f'{root}/web/scripts/test-v20.mjs', 'w').write(out)
print('kept', sum(1 for k in kept if k.startswith('await ok(')), 'dropped', dropped)
