# Reports what else is going on on this PC, so the app can optionally pause while you record, take a call or watch a video.
# It only READS Windows' own status information (microphone use flags, running process names, media sessions).
# It never records audio, never reads window contents and sends nothing over the network.
# Output is one JSON object per line on stdout.
param([string]$Recorders = '', [int]$ParentPid = 0, [int]$IntervalMs = 2000)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Send($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush() }

$wanted = @($Recorders -split ',' | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })

# Media sessions (what the Windows volume flyout lists): which apps are playing something right now.
$mgr = $null
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $op = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
  $task = $asTask.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($op))
  [void]$task.Wait(5000)
  $mgr = $task.Result
} catch { $mgr = $null }

$micRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone'

function Get-MicUsers {
  $out = @()
  try {
    $keys = @()
    if (Test-Path $micRoot) { $keys += Get-ChildItem $micRoot | Where-Object { $_.PSChildName -ne 'NonPackaged' } }
    if (Test-Path "$micRoot\NonPackaged") { $keys += Get-ChildItem "$micRoot\NonPackaged" }
    foreach ($k in $keys) {
      $p = Get-ItemProperty -LiteralPath $k.PSPath
      if ($null -ne $p.LastUsedTimeStart -and $null -ne $p.LastUsedTimeStop -and [int64]$p.LastUsedTimeStart -gt 0 -and [int64]$p.LastUsedTimeStop -eq 0) { $out += [string]$k.PSChildName }
    }
  } catch { }
  return $out
}

function Get-MediaPlayers {
  $out = @()
  if ($null -eq $mgr) { return $out }
  try {
    foreach ($s in $mgr.GetSessions()) {
      if ($s.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { $out += [string]$s.SourceAppUserModelId }
    }
  } catch { }
  return $out
}

Send @{ type = 'ready'; media = ($null -ne $mgr) }
$last = ''
$lastSent = [DateTime]::UtcNow
while ($true) {
  $names = @(Get-Process | ForEach-Object { $_.ProcessName.ToLower() } | Sort-Object -Unique)
  $state = [ordered]@{
    type = 'state'
    mic = @(Get-MicUsers)
    recorders = @($wanted | Where-Object { $names -contains $_ })
    media = @(Get-MediaPlayers)
  }
  $json = $state | ConvertTo-Json -Compress -Depth 4
  if ($json -ne $last -or ([DateTime]::UtcNow - $lastSent).TotalSeconds -gt 20) { [Console]::Out.WriteLine($json); [Console]::Out.Flush(); $last = $json; $lastSent = [DateTime]::UtcNow }
  if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds $IntervalMs
}
