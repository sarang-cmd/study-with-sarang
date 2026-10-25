# Updates

The installed app can update itself from **GitHub Releases**, and keeps the animated setup you already know.

## What the person sees

1. A few seconds after start (and every six hours while it runs) the app asks GitHub for the latest release. Turn this off in Settings, Window and updates, Updates, "Check in the background". There is also a **Check now** button and a "Check for updates" item in the tray menu.
2. If the version is newer, a notification appears and a small window shows the release notes with **Update now**, **Later** and **Skip this version**. Nothing installs without a click.
3. **Update now** downloads the setup file, checks its SHA-256 against the one published with the release, and only then starts it. The app closes, the animated installer shows the progress, replaces the files and reopens the app.
4. Saved mixes, the time log and every setting stay (they live outside the install folder). Shortcuts that exist stay, and a desktop shortcut the person deleted is not brought back. The "open at sign-in" choice is kept as it is now.
5. If anything fails, the previous version is moved back and the installer says so. The old version is only set aside, never deleted, until the new one is fully in place.

Copies that were not installed with the setup (run once from the exe) and the macOS build can see that an update exists, but open the release page instead of replacing themselves. The Microsoft Store build is updated by the Store and has the card turned off.

## Publishing a release (you)

1. Put your repository in `package.json` as `"swaUpdate": { "repo": "owner/repository" }` before building (people can also type it in the app). The repository must be **public**, because the app does not carry a token.
2. Raise `version` in `package.json` (plain `x.y.z`).
3. Build: `npm run dist:win`, then `node scripts/checksum.cjs` (writes `release/Study-with-Sarang-x.y.z.exe.sha256`).
4. On GitHub create a release with the tag `vx.y.z` (same number, with a `v`). Write the release notes in the description; they are shown in the update window. Do not mark it as a draft or pre-release.
5. Attach exactly two files: `Study-with-Sarang-x.y.z.exe` and `Study-with-Sarang-x.y.z.exe.sha256`. (GitHub's own SHA-256 "digest" for the file is also accepted if the checksum file is missing.)

A release without a checksum is refused by the app.

## What this protects, and what it does not

- It rejects downloads that are damaged, cut short, not a Windows program, larger than expected or do not match the published SHA-256. It only talks to GitHub over https, and only follows redirects to GitHub's own file hosts.
- The checksum comes from the same release as the file, so it protects against a bad download, **not** against someone who gets into your GitHub account. That needs code signing with a certificate you control, and the app verifying the signature. The exe is now signed (see `docs/STORE_AND_SIGNING.md`), but the updater does not check that signature yet, so treat the checksum as damage protection only.
- The first build that contains the updater is 1.3.0. Anyone on an older version installs 1.3.0 by hand once, then updates themselves.

## Tests

- `node scripts/test-update.cjs` (part of `npm test`): version rules, GitHub address rules, release parsing, downloads and every refusal case, the updater's decisions, background checks and the rollback of a failed install, all against a local stand-in for GitHub.
- `xvfb-run -a node scripts/test-update-ui.cjs`: the real app finds an update, shows the window and hands over to the installer.
- `xvfb-run -a node scripts/test-setup-ui.cjs`: the installer in update mode (success, failure, bad folder).
- Not tested here: the real GitHub API, a real Windows replace of a running install, and how Windows reacts to the signed file.
