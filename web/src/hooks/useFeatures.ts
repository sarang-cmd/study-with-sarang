import { useMemo } from 'react';
import { usePrefs } from '../lib/prefs';
import { resolveFeatures, type FeatureMap } from '../lib/uiLevel';

/** Which parts of the app the current interface level shows. */
export function useFeatures(): FeatureMap {
  const [prefs] = usePrefs();
  return useMemo(() => resolveFeatures(prefs.uiLevel, prefs.uiShow, prefs.advanced), [prefs.uiLevel, prefs.uiShow, prefs.advanced]);
}
