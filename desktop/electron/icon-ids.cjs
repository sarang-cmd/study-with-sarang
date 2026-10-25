'use strict';
/** The icon ids the shell accepts. Keep in step with ICON_IDS in src/lib/iconSet.ts (a test compares them). */
const IDS = ['default', 'waves', 'classic', 'ring', 'moon', 'leaf', 'timer', 'paper'];
/** Older saves called the Voice icon "bars". It is the default now. */
const pick = (id) => (id === 'bars' ? 'default' : IDS.includes(id) ? id : 'default');
module.exports = { IDS, valid: (id) => IDS.includes(id) || id === 'bars', pick };
