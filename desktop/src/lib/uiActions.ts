import { getPrefs, setPrefs } from './prefs';
import { notify } from '../components/ui/toast';
import { resolveFeatures, type FeatureId, type PresetLevel } from './uiLevel';

/** Pick Simple, Standard or Power. */
export function chooseLevel(level: PresetLevel) {
  const prefs = getPrefs();
  setPrefs({ advanced: true, uiLevel: level, uiPrev: level === 'simple' ? prefs.uiPrev : level });
}
/** The top bar switch: into Simple, and back to whatever level you had before. */
export function toggleSimple() {
  const prefs = getPrefs();
  if (!prefs.advanced) { notify({ title: 'Essentials is the simple view', message: 'Settings > Advanced turns on the full feature set.', variant: 'default', id: 'essentials-simple', duration: 3200 }); return; }
  if (prefs.uiLevel === 'simple') setPrefs({ uiLevel: prefs.uiPrev === 'simple' ? 'standard' : prefs.uiPrev });
  else setPrefs({ uiPrev: prefs.uiLevel, uiLevel: 'simple' });
}
/** Show or hide one item. The level becomes Custom and keeps everything else as it was. */
export function setFeature(id: FeatureId, value: boolean) {
  const prefs = getPrefs();
  const base = resolveFeatures(prefs.uiLevel, prefs.uiShow, true);
  setPrefs({ advanced: true, uiLevel: 'custom', uiShow: { ...base, [id]: value }, uiPrev: prefs.uiLevel === 'simple' ? prefs.uiPrev : 'custom' });
}
export function setCustomFromPreset(level: PresetLevel) {
  const prefs = getPrefs();
  setPrefs({ advanced: true, uiLevel: 'custom', uiShow: { ...resolveFeatures(level, {}) }, uiPrev: prefs.uiLevel === 'simple' ? prefs.uiPrev : 'custom' });
}
