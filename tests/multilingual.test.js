const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.existsSync(path.resolve(__dirname, '../game/StrangeFlesh.js')) ? path.resolve(__dirname, '../game') : path.resolve(__dirname, '..');
function harness() {
    const c = vm.createContext({settings: {}, saves: 0, saveSettings() { c.saves++; },
        document: {documentElement: {}}, sstext: {canvas: {}}, c: {}, displayC: {}});
    for (const name of ['locales/pt-BR.js', 'Localization.js', 'locales/catalogs.js'])
        vm.runInContext(fs.readFileSync(path.join(game, name), 'utf8'), c);
    return c;
}

test('all 17 offline languages register once and cover every source string and controller placeholder', () => {
    const c = harness();
    assert.equal(c.Localization.languages.length, 17);
    assert.equal(new Set(c.Localization.languages).size, 17);
    const keys = Object.keys(c.PortugueseBrazil).sort();
    for (const code of c.Localization.languages.filter(code => code !== 'en')) {
        const dictionary = c.Localization.catalogs[code];
        assert.deepEqual(Object.keys(dictionary).sort(), keys, code);
        for (const key of keys) {
            assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), code + ': ' + key);
            assert.deepEqual(dictionary[key].match(/\{\w+\}/g), key.match(/\{\w+\}/g), code + ': ' + key);
        }
    }
    assert.notEqual(c.Localization.catalogs['zh-Hans']['Settings'], c.Localization.catalogs['zh-Hant']['Settings']);
    assert.notEqual(c.Localization.catalogs['pt-BR']['Settings'], c.Localization.catalogs['pt-PT']['Settings']);
    assert.notEqual(c.Localization.catalogs.es.Settings, c.Localization.catalogs['es-419'].Settings);
});

test('each new language switches immediately, persists, and tags the detached canvases for localized glyphs', () => {
    const c = harness();
    const menu = c.languageMenuItem();
    for (let index = 0; index < c.Localization.languages.length; index++) {
        menu.selected = index;
        menu.onChange();
        const code = c.Localization.languages[index];
        assert.equal(c.settings.language, code);
        assert.equal(c.document.documentElement.lang, code);
        assert.equal(c.sstext.canvas.lang, code);
        assert.equal(c.displayC.lang, code);
        assert.equal(c.c.lang, code);
        assert.equal(c.localize('Language:'), c.localize('Language') + ':');
        assert.equal(c.localize('Untranslated future text'), 'Untranslated future text');
        if (code !== 'en') assert.notEqual(c.localize('Years passed.'), 'Years passed.', code);
    }
    assert.equal(c.saves, 17);
});

test('completed story captions remain complete across every language and return to English correctly', () => {
    const c = harness();
    const scene = {screens: [{lines: [{text: 'Joe was happy.', i: 14}]}]};
    for (const code of c.Localization.languages.slice(1).concat('en')) {
        c.Localization.setLanguage(code);
        c.Localization.localizeCutscene(scene);
        const line = scene.screens[0].lines[0];
        assert.equal(line.i, line.text.length, code);
        assert.equal(line.sourceText, 'Joe was happy.');
    }
    assert.equal(scene.screens[0].lines[0].text, 'Joe was happy.');
});

test('European languages retain Alagard and other scripts use regional Fusion Bold Pixel faces first', () => {
    const c = harness();
    for (const code of ['ga', 'it', 'de', 'fr', 'pl', 'ru', 'es', 'es-419', 'pt-PT', 'tr', 'uk']) {
        c.Localization.setLanguage(code);
        assert.match(c.Localization.font('alagard'), /^"Alagard Unicode",/, code);
        assert.ok(c.Localization.font('alagard').indexOf('Fusion Bold Pixel Latin') < c.Localization.font('alagard').indexOf('Noto Sans'), code);
    }
    for (const [code, face] of [['zh-Hans','SC'], ['zh-Hant','TC'], ['ja','JP'], ['ko','KR']]) {
        c.Localization.setLanguage(code);
        assert.ok(c.Localization.font('alagard').startsWith('"Fusion Bold Pixel ' + face + '",'), code);
    }
    c.Localization.registerLanguage('el', 'Ελληνικά', {});
    c.Localization.setLanguage('el');
    assert.match(c.Localization.font('alagard'), /^"Fusion Bold Pixel Latin",/);
});

test('menu fitting bounds long translated labels and preserves shorter labels at their original size', () => {
    const c = vm.createContext({GlobalResourceLoader: {AddAudioResource() {}},
        sstext: {fontSize: 0, MeasureText(text) { return {width: text.length * this.fontSize}; }}});
    vm.runInContext(fs.readFileSync(path.join(game, 'SettingsMenu.js'), 'utf8'), c);
    assert.equal(c.settingsTextSize('short', 26, 300), 26);
    const long = 'A long native language name for a menu column';
    assert.ok(c.settingsTextSize(long, 26, 282) * long.length <= 282);
});

test('enemy names, randomized Joe variants and boss/level announcements are covered in every catalog', () => {
    const c = harness();
    const labels = new Set(['Unknown Object', 'Trigger', 'Sound', 'Code', 'Art']);
    const literal = '"(?:[^"\\\\]|\\\\.)*"';
    for (const file of fs.readdirSync(game).filter(file => file.endsWith('.js'))) {
        const source = fs.readFileSync(path.join(game, file), 'utf8');
        for (const match of source.matchAll(new RegExp('(?:\\.displayName\\s*=|\\.DisplayMessage\\()\\s*(' + literal + ')', 'g')))
            for (const label of JSON.parse(match[1]).split(';')) labels.add(label);
        for (const match of source.matchAll(/\.(?:regularNames|corruptNames)\s*=\s*(\[[^\]]*\])/g))
            for (const label of JSON.parse(match[1])) labels.add(label);
    }
    function visit(value) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') {
            if (typeof value.displayName === 'string') value.displayName.split(';').forEach(label => labels.add(label));
            Object.values(value).forEach(visit);
        }
    }
    for (const file of fs.readdirSync(path.join(game, 'levels')).filter(file => file.endsWith('.txt')))
        visit(JSON.parse(fs.readFileSync(path.join(game, 'levels', file), 'utf8').replace(/^\uFEFF/, '')));
    labels.delete('Joe'); // Character name, not a descriptive label.
    labels.delete('');
    labels.delete('?');
    for (const code of c.Localization.languages.filter(code => code !== 'en')) {
        const missing = [...labels].filter(label => !Object.hasOwn(c.Localization.catalogs[code], label));
        assert.deepEqual(missing, [], code);
    }
});

test('translated credit headings replace the title band while preserving the original name band and English artwork', () => {
    const c = harness();
    const rects = [], text = [];
    c.GlobalResourceLoader = {AddImageResource() {}, AddSequentialImageResources() {}, AddAudioResource() {}};
    c.ctx = {save() {}, restore() {}, fillRect(...args) {rects.push(args);}};
    c.sstext.DrawText = (...args) => text.push(args);
    vm.runInContext(fs.readFileSync(path.join(game, 'Cutscene.js'), 'utf8'), c);
    c.drawLocalizedCreditHeading('Sound');
    assert.equal(text.length, 0);
    c.Localization.setLanguage('pt-BR');
    c.drawLocalizedCreditHeading('Sound');
    assert.deepEqual(rects, [[0, 226, 640, 49]]);
    assert.ok(rects[0][1] + rects[0][3] < 278, 'Contributor names start below the mask');
    assert.equal(c.localize(text[0][0]), 'Som');
    assert.deepEqual(text[0].slice(1), [320, 264, 36, '#FFF', 1, 'center', 'alphabetic']);
});
