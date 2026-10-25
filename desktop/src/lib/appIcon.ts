import { iconDataUri, type IconId } from './iconSet';

/** Browser tab icon (and the desktop page's favicon). The desktop shell sets the window, taskbar, tray and shortcut icons itself. */
export function applyFavicon(kind: IconId) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  link.setAttribute('href', iconDataUri(kind));
  let touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!touch) { touch = document.createElement('link'); touch.rel = 'apple-touch-icon'; document.head.appendChild(touch); }
  touch.setAttribute('href', iconDataUri(kind, { size: 180 }));
}
