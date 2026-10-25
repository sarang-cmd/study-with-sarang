import { AlertTriangle, Check as CheckIcon, ChevronDown, Mic, MicOff, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDesktop } from '../../context/DesktopContext';
import { describeCommand } from '../../lib/commands';
import { buildVoiceEntries } from '../../lib/voice';
import { Slider } from '../Slider';
import { Card, Toggle, copyText } from './shared';
import { desktop, type VoiceDiagnosis } from '../../lib/desktop';
import { diagnosisReport, interpretDiagnosis, type Check } from '../../lib/voiceDiagnosis';
import { useVoiceMeter } from '../../lib/voiceMeter';
import { notify } from '../ui/toast';

/** Live microphone level, so you can see right away whether sound reaches the recognizer. */
function Meter({ active }: { active: boolean }) {
  const meter = useVoiceMeter();
  const quiet = active && meter.level === 0 && meter.peak === 0;
  return <div className="mt-2 rounded-lg border border-line px-3 py-2.5" data-testid="voice-meter">
    <div className="flex items-center justify-between text-[10px] text-muted"><span>Microphone level</span><span className="font-mono">{active ? `${meter.level}` : 'off'}</span></div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter.level}>
      <div className="h-full rounded-full bg-ink transition-[width] duration-100" style={{ width: `${active ? meter.level : 0}%` }} />
    </div>
    <p className="mt-2 text-[10px] leading-snug text-muted">
      {meter.hypothesis ? <>Hearing: <span className="font-mono text-ink">{meter.hypothesis}</span></> : active ? 'Say a command, for example "pause".' : 'Press "Test microphone" and speak.'}
      {' '}Recognized {meter.heard}, not understood {meter.rejected}{meter.lastRejected ? <> (last: <span className="font-mono">{meter.lastRejected}</span>)</> : null}.
    </p>
    {quiet && <p className="mt-1.5 text-[10px] font-semibold">No sound is reaching the recognizer yet. Speak, or run the checks below.</p>}
  </div>;
}

const icon = (status: Check['status']) => status === 'ok' ? <CheckIcon size={13} aria-hidden="true" /> : status === 'warn' ? <AlertTriangle size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />;


