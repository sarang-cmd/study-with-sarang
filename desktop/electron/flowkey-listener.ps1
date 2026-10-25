# Study with Sarang: the Flow push-to-talk key (Windows only).
# Windows has no "key down / key up" shortcut for a lone modifier such as Right Ctrl, so this helper reads the key state ~60 times a second
# with GetAsyncKeyState and prints one JSON object per line: ready, down, up, abort, esc, error.
# It never records what you type: it only checks whether the chosen key(s) are down, and whether ANY other key is down at the same moment
# (so Right Ctrl + C is a copy, not a request to Flow). Nothing is stored or sent anywhere.
param([string]$Keys = '163', [int]$ParentPid = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Send($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress)); [Console]::Out.Flush() }
try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SwaFlowKey {
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
  static bool Down(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }
  // bit0: every chosen key is down. bit1: some other key or mouse button is down. bit2: Esc is down.
  public static int Poll(int[] vks) {
    int flags = 0;
    bool all = vks.Length > 0;
    foreach (int vk in vks) { if (!Down(vk)) { all = false; break; } }
    if (all) flags |= 1;
    bool other = false;
    for (int vk = 1; vk < 255 && !other; vk++) {
      if (vk == 3 || vk == 5 || vk == 6 || vk == 7) continue;       // mouse buttons 4 and 5 and unassigned codes
      if (vk == 0x10 || vk == 0x11 || vk == 0x12) continue;          // generic Shift, Ctrl, Alt (the left and right ones are checked below)
      if (vk == 0x1B) continue;                                       // Esc is reported on its own
      bool mine = false;
      foreach (int k in vks) { if (k == vk) { mine = true; break; } }
      if (mine) continue;
      if (vk >= 0xA0 && vk <= 0xA5 && !all) continue;                 // A modifier alone does not count as "another key" unless a chord is held
      if (vk >= 0xA0 && vk <= 0xA5) { if (Down(vk)) other = true; continue; }
      if (Down(vk)) other = true;
    }
    if (other) flags |= 2;
    if (Down(0x1B)) flags |= 4;
    return flags;
  }
}
"@
  $vks = [int[]]($Keys -split ',' | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
  if ($vks.Count -eq 0) { Send @{ type = 'error'; code = 'nokey'; message = 'No key was given.' }; exit 1 }
  Send @{ type = 'ready' }
  $down = $false; $aborted = $false; $esc = $false; $ticks = 0
  while ($true) {
    $f = [SwaFlowKey]::Poll($vks)
    $all = ($f -band 1) -ne 0; $other = ($f -band 2) -ne 0; $escNow = ($f -band 4) -ne 0
    if ($escNow -and -not $esc) { Send @{ type = 'esc' } }
    $esc = $escNow
    if (-not $down) {
      if ($all -and -not $other -and -not $aborted) { $down = $true; Send @{ type = 'down' } }
      elseif (-not $all) { $aborted = $false }
    } else {
      if ($other) { Send @{ type = 'abort' }; $down = $false; $aborted = $true }
      elseif (-not $all) { Send @{ type = 'up' }; $down = $false }
    }
    Start-Sleep -Milliseconds 16
    $ticks++
    if ($ParentPid -gt 0 -and ($ticks % 120) -eq 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  }
} catch {
  Send @{ type = 'error'; code = 'failed'; message = [string]$_.Exception.Message }
  exit 1
}
