#!/usr/bin/env node
/**
 * Builds the branded Supabase Auth emails into supabase/email-templates/.
 * Plain tables and inline CSS only (works in Gmail, Outlook and Apple Mail), no images, no tracking, no remote fonts.
 * The code is shown in large type because link scanners can use up a one-time link; the code cannot be used up that way.
 *
 *   node scripts/build-email-templates.mjs          writes the files
 *   node scripts/build-email-templates.mjs --check  fails if the files are out of date
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'email-templates');
/** The only things that differ between the Sarang apps. The other app has its own copy of this file with its own values. */
const APP = {
  name: 'Study with Sarang',
  where: 'In the app, open Settings, Cloud sync, Create account, and type the code.',
  /** 'confirmation_url' uses Supabase's own link. 'token_hash' links to the site, which checks the token with one POST, so mail scanners cannot use it up. */
  linkStyle: 'confirmation_url',
  /** Which emails show a typed code. Only list a key when the app has somewhere to type that code. */
  codeKeys: ['confirmation', 'magic_link', 'recovery', 'reauthentication'],
};
const NAME = APP.name;
const WHERE = APP.where;
const OTP_TYPE = { confirmation: 'signup', magic_link: 'magiclink', recovery: 'recovery', email_change: 'email_change', invite: 'invite' };
const hrefFor = (key) => (APP.linkStyle === 'token_hash' && OTP_TYPE[key] ? `{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=${OTP_TYPE[key]}` : '{{ .ConfirmationURL }}');
const codeFor = (key) => TEMPLATES[key].code && APP.codeKeys.includes(key);
const subjectFor = (key) => (codeFor(key) ? TEMPLATES[key].subject : (TEMPLATES[key].subjectNoCode ?? TEMPLATES[key].subject));

/** Supabase template names, what they are for, and their copy. {{ ... }} are Supabase variables. */
export const TEMPLATES = {
  confirmation: {
    subject: `Your ${NAME} code: {{ .Token }}`, subjectNoCode: `Confirm your ${NAME} email`, preheader: 'Confirm your email to finish creating your account.',
    title: 'Confirm your email', lead: `Welcome to ${NAME}. Use this code to finish creating your account.`, leadNoCode: `Welcome to ${NAME}. Use the button below to finish creating your account.`, noteNoCode: 'Open the button in the same browser you signed up in.',
    code: true, button: 'Confirm email', link: true,
    note: `${WHERE} You can also use the button when you open it in the same browser you signed up in.`,
    ignore: 'If you did not create an account, you can ignore this email. Nothing happens until the code is used.',
  },
  magic_link: {
    subject: `Your ${NAME} sign-in code: {{ .Token }}`, subjectNoCode: `Your ${NAME} sign-in link`, preheader: 'Your one-time code to sign in.',
    title: 'Your sign-in code', lead: `Use this code to sign in to ${NAME}. It works once and expires soon.`, leadNoCode: `Use the button below to sign in to ${NAME}. It works once and expires soon.`, noteNoCode: 'The button signs you in on the web.',
    code: true, button: 'Sign in', link: true,
    note: 'Type the code in the app, or use the button to sign in on the web.',
    ignore: 'If you did not ask to sign in, you can ignore this email. Your account is safe.',
  },
  recovery: {
    subject: `Reset your ${NAME} password`, preheader: 'A link and a code to choose a new password.',
    title: 'Reset your password', lead: 'Someone asked to reset the password for this account. If that was you, use the button below, or type this code in the app under Forgot password.',
    code: true, button: 'Choose a new password', link: true,
    note: 'The link and the code work once and expire soon. The code is there because some email programs open links before you do, which uses the link up.',
    ignore: 'If you did not ask for this, ignore this email. Your password stays the same.',
  },
  email_change: {
    subject: `Confirm your new ${NAME} email address`, preheader: 'Confirm the change to {{ .NewEmail }}.',
    title: 'Confirm your new email', lead: 'Your account email is changing from {{ .Email }} to {{ .NewEmail }}. Confirm to finish the change.',
    code: false, button: 'Confirm the change', link: true,
    note: 'The link works once.',
    ignore: 'If you did not ask for this change, ignore this email and your address stays as it is.',
  },
  invite: {
    subject: `You are invited to ${NAME}`, preheader: 'Accept the invitation to create your account.',
    title: 'You are invited', lead: `You have been invited to ${NAME}, a calm place to focus with sound, a timer and your own progress.`,
    code: false, button: 'Accept the invitation', link: true,
    note: 'The link works once.',
    ignore: 'If you were not expecting this, you can ignore this email.',
  },
  reauthentication: {
    subject: `Your ${NAME} security code: {{ .Token }}`, preheader: 'A code to confirm a sensitive action.',
    title: 'Confirm it is you', lead: 'Use this code to confirm a sensitive change to your account.',
    code: true, button: '', link: false,
    note: 'Type the code where you were asked for it.',
    ignore: 'If you did not ask for this, someone may know your password. Change it soon.',
  },
  identity_linked_notification: {
    kind: 'notice',
    subject: `A sign-in method was linked to your ${NAME} account`, preheader: 'A new way to sign in was added.',
    title: 'A sign-in method was linked', lead: 'Your {{ .Provider }} account was linked as a way to sign in for {{ .Email }}.',
    code: false, button: '', link: false,
    note: 'You can now sign in with it as well as with your email.',
    ignore: 'If you did not do this, reset your password straight away and remove the sign-in method you do not recognise.',
  },
  identity_unlinked_notification: {
    kind: 'notice',
    subject: `A sign-in method was removed from your ${NAME} account`, preheader: 'A way to sign in was removed.',
    title: 'A sign-in method was removed', lead: 'Your {{ .Provider }} account was removed as a way to sign in for {{ .Email }}.',
    code: false, button: '', link: false,
    note: 'You can still sign in with your other methods.',
    ignore: 'If you did not do this, reset your password straight away and check which sign-in methods are still linked.',
  },
};

