import { Leaf } from 'lucide-react';
import { useFeatures } from '../../hooks/useFeatures';
import { usePrefs } from '../../lib/prefs';
import { chooseLevel, setCustomFromPreset, setFeature, toggleSimple } from '../../lib/uiActions';
import { FEATURES, LEVEL_BLURBS, LEVEL_LABELS, type PresetLevel, type UiLevel } from '../../lib/uiLevel';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';

const GROUPS = ['Pages', 'Studio', 'Library and progress', 'Top bar'] as const;

export function InterfaceTab() {
  const [prefs] = usePrefs();
  const features = useFeatures();
  const level = prefs.uiLevel;
  const pick = (next: UiLevel) => { if (next === 'custom') setCustomFromPreset(prefs.uiPrev === 'power' ? 'power' : 'standard'); else chooseLevel(next as PresetLevel); };
  return <div className="grid gap-5">
    <Card title="Interface level" hint="How much of the app you see. Nothing is deleted: every feature stays one switch away, and Settings is always available.">
      <Row label="Level" hint={LEVEL_BLURBS[level]}>
        <Segmented<UiLevel> label="Interface level" value={level} onChange={pick} options={(['simple', 'standard', 'power', 'custom'] as UiLevel[]).map((id) => ({ id, label: LEVEL_LABELS[id] }))} />
      </Row>
      <div className="mt-2 grid gap-2">
        <Row label="Top bar switch" hint="The leaf button next to Zen view flips between Simple and the level you had before.">
          <button type="button" className="studio-button" aria-pressed={level === 'simple'} onClick={toggleSimple}><Leaf size={13} aria-hidden="true" /> {level === 'simple' ? 'Simple view is on' : 'Try Simple view'}</button>
        </Row>
      </div>
      <ul className="mt-3 grid gap-1.5 text-[11px] leading-snug text-muted">
        <li><strong className="text-ink">Simple:</strong> Studio and Library only. The sound card, a timer without extra modes, and a short weekly summary. Layers and fine tuning sit in "More" drawers.</li>
        <li><strong className="text-ink">Standard:</strong> every page, without the intro strip, the shortcut and palette buttons, or the footer notes.</li>
        <li><strong className="text-ink">Power:</strong> everything, the app as it always was.</li>
      </ul>
    </Card>
    <Card title="Choose exactly what to show" hint={level === 'custom' ? 'You are using your own selection.' : 'Change any switch and the level becomes Custom. Your other choices stay as they are.'}>
      <div className="grid gap-5">
        {GROUPS.map((group) => <div key={group}>
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">{group}</p>
          <div className="grid gap-2">
            {FEATURES.filter((item) => item.group === group).map((item) => <Toggle key={item.id} label={item.label} hint={item.hint} checked={features[item.id]} onChange={(value) => setFeature(item.id, value)} />)}
          </div>
        </div>)}
      </div>
    </Card>
  </div>;
}
