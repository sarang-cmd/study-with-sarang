'use strict';
/** Pure window placement helpers (no Electron imports, so they are unit tested). */

const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
const area = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/**
 * Returns bounds that are guaranteed to be visible. The saved monitor is preferred, so the
 * window comes back on the same screen. If that screen is gone, it moves to the primary one.
 * displays: [{ id, workArea: {x,y,width,height} }]
 */
function restoreBounds(saved, displays, primaryId, fallbackSize) {
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0];
  const size = { width: saved?.width ?? fallbackSize.width, height: saved?.height ?? fallbackSize.height };
  const center = (display) => {
    const wa = display.workArea;
    const width = Math.min(size.width, wa.width), height = Math.min(size.height, wa.height);
    return { x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2), width, height, displayId: display.id };
  };
  if (!saved || typeof saved.x !== 'number') return center(primary);
  const rect = { x: saved.x, y: saved.y, width: size.width, height: size.height };
  const sameScreen = displays.find((d) => d.id === saved.displayId);
  let target = sameScreen && intersects(rect, sameScreen.workArea) ? sameScreen : null;
  if (!target) {
    let best = 0;
    for (const d of displays) { const overlap = area(rect, d.workArea); if (overlap > best) { best = overlap; target = d; } }
  }
  if (!target) return center(primary);
  const wa = target.workArea;
  const width = Math.min(size.width, wa.width), height = Math.min(size.height, wa.height);
  return {
    x: clamp(rect.x, wa.x - width + 120, wa.x + wa.width - 120), // Keep at least 120px of the title bar reachable.
    y: clamp(rect.y, wa.y, wa.y + wa.height - 48),
    width, height, displayId: target.id,
  };
}

/** Where the compact bar first appears: the bottom-right corner of the display the window is on. */
function compactDefault(display, size, margin = 20) {
  const wa = display.workArea;
  return { x: wa.x + wa.width - size.width - margin, y: wa.y + wa.height - size.height - margin, width: size.width, height: size.height, displayId: display.id };
}

module.exports = { restoreBounds, compactDefault, intersects };
