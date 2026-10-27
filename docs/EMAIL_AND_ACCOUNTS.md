# Emails, invitations, password reset and Resend

This guide covers everything about account emails for **Study with Sarang** and **Sarang.md**: the branded email templates, resetting a password, inviting people, and sending the emails through Resend instead of Supabase's built-in sender. Each app has its own Supabase project, so you do the steps once per project.

| | Study with Sarang | Sarang.md |
|---|---|---|
| Supabase project | `fykzmhxvhdrxvqkkhlnd` | `ddfvaonbikugjyhwpeei` |
| Templates folder | `desktop/supabase/email-templates/` (mirrored in `web/`) | `supabase/email-templates/` |
| Build and check | `npm run emails`, `npm run emails:check` | `npm run emails`, `npm run emails:check` |
| Apply to Supabase | `node scripts/apply-email-templates.mjs` | `node scripts/apply-email-templates.mjs` |
| Site URL | `https://sarang-md.vercel.app/study-with-sarang` | `https://sarang-md.vercel.app` |

Nothing here needs a secret to be stored. Every token or key is typed into one command and forgotten.

## 1. What was added

* **Eight branded emails** in the grayscale Sarang look, plain HTML with inline styles so every mail program shows them the same: Confirm signup, Magic link, Reset password, Change email address, Invite user, Reauthentication, and the two security notices **Sign-in method linked** and **Sign-in method removed**. There is no MFA email, on purpose.
* **Forgot password** in both apps. Sign-in has a "Forgot password?" button. It emails a link and a code. Either one leads to a "Choose a new password" form, and only after a new password is saved is anyone signed in. The answer never says whether an address has an account.
* **Invite user.** An invited person opens the email, chooses a password and lands signed in. You can send invitations from the dashboard or with `scripts/invite-user.mjs`.
* **Links that survive mail scanners.** Some email programs open every link before you do, which uses up a one-time link. Sarang.md's links point at the site with a token that is only used when the page posts it, so a scanner's visit changes nothing. Study with Sarang adds a typed code next to the button for the same reason.

## 2. Install the templates (about two minutes)

1. Open supabase.com/dashboard/account/tokens, create an access token and copy it.
2. In a terminal inside the app folder, run this once per project. The token lives only in that command:

   ```
   SUPABASE_ACCESS_TOKEN=sbp_xxxxx node scripts/apply-email-templates.mjs --dry-run
   SUPABASE_ACCESS_TOKEN=sbp_xxxxx node scripts/apply-email-templates.mjs --site-url https://sarang-md.vercel.app
   ```

   The dry run lists the 17 fields it would change and changes nothing. For Study with Sarang use `--site-url https://sarang-md.vercel.app/study-with-sarang`. Leave `--site-url` out if you only want the emails.
3. Revoke the token on the same page when you are done.
4. In **Authentication, URL Configuration**, make sure the Site URL has no trailing slash and the **Redirect URLs** list contains your site address and `https://sarang-md.vercel.app/**`. The Sarang.md links are built as `<Site URL>/?token_hash=...`, so the Site URL must be the real address of the site.
5. In **Authentication, Notifications** (or Emails), leave **Sign-in method linked** and **removed** switched on. The script turns both on.

To change wording or colors, edit `scripts/build-email-templates.mjs` (the `APP` block at the top holds the few per-app values), run `npm run emails`, then apply again. `npm run emails:check` fails if the saved HTML is out of date, and the test suite runs it.

You can also paste each file by hand: **Authentication, Emails, Templates**, choose the template, paste the HTML, and copy the subject from `subjects.json`.

## 3. Reset password

Nothing to configure beyond section 2. In the app, choose **Forgot password?**, type your email, and press the button.

* Study with Sarang: Settings, Cloud sync, Sign in, **Forgot password?**. Type the six-digit code and a new password, or click the link in the email.
* Sarang.md: Profile, Encrypted cloud copy, **Forgot password?**. Click the link in the email, or type the code on the same page.

This changes only the cloud account password. Sarang.md's **local vault password** is never sent anywhere and cannot be reset, because it is the key to your encrypted data.

## 4. Invite people

You do not need to add anyone by hand.

**From the dashboard.** Authentication, Users, **Invite user**, type the address. They get the Invite email.

**From your computer, with the script.** It needs your project's **secret** key (Project Settings, API Keys). That key can do anything to your project, so keep it on your computer, type it into this one command, and never paste it into a chat, a file or the app. The script refuses the public (publishable) key.

```
SUPABASE_URL=https://fykzmhxvhdrxvqkkhlnd.supabase.co SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxx \
  node scripts/invite-user.mjs friend@example.com --name "Friend" --redirect https://sarang-md.vercel.app/study-with-sarang/
```

