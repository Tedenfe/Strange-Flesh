'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(root, 'dist/win-unpacked/resources/app.asar'));
const entries = asar.listPackage(file).map(name => name.replaceAll('\\', '/').replace(/^\//, ''));
const prefix = entries.includes('game/StrangeFlesh.js') ? 'game/' : '';
for (const entry of ['StrangeFlesh.js', 'index.html', 'License.txt', 'locales/catalogs.js', 'locales/pt-BR.js',
    'fonts/NotoSans.ttf', 'fonts/NotoSans-OFL.txt', 'fonts/NotoSansCJK-Regular.otf', 'fonts/NotoSansCJK-OFL.txt',
    'fonts/alagard-unicode/alagard-12px-unicode.ttf', 'fonts/alagard-unicode/license.txt', 'fonts/alagard-unicode/readme.txt'])
    assert.ok(entries.includes(prefix + entry), 'Missing ' + entry);
for (const entry of ['desktop/main.js', 'desktop/preload.js', 'desktop/setup.html', 'CHANGELOG.txt', 'package.json'])
    assert.ok(entries.includes(entry), 'Missing ' + entry);
assert.equal(entries.some(entry => /^(game\/)?(images|sound)\//.test(entry)), false, 'Media must stay outside the release');
assert.equal(entries.some(entry => /PixelifySans\.ttf$/.test(entry)), false, 'Retired font');
const version = JSON.parse(asar.extractFile(file, 'package.json').toString()).version;
assert.equal(version, require('../package.json').version);
console.log('Verified release ' + version + ': bundled code, 17 languages, fonts and notices; no media pack.');
