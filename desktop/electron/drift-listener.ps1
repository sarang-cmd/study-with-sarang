# Reports which app is in front, and the title of its window, so the app can notice when you drift away from studying.
# It only reads the name of the front window's program and that window's title. It never reads window contents,
# never records the screen or keys, and sends nothing over the network. One JSON object per line on stdout.
param([int]$ParentPid = 0, [int]$IntervalMs = 1000)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class SwaFront {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
[Console]::Out.WriteLine('{"type":"ready"}'); [Console]::Out.Flush()
$last = ''; $lastSent = [DateTime]::UtcNow
while ($true) {
  $h = [SwaFront]::GetForegroundWindow()
  if ($h -ne [IntPtr]::Zero) {
    $procId = 0
    [void][SwaFront]::GetWindowThreadProcessId($h, [ref]$procId)
    $sb = New-Object System.Text.StringBuilder 256
    [void][SwaFront]::GetWindowText($h, $sb, 256)
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $name = if ($p) { $p.ProcessName } else { '' }
    $json = @{ type = 'window'; app = $name; title = $sb.ToString() } | ConvertTo-Json -Compress
    if ($json -ne $last -or ([DateTime]::UtcNow - $lastSent).TotalSeconds -gt 5) { [Console]::Out.WriteLine($json); [Console]::Out.Flush(); $last = $json; $lastSent = [DateTime]::UtcNow }
  }
  if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds $IntervalMs
}
