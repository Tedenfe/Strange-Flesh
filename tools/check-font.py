from pathlib import Path
import json
import struct
import unicodedata

root = Path(__file__).resolve().parents[1]
game = root / 'game' if (root / 'game').is_dir() else root

def glyph_reader(filename):
    data = (game / 'fonts' / filename).read_bytes()
    u16 = lambda offset: struct.unpack_from('>H', data, offset)[0]
    u32 = lambda offset: struct.unpack_from('>I', data, offset)[0]
    tables = {data[12+i*16:16+i*16].decode(): u32(20+i*16) for i in range(u16(4))}
    cmap = tables['cmap']
    candidates = [cmap+u32(cmap+8+i*8) for i in range(u16(cmap+2)) if u16(cmap+4+i*8) in (0, 3)]
    offset = next((candidate for candidate in candidates if u16(candidate) == 12), None)
    if offset is not None:
        groups = [struct.unpack_from('>III', data, offset+16+i*12) for i in range(u32(offset+12))]
        return lambda code: next((start_glyph+code-start for start, end, start_glyph in groups if start <= code <= end), 0)
    offset = next(candidate for candidate in candidates if u16(candidate) == 4)
    count = u16(offset+6)//2
    ends = offset+14
    starts = ends+count*2+2
    deltas = starts+count*2
    ranges = deltas+count*2
    def glyph(code):
        for i in range(count):
            if u16(starts+2*i) <= code <= u16(ends+2*i):
                delta = u16(deltas+2*i)
                relative = u16(ranges+2*i)
                if not relative:
                    return (code+delta) % 65536
                index = u16(ranges+2*i+relative+2*(code-u16(starts+2*i)))
                return (index+delta) % 65536 if index else 0
        return 0
    return glyph

samples = {
    'alagard-unicode/alagard-12px-unicode.ttf': 'ãáàâéêíóôõúçÃÁÀÂÉÊÍÓÔÕÚÇ',
    'NotoSans.ttf': 'Italiano Français Ελληνικά Ἑλληνική Русский Українська Tiếng Việt ×',
    'NotoSansCJK-Regular.otf': '简体中文 繁體中文 日本語 ひらがな カタカナ 한국어 한글 ○□△'
}
fusion_files = {code: 'fusion-bold-pixel/fusion-bold-pixel-proportional-' + variant + '-12px-square.ttf'
                for code, variant in [('latin', 'latin'), ('zh-Hans', 'zh-Hans'), ('zh-Hant', 'zh-Hant'), ('ja', 'ja'), ('ko', 'ko')]}
samples.update({filename: sample for filename, sample in [
    (fusion_files['latin'], 'Italiano Français Ελληνικά Русский Українська ×○□△'),
    (fusion_files['zh-Hans'], '简体中文 游戏菜单'), (fusion_files['zh-Hant'], '繁體中文 遊戲選單'),
    (fusion_files['ja'], '日本語 ひらがな カタカナ'), (fusion_files['ko'], '한국어 한글 게임 메뉴')]})
samples.update({'pixel-controller/Xbox.ttf': 'abxy[]{}<>mvWADX',
                'pixel-controller/DualShock.ttf': 'xcst[]{}<>roWADX',
                'pixel-controller/DualShockMod.ttf': 'xcst[]{}<>rpqoWADX'})
catalog_source = (game / 'locales/pt-BR.js').read_text(encoding='utf-8')
catalog = json.loads(catalog_source[catalog_source.index('{'):catalog_source.rindex('}')+1])
samples['alagard-unicode/alagard-12px-unicode.ttf'] += ''.join({
    char for text in catalog.values() for char in text
    if unicodedata.name(char, '').startswith('LATIN ')
})
for filename, sample in samples.items():
    glyph = glyph_reader(filename)
    missing = sorted(set(char for char in sample if not char.isspace() and not glyph(ord(char))))
    assert not missing, filename + ': ' + ascii(missing)
    print(filename + ': all sample glyphs present.')

# Check every character actually shipped, including native selector names.
locales = game / 'locales'
readers = {filename: glyph_reader(filename) for filename in samples}
for language in json.loads((locales / 'languages.json').read_text(encoding='utf-8')):
    dictionary = json.loads((locales / (language['code'] + '.json')).read_text(encoding='utf-8'))
    characters = set(''.join(dictionary.values()) + language['name'])
    is_cjk = language['code'].startswith(('zh-', 'ja', 'ko'))
    # The current catalogs must work in pixel fonts, without reaching Noto.
    stack = [fusion_files[language['code']], fusion_files['latin']] if is_cjk else ['alagard-unicode/alagard-12px-unicode.ttf', fusion_files['latin']]
    missing = sorted(char for char in characters if not char.isspace() and not any(readers[font](ord(char)) for font in stack))
    assert not missing, language['code'] + ': ' + ascii(missing)
    print(language['code'] + ': all translated characters covered by bundled fonts.')
