# Language catalogs

The game includes 17 selectable languages. English uses the original source strings; Brazilian Portuguese retains its existing `pt-BR.js` catalog. `languages.json` lists the 15 additional native names and codes. Their editable JSON catalogs contain all 425 source keys, including menus, controller labels, story captions, endings, credits, randomized enemy names, level-file object names, and the boss announcement.

Additional languages: Irish (`ga`), Italian (`it`), German (`de`), French (`fr`), Polish (`pl`), Russian (`ru`), Traditional Chinese (`zh-Hant`), Simplified Chinese (`zh-Hans`), Japanese (`ja`), Korean (`ko`), Spanish for Spain (`es`), Latin American Spanish (`es-419`), European Portuguese (`pt-PT`), Turkish (`tr`), and Ukrainian (`uk`). The two Chinese variants have separate translations and terminology.

These new translations are AI-assisted drafts, not native-speaker-reviewed releases. They need linguistic review, particularly idioms, adult slang, Irish grammar, and caption flow. Automated checks establish complete key coverage, placeholder safety, font coverage, language switching, and caption reveal state; they do not establish linguistic accuracy.

Names of contributors, font families, and license notices remain unchanged. Sound, code, and art headings baked into the credit images are covered by translated text during drawing, preserving the illustrations and contributor names. Other text inside artwork and recorded speech keep the original media. Newly added English source text falls back to English until translated.

To edit a translation, change values in its JSON file while preserving the English keys and `{button}` placeholder. Run `python tools/build-locales.py` to validate the catalogs and rebuild `catalogs.js`, which the game loads locally after `Localization.js`. Packaging also rebuilds this bundle. JSON catalogs are the authoritative editable sources; no translation service is contacted by the game or builder.

The bundled Alagard Unicode is the primary face for European languages, with Noto fallbacks. Chinese, Japanese, and Korean use Noto Sans CJK. Canvas language tags select localized CJK glyph forms. `python tools/check-font.py` checks every character shipped in the additional catalogs and native language names.

Open `http://127.0.0.1:8765/localization-preview.html` to review enemy-name fitting, the boss announcement, and the credit overlays in any language. It uses the game's text, enemy-name, and credit-heading renderers without changing saved game settings.

Translation adaptations retain the game's CC BY-NC-SA 4.0 license; see `../License.txt`.
