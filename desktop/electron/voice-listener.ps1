# Offline voice commands using the speech recognizer built into Windows (System.Speech).
# It listens only for the fixed phrases it is given, nothing is sent over the network, and
# no audio is stored. Output is one JSON object per line on stdout.
param([string]$ConfigFile, [int]$ParentPid = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Send($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress)); [Console]::Out.Flush() }
try {
  Add-Type -AssemblyName System.Speech
  $cfg = Get-Content -Raw -Encoding UTF8 -LiteralPath $ConfigFile | ConvertFrom-Json
  $installed = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
  if ($installed.Count -eq 0) { Send @{ type = 'error'; code = 'no-recognizer'; message = 'Windows has no speech recognizer installed.' }; exit 2 }
  $pick = $null
  foreach ($want in @($cfg.languages)) {
    foreach ($candidate in $installed) {
      if ($candidate.Culture.TwoLetterISOLanguageName -eq $want) { $pick = $candidate; break }
    }
    if ($pick) { break }
  }
  if (-not $pick) { Send @{ type = 'error'; code = 'no-language'; message = 'Install an English or German speech language in Windows settings.' }; exit 3 }
  $lang = $pick.Culture.TwoLetterISOLanguageName
  $phrases = @($cfg.phrases.$lang)
  if ($phrases.Count -eq 0) { Send @{ type = 'error'; code = 'no-phrases'; message = 'There are no commands for this language.' }; exit 4 }

  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($pick.Culture)
  $choices = New-Object System.Speech.Recognition.Choices
  foreach ($p in $phrases) { $choices.Add([string[]]@([string]$p)) }
  $builder = New-Object System.Speech.Recognition.GrammarBuilder
  $builder.Culture = $pick.Culture
  # The names it answers to (for example Flow and Sarang). Required when the wake word is on, otherwise optional,
  # so "volume forty" and "Flow volume forty" both work.
  $wakeWords = @($cfg.wakes | Where-Object { $_ })
  if ($wakeWords.Count -eq 0) { $single = [string]$cfg.wake.$lang; if ($single) { $wakeWords = @($single) } }
  if ($wakeWords.Count -gt 0) {
    $wakeChoices = New-Object System.Speech.Recognition.Choices
    foreach ($w in $wakeWords) { $wakeChoices.Add([string[]]@([string]$w)) }
    if ($cfg.useWake) { $builder.Append($wakeChoices) }
    else {
      $wakeBuilder = New-Object System.Speech.Recognition.GrammarBuilder
      $wakeBuilder.Append($wakeChoices)
      $builder.Append($wakeBuilder, 0, 1)
    }
  }
  $builder.Append($choices)
  $main = New-Object System.Speech.Recognition.Grammar($builder)
  $main.Name = 'cmd'
  $engine.LoadGrammar($main)
  # Free speech: a second, general grammar so sentences that are not in the list ("add a to-do hand in the report") are still
  # written down. It runs fully on this PC. If this Windows has no dictation support, the fixed phrases keep working.
  $dictation = $false
  if ($cfg.dictation) {
    try {
      $dict = New-Object System.Speech.Recognition.DictationGrammar
      $dict.Name = 'dict'
      $engine.LoadGrammar($dict)
      $dictation = $true
    } catch { $dictation = $false }
  }
  $engine.SetInputToDefaultAudioDevice()
  Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier 'heard' | Out-Null
  Register-ObjectEvent -InputObject $engine -EventName SpeechRecognitionRejected -SourceIdentifier 'rejected' | Out-Null
  Register-ObjectEvent -InputObject $engine -EventName SpeechHypothesized -SourceIdentifier 'hypothesis' | Out-Null
  Register-ObjectEvent -InputObject $engine -EventName AudioLevelUpdated -SourceIdentifier 'level' | Out-Null
  $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
  Send @{ type = 'ready'; language = $lang; culture = $pick.Culture.Name; dictation = $dictation }

  $lastLevel = [DateTime]::UtcNow
  while ($true) {
    $e = Wait-Event -Timeout 2
    if ($e) {
      if ($e.SourceIdentifier -eq 'heard') {
        $r = $e.SourceEventArgs.Result
        Send @{ type = 'heard'; text = [string]$r.Text; confidence = [math]::Round([double]$r.Confidence, 3); grammar = [string]$r.Grammar.Name }
      } elseif ($e.SourceIdentifier -eq 'rejected') {
        $r = $e.SourceEventArgs.Result
        Send @{ type = 'rejected'; text = [string]$r.Text; confidence = [math]::Round([double]$r.Confidence, 3); grammar = [string]$r.Grammar.Name }
      } elseif ($e.SourceIdentifier -eq 'hypothesis') {
        Send @{ type = 'hypothesis'; text = [string]$e.SourceEventArgs.Result.Text; grammar = [string]$e.SourceEventArgs.Result.Grammar.Name }
      } elseif ($e.SourceIdentifier -eq 'level') {
        $now = [DateTime]::UtcNow
        if (($now - $lastLevel).TotalMilliseconds -ge 120) { $lastLevel = $now; Send @{ type = 'level'; level = [int]$e.SourceEventArgs.AudioLevel } }
      }
      Remove-Event -EventIdentifier $e.EventIdentifier
    }
    if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  }
} catch {
  Send @{ type = 'error'; code = 'failed'; message = [string]$_.Exception.Message }
  exit 1
}
