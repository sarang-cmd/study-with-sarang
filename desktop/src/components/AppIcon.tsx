import { iconSvg } from '../lib/iconSet';
import { usePrefs } from '../lib/prefs';

/** The chosen app icon, drawn inline so it follows the setting everywhere in the page (header, settings, tutorial). */
export function AppIcon({ id, size = 32, className = '' }: { id?: string; size?: number; className?: string }) {
  const [prefs] = usePrefs();
  const kind = id ?? prefs.appIcon;
  return <span className={`inline-flex shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(kind, { size }) }} />;
}
