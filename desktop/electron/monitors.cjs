'use strict';
/**
 * Monitor helpers (no Electron imports, so they are unit tested): stable keys and readable names for screens, the rules the person
 * sets ("when this monitor connects, move here and open Zen"), "keep the app on this one monitor", and the snap layouts.
 */
const LAYOUTS = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright', 'center', 'third-left', 'third-middle', 'third-right'];
const LAYOUT_LABELS = {
  left: 'Left half', right: 'Right half', top: 'Top half', bottom: 'Bottom half', topleft: 'Top left', topright: 'Top right', bottomleft: 'Bottom left', bottomright: 'Bottom right',
  center: 'Centered', 'third-left': 'Left third', 'third-middle': 'Middle third', 'third-right': 'Right third',
};
const THEN = ['none', 'zen', 'zen-full', 'zen-off', 'compact', 'expand', ...LAYOUTS.map((l) => `snap:${l}`)];
const MAX_RULES = 12;
const text = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');

/** Identifies a screen across restarts. Two identical screens get "#2" and so on, in left to right order (see describe). */
function baseKey(d) {
  const label = text(d.label, 60) || (d.internal ? 'internal' : 'display');
  return `${label}|${d.size?.width ?? 0}x${d.size?.height ?? 0}|${d.internal ? 'i' : 'e'}`;
}

/** Every screen as the page shows it: left to right, with a readable name instead of "main" and "secondary". */
function describe(displays, { primaryId, currentId, names = {} } = {}) {
  const sorted = [...displays].sort((a, b) => (a.bounds?.x ?? 0) - (b.bounds?.x ?? 0) || (a.bounds?.y ?? 0) - (b.bounds?.y ?? 0));
  const seen = {}; const primary = displays.find((d) => d.id === primaryId) ?? displays[0];
  const out = sorted.map((d) => {
    const base = baseKey(d); seen[base] = (seen[base] ?? 0) + 1;
    const key = seen[base] > 1 ? `${base}#${seen[base]}` : base;
    const label = text(d.label, 60);
    const generic = !label || /^(generic (pnp )?monitor|default monitor|monitor|display)$/i.test(label);
    const natural = d.internal ? (generic ? 'Built-in screen' : label) : (generic ? '' : label);
    let where = '';
    if (primary && d.id !== primary.id) {
      const a = d.bounds, b = primary.bounds;
      where = a.x + a.width <= b.x + 1 ? 'left' : a.x >= b.x + b.width - 1 ? 'right' : a.y + a.height <= b.y + 1 ? 'above' : 'below';
    }
    return {
      key, id: d.id, nickname: text(names[key], 40), natural, label, width: d.size?.width ?? 0, height: d.size?.height ?? 0, scale: d.scaleFactor ?? 1,
      primary: !!primary && d.id === primary.id, internal: !!d.internal, current: d.id === currentId, where, x: d.bounds?.x ?? 0, y: d.bounds?.y ?? 0,
    };
  });
  // Names: your nickname, else the screen's own name, else its place from left to right ("Left screen"). Same names get 1, 2.
  const stacked = out.length > 1 && out.every((m) => m.x === out[0].x);
  const place = (i) => (out.length === 2 ? (stacked ? ['Top', 'Bottom'] : ['Left', 'Right'])[i] + ' screen' : out.length === 3 ? ['Left', 'Middle', 'Right'][i] + ' screen' : `Screen ${i + 1}`);
  const raw = out.map((m, i) => m.nickname || m.natural || (out.length === 1 ? 'Screen' : place(i)));
  const count = {}; raw.forEach((n) => { count[n] = (count[n] ?? 0) + 1; });
  const idx = {};
  out.forEach((m, i) => { const n = raw[i]; if (count[n] > 1) { idx[n] = (idx[n] ?? 0) + 1; m.name = `${n} (${idx[n]})`; } else m.name = n; });
  return out;
}

function sanitizeConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const names = {};
  if (r.names && typeof r.names === 'object') for (const [k, v] of Object.entries(r.names).slice(0, 24)) { const key = text(k, 120), name = text(v, 40); if (key && name) names[key] = name; }
  const seen = {};
  if (r.seen && typeof r.seen === 'object') for (const [k, v] of Object.entries(r.seen).slice(0, 24)) { const key = text(k, 120); if (key && v && typeof v === 'object') seen[key] = { name: text(v.name, 40) || 'Screen', width: Math.max(0, Math.min(20000, Math.round(Number(v.width) || 0))), height: Math.max(0, Math.min(20000, Math.round(Number(v.height) || 0))) }; }
  const rules = [];
  for (const x of Array.isArray(r.rules) ? r.rules.slice(0, MAX_RULES) : []) {
    if (!x || typeof x !== 'object') continue;
    const on = x.on === 'disconnect' ? 'disconnect' : 'connect';
    rules.push({
      id: text(x.id, 24) || `r${rules.length + 1}`, enabled: x.enabled !== false, on, monitor: text(x.monitor, 120),
      moveTo: text(x.moveTo, 120) || (on === 'connect' ? 'trigger' : 'primary'), then: THEN.includes(x.then) ? x.then : 'none', atStart: x.atStart === true,
    });
  }
  return { names, seen, onlyOn: text(r.onlyOn, 120), rules };
}

