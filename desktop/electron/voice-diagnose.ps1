# One-off checks for voice mode. Reads settings only. It does not record or keep any audio.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$result = [ordered]@{ psVersion = $PSVersionTable.PSVersion.ToString(); languageMode = [string]$ExecutionContext.SessionState.LanguageMode }
$result.os = [string][Environment]::OSVersion.Version
$result.uiCulture = [string](Get-Culture).Name

$result.speechLoaded = $false
$result.recognizers = @()
$result.micOpen = $false
$result.micError = ''
try {
  Add-Type -AssemblyName System.Speech
  $result.speechLoaded = $true
  $list = @()
  foreach ($r in [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()) { $list += [string]$r.Culture.Name }
  $result.recognizers = $list
  if ($list.Count -gt 0) {
    $engine = $null
    try {
      $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
      $engine.SetInputToDefaultAudioDevice()
      $result.micOpen = $true
    } catch { $result.micError = [string]$_.Exception.Message }
    if ($engine) { $engine.Dispose() }
  }
} catch { $result.speechError = [string]$_.Exception.Message }

function Get-Consent($path) {
  try { $v = (Get-ItemProperty -LiteralPath $path -Name Value -ErrorAction Stop).Value; if ($v) { return [string]$v } } catch { }
  return ''
}
$base = 'Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone'
$result.micUser = Get-Consent "HKCU:\$base"
$result.micMachine = Get-Consent "HKLM:\$base"
$result.micDesktopApps = Get-Consent "HKCU:\$base\NonPackaged"

$devices = @()
try { foreach ($d in (Get-PnpDevice -Class AudioEndpoint -PresentOnly)) { if ($d.FriendlyName -match 'mic|input|line in|headset|array|webcam|camera') { $devices += [string]$d.FriendlyName } } } catch { }
$result.inputDevices = @($devices)
[Console]::Out.WriteLine(($result | ConvertTo-Json -Compress -Depth 4))