const INK = '#161616', MUTED = '#6b6b6b', LINE = '#e4e4e4', PAPER = '#ffffff', BG = '#f4f4f4';
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function render(key) {
  const base = TEMPLATES[key]; const code = codeFor(key);
  const t = { ...base, code, lead: code ? base.lead : (base.leadNoCode ?? base.lead), note: code ? base.note : (base.noteNoCode ?? base.note) };
  const codeBlock = t.code ? `
            <tr><td align="center" style="padding:6px 0 4px 0;">
              <div style="display:inline-block;background:${BG};border:1px solid ${LINE};border-radius:12px;padding:16px 26px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:${INK};">{{ .Token }}</div>
            </td></tr>` : '';
  const buttonBlock = t.link ? `
            <tr><td align="center" style="padding:${t.code ? '22px' : '8px'} 0 4px 0;">
              <a href="${hrefFor(key)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-family:${FONT};font-size:14px;font-weight:600;line-height:20px;padding:12px 26px;border-radius:999px;">${esc(t.button)}</a>
            </td></tr>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(NAME)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${esc(t.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:480px;background:${PAPER};border:1px solid ${LINE};border-radius:16px;">
      <tr><td style="padding:28px 32px 8px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td style="width:14px;font-size:0;line-height:0;"><div style="width:14px;height:14px;background:${INK};border-radius:7px;font-size:0;line-height:0;">&nbsp;</div></td>
          <td style="padding-left:10px;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:-0.2px;color:${INK};">${esc(NAME)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:8px 32px 28px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="font-family:${FONT};font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.4px;color:${INK};padding:12px 0 8px 0;">${esc(t.title)}</td></tr>
          <tr><td style="font-family:${FONT};font-size:15px;line-height:23px;color:${INK};padding-bottom:14px;">${t.lead}</td></tr>${codeBlock}${buttonBlock}
          <tr><td style="font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};padding-top:22px;">${esc(t.note)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="border-top:1px solid ${LINE};padding:18px 32px 24px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
        ${esc(t.ignore)}<br><br>
        Sent to {{ .Email }} by ${esc(NAME)}. ${t.kind === 'notice' ? 'This is a security notice about your account.' : 'Never share this code. We will never ask you for it.'}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

/** Every Supabase variable used must be one the dashboard knows. */
export const KNOWN_VARS = new Set(['.ConfirmationURL', '.Token', '.TokenHash', '.SiteURL', '.RedirectTo', '.Data', '.Email', '.NewEmail', '.OldEmail', '.Provider']);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  fs.mkdirSync(OUT, { recursive: true });
  let stale = 0;
  const subjects = {};
  for (const key of Object.keys(TEMPLATES)) {
    const html = render(key);
    for (const m of html.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) if (!KNOWN_VARS.has(m[1])) throw new Error(`${key}: unknown variable ${m[1]}`);
    subjects[key] = subjectFor(key);
    const file = path.join(OUT, `${key}.html`);
    if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) { console.error(`out of date: ${key}.html`); stale++; } } else fs.writeFileSync(file, html);
  }
  const json = JSON.stringify(subjects, null, 2) + '\n';
  const sf = path.join(OUT, 'subjects.json');
  if (check) { if (!fs.existsSync(sf) || fs.readFileSync(sf, 'utf8') !== json) { console.error('out of date: subjects.json'); stale++; } } else fs.writeFileSync(sf, json);
  if (check) { if (stale) process.exit(1); console.log('email templates are up to date'); } else console.log(`wrote ${Object.keys(TEMPLATES).length} templates and subjects.json to supabase/email-templates/`);
}