export function VoiceCard() {
  const { info, voice, setVoice, voiceStatus, lastHeard, macros, allMixNames, voiceTesting, setVoiceTesting } = useDesktop();
  const [checks, setChecks] = useState<{ raw: VoiceDiagnosis; list: Check[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const runChecks = async () => {
    setChecking(true);
    try { const raw = (await desktop?.voiceDiagnose()) ?? { ok: false, error: 'Not running in the desktop app.' }; setChecks({ raw, list: interpretDiagnosis(raw, voice.language) }); }
    catch { setChecks({ raw: { ok: false }, list: interpretDiagnosis({ ok: false, error: 'The check failed to run.' }, voice.language) }); }
    setChecking(false);
  };
  const supported = info?.voiceSupported ?? false;
  const entries = useMemo(() => buildVoiceEntries(allMixNames(), macros.filter((macro) => macro.voice).map((macro) => macro.name)), [macros, allMixNames]);
  const prefix = voice.useWake ? `${voice.wake}, ` : '';
  const status = !supported ? 'Not available on this system yet'
    : voiceStatus.status === 'listening' ? `Listening (${voiceStatus.language === 'de' ? 'German' : 'English'})`
    : voiceStatus.status === 'starting' ? 'Starting...'
    : voiceStatus.status === 'error' ? voiceStatus.message ?? 'Could not start'
    : voice.enabled ? 'Starting...' : 'Off';
  return <Card title="Voice mode" hint={`Say a command out loud, for example "pause" or "louder". It uses the speech recognizer built into Windows, works offline, listens only for the phrases below and stores no audio.${voice.useWake ? ` Start each command with "${voice.wake}".` : ''}`}>
    <Toggle label="Listen for voice commands" hint={supported ? 'Needs a microphone and permission for desktop apps in Windows privacy settings.' : 'Voice mode runs on Windows. The Mac version does not have it yet.'} checked={voice.enabled && supported} disabled={!supported} onChange={(value) => setVoice({ enabled: value })} />
    <p role="status" className={`mt-2 flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[11px] ${voiceStatus.status === 'error' ? 'font-semibold' : 'text-muted'}`}>
      {voiceStatus.status === 'listening' ? <Mic size={13} aria-hidden="true" /> : <MicOff size={13} aria-hidden="true" />}{status}
    </p>
    {supported && <Meter active={voice.enabled || voiceTesting} />}
    {lastHeard && <p className="mt-1.5 text-[10px] text-muted">Last heard: <span className="font-mono text-ink">{lastHeard.text}</span>{lastHeard.confidence !== undefined ? ` (${Math.round(lastHeard.confidence * 100)}%)` : ''} {lastHeard.command ? `> ${describeCommand(lastHeard.command)}` : lastHeard.reason === 'confidence' ? '(not sure enough: lower Strictness)' : lastHeard.reason === 'wake' ? `(not a command${voice.useWake ? `, start with "${voice.wake}"` : ''})` : '(ignored)'}</p>}
    {supported && <div className="mt-3 flex flex-wrap gap-2">
      {!voice.enabled && <button type="button" className="studio-button" onClick={() => setVoiceTesting(!voiceTesting)} aria-pressed={voiceTesting}>{voiceTesting ? 'Stop test' : 'Test microphone'}</button>}
      <button type="button" className="studio-button" disabled={checking} onClick={() => void runChecks()}>{checking ? 'Checking...' : 'Run checks'}</button>
    </div>}
    {checks && <div className="mt-3 rounded-xl border border-line" role="region" aria-label="Voice checks">
      <ul className="divide-y divide-line">
        {checks.list.map((check) => <li key={check.id} className="px-3 py-2 text-[11px]">
          <p className="flex items-center gap-1.5 font-semibold">{icon(check.status)}{check.label}<span className="ml-auto text-[10px] font-normal uppercase tracking-wide text-muted">{check.status === 'ok' ? 'OK' : check.status === 'warn' ? 'Check' : 'Problem'}</span></p>
          <p className="mt-0.5 text-[10px] leading-snug text-muted">{check.detail}</p>
          {check.fix && check.status !== 'ok' && <p className="mt-0.5 text-[10px] leading-snug">{check.fix}</p>}
        </li>)}
      </ul>
      <div className="border-t border-line px-3 py-2"><button type="button" className="text-[10px] font-semibold underline underline-offset-2" onClick={() => void copyText(diagnosisReport(checks.raw, checks.list), () => notify({ message: 'Report copied.', variant: 'success', id: 'voice-report' }))}>Copy report</button></div>
    </div>}
    <div className="mt-3 grid gap-2">
      <Toggle label="Require the wake word" hint={`Off by default. Windows' recognizer often mishears an unusual name such as "${voice.wake}", so commands can be missed. Turn it on if music or talking triggers commands, then use the meter above to see whether it is understood.`} checked={voice.useWake} onChange={(value) => setVoice({ useWake: value })} />
      <Toggle label="Understand any sentence after the wake word" hint={`With the wake word on, say a full sentence such as "${voice.wake}, pause my music" or "${voice.wake}, add a to-do read chapter four". Needs the wake word, so everyday talk is ignored.`} checked={voice.freeSpeech && voice.useWake} onChange={(freeSpeech) => setVoice({ freeSpeech })} disabled={!voice.useWake} />
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Wake word
          <input className="field mt-1.5 !min-h-9 font-normal" value={voice.wake} maxLength={24} onChange={(event) => setVoice({ wake: event.target.value })} disabled={!voice.useWake} />
        </label>
        <label className="rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Language
          <select className="field mt-1.5 !min-h-9 font-normal" value={voice.language} onChange={(event) => setVoice({ language: event.target.value as 'auto' | 'en' | 'de' })}>
            <option value="auto">Automatic</option><option value="en">English</option><option value="de">Deutsch</option>
          </select>
        </label>
      </div>
      <Slider label="Strictness" value={Math.round(voice.minConfidence * 100)} min={40} max={95} defaultValue={72} onChange={(value) => setVoice({ minConfidence: value / 100 })} format={(value) => `${value}%`} hint="Higher means fewer mistaken commands but you may need to repeat yourself." />
    </div>
    <details className="mt-3 rounded-xl border border-line">
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-[11px] font-semibold">What can I say?<ChevronDown size={14} className="chevron text-muted" aria-hidden="true" /></summary>
      <ul className="max-h-56 overflow-auto border-t border-line px-3 py-2 text-[11px]">
        {entries.filter((entry) => !entry.command.startsWith('volume.set')).map((entry) => <li key={entry.command} className="flex justify-between gap-3 py-1">
          <span className="text-muted">{describeCommand(entry.command)}</span><span className="text-right font-mono text-[10px]">{prefix}{entry.en[0]}</span>
        </li>)}
        <li className="flex justify-between gap-3 py-1"><span className="text-muted">Set volume</span><span className="text-right font-mono text-[10px]">{prefix}volume forty</span></li>
      </ul>
      <p className="border-t border-line px-3 py-2 text-[10px] text-muted">German phrases such as "Lauter", "Ton aus" and "Timer starten" work when the recognizer language is German.</p>
    </details>
  </Card>;
}