/** Bounds for a snap layout inside a screen's work area. */
function snapBounds(wa, layout) {
  const hw = Math.floor(wa.width / 2), hh = Math.floor(wa.height / 2), tw = Math.floor(wa.width / 3);
  const at = (x, y, w, h) => ({ x: wa.x + x, y: wa.y + y, width: w, height: h });
  switch (layout) {
    case 'left': return at(0, 0, hw, wa.height);
    case 'right': return at(hw, 0, wa.width - hw, wa.height);
    case 'top': return at(0, 0, wa.width, hh);
    case 'bottom': return at(0, hh, wa.width, wa.height - hh);
    case 'topleft': return at(0, 0, hw, hh);
    case 'topright': return at(hw, 0, wa.width - hw, hh);
    case 'bottomleft': return at(0, hh, hw, wa.height - hh);
    case 'bottomright': return at(hw, hh, wa.width - hw, wa.height - hh);
    case 'third-left': return at(0, 0, tw, wa.height);
    case 'third-middle': return at(tw, 0, tw, wa.height);
    case 'third-right': return at(tw * 2, 0, wa.width - tw * 2, wa.height);
    case 'center': { const w = Math.round(wa.width * 0.7), h = Math.round(wa.height * 0.8); return at(Math.round((wa.width - w) / 2), Math.round((wa.height - h) / 2), w, h); }
    default: return null;
  }
}

/** The window's bounds moved onto another screen: same size (shrunk if needed), kept inside, and in the same relative place. */
function moveInto(bounds, fromArea, toArea) {
  const width = Math.min(bounds.width, toArea.width), height = Math.min(bounds.height, toArea.height);
  const fx = fromArea && fromArea.width > bounds.width ? (bounds.x - fromArea.x) / (fromArea.width - bounds.width) : 0.5;
  const fy = fromArea && fromArea.height > bounds.height ? (bounds.y - fromArea.y) / (fromArea.height - bounds.height) : 0.5;
  const cl = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));
  return { x: Math.round(toArea.x + cl(fx) * (toArea.width - width)), y: Math.round(toArea.y + cl(fy) * (toArea.height - height)), width, height };
}

/**
 * Which rules fire for an event, and where the app should go.
 * event: { type: 'connect' | 'disconnect' | 'start', key } (key = the screen that came or went; not used for 'start')
 * connected: describe() of the screens that are connected now. Returns [{ ruleId, target: key | 'primary' | null, then }]
 */
function planRules(rules, event, connected) {
  const out = []; const primary = connected.find((m) => m.primary) ?? connected[0];
  const has = (key) => connected.find((m) => m.key === key);
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let trigger = null;
    if (event.type === 'start') {
      if (rule.on !== 'connect' || !rule.atStart || !rule.monitor || !has(rule.monitor)) continue;
      trigger = rule.monitor;
    } else {
      if (rule.on !== event.type) continue;
      if (rule.monitor && rule.monitor !== event.key) continue;
      trigger = event.key;
    }
    let target = null;
    if (rule.moveTo === 'keep') target = null;
    else if (rule.moveTo === 'primary') target = 'primary';
    else if (rule.moveTo === 'trigger') target = event.type === 'disconnect' ? 'primary' : trigger;
    else target = has(rule.moveTo) ? rule.moveTo : null;
    if (target && target !== 'primary' && !has(target)) target = null;
    if (target === 'primary' && !primary) target = null;
    if (target === null && rule.then === 'none') continue;
    out.push({ ruleId: rule.id, target, then: rule.then });
  }
  return out;
}

/** "Keep the app on one monitor": which screen should the window go back to? null when it is already right or that screen is not connected. */
function enforceTarget(onlyOnKey, connected, currentKey) {
  if (!onlyOnKey || onlyOnKey === currentKey) return null;
  return connected.find((m) => m.key === onlyOnKey) ? onlyOnKey : null;
}

module.exports = { LAYOUTS, LAYOUT_LABELS, THEN, MAX_RULES, baseKey, describe, sanitizeConfig, snapBounds, moveInto, planRules, enforceTarget };
