# Deployment guide

How to publish the **landing page**, the **web app** and a **desktop release** of Study with Sarang. Everything below was set up for the repository `sarang-cmd/study-with-sarang`; replace that name if you fork it.

## 1. What gets published, and where

| Piece | Source | Public address (GitHub Pages) |
| --- | --- | --- |
| Landing page | `landing/` (plain HTML, no build) | `https://sarang-cmd.github.io/study-with-sarang/` |
| Web app | `web/` (Vite build) | `https://sarang-cmd.github.io/study-with-sarang/app/` |
| Windows app | `desktop/` (electron-builder) | GitHub **Releases** (not Pages) |

The workflow `.github/workflows/pages.yml` builds the web app, puts the landing page at the root and the web app in `/app/`, then deploys both. It runs on every push to `main` that touches `landing/`, `web/` or the workflow, and by hand from the **Actions** tab.

## 2. Option A: GitHub Pages (already set up)

1. Repository **Settings**, **Pages**, **Build and deployment**, Source: **GitHub Actions**. (This was switched on through the API; check it is still selected.)
2. Push to `main`. Open the **Actions** tab and wait for *Deploy landing page and web app to GitHub Pages* to turn green (about two minutes).
3. Open `https://sarang-cmd.github.io/study-with-sarang/`.

If the workflow fails with a permissions error, open Settings, Actions, General, and set *Workflow permissions* to **Read and write**; then re-run.

### Custom domain

1. Settings, Pages, Custom domain: enter `studywithsarang.example` (your domain).
2. At your DNS provider add a `CNAME` record for `www` (or a subdomain) pointing to `sarang-cmd.github.io`. For an apex domain add four `A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Tick **Enforce HTTPS** once the certificate is ready (it can take up to an hour).
4. Update the three addresses in `landing/index.html` (`og:` tags), `desktop/src/lib/suite.ts` (`landingUrl`) and the `homepage` field in both `package.json` files.

## 3. Option B: Vercel (landing page only, or both)

Vercel hosts Sarang.md already, so this is a familiar route.

1. vercel.com, **Add New**, **Project**, import `sarang-cmd/study-with-sarang`.
2. For the landing page alone: *Root Directory* `landing`, *Framework Preset* **Other**, no build command, output directory `.`.
3. For the web app as its own project: create a second project with *Root Directory* `web`, framework **Vite**, build `npm run build`, output `dist`.
4. Deploy. Every push to `main` redeploys.
5. Domains: Project, Settings, Domains, then follow the DNS instructions Vercel shows.

If you use Vercel for the landing page, the "Open in your browser" button points to `app/`, which would not exist there. Either point it to your web-app project's address or keep Pages for `/app/`.

## 4. Option C: Netlify or Cloudflare Pages

Drag the `landing` folder onto app.netlify.com/drop, or connect the repo with *Publish directory* `landing` and no build command. For the web app use base directory `web`, build `npm run build`, publish `dist`. Both use relative asset paths, so the app works at `/` or under a subfolder.

## 5. Publishing a desktop release

Use this order so the in-app updater, the landing page and the download links all work.

1. **Bump the version** in `desktop/package.json` and `desktop/package-lock.json` (two places at the top of the lock file only), and for the web edition in `web/package.json` and its lock file. Add an entry to `VERSION_HISTORY.md` and `CHANGELOG.md`.
2. **Test:** `cd desktop && npm test`. For the UI tests run `npm run build` first, then `npm run test:ui` under a display.
3. **Build:** `cd desktop && npm run build && npx electron-builder --win --x64 --config.directories.output=/some/folder`. On Linux give the build 3 GB of swap or it runs out of memory.
4. **Sign** (optional but recommended): `node scripts/sign-exe.cjs <exe>` with `SWA_SIGN_PFX`, `SWA_SIGN_PASSWORD` and `SWA_SIGN_TIMESTAMP` set. A self-made certificate still triggers SmartScreen; a purchased certificate (or Microsoft's Artifact Signing, where available) builds trust. Never commit the `.pfx` or its password.
5. **Checksum:** `node scripts/checksum.cjs <folder>` writes `<exe>.sha256` beside the exe. Checksum after signing.
6. **Create the release.** Tag `vX.Y.Z` (the updater needs the plain `vX.Y.Z` form; no suffixes). Upload exactly these files:
   - `Study-with-Sarang-X.Y.Z.exe` (the updater only accepts this exact name)
   - `Study-with-Sarang-X.Y.Z.exe.sha256`
   - `Study-with-Sarang-Windows.exe` (the same file again; the landing page and the web app's Download button link to it, because `releases/latest/download/<name>` needs a name that does not change)
   - `Study-with-Sarang-Web-X.Y.Z.zip` (the web edition, for people who host it themselves)
7. Mark it **Latest**. Do not tick *Pre-release*: the updater ignores pre-releases and drafts.
8. Check: open the landing page (it reads the newest release and shows its version), click **Download for Windows**, and in an older installed copy press **Check for updates**.

## 6. Cloud sync (optional)

The apps work with no server. For sync across devices, create a Supabase project, run the SQL in `desktop/supabase/` and paste the project URL and the **publishable** (anon) key into Settings, Cloud sync. Never paste a `service_role` or secret key; the app refuses them. `MASTER_GUIDE.md` has the full walk-through, including email templates.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Pages shows a 404 | Settings, Pages: Source must be *GitHub Actions*; re-run the workflow. |
| The page loads but images or the app are missing | The workflow copies `landing/` and `web/dist` into `_site`; check the *Assemble the site* step in the log. |
| `Download for Windows` gives a 404 | The release is missing the asset named exactly `Study-with-Sarang-Windows.exe`. |
| The updater says no update | The release is a draft or pre-release, the tag is not `vX.Y.Z`, or the exe name or `.sha256` file is missing. |
| SmartScreen warns | Expected with a self-made certificate. More info, then Run anyway. |
| API rate limit on the landing page | The version line falls back to static text; the download links still work. |
