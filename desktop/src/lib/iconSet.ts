/**
 * The app icons people can choose from. One definition draws all of them: the in-app logo, the browser tab icon, the media
 * flyout artwork, and (through scripts/make-icons.cjs) the .ico, window, taskbar and tray files used by the desktop app.
 */
export const ICON_IDS = ['default', 'classic', 'ring', 'bars', 'moon', 'leaf', 'timer', 'paper'] as const;
export type IconId = (typeof ICON_IDS)[number];

interface IconDef { id: IconId; label: string; blurb: string; light?: boolean; mark: (ink: string, bg: string) => string }
const stroke = (ink: string, width: number, extra = '') => `fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}`;
const waves = (ink: string) => `<path d="M9 40c8-9 14 5 23-4s15 3 23-5" ${stroke(ink, 2.6, 'opacity=".32"')}/><path d="M9 33c8-10 14 4 23-5s15 3 23-6" ${stroke(ink, 2.6, 'opacity=".6"')}/><circle cx="32" cy="31" r="5" fill="${ink}"/>`;

export const ICONS: IconDef[] = [
  { id: 'default', label: 'Waves', blurb: 'The original: soft waves and a dot.', mark: (ink) => waves(ink) },
  { id: 'classic', label: 'Dot', blurb: 'One dot. Quiet and simple.', mark: (ink) => `<circle cx="32" cy="32" r="8" fill="${ink}"/>` },
  { id: 'ring', label: 'Ring', blurb: 'A calm ring around a focus point.', mark: (ink) => `<circle cx="32" cy="32" r="16" ${stroke(ink, 4.5)}/><circle cx="32" cy="32" r="4.5" fill="${ink}"/>` },
  { id: 'bars', label: 'Voice', blurb: 'Five bars, like sound.', mark: (ink) => [[14, 24], [23, 34], [32, 44], [41, 30], [50, 20]].map(([x, h]) => `<rect x="${x - 2.6}" y="${32 - h / 2}" width="5.2" height="${h}" rx="2.6" fill="${ink}"/>`).join('') },
  { id: 'moon', label: 'Night', blurb: 'A crescent for late sessions.', mark: (ink) => `<path d="M39 13A19 19 0 1 0 51 42A15 15 0 0 1 39 13Z" fill="${ink}"/>` },
  { id: 'leaf', label: 'Leaf', blurb: 'For calm, steady study.', mark: (ink, bg) => `<path d="M17 47C17 28 29 15 48 15c0 19-11 32-27 32z" fill="${ink}"/><path d="M21 43L40 24" ${stroke(bg, 2.6)}/>` },
  { id: 'timer', label: 'Timer', blurb: 'A ring that is three quarters full.', mark: (ink) => `<circle cx="32" cy="32" r="17" ${stroke(ink, 5, 'opacity=".28"')}/><path d="M32 15A17 17 0 1 1 15 32" ${stroke(ink, 5)}/><circle cx="32" cy="32" r="3.4" fill="${ink}"/>` },
  { id: 'paper', label: 'Paper', blurb: 'The waves on a light tile.', light: true, mark: (ink) => waves(ink) },
];

export const iconDef = (id: string) => ICONS.find((icon) => icon.id === id) ?? ICONS[0];
export const isIconId = (value: unknown): value is IconId => typeof value === 'string' && (ICON_IDS as readonly string[]).includes(value);

export interface SvgOptions { size?: number; template?: boolean; round?: number; ink?: string; bg?: string }
/** A complete SVG for an icon. `template` draws only the mark in black on a transparent background (macOS menu bar). */
export function iconSvg(id: string, options: SvgOptions = {}): string {
  const def = iconDef(id);
  const { size = 64, template = false, round = 15 } = options;
  const ink = template ? '#000' : options.ink ?? (def.light ? '#171717' : '#ffffff');
  const bg = template ? 'none' : options.bg ?? (def.light ? '#f3f3f1' : '#171717');
  const tile = template ? '' : `<rect width="64" height="64" rx="${round}" fill="${bg}"${def.light ? ' stroke="#d4d4d0" stroke-width="1.5"' : ''}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${tile}${def.mark(ink, bg === 'none' ? '#ffffff' : bg)}</svg>`;
}
export const iconDataUri = (id: string, options?: SvgOptions) => `data:image/svg+xml,${encodeURIComponent(iconSvg(id, options))}`;
