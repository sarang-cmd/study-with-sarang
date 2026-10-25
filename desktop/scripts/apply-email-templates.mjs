#!/usr/bin/env node
/**
 * Pushes the branded emails (supabase/email-templates/) and, optionally, the sign-in URLs to your Supabase project
 * through the Management API. It changes only the fields listed below and nothing else.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-email-templates.mjs [--dry-run]
 *       [--project-ref <ref>] [--include-reauthentication] [--site-url https://your.site/] [--redirect https://your.site/ ...]
 *
 * The token is a personal access token from supabase.com/dashboard/account/tokens. It is read from the environment,
 * never stored, and never printed. Without --site-url the Site URL and redirect list are left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'email-templates');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const values = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));

export function buildPatch({ siteUrl, redirects = [], reauth = false } = {}) {
  const subjects = JSON.parse(fs.readFileSync(path.join(DIR, 'subjects.json'), 'utf8'));
  const patch = {};
  for (const [key, subject] of Object.entries(subjects)) {
    patch[`mailer_subjects_${key}`] = subject;
    // Not every API version accepts a body for reauthentication, so that one is opt-in (--include-reauthentication).
    if (key !== 'reauthentication' || reauth) patch[`mailer_templates_${key}_content`] = fs.readFileSync(path.join(DIR, `${key}.html`), 'utf8');
  }
  if (siteUrl) patch.site_url = siteUrl;
  if (redirects.length) patch.uri_allow_list = redirects.join(',');
  return patch;
}

async function main() {
  const ref = value('--project-ref') ?? 'fykzmhxvhdrxvqkkhlnd';
  const patch = buildPatch({ siteUrl: value('--site-url'), redirects: values('--redirect'), reauth: flag('--include-reauthentication') });
  if (patch.site_url && !/^https:\/\//.test(patch.site_url)) throw new Error('--site-url must be an https address');
  if (flag('--dry-run')) {
    console.log(`Dry run for project ${ref}. Would set ${Object.keys(patch).length} fields:`);
    for (const [k, v] of Object.entries(patch)) console.log(`  ${k}${k.includes('content') ? ` (${v.length} characters of HTML)` : `: ${v}`}`);
    return;
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN (a personal access token) or use --dry-run.');
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  console.log(`Updated ${Object.keys(patch).length} settings on ${ref}. Send yourself a test sign-up to check.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
