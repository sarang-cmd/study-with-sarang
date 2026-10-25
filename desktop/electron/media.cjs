'use strict';
/**
 * "Flow, pause my music": controls whatever is playing in OTHER apps (Spotify, a browser video, a podcast), without touching this app's own sound.
 * Windows asks the system media controls (the same ones behind the media flyout), so "pause" really pauses and never starts something by mistake.
 * macOS talks to Spotify or Music. Linux uses playerctl when it is installed. Nothing is sent over the network.
 */
const { spawn: realSpawn } = require('node:child_process');

const ACTIONS = new Set(['pause', 'play', 'toggle', 'next', 'prev', 'stop', 'info']);
const VOLUME = new Set(['up', 'down', 'mute']);

// Windows PowerShell 5.1: WinRT through the system media transport controls. Prints one JSON line.
const WIN_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Say($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)) }
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + "`" + String.raw`1' })[0]
  function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(6000); $t.Result }
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $mine = @($SelfId, 'studywithsarang', 'Study with Sarang')
  $all = @($mgr.GetSessions()) | Where-Object { $id = [string]$_.SourceAppUserModelId; -not ($mine | Where-Object { $_ -and $id -like ('*' + $_ + '*') }) }
  function Status($s) { [int]$s.GetPlaybackInfo().PlaybackStatus }   # 4 = playing, 5 = paused
  function Nice($s) { $id = [string]$s.SourceAppUserModelId; if ($id -match '!') { $id = ($id -split '!')[-1] }; $id = $id -replace '\.exe$', ''; if ($id -match '_') { $id = ($id -split '_')[0] }; $id }
  function Props($s) { $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]); @{ title = [string]$p.Title; artist = [string]$p.Artist } }
  $playing = @($all | Where-Object { (Status $_) -eq 4 })
  if (-not $all -or $all.Count -eq 0) { Say @{ ok = $true; status = 'nothing' }; exit 0 }
  $result = @{ ok = $true; status = 'nothing' }
  switch ($Action) {
    'info' { if ($playing.Count -gt 0) { $p = Props $playing[0]; $result = @{ ok = $true; status = 'playing'; app = (Nice $playing[0]); title = $p.title; artist = $p.artist } } }
    'pause' { if ($playing.Count -gt 0) { $n = @(); foreach ($s in $playing) { [void](Await ($s.TryPauseAsync()) ([bool])); $n += (Nice $s) }; $p = Props $playing[0]; $result = @{ ok = $true; status = 'paused'; app = ($n -join ', '); title = $p.title; artist = $p.artist } } }
    'stop' { if ($playing.Count -gt 0) { foreach ($s in $playing) { [void](Await ($s.TryStopAsync()) ([bool])) }; $result = @{ ok = $true; status = 'stopped'; app = (Nice $playing[0]) } } }
    'play' { $cur = $mgr.GetCurrentSession(); $s = if ($cur -and ($all | Where-Object { $_.SourceAppUserModelId -eq $cur.SourceAppUserModelId })) { $cur } else { $all[0] }
      if ((Status $s) -eq 4) { $result = @{ ok = $true; status = 'already'; app = (Nice $s) } } else { [void](Await ($s.TryPlayAsync()) ([bool])); $p = Props $s; $result = @{ ok = $true; status = 'played'; app = (Nice $s); title = $p.title; artist = $p.artist } } }
    'toggle' { if ($playing.Count -gt 0) { foreach ($s in $playing) { [void](Await ($s.TryPauseAsync()) ([bool])) }; $result = @{ ok = $true; status = 'paused'; app = (Nice $playing[0]) } }
      else { $cur = $mgr.GetCurrentSession(); $s = if ($cur -and ($all | Where-Object { $_.SourceAppUserModelId -eq $cur.SourceAppUserModelId })) { $cur } else { $all[0] }; [void](Await ($s.TryPlayAsync()) ([bool])); $result = @{ ok = $true; status = 'played'; app = (Nice $s) } } }
    'next' { $s = if ($playing.Count -gt 0) { $playing[0] } else { $all[0] }; [void](Await ($s.TrySkipNextAsync()) ([bool])); Start-Sleep -Milliseconds 700; $p = Props $s; $result = @{ ok = $true; status = 'skipped'; app = (Nice $s); title = $p.title; artist = $p.artist } }
    'prev' { $s = if ($playing.Count -gt 0) { $playing[0] } else { $all[0] }; [void](Await ($s.TrySkipPreviousAsync()) ([bool])); Start-Sleep -Milliseconds 700; $p = Props $s; $result = @{ ok = $true; status = 'previous'; app = (Nice $s); title = $p.title; artist = $p.artist } }
  }
  Say $result
} catch { Say @{ ok = $false; status = 'error'; message = [string]$_.Exception.Message } }
`;
const WIN_VOLUME = String.raw`
$ErrorActionPreference = 'Stop'
try { $sh = New-Object -ComObject WScript.Shell; $key = switch ($Action) { 'up' { [char]175 } 'down' { [char]174 } default { [char]173 } }; $n = if ($Action -eq 'mute') { 1 } else { [Math]::Max(1, [Math]::Min(25, $Steps)) }; for ($i = 0; $i -lt $n; $i++) { $sh.SendKeys($key); Start-Sleep -Milliseconds 25 }; Write-Output '{"ok":true}' } catch { Write-Output ('{"ok":false,"message":"' + ($_.Exception.Message -replace '"', "'") + '"}') }
`;
const encode = (text) => Buffer.from(text, 'utf16le').toString('base64');

