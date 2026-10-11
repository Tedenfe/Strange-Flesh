# Bundled multilingual fonts

The font stack preserves the game's Alagard for English, uses the supplied Alagard Unicode for the European-language catalogs, and uses Noto Sans CJK for Chinese, Japanese, and Korean. Noto also supplies fallback glyphs. All font files are served from this folder; there are no runtime requests to external font services.

| File | Coverage / purpose | Source | License |
| --- | --- | --- | --- |
| alagard-unicode/alagard-12px-unicode.ttf | Alagard style with Portuguese accents; by iosoftware, supplied in alagard-12px-unicode.ttf.zip | [Fontstruct](https://fontstruct.com/fontstructions/show/1035837) | alagard-unicode/license.txt (CC BY 3.0) |
| NotoSans.ttf | Latin, Greek, Cyrillic; French, Italian, Russian, Vietnamese, and other languages in these scripts | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosans) | NotoSans-OFL.txt |
| NotoSansCJK-Regular.otf | Full CJK character coverage including simplified/traditional Chinese, kana and Hangul | [Noto CJK](https://github.com/notofonts/noto-cjk/tree/main/Sans/OTF/SimplifiedChinese) | NotoSansCJK-OFL.txt |

Noto Sans CJK uses the Simplified Chinese default face, with OpenType localized glyph forms for other CJK locales when text is language-tagged. Future locales should set the correct language through `Localization.setLanguage`. This follows the upstream [Noto CJK deployment guide](https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md).

The CSS declares these fonts once in `fonts.css`. The CJK font is about 16 MB and is fetched only when its Unicode ranges are used. Additional scripts such as Arabic or Thai can be added as separate Noto fallback faces when translations in those scripts are developed; this bundle does not claim all Unicode coverage.

The supplied Alagard Unicode font is unchanged. Its original `license.txt` and `readme.txt` accompany it as required by the archive notice. Credit: Alagard-12px-unicode by iosoftware, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Font attribution also appears in the game's end credits.

Use `font-preview.html` for visual inspection and `python tools/check-font.py` to check representative characters and every character actually shipped in the new translations against the font character maps. Noto fonts were downloaded from their official repositories on 2026-10-11; see `manifest.json` for source URLs, supplied archive details and SHA-256 checksums.
