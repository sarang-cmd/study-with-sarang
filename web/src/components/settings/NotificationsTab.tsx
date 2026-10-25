import { useState, useSyncExternalStore } from 'react';
import { testOsNotification, askOsPermission, celebrate, clearNotes, getNotes, getNotifySettings, minutesLabel, NOTE_KINDS, parseMinutes, setNotifySettings, subscribeNotes, addNote } from '../../lib/notifications';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';
import { notify } from '../ui/toast';

export function NotificationsTab() {
  const s = useSyncExternalStore(subscribeNotes, getNotifySettings, getNotifySettings);
  const notes = useSyncExternalStore(subscribeNotes, getNotes, getNotes);
  const [prefs] = usePrefs();
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const time = 'field !min-h-8 !w-[88px] !py-1 text-center text-[11px]';
  return <div className="grid gap-5">
    <Card title="Notification centre" hint="The bell in the top bar keeps a list of what the app told you, so a message that faded is never lost. It stays on this device.">
      <div className="grid gap-2">
        <Toggle label="Quick confirmations" hint="Small messages for actions such as skip, next and reset." checked={prefs.toasts} onChange={(toasts) => setPrefs({ toasts })} />
        <Toggle label="Unread number on the bell" checked={s.badge} onChange={(badge) => setNotifySettings({ badge })} />
        <Slider label="Keep the last" value={s.history} min={20} max={500} step={10} defaultValue={100} onChange={(history) => setNotifySettings({ history })} format={(v) => `${v} notifications`} />
        <Row label="In the list" hint="Untick a group to stop it being listed. Pop-ups for that group stay as set below."><span className="flex max-w-[360px] flex-wrap justify-end gap-1.5">
          {NOTE_KINDS.map((k) => <button key={k.id} type="button" role="switch" aria-checked={s.kinds[k.id]} title={k.hint} onClick={() => setNotifySettings({ kinds: { ...s.kinds, [k.id]: !s.kinds[k.id] } })}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${s.kinds[k.id] ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{k.label}</button>)}</span></Row>
        <div className="flex flex-wrap gap-2"><button type="button" className="studio-button" disabled={!notes.length} onClick={() => clearNotes()}>Clear the list ({notes.length})</button>
          <button type="button" className="studio-button" onClick={() => { addNote({ kind: 'system', title: 'Test notification', message: 'This is what a notification looks like.' }); notify({ title: 'Test notification', message: 'This is what a notification looks like.', record: false }); }}>Send a test</button></div>
      </div>
    </Card>
    <Card title="Achievement unlocks" hint="How a new badge is shown the moment you earn it.">
      <div className="grid gap-2">
        <Toggle label="Announce unlocked achievements" checked={prefs.achievementToasts} onChange={(achievementToasts) => setPrefs({ achievementToasts })} />
        <Row label="Style" hint="Full: a card with the badge drawing itself in. Small: a card in the corner. Off: only the list."><Segmented label="Unlock style" value={s.celebrate} onChange={(celebrate) => setNotifySettings({ celebrate })} options={[{ id: 'full', label: 'Full' }, { id: 'subtle', label: 'Small' }, { id: 'off', label: 'Off' }]} /></Row>
        <Slider label="Stays for" value={s.celebrateSeconds} min={3} max={20} defaultValue={7} onChange={(celebrateSeconds) => setNotifySettings({ celebrateSeconds })} format={(v) => `${v} s`} />
        <Toggle label="Soft chime" hint="Uses the same switch as the other interface sounds." checked={prefs.uiSounds} onChange={(uiSounds) => setPrefs({ uiSounds })} />
        <div><button type="button" className="studio-button" onClick={() => celebrate([{ id: 'preview', title: 'In the zone', text: 'Focus for 10 hours in total.', icon: 'brain', tier: 3 }])}>Preview an unlock</button></div>
      </div>
    </Card>
    <Card title="Outside the app" hint="Optional system notifications while this window is in the background.">
      <div className="grid gap-2">
        <Toggle label="System notifications" hint="Shows unlocks, goals and reminders in your system notification area when the app is not in front." checked={s.osAlerts} onChange={(osAlerts) => { setNotifySettings({ osAlerts }); if (osAlerts) void askOsPermission(); }} />
        <Row label="Show them" hint="When away: only while you are in another window or this one is minimised. Always: even while you are using the app."><Segmented label="When to show system notifications" value={s.osWhen} onChange={(osWhen) => setNotifySettings({ osWhen })} options={[{ id: 'away', label: 'When away' }, { id: 'always', label: 'Always' }]} /></Row>
        <div className="flex flex-wrap items-center gap-2"><button type="button" className="studio-button" data-testid="os-test" onClick={() => { setTest(null); void testOsNotification().then(setTest); }}>Send a test notification</button>
          {test && <p role="status" data-testid="os-test-result" className={`text-[11px] leading-snug ${test.ok ? 'text-muted' : 'font-semibold text-ink'}`}>{test.text}</p>}</div>
        <Toggle label="Quiet hours" hint="No pop-ups, chimes or system notifications in this time. Everything is still listed in the bell." checked={s.quiet.on} onChange={(on) => setNotifySettings({ quiet: { ...s.quiet, on } })} />
        {s.quiet.on && <Row label="From and to"><span className="flex items-center gap-2"><input className={time} type="time" value={minutesLabel(s.quiet.from)} onChange={(e) => setNotifySettings({ quiet: { ...s.quiet, from: parseMinutes(e.target.value, s.quiet.from) } })} aria-label="Quiet hours start" /><span className="text-[11px] text-muted">to</span><input className={time} type="time" value={minutesLabel(s.quiet.to)} onChange={(e) => setNotifySettings({ quiet: { ...s.quiet, to: parseMinutes(e.target.value, s.quiet.to) } })} aria-label="Quiet hours end" /></span></Row>}
      </div>
    </Card>
  </div>;
}
