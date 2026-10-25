# Sign-up emails: branded, working links, and reaching the inbox

> Newer: forgot password, invitations, the two security notices and the Resend setup are in `docs/EMAIL_AND_ACCOUNTS.md` at the top of the repository. This page still explains the sign-up side.

Everything here is done in the Supabase dashboard or with the scripts in this project. The app code cannot change dashboard settings, and nobody can promise an inbox: Gmail and others decide per message. What you can do is remove every reason for them to say no.

Project reference: `fykzmhxvhdrxvqkkhlnd` (the built-in project).

## 1. Why the confirmation link went to localhost:3000

Supabase builds the link from **Site URL** (default `http://localhost:3000`) unless the app passes a `redirect_to` address that is on the **Redirect URLs** allow list. The web app now passes its own address, but Supabase only honors it when it is on the list, and otherwise falls back to Site URL.

1. Dashboard, **Authentication, URL Configuration**.
2. **Site URL**: the address where the web app is hosted, for example `https://sarang-md.vercel.app/study-with-sarang` (no trailing slash).
3. **Redirect URLs**: add the same address (with and without the trailing slash). Add `http://localhost:5173/*` if you test locally.
4. The desktop app has no web address. It asks for the 6 digit code from the email instead, so nothing opens in a browser. If you host the web app, you can also set `WEB_URL` in `src/lib/cloudDefaults.ts` so desktop sign-ups point their link at it.

What happens when the link is opened: the web app removes `#access_token=...` from the address bar immediately, asks Supabase to confirm the token is real, and signs in only if the address belongs to the account that was just created in that same browser. Opened anywhere else (a phone, another browser), it only shows "Email confirmed, now sign in". It never signs you in with a link it did not expect, which blocks a known attack where a stranger's link logs you into their account.

## 2. Branded emails

```bash
node scripts/build-email-templates.mjs            # (re)creates supabase/email-templates/*.html and subjects.json
node scripts/build-email-templates.mjs --check    # CI: fails when the files are out of date
```

Six templates are generated: confirmation, magic link (the Email code tab), recovery, email change, invite and reauthentication. They are plain table HTML with inline CSS (no images, no remote fonts, no tracking pixels), show the code in large type with a button underneath, and are short on purpose.

To install them either:

- **Dashboard (no tokens):** Authentication, Emails. For each template paste the matching file and set the subject from `subjects.json`.
- **Script:** create a personal access token at supabase.com/dashboard/account/tokens, then

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-email-templates.mjs --dry-run
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-email-templates.mjs --site-url https://your.site/app/ --redirect https://your.site/app/
```

It calls `PATCH /v1/projects/{ref}/config/auth` and changes only the subject, template and (if you pass them) Site URL and redirect fields. It does not touch anything else. The token is read from the environment and never stored. Reauthentication bodies are skipped unless you add `--include-reauthentication`. I could not run this against your project, so use `--dry-run` first and check the dashboard afterwards.

The password recovery email exists for completeness. The app has no "forgot password" screen yet; use the **Email code** tab to sign in if a password is lost.

## 3. Reaching the inbox (the part that matters most)

**Supabase's built-in sender is for testing.** It is heavily rate limited and, in current projects, only delivers to members of your Supabase team. Real users need your own SMTP provider.

1. **Use a domain you own** and a provider such as Resend, Brevo, Postmark or Amazon SES. In Supabase: Authentication, Emails, SMTP Settings, enable custom SMTP, enter the host, port, user and password from the provider.
2. **Sender:** an address on your domain, such as `hello@yourdomain.com`, sender name `Study with Sarang`. Not a free-mail address, not a `noreply@` on a domain you have not verified.
3. **Authenticate the domain.** The provider shows DNS records to add. All three must pass:
   - **SPF** (a TXT record naming the provider),
   - **DKIM** (a TXT or CNAME record with the provider's key),
   - **DMARC** (a TXT record on `_dmarc`, start with `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`, tighten later).
4. **Turn off link and open tracking** at the provider. Rewritten links look like phishing to filters and also break one-time links.
5. **Keep the message simple.** The templates have a clear subject, one short paragraph, a code and a button, no images and no marketing words. That is what filters like.
6. **Test before real users.** Send a sign-up to a Gmail address and open Show original: SPF, DKIM and DMARC should all say PASS. Send one to mail-tester.com for a score.
7. **No domain yet?** For a small private group you can use a Gmail or Google Workspace account as the SMTP server (`smtp.gmail.com`, port 465, an app password). It is limited to a few hundred messages a day, and recipients see a Gmail sender, but it lands in inboxes reliably. It is a stop-gap, not a product setup.

**Primary versus Updates versus Promotions.** Gmail files transactional mail (confirmations, codes) under Updates in many cases, however well it is sent, and that is Gmail's choice. Spam folder avoidance is something you can control with the steps above. Moving it to Primary is up to the recipient: drag one message to Primary once and answer "do this for future messages". The code in the subject (`Your Study with Sarang code: 123456`) also shows in notifications, so people see it even if the email sits in Updates.

**Rate limits.** Supabase limits auth emails per project and per address. If someone asks for several codes quickly the app says "Too many emails were requested. Wait a minute and try again."

## 4. A short checklist

- [ ] Site URL and Redirect URLs set
- [ ] Templates installed (confirmation and magic link at least), "Confirm email" left on
- [ ] Custom SMTP on your own domain, SPF, DKIM and DMARC passing
- [ ] Tracking off at the provider
- [ ] Sign-up test to Gmail and Outlook: arrives, code works in the desktop app, link works in the web app
