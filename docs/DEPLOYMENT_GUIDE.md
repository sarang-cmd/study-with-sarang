# Deployment guide (Vercel only)

Everything for the Sarang suite is hosted on **Vercel**: the two web apps, the download pages, the installers and the update feeds. Nothing is hosted, released or updated through GitHub. (The old GitHub Pages guide is kept in `docs/archive/` for reference.)

## 1. What lives where

| Piece | Vercel project | Address |
| --- | --- | --- |
| Sarang.md web app | `sarang.md` | `https://sarang-md.vercel.app/` |
| Study with Sarang web app | `study-with-sarang` | `https://sarang-md.vercel.app/study-with-sarang/` (also `https://study-with-sarang.vercel.app/`) |
| Study downloads page | `study-with-sarang` | `https://sarang-md.vercel.app/study-with-sarang/downloads/` |
| Sarang.md downloads page | `sarang.md` | `https://sarang-md.vercel.app/downloads/` |
| Windows installers | each project, `/downloads/` | `.../downloads/Study-with-Sarang-<version>.exe`, `Sarang-md-<version>.exe`, plus stable names `...-Windows.exe` |
| Browser helper (zip) | `study-with-sarang` | `https://study-with-sarang.vercel.app/downloads/Study-with-Sarang-Helper-<version>.zip` |
| Update feeds | each project | `.../updates/latest.json` (public, CORS open) |

The Study app is shown at `sarang-md.vercel.app/study-with-sarang/` by a route in the `sarang.md` project that proxies that path to the `study-with-sarang` project (so the browser keeps the Sarang.md address). `/study-with-sarang` redirects to `/study-with-sarang/`. The web apps have no router that needs the server (Sarang.md uses `#/` addresses, Study has one page), and both build with `base: './'`, so they work under a sub-path.

## 2. Publish (one command per site)

You need a Vercel access token from vercel.com/account/tokens (Full Account scope on team `sarang-dev` is enough). Type it into the command only. Never save it in a file, in `.vercel/`, or in a ZIP, and delete it on the same page afterwards.

```bash
# 1. Build the web apps
cd web && npm ci && npx vite build --outDir /var/tmp/study-dist && cd ..
cd ../Sarang.md && npm ci && npm run build && cd ../Study-with-Sarang      # dist/ in the Sarang.md folder

# 2. Put the signed installers in a folder outside the project (they are about 85 MB each)
ls /var/tmp/assets      # Study-with-Sarang-<v>.exe  Sarang-md-<v>.exe

# 3. Generate both sites (download pages, feeds, checksums, routes) and check them
node site/build.mjs --study-web /var/tmp/study-dist --md-web ../Sarang.md/dist --assets /var/tmp/assets --out /var/tmp/site
node site/test-site.mjs

# 4. Deploy (Study first, then Sarang.md, because Sarang.md proxies to Study)
cd /var/tmp/site/study && npx vercel deploy --prebuilt --prod --token "$TOKEN" --scope sarang-dev
cd /var/tmp/site/md    && npx vercel deploy --prebuilt --prod --token "$TOKEN" --scope sarang-dev
```

`site/build.mjs` writes a Build Output (`.vercel/output`) and a `.vercel/project.json` that contains only the project and team ids, which is why `--prebuilt` needs no login or Git link. Big files stay out of the repository.

**Pushing to GitHub does not deploy.** Both repositories contain a `vercel.json` that turns off Git-triggered deployments for `main` and `master`, because a plain Git build would not contain the installers, `/downloads/` or `/updates/latest.json`. The sites only change when you run the `vercel deploy --prebuilt` commands above.

Vercel Hobby limits that matter here: 100 MB per static file, 10 GB of storage, 100 GB a month of transfer, 100 deployments a day. An installer is about 85 MB, so keep an eye on the 100 MB file limit and on old deployments piling up.

## 3. After a deploy, check

1. `https://sarang-md.vercel.app/study-with-sarang/` shows Study with Sarang, and `/study-with-sarang` redirects to it.
2. Both download pages open, the Download buttons start a download, and the SHA-256 on the page matches `Get-FileHash` of the file.
3. `.../updates/latest.json` on both hosts lists the new version.
4. An installed older app shows the update window after its first check (or press Check now in Settings, Window and updates).

## 4. Analytics

Both web apps include Vercel Web Analytics and Speed Insights (anonymous, no cookies). They only report on `*.vercel.app` pages, never from the desktop apps, and each app has a switch to turn them off. Enable Web Analytics and Speed Insights for the projects in the Vercel dashboard if they are not already on.

## 5. Accounts, emails, invitations, Resend

See `docs/EMAIL_AND_ACCOUNTS.md`. Nothing in the Supabase projects or Vercel environment variables is touched by the steps above.

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/study-with-sarang/` is 404 | The `sarang.md` project was deployed without `site/build.mjs` output, or before the Study project had a deployment. Deploy Study, then Sarang.md again. |
| A download is blocked at 100 MB | The installer grew past the Hobby per-file limit. Slim the build or move to Vercel Blob. |
| The update window never appears | The feed is missing a 64-character `sha256`, or the file name does not match the version. Run `node site/test-site.mjs`. |
| SmartScreen warns | The installers use a self-made certificate. See `desktop/docs/STORE_AND_SIGNING.md` for real options. |