function lastJson(out) {
  const lines = String(out).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) { try { const v = JSON.parse(lines[i]); if (v && typeof v === 'object') return v; } catch { /* Next line. */ } }
  return null;
}
function runProcess(spawn, command, args, timeoutMs, stdin) {
  return new Promise((resolve) => {
    let out = '', done = false, child;
    const finish = (value) => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => { try { child?.kill(); } catch { /* Gone. */ } finish({ code: -1, out, timeout: true }); }, timeoutMs);
    try { child = spawn(command, args, { windowsHide: true, stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] }); } catch (error) { finish({ code: -2, out: '', error: String(error && error.message || error) }); return; }
    child.stdout?.on('data', (d) => { out += d; });
    child.on('error', (error) => finish({ code: -2, out, error: String(error && error.message || error) }));
    child.on('close', (code) => finish({ code, out }));
    if (stdin && child.stdin) { try { child.stdin.end(stdin); } catch { /* Gone. */ } }
  });
}

function createMedia({ platform = process.platform, spawn = realSpawn, selfId = '' } = {}) {
  const safe = (v) => String(v).replace(/[^A-Za-z0-9._-]/g, '');
  async function control(action) {
    if (!ACTIONS.has(action)) return { ok: false, status: 'bad-action' };
    if (platform === 'win32') {
      const script = `$Action = '${safe(action)}'; $SelfId = '${safe(selfId)}'; ${WIN_SCRIPT}`;
      const r = await runProcess(spawn, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encode(script)], 9000);
      if (r.timeout) return { ok: false, status: 'error', message: 'The media controls did not answer.' };
      if (r.error) return { ok: false, status: 'error', message: `Could not start Windows PowerShell: ${r.error.slice(0, 100)}` };
      return lastJson(r.out) || { ok: false, status: 'error', message: 'The media controls gave no answer.' };
    }
    if (platform === 'darwin') {
      const verb = { pause: 'pause', play: 'play', toggle: 'playpause', next: 'next track', prev: 'previous track', stop: 'pause', info: '' }[action];
      const app = (name) => `if application "${name}" is running then\n tell application "${name}"\n${verb ? ` ${verb}\n` : ''} try\n  return "${name}|" & (name of current track) & "|" & (artist of current track) & "|" & (player state as string)\n end try\n end tell\nend if`;
      const r = await runProcess(spawn, 'osascript', ['-e', `${app('Spotify')}\nreturn ""`], 6000);
      let text = String(r.out).trim();
      if (!text) { const m = await runProcess(spawn, 'osascript', ['-e', `${app('Music')}\nreturn ""`], 6000); text = String(m.out).trim(); }
      if (!text) return { ok: true, status: 'nothing' };
      const [appName, title, artist, state] = text.split('|');
      const status = action === 'info' ? (/play/i.test(state) ? 'playing' : 'nothing') : { pause: 'paused', stop: 'stopped', play: 'played', toggle: 'played', next: 'skipped', prev: 'previous' }[action];
      return { ok: true, status, app: appName, title, artist };
    }
    // Linux and others: playerctl, when there is one.
    const verb = { pause: 'pause', play: 'play', toggle: 'play-pause', next: 'next', prev: 'previous', stop: 'stop', info: 'metadata' }[action];
    const r = await runProcess(spawn, 'playerctl', action === 'info' ? ['metadata', '--format', '{{playerName}}|{{title}}|{{artist}}'] : [verb], 5000);
    if (r.error || r.code === -2) return { ok: false, status: 'unsupported', message: 'Install playerctl to control other players on this system.' };
    if (action === 'info') { const [app, title, artist] = String(r.out).trim().split('|'); return title ? { ok: true, status: 'playing', app, title, artist } : { ok: true, status: 'nothing' }; }
    return { ok: true, status: r.code === 0 ? ({ pause: 'paused', stop: 'stopped', play: 'played', toggle: 'played', next: 'skipped', prev: 'previous' }[action]) : 'nothing' };
  }
  /** System volume keys (Windows). Each step is about two percent. */
  async function volume(action, steps = 5) {
    if (!VOLUME.has(action)) return { ok: false, status: 'bad-action' };
    if (platform === 'win32') {
      const script = `$Action = '${safe(action)}'; $Steps = ${Math.max(1, Math.min(25, Math.round(Number(steps) || 5)))}; ${WIN_VOLUME}`;
      const r = await runProcess(spawn, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encode(script)], 6000);
      return lastJson(r.out) || { ok: false, message: 'No answer.' };
    }
    if (platform === 'darwin') {
      const script = action === 'mute' ? 'set volume output muted not (output muted of (get volume settings))' : `set volume output volume ((output volume of (get volume settings)) ${action === 'up' ? '+' : '-'} ${Math.round(steps) * 2})`;
      const r = await runProcess(spawn, 'osascript', ['-e', script], 4000); return { ok: r.code === 0 };
    }
    return { ok: false, message: 'System volume is not available on this system.' };
  }
  return { control, volume, ACTIONS, VOLUME };
}

/** A sentence for what happened. Used for the toast and, if you like, spoken. */
function describe(result, action) {
  if (!result || result.ok === false) return result?.message ? `Could not control the player: ${String(result.message).slice(0, 120)}` : 'Could not control the player.';
  const what = result.title ? `${result.title}${result.artist ? ` by ${result.artist}` : ''}` : '';
  const app = result.app ? ` in ${result.app}` : '';
  switch (result.status) {
    case 'paused': return `Paused${app}.`;
    case 'stopped': return `Stopped${app}.`;
    case 'played': return `Playing${what ? ` ${what}` : ''}${app}.`;
    case 'already': return `${result.app || 'It'} is already playing.`;
    case 'skipped': return what ? `Next: ${what}.` : 'Skipped to the next track.';
    case 'previous': return what ? `Previous: ${what}.` : 'Back to the previous track.';
    case 'playing': return what ? `Playing ${what}${app}.` : `Something is playing${app}.`;
    case 'nothing': return action === 'info' ? 'Nothing is playing in another app.' : 'No other player is playing right now.';
    case 'unsupported': return result.message || 'Not supported here.';
    default: return 'Done.';
  }
}
module.exports = { createMedia, describe, lastJson, ACTIONS, VOLUME, WIN_SCRIPT };
