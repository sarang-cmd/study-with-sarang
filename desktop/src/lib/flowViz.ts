import type { BarStyle } from './flow';

/** Drawing for the Flow bar. Grayscale only: one ink color, varying opacity. Pure functions so they can be tested with a fake canvas. */
export function smoothBars(previous: number[], target: number[], rise = .55, fall = .16): number[] {
  const count = Math.max(previous.length, target.length, 32);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = previous[i] ?? 0, to = target[i] ?? 0;
    out.push(from + (to - from) * (to > from ? rise : fall));
  }
  return out;
}

/** A quiet breathing motion for when nothing is being heard, so the bar never looks frozen. */
export function idleBars(count: number, time: number): number[] {
  return Array.from({ length: count }, (_, i) => .06 + .05 * (1 + Math.sin(time * .0035 + i * .45)) * (.6 + .4 * Math.sin(time * .0012 + i * .2)));
}

export function drawFlow(ctx: CanvasRenderingContext2D, width: number, height: number, style: BarStyle, bars: number[], level: number, time: number, ink: string, thinking = false) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = bars.length;
  const cy = height / 2;
  if (style === 'bars') {
    const gap = 3, w = Math.max(2, (width - gap * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      const h = Math.max(3, bars[i] * height * .92);
      ctx.globalAlpha = .35 + .65 * bars[i];
      const x = i * (w + gap);
      ctx.beginPath(); ctx.roundRect?.(x, cy - h / 2, w, h, w / 2); if (!ctx.roundRect) ctx.rect(x, cy - h / 2, w, h); ctx.fill();
    }
  } else if (style === 'orb') {
    const base = Math.min(width, height) * .2, r = base + level * Math.min(width, height) * .24 + (thinking ? Math.sin(time * .006) * 4 : 0);
    for (let k = 3; k >= 1; k--) {
      const pulse = ((time * .0008 * (1 + level * 2) + k / 3) % 1);
      ctx.globalAlpha = (1 - pulse) * .22; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(width / 2, cy, r + pulse * Math.min(width, height) * .38, 0, Math.PI * 2); ctx.stroke();
    }
    const grad = ctx.createRadialGradient(width / 2, cy, 0, width / 2, cy, r);
    grad.addColorStop(0, ink); grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = .9; ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(width / 2, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(width / 2, cy, base * .55, 0, Math.PI * 2); ctx.fill();
  } else if (style === 'ring') {
    const r0 = Math.min(width, height) * .26, max = Math.min(width, height) * .2;
    ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + time * .0003;
      const r1 = r0 + 3 + bars[i] * max * 2.2;
      ctx.globalAlpha = .4 + .6 * bars[i];
      ctx.beginPath(); ctx.moveTo(width / 2 + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(width / 2 + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.globalAlpha = .12 + level * .3; ctx.beginPath(); ctx.arc(width / 2, cy, r0 * .8, 0, Math.PI * 2); ctx.fill();
  } else {
    // wave: three mirrored ribbons that swell with the voice
    for (let layer = 0; layer < 3; layer++) {
      ctx.globalAlpha = [.9, .38, .2][layer]; ctx.lineWidth = [2.4, 1.6, 1.2][layer];
      ctx.beginPath();
      const steps = 96;
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * width, p = s / steps;
        const idx = Math.min(n - 1, Math.floor(Math.abs(p - .5) * 2 * (n - 1)));
        const envelope = Math.sin(p * Math.PI) ** 1.4;
        const amp = (bars[idx] * .85 + level * .35) * cy * .95 * envelope * (1 - layer * .22);
        const y = cy + Math.sin(p * 11 + time * .006 * (1 + layer * .5) + layer) * amp;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = .18; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(width, cy); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
