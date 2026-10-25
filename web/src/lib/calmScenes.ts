import type { SceneId } from './calm';

/**
 * The calm scenes. Each one draws grayscale shapes with the page's text color on a transparent canvas, so light and dark themes both work.
 * They take a little "energy" (0 to 1) from the sound that is playing, so they breathe with it when you allow that.
 */
export interface SceneParams { time: number; dt: number; energy: number; intensity: number; speed: number; reduced: boolean; ink: string; }
export interface Scene { draw: (ctx: CanvasRenderingContext2D, width: number, height: number, p: SceneParams) => void }

// A small deterministic random generator so scenes start the same way and tests are repeatable.
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const TAU = Math.PI * 2;

function aurora(): Scene {
  return { draw(ctx, w, h, p) {
    const t = p.time * .00012 * p.speed / 100;
    const bands = 4 + Math.round(p.intensity / 25);
    ctx.save(); ctx.fillStyle = p.ink;
    for (let b = 0; b < bands; b++) {
      const base = h * (.28 + .1 * b);
      const grad = ctx.createLinearGradient(0, base - h * .22, 0, base + h * .18);
      const a = (.02 + .05 * p.intensity / 100) * (1 + p.energy * .8);
      grad.addColorStop(0, 'transparent'); grad.addColorStop(.5, p.ink); grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = a;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) { const y = base + Math.sin(x * .004 + t * (2 + b * .6) + b) * h * .07 + Math.sin(x * .011 - t * 3 + b * 2) * h * .03; ctx.lineTo(x, y); }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  } };
}

function rain(): Scene {
  const r = rng(11); const drops: { x: number; y: number; v: number; size: number; trail: number }[] = [];
  const beads: { x: number; y: number; s: number }[] = [];
  return { draw(ctx, w, h, p) {
    const target = Math.round(10 + p.intensity * .5);
    while (drops.length < target) drops.push({ x: r() * w, y: -r() * h * .3, v: 20 + r() * 50, size: 1.6 + r() * 2.6, trail: 0 });
    while (beads.length < target * 5) beads.push({ x: r() * w, y: r() * h, s: .6 + r() * 1.4 });
    ctx.save(); ctx.fillStyle = p.ink; ctx.strokeStyle = p.ink; ctx.lineCap = 'round';
    ctx.globalAlpha = .12; for (const b of beads) { ctx.beginPath(); ctx.arc(b.x, b.y, b.s, 0, TAU); ctx.fill(); }
    for (const d of drops) {
      const step = d.v * (p.speed / 100) * p.dt / 1000 * (1 + p.energy * .6);
      d.y += step; d.trail = Math.min(70, d.trail + step * .6);
      if (d.y > h + 20) { d.y = -10; d.x = r() * w; d.trail = 0; d.v = 20 + r() * 50; }
      ctx.globalAlpha = .06; ctx.lineWidth = d.size * .7; ctx.beginPath(); ctx.moveTo(d.x, d.y - d.trail); ctx.lineTo(d.x, d.y); ctx.stroke();
      ctx.globalAlpha = .28; ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, TAU); ctx.fill();
    }
    ctx.restore();
  } };
}

function stars(): Scene {
  const r = rng(5); const list = Array.from({ length: 160 }, () => ({ x: r(), y: r(), s: .4 + r() * 1.6, f: .3 + r() * 1.7, o: r() * TAU }));
  return { draw(ctx, w, h, p) {
    const count = Math.round(40 + p.intensity * 1.2);
    ctx.save(); ctx.fillStyle = p.ink;
    for (let i = 0; i < count && i < list.length; i++) {
      const s = list[i];
      const tw = p.reduced ? .7 : .5 + .5 * Math.sin(p.time * .001 * s.f * p.speed / 100 + s.o);
      ctx.globalAlpha = (.12 + .55 * tw) * (1 + p.energy * .5);
      const x = ((s.x * w + p.time * .002 * p.speed / 100 * s.s) % w + w) % w;
      ctx.beginPath(); ctx.arc(x, s.y * h, s.s * (1 + p.energy * .4), 0, TAU); ctx.fill();
    }
    ctx.restore();
  } };
}

function ripples(): Scene {
  const rings: { x: number; y: number; age: number; max: number }[] = [];
  let next = 0; const r = rng(23);
  return { draw(ctx, w, h, p) {
    next -= p.dt * (p.speed / 100) * (1 + p.energy * 1.5);
    if (next <= 0 && rings.length < 4 + p.intensity / 12) { rings.push({ x: w * (.2 + r() * .6), y: h * (.3 + r() * .5), age: 0, max: Math.min(w, h) * (.25 + r() * .3) }); next = 1500 - p.intensity * 7; }
    ctx.save(); ctx.strokeStyle = p.ink; ctx.lineWidth = 1.4;
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i]; ring.age += p.dt * (p.speed / 100) / 5200;
      if (ring.age >= 1) { rings.splice(i, 1); continue; }
      for (let k = 0; k < 3; k++) { const a = ring.age - k * .08; if (a <= 0) continue; ctx.globalAlpha = (1 - a) * (.3 - k * .08); ctx.beginPath(); ctx.arc(ring.x, ring.y, a * ring.max, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();
  } };
}

function embers(): Scene {
  const r = rng(77); const sparks: { x: number; y: number; v: number; s: number; sway: number; o: number }[] = [];
  return { draw(ctx, w, h, p) {
    const target = Math.round(14 + p.intensity * .9);
    while (sparks.length < target) sparks.push({ x: r() * w, y: h + r() * h * .2, v: 12 + r() * 30, s: .8 + r() * 2.2, sway: r() * 30, o: r() * TAU });
    ctx.save(); ctx.fillStyle = p.ink;
    for (const s of sparks) {
      s.y -= s.v * (p.speed / 100) * p.dt / 1000 * (1 + p.energy);
      if (s.y < -10) { s.y = h + 10; s.x = r() * w; }
      const life = Math.max(0, Math.min(1, s.y / h));
      ctx.globalAlpha = .08 + .5 * life * (.6 + .4 * Math.sin(p.time * .003 + s.o));
      ctx.beginPath(); ctx.arc(s.x + Math.sin(p.time * .0008 + s.o) * s.sway, s.y, s.s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  } };
}

function drift(): Scene {
  const r = rng(41); const puffs = Array.from({ length: 9 }, () => ({ x: r(), y: .25 + r() * .6, s: .25 + r() * .35, v: .3 + r() * .7 }));
  return { draw(ctx, w, h, p) {
    ctx.save();
    const count = Math.max(3, Math.round(puffs.length * (.4 + p.intensity / 170)));
    for (let i = 0; i < count; i++) {
      const puff = puffs[i];
      const x = ((puff.x * w + p.time * .018 * puff.v * p.speed / 100) % (w * 1.6)) - w * .3;
      const y = puff.y * h + Math.sin(p.time * .0003 * puff.v + i) * 20;
      const radius = Math.max(w, h) * puff.s * (1 + p.energy * .15);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, p.ink); grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = .035 + .03 * p.intensity / 100; ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    }
    ctx.restore();
  } };
}

export function createScene(id: SceneId): Scene {
  switch (id) { case 'rain': return rain(); case 'stars': return stars(); case 'ripples': return ripples(); case 'embers': return embers(); case 'drift': return drift(); default: return aurora(); }
}
