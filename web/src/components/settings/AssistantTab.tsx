import { useSyncExternalStore } from 'react';
import { GROUPS, type ConfirmMode } from '../../lib/agent';
import { clearAgent, getAgent, openAgent, subscribeAgent } from '../../lib/agentStore';
import { providerInfo } from '../../lib/flowApi';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { useSettings } from '../../context/SettingsContext';
import { Card, Toggle } from '../desktop/shared';
import { openAiGuide, readGuide } from '../agent/AiGuide';
import { Row, Segmented } from './parts';

/** Settings for the assistant that acts in the app: on or off, how often it must ask, and which kinds of action it may take. */
export function AssistantTab() {
  const [prefs] = usePrefs();
  const a = prefs.agent;
  const st = useSyncExternalStore(subscribeAgent, getAgent, getAgent);
  const { closeSettings } = useSettings();
  const set = (patch: Partial<typeof a>) => setPrefs({ agent: { ...a, ...patch } });
  const chat = prefs.flow.chatProvider;
  const ready = chat !== 'off';
  const guide = readGuide();
  return <div className="grid gap-5">
    <Card title="Assistant" hint="Tell it what you want in plain words and it does it: change a setting, add a to-do, set your goal, build an automation. It uses your own AI key and works through the same options you see in Settings.">
      <div className="grid gap-2">
        <Toggle label="Turn the assistant on" hint="Off hides the button in the top bar and stops all assistant requests." checked={a.enabled} onChange={(enabled) => set({ enabled })} />
        <p role="status" data-testid="assistant-status" className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted">{ready ? `Using ${providerInfo(chat).short}${prefs.flow.chatModel ? ` (${prefs.flow.chatModel})` : ''} with your own key. ` : 'No AI service chosen yet. '}{guide?.done ? '' : 'The walkthrough shows free options and tests your key.'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="studio-button" onClick={() => openAiGuide()} data-testid="assistant-guide">{ready ? 'Run the AI walkthrough again' : 'Open the AI walkthrough'}</button>
          <button type="button" className="studio-button" disabled={!a.enabled} onClick={() => { closeSettings(); openAgent(); }} data-testid="assistant-open">Open the assistant</button>
          <button type="button" className="studio-button" disabled={!st.items.length} onClick={clearAgent}>Clear the conversation</button>
        </div>
      </div>
    </Card>
    <Card title="Ask before it acts" hint="You decide how much trust to give it. Reading the app is always free; this is about changing things.">
      <div className="grid gap-2">
        <Row label="Confirmation" hint={a.confirm === 'off' ? 'It acts straight away. Everything it did is listed under its answer, and the notification list records it.' : a.confirm === 'changes' ? 'A card asks you to Allow or Decline each change.' : 'A card asks you before every single action, even looking things up.'}>
          <Segmented<ConfirmMode> label="Confirmation" value={a.confirm} onChange={(confirm) => set({ confirm })} options={[{ id: 'off', label: 'Never' }, { id: 'changes', label: 'Changes' }, { id: 'all', label: 'Everything' }]} /></Row>
        <Toggle label="Show what it did" hint="A short list of actions under each answer." checked={a.showSteps} onChange={(showSteps) => set({ showSteps })} />
      </div>
    </Card>
    <Card title="What it may do" hint="Switch off any kind of action you never want it to take. Tools you switch off are not even offered to the AI.">
      <div className="grid gap-2">
        {GROUPS.map((g) => <Toggle key={g.id} label={g.label} hint={g.hint} checked={a.groups[g.id]} onChange={(on) => set({ groups: { ...a.groups, [g.id]: on } })} />)}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">Never available to it, whatever you switch on: your API keys, the browser pairing code, server addresses, quitting the app and deleting your data. Window and monitor layouts of the desktop app are reached through commands only. The shared dictation helper is never used for the assistant: it needs your own key or a model on your computer, and it only sees what you type to it plus the results of the actions it takes.</p>
    </Card>
  </div>;
}
