'use strict';
/** The icon ids the shell accepts. Keep in step with ICON_IDS in src/lib/iconSet.ts (a test compares them). */
const IDS = ['default', 'classic', 'ring', 'bars', 'moon', 'leaf', 'timer', 'paper'];
module.exports = { IDS, valid: (id) => IDS.includes(id), pick: (id) => (IDS.includes(id) ? id : 'default') };
