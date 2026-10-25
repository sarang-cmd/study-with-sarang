# Microsoft Store, signing and macOS

## Microsoft Store (preferred distribution)

The Store signs the package for you, so there is no SmartScreen warning and updates are handled for you. It cannot be built on Linux, so this is a short job on your Windows PC.

1. Register a Microsoft Partner Center developer account (a one-time fee for individuals) and reserve the name **Study with Sarang**.
2. In Partner Center open **Product identity** and copy the *Package/Identity/Name* and *Package/Identity/Publisher* values.
3. Put them in `package.json` under `build.appx` (`identityName` and `publisher`, replacing the two REPLACE_WITH values).
4. `npm install`, then `npm run dist:store`. This creates `release/Study-with-Sarang-<version>.appx`. The tile images in `assets/appx` are already generated.
5. Upload the package in Partner Center and complete the listing. Describe the global shortcuts and the microphone use (voice mode) in the notes.

Things to check in a Store build (they could not be tried here):

- **Open at sign-in.** Packaged apps start at sign-in through a *startup task* declared in the package manifest. electron-builder does not add one by default, so the sign-in switch may do nothing in a Store build until the manifest includes it. Verify on the Store build and, if needed, add the extension through a custom appx manifest.
- **Setup window.** Store builds skip the custom setup, because the Store installs the app. The app detects the Store package and goes straight to the main window.
- **The `study-with-sarang://` link** needs the protocol declared in the manifest as well.
- Microsoft reviewers may ask why a background app registers global shortcuts. They do not log keys, and only the listed combinations are registered.

## Signing the downloadable exe

### What this project does now

`scripts/sign-exe.cjs` signs the finished exe (SHA-256, with a timestamp when the timestamp server is reachable) using `osslsigncode`, or Windows' own `Set-AuthenticodeSignature` on a PC. It reads the certificate from `SWA_SIGN_PFX` and `SWA_SIGN_PASSWORD`, so no key lives in the source. Release order matters: build, **sign**, then `node scripts/checksum.cjs` (signing changes the file, so the checksum comes last).

```bash
bash scripts/make-signing-cert.sh signing          # once: creates a self-signed certificate (5 years)
SWA_SIGN_PFX=signing/study-with-sarang-signing.pfx SWA_SIGN_PASSWORD="$(cat signing/PASSWORD.txt)" node scripts/sign-exe.cjs release/Study-with-Sarang-2.0.0.exe
```

The default build keeps `win.signAndEditExecutable: false` on purpose: it lets the project build on Linux without wine, and the icon and version info are written by `scripts/after-pack.cjs`. Only the outer file you distribute is signed. The program unpacked from it at run time is not.

### Be clear about what a self-signed certificate does

- It proves the file was not modified after signing, and gives it a fixed publisher name, `Study with Sarang`.
- Windows does **not** trust it. SmartScreen still treats the file as from an unknown publisher on a PC that has not seen it, and the signature shows as "not trusted" in the file's Properties.
- On your own PCs you can make Windows trust it: double-click `study-with-sarang-signing.cer`, Install Certificate, Local Machine, "Trusted Publishers" and "Trusted Root Certification Authorities". Only do this on machines you own. Never ask other people to install a root certificate for you.
- The public certificate for this build is `docs/study-with-sarang-signing.cer` (SHA-256 fingerprint `2A:3F:0E:1A:65:28:8B:7F:EC:26:30:63:D2:0B:B3:E3:73:B9:03:C2:E7:F6:D4:7E:E2:41:3C:DF:6D:74:31:4B`). It contains no secret.
- The 2.0.0 exe was signed on a build machine with no internet access, so it carries **no timestamp**. Such a signature stops validating when the certificate expires (2031-10-03). Sign again with network access (the script then adds a timestamp) when you rebuild.
- Keep the `.pfx` and its password private. Anyone who has them can sign a file as "Study with Sarang". They are not in the release ZIPs.

### How to get rid of the warning for everyone

| Option | Cost and conditions | Result |
| --- | --- | --- |
| Microsoft Store | One-time developer fee, review by Microsoft | No SmartScreen warning at all; Microsoft signs the package. |
| Certificate from a public authority (OV), for example from a Certum, Sectigo or DigiCert reseller | About 100 to 300 USD a year, works worldwide, identity check | Publisher name shown. SmartScreen reputation still builds over weeks of clean downloads (EV no longer gives an instant pass). |
| Azure Artifact Signing (formerly Trusted Signing) | About 10 USD a month. Organizations in the EU, US, Canada and UK; individuals only in the US and Canada | Short-lived certificates, Microsoft-trusted. Reputation still builds. |
| SignPath Foundation | Free for open source projects that meet its rules | Trusted signature for a public repository. |

With a purchased or issued certificate, use the same two variables (`SWA_SIGN_PFX`, `SWA_SIGN_PASSWORD`) or sign with `signtool` and then run the checksum script. Hardware-token certificates (most OV and EV ones today) cannot be exported to a `.pfx`; sign on the PC where the token is plugged in with `signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 /a <exe>`.

## macOS

`npm run dist:mac` must run on a Mac and produces a universal DMG. It could not be built or run here, so it is untested. The code paths are written for it: inset traffic lights, the system vibrancy material, Cmd-based shortcuts, a standard app menu and the Dock behavior (the app keeps running in the menu bar when the window closes).

- **Liquid Glass.** Electron's own `vibrancy` option uses the system material. Apple's new Liquid Glass controls would need a native addon plus a macOS 26 SDK, which cannot be verified without a Mac running macOS 26, so it is not included and the app does not claim it. If you want to try it later, the title bar and the mini bar are the two places to start. Both are already their own components.
- **Signing and notarization** need an Apple Developer ID. Set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for electron-builder.
- Voice mode is Windows only for now.
- The default shortcuts use Cmd + Option + Shift. Closing the window keeps the app running in the menu bar, and clicking the Dock icon brings the window back.

## Android

Not part of this version. The web app inside this project is already responsive. A later Android app can wrap `dist/` with Capacitor and use a foreground service for audio, but global shortcuts and the tray do not exist there.
