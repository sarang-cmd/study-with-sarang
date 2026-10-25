'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.setup;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Number(n).toLocaleString();

  // ---- Animated waves: calm when idle, they rise as the install progresses, then settle. ----
  const canvas = $('waves'); const ctx = canvas.getContext('2d');
  let energy = 0.28, target = 0.28, phase = 0, w = 0, h = 0, dpr = 1, baseNow = 0.93, baseGoal = 0.93;
  function resize() { dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  addEventListener('resize', resize); resize();
  const layers = [
    { amp: 1.0, freq: 1.1, speed: 0.55, alpha: 0.5, width: 1.6 },
    { amp: 0.78, freq: 1.6, speed: -0.4, alpha: 0.32, width: 1.2 },
    { amp: 0.55, freq: 2.3, speed: 0.75, alpha: 0.22, width: 1 },
    { amp: 0.95, freq: 0.8, speed: -0.28, alpha: 0.16, width: 2.4 },
    { amp: 0.4, freq: 3.1, speed: 0.95, alpha: 0.14, width: 0.8 },
  ];
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    energy += (target - energy) * Math.min(1, dt * 2.2); baseNow += (baseGoal - baseNow) * Math.min(1, dt * 2.5); phase += dt;
    ctx.clearRect(0, 0, w, h);
    const base = h * baseNow;
    for (const L of layers) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const t = x / w;
        const env = Math.sin(Math.PI * t) ** 1.2; // Fade the ends so the lines float.
        const y = base - L.amp * energy * 70 * env * Math.sin(t * Math.PI * 2 * L.freq * 1.4 + phase * L.speed * 2.2) - Math.sin(t * 7 + phase * L.speed) * energy * 8 * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,255,255,${L.alpha})`; ctx.lineWidth = L.width; ctx.stroke();
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduced) { energy = target = 0.2; frame(performance.now()); }

  // ---- Pages ----
  const order = ['welcome', 'options', 'working', 'done'];
  const dots = [...$('steps').children];
  let info = null; let current = 'welcome';
  function show(name) {
    current = name; baseGoal = name === 'working' ? 0.76 : 0.94;
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === `p-${name}`));
    const idx = order.indexOf(name);
    dots.forEach((d, i) => d.classList.toggle('on', i === Math.max(0, idx)));
    $('steps').style.visibility = idx < 0 ? 'hidden' : 'visible';
    const page = $(`p-${name}`); const first = page.querySelector('.btn.primary'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 120);
  }
  const options = () => ({ desktop: $('o-desktop').checked, startMenu: $('o-start').checked, autostart: $('o-login').checked, startHidden: $('o-hidden').checked, launch: false, dir: info.dir });
  const showError = (id, message) => { const el = $(id); el.textContent = message; el.hidden = !message; };

  function chime() {
    try {
      const ac = new AudioContext(); const t = ac.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = ac.createOscillator(); const g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + i * 0.11); g.gain.linearRampToValueAtTime(0.06, t + i * 0.11 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 1.1);
        o.connect(g).connect(ac.destination); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 1.2);
      });
    } catch { /* No audio is fine. */ }
  }

  // ---- Progress ----
  let shown = 0, goal = 0, counting = false;
  function tick() { shown += (goal - shown) * 0.18; if (goal - shown < 0.05) shown = goal; $('pct').textContent = String(Math.round(shown)); if (shown !== goal) requestAnimationFrame(tick); else counting = false; }
  function onProgress(p) {
    goal = p.percent; if (!counting) { counting = true; requestAnimationFrame(tick); }
    $('fill').style.width = `${p.percent}%`; $('track').setAttribute('aria-valuenow', String(Math.round(p.percent)));
    $('status').textContent = p.label; target = 0.3 + (p.percent / 100) * 1.05;
    $('files').innerHTML = p.total ? `${fmt(p.files)} / ${fmt(p.total)} files` : '&nbsp;';
  }
  api.onProgress(onProgress);

  async function runInstall() {
    showError('o-error', '');
    show('working'); $('work-kicker').textContent = info.existing ? 'UPDATING' : 'INSTALLING'; $('h-working').textContent = info.existing ? 'Updating' : 'Installing';
    shown = goal = 0; $('pct').textContent = '0'; $('fill').style.width = '0';
    const result = await api.install(options());
    if (!result.ok) { show('options'); showError('o-error', result.error); target = 0.28; return; }
    target = 0.5; chime();
    setTimeout(() => { target = 0.18; }, 1200);
    show('done');
  }

  async function runUpdate() {
    showError('f-error', '');
    show('working'); $('work-kicker').textContent = 'UPDATING'; $('h-working').textContent = 'Updating';
    shown = goal = 0; $('pct').textContent = '0'; $('fill').style.width = '0';
    const result = await api.install({});
    if (!result.ok) { show('failed'); showError('f-error', result.error); target = 0.22; return; }
    target = 0.5;
    $('h-done').textContent = `Updated to ${info.version}.`;
    $('tips').innerHTML = '<li>Your mixes, time log and settings are untouched.</li><li>Nothing opens by itself. Start Study with Sarang whenever you like.</li>';
    $('d-open').textContent = 'Open Study with Sarang'; $('d-close').hidden = false;
    setTimeout(() => { target = 0.18; }, 1200);
    show('done');
  }
  $('f-retry').onclick = runUpdate;
  $('f-open').onclick = () => api.finish(true);

  $('go-install').onclick = runInstall;
  $('go-options').onclick = () => show('options');
  $('o-back').onclick = () => show('welcome');
  $('o-install').onclick = runInstall;
  $('go-portable').onclick = () => api.runPortable();
  $('o-browse').onclick = async () => { const dir = await api.chooseDir(info.dir); if (dir) { info.dir = dir; $('o-dir').textContent = dir; $('o-dir').title = dir; } };
  $('d-open').onclick = async () => { const r = await api.finish(true); if (r && !r.ok) showError('d-error', r.error); };
  $('d-close').onclick = () => api.finish(false);
  $('min').onclick = () => api.minimize();
  $('close').onclick = () => api.close();
  $('r-cancel').onclick = () => api.close();
  $('x-close').onclick = () => api.close();
  $('r-go').onclick = async () => {
    show('working'); $('work-kicker').textContent = 'REMOVING'; $('h-working').textContent = 'Removing'; target = 0.9;
    const result = await api.uninstall({ deleteData: $('r-data').checked });
    if (!result.ok) { show('remove'); showError('r-error', result.error); return; }
    target = 0.15; show('removed');
  };
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (current === 'welcome' || current === 'failed' || current === 'remove' || current === 'removed' || current === 'done')) api.close();
  });

  api.info().then((i) => {
    info = i; $('ver').textContent = i.version; $('o-dir').textContent = i.dir; $('o-dir').title = i.dir;
    if (i.update) { $('bar-title').textContent = 'Study with Sarang Update'; show('working'); void runUpdate(); return; }
    if (i.mode === 'uninstall') { $('bar-title').textContent = 'Study with Sarang Uninstall'; show('remove'); return; }
    if (i.existing) {
      $('go-install').textContent = i.existing === i.version ? 'Repair' : 'Update';
      $('welcome-kicker').firstChild.textContent = i.existing === i.version ? 'ALREADY INSTALLED / VERSION ' : `UPDATE FROM ${i.existing} TO `;
      $('welcome-lede').textContent = 'Your saved mixes, time log and settings are kept.';
    }
    if (!i.canRunOnce) $('go-portable').hidden = true;
    show('welcome');
  });
})();
