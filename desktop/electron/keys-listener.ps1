# Study with Sarang: listens for the Pause/Break key (Windows only).
# Electron's globalShortcut cannot register Pause/Break, so this small helper asks Windows for it directly
# with RegisterHotKey. It prints one JSON object per line and exits when the app does.
param([int]$ParentPid = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Send($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress)); [Console]::Out.Flush() }
try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SwaKeys {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }
  [DllImport("user32.dll", SetLastError = true)] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] public static extern bool PeekMessage(out MSG msg, IntPtr hWnd, uint min, uint max, uint remove);
}
"@
  $MOD_NOREPEAT = 0x4000; $VK_PAUSE = 0x13; $WM_HOTKEY = 0x0312; $PM_REMOVE = 1
  if (-not [SwaKeys]::RegisterHotKey([IntPtr]::Zero, 1, $MOD_NOREPEAT, $VK_PAUSE)) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Send @{ type = 'error'; code = 'taken'; message = "Windows would not give this app the Pause key (error $code). Another program may be using it." }
    exit 1
  }
  Send @{ type = 'ready' }
  $msg = New-Object SwaKeys+MSG
  $ticks = 0
  while ($true) {
    while ([SwaKeys]::PeekMessage([ref]$msg, [IntPtr]::Zero, 0, 0, $PM_REMOVE)) {
      if ($msg.message -eq $WM_HOTKEY) { Send @{ type = 'key'; key = 'pause' } }
    }
    Start-Sleep -Milliseconds 30
    $ticks++
    if ($ParentPid -gt 0 -and ($ticks % 60) -eq 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  }
  [SwaKeys]::UnregisterHotKey([IntPtr]::Zero, 1) | Out-Null
} catch {
  Send @{ type = 'error'; code = 'failed'; message = [string]$_.Exception.Message }
  exit 1
}