Use `https://ddfvaonbikugjyhwpeei.supabase.co` and `--redirect https://sarang-md.vercel.app/` for Sarang.md. If the person already has an account the script says so and suggests Forgot password. An invitation link works once and expires after a while, so send a new one if it has lapsed.

Turning **Allow new users to sign up** off in Authentication, Sign In / Providers makes the app invitation-only.

## 5. Send the emails through Resend

Supabase's built-in sender is for testing only. It is limited to a few emails per hour, only sends to your team's addresses, and often lands in spam. For real use, give Supabase a proper SMTP sender. Resend is a good fit and its free plan is enough for a small study site.

**What you need first.** A domain you own, such as `sarang.example`. Resend cannot send from `vercel.app`, because you do not control its DNS. A domain costs about 10 euros a year. Without a verified domain, Resend only delivers to the email address of your own Resend account, which is fine for a first test but nothing else.

**Free plan facts (checked October 2026 on resend.com/pricing):** 3,000 emails a month, 100 a day, no overage. Each recipient counts as one email. The daily limit resets at midnight UTC. Check the page again before you rely on it.

### Steps

1. Create an account at resend.com.
2. **Domains, Add Domain.** Enter your domain, or better a subdomain such as `mail.sarang.example`, and pick the region closest to your users (Europe for you in Dresden).
3. Resend shows DNS records. Add all of them at the place that manages your domain's DNS: the **SPF** record (a TXT record plus an MX record on the `send` subdomain) and the **DKIM** record (a TXT record). Wait until the domain shows **Verified**, which can take minutes to a few hours.
4. Add a **DMARC** record if you have none, for example a TXT record named `_dmarc` with `v=DMARC1; p=none; rua=mailto:you@your-domain`. It helps inboxes trust your mail. Tighten `p=` later.
5. **API Keys, Create API Key**, permission "Sending access", limited to your domain. Copy it, because it is shown once.
6. In Supabase open **Authentication, Notifications, Email, SMTP Settings** and turn on **Enable custom SMTP**:
   * **Sender email:** `accounts@mail.sarang.example` (any address on the verified domain)
   * **Sender name:** `Study with Sarang` (or `Sarang.md`)
   * **Host:** `smtp.resend.com`
   * **Port:** `465`
   * **Username:** `resend`
   * **Password:** the Resend API key
   * Save. Do this in both Supabase projects. You can use the same Resend account and domain, with a different sender name per project.
7. In **Authentication, Rate Limits**, raise "Rate limit for sending emails". After custom SMTP is on, Supabase starts at a low number per hour, so pick something that fits your Resend plan.
8. Test: send yourself a reset code from the app, then an invitation to a second address. In Resend, open **Emails** to see delivery, bounces and complaints.

### Things that go wrong

| Symptom | Cause and fix |
|---|---|
| Resend returns 403 or nothing arrives | The domain is not verified yet, or the sender address is not on the verified domain. |
| Emails arrive in spam | SPF, DKIM or DMARC missing. Check the three records in Resend's domain page. Send from a subdomain used only for this. |
| "Email rate limit exceeded" in the app | Supabase's hourly limit or Resend's 100 a day. Raise the first, upgrade or wait for the second. |
| Link says "expired or already used" | A mail program opened it first. Use the code (Study with Sarang, or Sarang.md reset) or ask for a new email. |
| The button opens the wrong address | The Site URL in URL Configuration is wrong or has a trailing slash. |

### Privacy

Resend sees the recipient address and the email text for each message, which is what any sender sees. The app sends no study data, marks or profile through email. If you publish the site to other people, name Resend as an email processor in your privacy notice.

## 6. Checklist

1. Run `npm run emails:check` (both apps).
2. Apply templates to each project (section 2).
3. Verify your domain in Resend and fill in the SMTP settings (section 5).
4. Test sign up, reset, magic link, invitation and a change of email address with a real mailbox.
5. Revoke the Supabase access token and any key you pasted anywhere else.

## Current state (2026-10-27)

* **Sarang.md project (`ddfvaonbikugjyhwpeei`):** Site URL `https://sarang-md.vercel.app`, redirect list updated, Resend SMTP on (`smtp.resend.com`, port 465, user `resend`, the API key is stored only in Supabase), 30 emails per hour, all branded templates applied.
* **Sender:** Resend has no verified domain yet, so the sender is `onboarding@resend.dev`. Resend only delivers from that address to the Resend account owner's own email. To email anyone else, verify a domain at resend.com/domains, then change the sender address in Supabase (Authentication, SMTP settings) or with `apply-email-templates.mjs`'s companion PATCH (`smtp_admin_email`).
* **Study project (`fykzmhxvhdrxvqkkhlnd`):** Site URL and redirect list are correct, Resend SMTP is on with the same test sender (sender name "Study with Sarang"), 30 emails per hour, and all branded templates are applied.
