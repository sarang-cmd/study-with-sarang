// Sets the first paint's theme before the app loads, avoiding a light-mode flash.
// Set the first paint's theme before React/CSS load, avoiding a light-mode flash.
try {
  const saved = localStorage.getItem('study-with-sarang:theme');
  const dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0b0b0b' : '#ffffff';
} catch (_) {}
try {
  const prefs = JSON.parse(localStorage.getItem('study-with-sarang:prefs') || '{}');
  if (prefs.customScrollbar !== false) document.documentElement.classList.add('scrollbar-custom');
} catch (_) {}
