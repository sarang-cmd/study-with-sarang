# Cloud sync with Supabase (optional)

The studio works with no account and keeps everything on the device. Cloud sync is for people who want the same saved mixes, time log and settings on more than one computer. It uses a Supabase project. The app comes with one already set up (`src/lib/cloudDefaults.ts` holds its public URL and publishable key), and you can switch to your own under Advanced.

## What it does

- Syncs: saved mixes, the time log, minutes listened, the video playlist and the timer settings (the desktop edition also syncs macros).
- Does not sync: theme, the running timer, window and shortcut settings, voice mode, local video files.
- Merges three ways against the last sync, so edits and deletions on one device arrive on the others. If both devices edit the same item, the newer edit wins.
- Signed-in apps merge at start, a few seconds after a change, when the window regains focus and every five minutes. Newer data that arrives while the app is open is applied after a reload (the app asks), so the page never overwrites it with stale state.
- Advanced: replace this device with the cloud copy, replace the cloud copy with this device, delete the cloud copy.

## Using the built-in project

Nothing to do in the app: open Settings, Cloud sync, and sign in or create an account. Creating an account asks for a 6 digit code that is emailed to you. The project owner needs to do the one-time dashboard steps in `docs/EMAIL_SETUP.md` (Site URL, redirect addresses, branded emails, SMTP).

## Set up your own project (about two minutes)

1. Create a project at supabase.com.
2. SQL Editor, New query, paste `supabase/schema.sql`, Run. It creates one table, `study_sync`, with Row Level Security: each user can only read and change their own row.
3. Project Settings, API: copy the **Project URL** and the **anon / publishable key**. In the app open Settings, Cloud sync, Advanced, Use a different Supabase project, and paste both. Or set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env` file before building.
4. Authentication, Providers: keep Email enabled. With "Confirm email" on (recommended) the app asks for the emailed code, and the sign-up email must contain `{{ .Token }}` (the templates in `supabase/email-templates/` do). For the **Email code** option the Magic Link template needs it too.
5. Follow `docs/EMAIL_SETUP.md` for Site URL, redirects and sending real mail.

## Keys

The app never ships or accepts a secret. It refuses the service-role key and `sb_secret_` keys when you paste them. The anon key is public by design; Row Level Security is what protects the data. Sessions are stored in the app's local storage like any web app's.

## Tests

`node scripts/test-cloud.mjs` runs the merge rules and the whole client (sign up with a confirmation code, email links, sign in, email code, token refresh, two devices, deletions, concurrent writers, account isolation, errors) against a small mock of Supabase's Auth and REST endpoints. `scripts/test-features.cjs` drives the real window against the same mock. Neither talks to a real Supabase project, so run through the steps above once with your own project before relying on it.
