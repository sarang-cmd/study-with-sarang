# Updates

The installed app updates itself from the **Study with Sarang website** (Vercel), and keeps the animated setup you already know. Nothing here uses GitHub.

## What the person sees

1. A few seconds after start (and every six hours while it runs) the app reads the update feed, a small public JSON file at `https://study-with-sarang.vercel.app/updates/latest.json`. Turn this off in Settings, Window and updates, Updates, "Check in the background". There is also a **Check now** button and a "Check for updates" item in the tray menu.
2. If the version is newer, a notification appears and a small window shows the release notes with **Update now**, **Later** and **Skip this version**. Nothing installs without a click.
3. **Update now** downloads the setup file from the same website, checks its SHA-256 against the one in the feed, and only then starts it. The app closes, the animated installer shows the progress, replaces the files and reopens the app.
4. Saved mixes, the time log and every setting stay (they live outside the install folder). Shortcuts that exist stay, and a desktop shortcut the person deleted is not brought back. The "open at sign-in" choice is kept as it is now.
5. If anything fails, the previous version is moved back and the installer says so. The old version is only set aside, never deleted, until the new one is fully in place.

Copies that were not installed with the setup (run once from the exe) and the macOS build can see that an update exists, but open the download page instead of replacing themselves. The Microsoft Store build is updated by the Store and has the card turned off.

The web app has its own, simpler note: when a newer page version is published, a small popup offers to reload. It reads the same feed (`web.version`).

## The feed

```json
{
  "schema": 1, "app": "study-with-sarang", "version": "2.2.0", "published": "2026-10-25T10:00:00.000Z",
  "notes": "What changed, in plain words.",
  "page": "https://sarang-md.vercel.app/study-with-sarang/downloads/",
  "windows": { "file": "Study-with-Sarang-2.2.0.exe", "url": "https://study-with-sarang.vercel.app/downloads/Study-with-Sarang-2.2.0.exe", "size": 85000000, "sha256": "<64 hex characters>" },
  "web": { "version": "1.10.0", "notes": "..." },
  "extension": { "version": "1.1.0", "file": "Study-with-Sarang-Helper-1.1.0.zip", "url": "...", "sha256": "..." }
}
```

The file name must be `Study-with-Sarang-<version>.exe` with the same version as `version`, and the checksum must be 64 hex characters. A feed without a checksum is refused by the app.

## Publishing a release (you)

You never upload anything by hand. From the project folder:

1. Raise `version` in `desktop/package.json` (plain `x.y.z`), and the web version in `web/package.json`. Write the release notes in `site/releases.json`.
2. Build and sign the installer (see the build notes in `MASTER_GUIDE.md`), and build the web app (`npm run build` in `web/`, and in the Sarang.md folder).
3. Put the signed exes in a folder outside the project, for example `/var/tmp/assets`, then run `node site/build.mjs --study-web web/dist --md-web ../Sarang.md/dist --assets /var/tmp/assets --out /var/tmp/site`. It writes both sites, the download pages, the checksums and the feed.
4. Deploy each folder with `vercel deploy --prebuilt --prod` (token from your own Vercel account, typed into that command only). `node site/test-site.mjs` checks the output first.

The same step publishes the browser helper zip and the new feed, so every update ships the helper too.

## What this protects, and what it does not

- It rejects downloads that are damaged, cut short, not a Windows program, larger than expected or do not match the published SHA-256. It only talks to `vercel.app` over https, and only follows redirects that stay on `vercel.app`.
- The checksum comes from the same site as the file, so it protects against a bad download, **not** against someone who gets into your Vercel account. That needs code signing with a certificate you control, and the app verifying the signature. The exe is signed (see `docs/STORE_AND_SIGNING.md`), but the updater does not check that signature yet, so treat the checksum as damage protection only.
- Versions before 2.2.0 look for updates on GitHub. Anyone on those installs 2.2.0 by hand once (the download page), then updates themselves from the website.

## Tests

- `node scripts/test-update.cjs` (part of `npm test`): version rules, feed address rules, feed parsing, downloads and every refusal case, the updater's decisions, background checks and the rollback of a failed install, all against a local stand-in for the website.
- `xvfb-run -a node scripts/test-update-ui.cjs`: the real app finds an update, shows the window and hands over to the installer.
- `xvfb-run -a node scripts/test-setup-ui.cjs`: the installer in update mode (success, failure, bad folder).
- `node site/test-site.mjs`: the generated sites, feeds, hashes, pages and routes.
