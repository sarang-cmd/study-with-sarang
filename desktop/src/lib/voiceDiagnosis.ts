import type { VoiceDiagnosis } from './desktop';

export type CheckStatus = 'ok' | 'warn' | 'fail';
export interface Check { id: string; label: string; status: CheckStatus; detail: string; fix?: string }

const denied = (value?: string) => (value ?? '').toLowerCase() === 'deny';

/** Turns the raw facts from Windows into a short checklist with plain advice. */
export function interpretDiagnosis(d: VoiceDiagnosis, language: 'auto' | 'en' | 'de'): Check[] {
  if (!d.ok) return [{ id: 'run', label: 'Checks could not run', status: 'fail', detail: d.error ?? 'Unknown problem.', fix: 'Voice mode needs Windows PowerShell. Make sure it is not blocked by a company or school policy.' }];
  const out: Check[] = [];
  const constrained = (d.languageMode ?? 'FullLanguage') !== 'FullLanguage';
  out.push(constrained
    ? { id: 'ps', label: 'Windows PowerShell', status: 'fail', detail: `Running in ${d.languageMode} mode.`, fix: 'A policy on this PC restricts PowerShell, which voice mode needs. It cannot work on this computer.' }
    : { id: 'ps', label: 'Windows PowerShell', status: 'ok', detail: `Version ${d.psVersion ?? '?'} on Windows ${d.os ?? '?'}.` });
  out.push(d.speechLoaded
    ? { id: 'speech', label: 'Windows speech library', status: 'ok', detail: 'Loaded.' }
    : { id: 'speech', label: 'Windows speech library', status: 'fail', detail: d.speechError ?? 'Could not load System.Speech.', fix: 'Repair Windows (sfc /scannow) or install the latest .NET Framework updates.' });
  const recognizers = d.recognizers ?? [];
  const short = recognizers.map((culture) => culture.slice(0, 2).toLowerCase());
  const wanted = language === 'auto' ? ['en', 'de'] : [language];
  const usable = wanted.filter((code) => short.includes(code));
  if (!recognizers.length) out.push({ id: 'recognizer', label: 'Speech recognizer', status: 'fail', detail: 'Windows has no speech recognizer installed.', fix: 'Settings > Time & language > Language & region > your language > Language options > install "Speech recognition", then restart the app.' });
  else if (!usable.length) out.push({ id: 'recognizer', label: 'Speech recognizer', status: 'fail', detail: `Installed: ${recognizers.join(', ')}. None matches ${wanted.join(' or ')}.`, fix: 'Install the English or German speech recognition language in Windows settings, or pick another language here.' });
  else out.push({ id: 'recognizer', label: 'Speech recognizer', status: 'ok', detail: `Installed: ${recognizers.join(', ')}.` });
  const privacy = [
    denied(d.micMachine) && 'Microphone access is off for this device',
    denied(d.micUser) && 'Microphone access is off for your account',
    denied(d.micDesktopApps) && '"Let desktop apps access your microphone" is off',
  ].filter(Boolean) as string[];
  out.push(privacy.length
    ? { id: 'privacy', label: 'Microphone permission', status: 'fail', detail: privacy.join('. ') + '.', fix: 'Settings > Privacy & security > Microphone: turn on "Microphone access" and "Let desktop apps access your microphone".' }
    : { id: 'privacy', label: 'Microphone permission', status: 'ok', detail: 'Windows allows desktop apps to use the microphone.' });
  out.push(d.micOpen
    ? { id: 'mic', label: 'Default microphone', status: 'ok', detail: 'Opened successfully.' }
    : { id: 'mic', label: 'Default microphone', status: 'fail', detail: d.micError || 'Could not open the default recording device.', fix: 'Plug in or enable a microphone and choose it under Settings > System > Sound > Input.' });
  const devices = d.inputDevices ?? [];
  out.push(devices.length
    ? { id: 'devices', label: 'Input devices', status: 'ok', detail: devices.slice(0, 4).join(', ') }
    : { id: 'devices', label: 'Input devices', status: 'warn', detail: 'No microphone found in the device list.', fix: 'Check that your microphone is connected and not disabled in Sound settings.' });
  return out;
}

export const diagnosisReport = (d: VoiceDiagnosis, checks: Check[]) => [
  'Study with Sarang voice check',
  ...checks.map((check) => `${check.status.toUpperCase().padEnd(4)} ${check.label}: ${check.detail}${check.fix ? ` (${check.fix})` : ''}`),
  `Raw: ${JSON.stringify(d)}`,
].join('\n');
