# Strange Flesh — multilingual edition

Strange Flesh by Greatest Bear Studios, adapted in [Tedenfe/Strange-Flesh](https://github.com/Tedenfe/Strange-Flesh) with 17 languages, controller improvements and Windows releases.

The source includes unreleased font, controller-icon and menu updates, plus a Brazilian Portuguese caption correction, listed in `CHANGELOG.txt` and `releases/unreleased.md`. The published v1.5.1 remains unchanged until the next release is requested.

## Windows download

Download `Strange-Flesh-1.5.1-Windows-x64.exe` from [Releases](https://github.com/Tedenfe/Strange-Flesh/releases). Run the portable executable and choose your existing `Strange-Flesh-Media-v1.4.zip` on first launch. No Node.js installation or local web server is needed. The importer accepts the original v1.4 media pack and verifies its SHA-256 checksum.

The media pack is distributed separately. Adults can obtain it from the [original media link](http://greatestbear.com/strangeflesh/Strange-Flesh-Media-v1.4.zip) documented by the upstream project. The pack contains explicit adult content; see [UPSTREAM-README.md](UPSTREAM-README.md). Images and sounds are excluded from this repository and its executable releases.

Imported media is kept in the application's user-data directory on this computer, alongside persistent desktop settings and saves. Keep the executable's application name unchanged when updating. Future versions reuse the media and desktop saves; browser saves are separate. The executable is unsigned.

The release page contains a short summary. Download `CHANGELOG.txt` for the complete changelog, and `SHA256SUMS.txt` to check downloaded files.

## Language and controls

Press a key or controller button on the title screen. Choose **Settings → Language** and use Left/Right to select a native language name. The choice applies immediately and is saved. The selector appears only in Settings.

Available languages: English, Brazilian Portuguese, Irish, Italian, German, French, Polish, Russian, Traditional Chinese, Simplified Chinese, Japanese, Korean, Spanish (Spain), Spanish (Latin America), Portuguese (Portugal), Turkish and Ukrainian. Each translated catalog covers 425 source strings. The 15 additional catalogs are AI-assisted drafts awaiting native-speaker review. See [locales/README.md](locales/README.md).

Use arrows and Enter to navigate; J also confirms and K goes back. Standard-mapped Xbox 360/One/Series, DualShock 4/DualSense, Switch Pro and compatible controllers are supported through the Gamepad API. Physical controller playtesting remains pending.

| Action | Xbox | PlayStation | Switch Pro |
| --- | --- | --- | --- |
| Move | D-pad / left stick | D-pad / left stick | D-pad / left stick |
| Jump / confirm | A | Cross | B |
| Attack | X | Square | Y |
| Smoke / back | B | Circle | A |
| Grab | Y | Triangle | X |
| Special | LB | L1 | L |
| Pause / skip | Menu | Options | + |

Controls includes remapping, automatic/manual Xbox, PlayStation 4, DualSense and Nintendo labels, and 15%, 25% or 40% stick deadzones. PlayStation icons use Tedenfe's DualShockMod.ttf, with the correct Square icon and model-specific Share/Create and Options symbols. Select an action, release the confirmation button, then press the new key/button/stick direction; Esc cancels. Keyboard and controller inputs can be combined. Release controller inputs after switching back to the window.

Music and SFX use slider bars: far left mutes and far right is maximum, with eleven internal positions. Use Left/Right or drag with a mouse/touchscreen. Changes apply immediately and are saved.

The original single-line title prompt and its beat pulse are retained. Desktop title music can start immediately. In a browser, a key/click may be required by its autoplay policy.

## Display and fonts

Render Mode retains the original scaling: Perfect uses whole 640×360 multiples; Rough uses 64×36 size steps without interpolation; Blurry fits the available 16:9 area with interpolation. Scaling Quality High uses a display-sized canvas capped at 1920×1080; Low uses 640×360 enlarged by the browser; Auto switches from High to Low after sustained low frame rate.

English keeps the original Alagard. European catalogs use Alagard Unicode with Fusion Bold Pixel as the first fallback. Chinese, Japanese and Korean use their regional Fusion faces; Noto is a final fallback for unsupported future characters. Controller icons use the separate CC0 Xbox/PlayStation fonts by Spriteshift and azagaya. All fonts work offline. Font sources, licenses and attribution are in [fonts/README.md](fonts/README.md). Other artwork text and recorded dialogue remain in the original media.

## Development

This repository keeps the upstream flat source layout. Install Node.js 22+ and Python 3.12+:

```text
npm ci
python tools/build-locales.py
python tools/check-font.py
npm test
npm start
```

The desktop starts with the media importer if no complete cache is available. For a browser build, extract the original pack's `images/` and `sound/` folders beside `index.html`, run `node tools/server.js`, and open `http://127.0.0.1:8765/`. Media folders are ignored by Git. Review pages are `font-preview.html`, `localization-preview.html` and `controller-menu-preview.html`.

To edit translations, change `locales/<code>.json` and run `python tools/build-locales.py`. To add another, register its native name/code in `locales/languages.json`. Brazilian Portuguese is in `locales/pt-BR.js`. Newly introduced strings fall back to English. The generator validates complete keys and placeholders; font checks inspect the actual shipped character maps.

Build on Windows:

```text
npm run build:windows
npm run verify:bundle
```

The portable executable appears in `dist/`. The bundle check verifies source, all catalogs, fonts and license notices, and confirms that media is excluded. To additionally test a real media import, set `STRANGE_FLESH_MEDIA_ZIP` to the original ZIP's absolute path before `npm test`. Standard CI skips that test because the media is kept off GitHub.

## Publishing future versions

Update `package.json`/`package-lock.json` and `gameVersion` in `StrangeFlesh.js`. Update `CHANGELOG.txt` and add `releases/v<version>.md` with the shorter summary. Commit and push the source, create the matching `v<version>` Git tag, and push that tag. The Windows release workflow validates catalogs/fonts/tests, builds the executable, checks the bundle, and publishes the `.exe`, full changelog and checksums. It rejects a tag/package version mismatch. Manual workflow runs build downloadable artifacts without publishing a release.

## License and credits

Original game © 2017 Greatest Bear Studios. Original game code and these adaptations retain [CC BY-NC-SA 4.0](License.txt). Preserve attribution and ShareAlike terms; commercial game distribution requires permission under that license. The supplied unchanged Alagard-12px-unicode by iosoftware is CC BY 3.0 with its original archive notices. Noto fonts use SIL OFL 1.1. Bundled dependencies retain their respective notices. See [CHANGELOG.txt](CHANGELOG.txt) and [UPSTREAM-README.md](UPSTREAM-README.md).
