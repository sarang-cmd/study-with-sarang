'use strict';
/**
 * UI test for the AI setup walkthrough and the assistant that acts in the app, against a small stand-in for an
 * OpenAI-style service on this computer (the same kind of address Ollama or LM Studio uses).
 * Run with: xvfb-run -a -s "-screen 0 1500x1000x24" node scripts/test-ui28.cjs   (needs `npm run build` first)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
if (process.platform === 'linux' && !process.env.DISPLAY) { console.log('Skipped: no display (use xvfb-run).'); process.exit(0); }
const { _electron: electron } = require('playwright-core');
const root = path.join(__dirname, '..');
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-ui28-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (m) => console.log(`PASS ${m}`);
const shot = process.env.SWA_SHOTS;

// The pretend service: it "decides" from the last user message, and answers in words once a tool has run.
const posts = []; let toolsSeen = [];
const server = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let raw = ''; req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const send = (code, data) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url.endsWith('/models')) return send(200, { data: [{ id: 'mock-model' }, { id: 'mock-big' }] });
    if (!req.url.endsWith('/chat/completions')) return send(404, {});
    const body = JSON.parse(raw); posts.push(body); toolsSeen = (body.tools ?? []).map((t) => t.function.name);
    const msgs = body.messages; const last = msgs[msgs.length - 1];
    if (!body.tools) return send(200, { choices: [{ message: { content: 'OK' } }] });
    if (last.role === 'tool') return send(200, { choices: [{ message: { content: `Done. ${/error/.test(last.content) ? 'It failed.' : 'That worked.'}` } }] });
    const text = String(last.content);
    const call = (name, args) => send(200, { choices: [{ message: { content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
    if (/to-do/i.test(text)) return call('add_todo', { text: 'Finish the physics problem set' });
    if (/goal/i.test(text)) return call('set_plan', { goal: 'Two past paper questions' });
    if (/focus length/i.test(text)) return call('set_setting', { path: 'timer.focusMin', value: '40' });
    if (/quit/i.test(text)) return call('run_command', { command: 'app.quit' });
    return send(200, { choices: [{ message: { content: 'Hello from the pretend service.' } }] });
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/v1`;
  const app = await electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu'], env: { ...process.env, XDG_CONFIG_HOME: config } });
  const page = await app.firstWindow(); const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|NotAllowedError|Requested device not found|Permission denied|404/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  const panel = '[data-testid="settings-panel"]';
  const boot = async () => { await page.waitForFunction(() => window.desktop && document.querySelector('header')); await sleep(1000); for (let i = 0; i < 3; i += 1) { await page.keyboard.press('Escape'); await sleep(900); } };
  const ls = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  await boot();

  // ---- without a service the assistant explains what to do, and the walkthrough is one click away
  await page.click('[data-testid="agent-open"]'); await page.waitForSelector('[data-testid="agent-panel"]');
  assert.ok(await page.locator('[data-testid="agent-panel"]:has-text("Pick an AI service first")').count(), 'asks for setup');
  assert.equal(await page.locator('[data-testid="agent-input"]').isDisabled(), true);
  pass('the assistant asks you to set up an AI service first and does not send anything');
  await page.click('[data-testid="agent-panel"] button:has-text("Start the walkthrough")');
  await page.waitForSelector('[data-testid="aiguide"]'); await sleep(500);

  // ---- the walkthrough: goal, service, key and address, models, a real test, what it may do
  assert.ok(await page.locator('[data-testid="aiguide-step-goal"]').count());
  if (shot) await page.screenshot({ path: path.join(shot, 'ui28-guide-1.png') });
  await page.click('[data-testid="aiguide-next"]'); await sleep(500);
  const providers = await page.locator('[data-testid^="aiguide-provider-"]').count(); assert.ok(providers >= 8, `${providers} services listed`);
  assert.ok((await page.locator('[data-testid="aiguide-step-service"]').innerText()).includes('Free plan'), 'free badges');
  assert.ok((await page.locator('[data-testid="aiguide-step-service"]').innerText()).includes('October 2026'), 'says when it was checked');
  await page.click('[data-testid="aiguide-provider-groq"]'); await page.click('[data-testid="aiguide-next"]'); await sleep(500);
  assert.equal(await page.locator('[data-testid="aiguide-next"]').isDisabled(), true, 'a key is needed before moving on');
  assert.ok(await page.locator('[data-testid="aiguide-step-key"] a[href^="https://console.groq.com"]').count(), 'sign-up link');
  await page.click('[data-testid="aiguide"] button:has-text("Back")'); await sleep(400); await page.click('[data-testid="aiguide-provider-custom"]'); await page.click('[data-testid="aiguide-next"]'); await sleep(500);
  assert.equal(await page.locator('[data-testid="aiguide-next"]').isDisabled(), true, 'an address is needed for a custom service');
  await page.fill('[data-testid="aiguide-url"]', base); await page.click('[data-testid="aiguide-next"]'); await sleep(500);
  await page.click('[data-testid="aiguide-find"]');
  await page.waitForSelector('[data-testid="aiguide-result"]:has-text("2 models found")', { timeout: 8000 });
  await page.fill('[data-testid="aiguide-model"]', 'mock-model');
  await page.click('[data-testid="aiguide-test"]'); await page.waitForSelector('[data-testid="aiguide-result"]:has-text("It works")', { timeout: 8000 });
  assert.equal(posts[0].model, 'mock-model'); assert.equal(posts[0].tools, undefined, 'the test request is plain');
  pass('the walkthrough lists the free services with badges, needs a key or address, finds models and makes a real test request');
  await page.click('[data-testid="aiguide-next"]'); await sleep(500);
  assert.ok(await page.locator('[data-testid="aiguide-step-allowed"]').count());
  await page.click('[data-testid="aiguide-finish"]'); await page.waitForSelector('[data-testid="aiguide"]', { state: 'detached' });
  await page.waitForSelector('[data-testid="agent-panel"]'); await sleep(600);
  const guide = await ls('study-with-sarang:ai-guide'); assert.equal(guide.done, true);
  const prefs = await ls('study-with-sarang:prefs'); assert.equal(prefs.flow.chatProvider, 'custom'); assert.equal(prefs.flow.customUrl, base); assert.equal(prefs.flow.chatModel, 'mock-model');
  pass('finishing saves the choice and opens the assistant');
  if (shot) await page.screenshot({ path: path.join(shot, 'ui28-agent-1.png') });

  // ---- the assistant acts: a to-do, a goal, a timer setting, and a refused command
  const count = (word) => page.evaluate((w) => (document.querySelector('[data-testid="agent-log"]').innerText.match(new RegExp(w, 'g')) ?? []).length, word);
  const ask = async (text, word, n = 1) => { await page.fill('[data-testid="agent-input"]', text); await page.click('[data-testid="agent-send"]'); await page.waitForFunction(([w, k]) => (document.querySelector('[data-testid="agent-log"]').innerText.match(new RegExp(w, 'g')) ?? []).length >= k, [word, n], { timeout: 15000 }); await sleep(400); };
  await ask('Add a to-do for the physics problem set', 'That worked');
  assert.ok(toolsSeen.includes('add_todo') && toolsSeen.includes('set_setting'), 'tools were offered');
  let todos = await ls('study-with-sarang:todos'); assert.equal(todos.length, 1); assert.equal(todos[0].text, 'Finish the physics problem set');
  assert.ok((await page.locator('[data-testid="agent-steps"]').first().innerText()).includes('Added the to-do'), 'the action list shows what it did');
  await ask('Set my goal for this block', 'That worked', 2);
  const plan = await ls('study-with-sarang:plan'); assert.equal(plan.goal, 'Two past paper questions');
  await ask('Change my focus length', 'That worked', 3);
  const timerSettings = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /timer-settings|settings/.test(k) && /focus/i.test(localStorage.getItem(k) ?? '')).map(([k, v]) => v).join('|'));
  assert.match(timerSettings, /40/, 'the focus length is 40 now');
  pass('the assistant adds a to-do, sets the goal and changes a timer setting through tool calls, and lists what it did');
  await ask('please quit the app', 'It failed');
  assert.ok(await page.locator('[data-testid="agent-steps"]:has-text("not allowed")').count(), 'quit is refused and explained'); assert.ok(await page.evaluate(() => Boolean(document.querySelector('header'))), 'the app is still open');
  pass('a command that is not allowed (quit) is refused and the app stays open');

  // ---- the key never travels in a message; notifications record the changes
  assert.ok(!JSON.stringify(posts).includes('sk-'), 'no key in requests');
  await page.click('header button[aria-label^="Notifications"]'); await sleep(700);
  assert.ok(await page.locator('text=Assistant').count(), 'the bell lists the assistant changes'); await page.keyboard.press('Escape'); await sleep(500);

  // ---- confirmation: "Changes" asks first, Decline does nothing, Allow does it
  await page.click('[aria-label="Close the assistant"]'); await sleep(500);
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Assistant")`); await sleep(600);
  assert.ok(await page.locator('[data-testid="assistant-status"]:has-text("Custom")').count(), 'status names the service');
  await page.click(`${panel} button[role="radio"]:has-text("Changes"), ${panel} button:has-text("Changes")`); await sleep(500);
  assert.equal((await ls('study-with-sarang:prefs')).agent.confirm, 'changes');
  await page.click('[aria-label="Close settings"]'); await sleep(500);
  await page.click('[data-testid="agent-open"]'); await page.waitForSelector('[data-testid="agent-panel"]');
  await page.fill('[data-testid="agent-input"]', 'Add a to-do for the physics problem set'); await page.click('[data-testid="agent-send"]');
  await page.waitForSelector('[data-testid="agent-confirm"]'); assert.ok((await page.locator('[data-testid="agent-confirm"]').innerText()).includes('Added the to-do'));
  await page.click('[data-testid="agent-deny"]'); await page.waitForFunction(() => (document.querySelector('[data-testid="agent-log"]').innerText.match(/It failed/g) ?? []).length >= 2, null, { timeout: 10000 }); await sleep(400);
  todos = await ls('study-with-sarang:todos'); assert.equal(todos.length, 1, 'declined: nothing was added');
  await page.fill('[data-testid="agent-input"]', 'Add a to-do for the physics problem set'); await page.click('[data-testid="agent-send"]');
  await page.waitForSelector('[data-testid="agent-confirm"]'); await page.click('[data-testid="agent-allow"]'); await sleep(2500);
  todos = await ls('study-with-sarang:todos'); assert.equal(todos.length, 2, 'allowed: it was added');
  pass('with "ask before changes" a card appears: Decline does nothing, Allow does it');

  // ---- a switched-off kind of action is not even offered; Clear forgets the chat
  await page.click('[aria-label="Close the assistant"]'); await sleep(500);
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Assistant")`); await sleep(500);
  await page.locator('label:has-text("To-dos") input[role="switch"]').first().click(); await sleep(400);
  await page.click('[aria-label="Close settings"]'); await sleep(500);
  await page.click('[data-testid="agent-open"]'); await page.waitForSelector('[data-testid="agent-panel"]');
  await page.fill('[data-testid="agent-input"]', 'hello'); await page.click('[data-testid="agent-send"]'); await page.waitForSelector('text=Hello from the pretend service', { timeout: 10000 });
  assert.ok(!toolsSeen.includes('add_todo') && toolsSeen.includes('set_setting'), 'to-do tools are not offered any more');
  await page.click('[data-testid="agent-clear"]'); await sleep(500);
  assert.equal(await page.locator('[data-testid="agent-log"] [data-role]').count(), 0, 'the chat was cleared');
  pass('switched-off action types are not offered to the AI, and Clear forgets the conversation');

  // ---- the walkthrough can be run again from Settings
  await page.click('[aria-label="Close the assistant"]'); await sleep(500);
  await page.click('header button[aria-label="Settings"]'); await page.waitForSelector(panel); await page.click(`${panel} nav button:has-text("Flow voice and AI")`); await sleep(600);
  await page.click('[data-testid="open-ai-guide"]'); await page.waitForSelector('[data-testid="aiguide"]'); await page.keyboard.press('Escape'); await page.waitForSelector('[data-testid="aiguide"]', { state: 'detached' });
  pass('the walkthrough can be opened again from the Flow settings');

  assert.deepEqual(problems, [], `console problems: ${problems.join(' | ')}`);
  await app.close(); server.close();
  console.log('Assistant UI tests passed');
})().catch((error) => { console.error(error); server.close(); process.exit(1); });
