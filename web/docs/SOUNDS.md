# Real recordings for the ambience sounds (setup guide)

Ten of the sounds can be real recordings instead of generated ones: **rain, thunder, waves, wind, fire, birds, crickets, coffee shop, singing bowl, white noise**. Until a recording exists for one of them, the generated sound keeps playing, so nothing is ever silent and nothing breaks if a file is missing.

Where a recording can come from, in the order the app looks:

| # | Source | Who it is for |
| - | ------ | ------------- |
| 1 | **Your own file**, chosen in Settings > Sound > Real recordings (stored in this browser or on this computer) | Anyone, instantly, no setup |
| 2 | **The sounds folder** (desktop only): Settings > Sound > Open the sounds folder, then drop `rain.mp3` and so on in | Desktop users who like files |
| 3 | **Bundled**: files in `public/sounds/` when the app is built | You, as the publisher: everyone gets them offline |
| 4 | **Cloud**: any web folder (Supabase Storage, GitHub Pages, any CDN), downloaded once and kept | You, if you do not want a 30 MB larger app |
| 5 | The generated sound | Always the fallback |

Settings > Sound > Real recordings shows which source each sound uses right now and lets people check, replace or remove each one.

## File names

`rain`, `thunder`, `waves`, `wind`, `fire`, `birds`, `crickets`, `coffee-shop`, `singing-bowl`, `white-noise` plus one of `.mp3 .ogg .wav .flac .m4a .aac .opus .webm`.

## Good recordings

- **1 to 5 minutes** each. The app blends the end into the start (Loop blend, 3 s by default), so the loop has no click, but a longer file repeats less obviously.
- Steady, no sudden bangs, no speech you can follow, no music. Thunder and birds can have events; just avoid one very loud crack.
- MP3 at 128 to 192 kbps is plenty. About 1 MB per minute.
- Memory: a decoded minute is about 10 MB in mono and 20 MB in stereo. The app keeps the five most recently used recordings in memory and decodes the rest on demand (Settings lets you change this).

## The quick way: download from freesound.org

1. Create a free Freesound account and request an API key at https://freesound.org/apiv2/apply (choose "Token" for the type of key).
2. In the project folder:

   ```
   # Windows PowerShell
   $env:FREESOUND_TOKEN = "your-key"
   npm run sounds:list        # shows the best candidates for each sound, with licence and rating
   npm run sounds:fetch       # downloads the top pick for every sound that has no file yet
   npm run sounds:fetch -- rain=123456     # use a specific Freesound sound id for a slot
   npm run sounds:fetch -- --license cc0   # only CC0 (no credit needed)
   npm run sounds:fetch -- --slots rain,thunder --force
   ```

   macOS and Linux: `FREESOUND_TOKEN=your-key npm run sounds:fetch`.
3. The files land in `public/sounds/`. The author, title, licence and link of each go to `public/sounds/credits.json`, and a `manifest.json` is generated. The app shows these credits in Settings > About and Settings > Sound.
4. Build as usual (`npm run build` regenerates the manifest first). Or just run `npm run dev`.

What the script does and does not do:

- It uses the Freesound API with your token and only picks sounds under **CC0** or **CC BY** (no non-commercial ones), 60 to 600 seconds long, sorted by number of ratings. Use `--list` and pick by hand if you disagree with a choice.
- It downloads Freesound's high-quality MP3 preview (about 128 kbps), which a token may fetch directly. Original-quality downloads need a sign-in (OAuth2), which this tool deliberately does not do. You can always download an original in the browser and put it in `public/sounds/` yourself; run `npm run sounds` afterwards to refresh the manifest.
- Your token is read from the environment and never written anywhere.

## Licences, briefly

- **CC0**: no credit required.
- **CC BY**: you must credit the author. The app does that for bundled and cloud files through `credits.json` (see Settings > About). Keep the file when you publish.
- **CC BY-NC** and **Sampling+**: not for a published app that might be used commercially; the script avoids them.
- Always check the licence on the sound's own page. Authors can change it, and this guide is not legal advice.

## Option 3, bundled: details

Put the files and `credits.json` in `public/sounds/`. `credits.json` looks like this (written for you by the fetch script):

```json
{ "rain": { "title": "Rain on a tin roof", "author": "someone", "license": "CC BY 4.0", "url": "https://freesound.org/s/123456/", "freesoundId": 123456, "seconds": 190 } }
```

`npm run sounds` turns the files plus credits into `public/sounds/manifest.json`. It runs before every build by itself (`prebuild`). The app downloads nothing at run time for bundled files; the desktop app serves them from inside the installed program.

Size: ten 3 minute MP3s are about 30 MB. If that is too much for the web app, use option 4 instead, or keep recordings out of the web build and ship them only in the desktop one.

## Option 4, cloud: details

Any https folder that contains the ten files (and optionally a `manifest.json` for credits) works. With Supabase:

1. Storage > New bucket > name `sounds` > **Public bucket**.
2. Upload the ten files. Optionally upload `manifest.json` (from `public/sounds/`).
3. In the app: Settings > Sound > Real recordings > Cloud address > "Use my Supabase storage (bucket called sounds)" (fills in `<project url>/storage/v1/object/public/sounds`).

Each file is downloaded once on first use and kept on the device (the browser's cache or the desktop app's cache), so it works offline afterwards. Cross-origin hosts must allow it (Supabase public buckets do).

## If something does not play

Open Settings > Sound > Real recordings and press **Check** next to the sound. It says what failed: file not found at the address, a format the browser cannot decode, or a file that is too short to loop. Nothing else is affected, because the generated sound takes over.
