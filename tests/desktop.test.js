'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {resolveResource, validatedBounds} = require('../desktop/paths');
const {MEDIA_SHA256, hashFile, mediaPath, mediaReady, importMedia} = require('../desktop/media');
const root = path.resolve(__dirname, '..');

test('desktop resource routing keeps media external and blocks private files and encoded traversal', () => {
    const source = path.resolve('source');
    const media = path.resolve('media');
    assert.equal(resolveResource('strangeflesh://game/index.html', source, media), path.join(source, 'index.html'));
    assert.equal(resolveResource('strangeflesh://game/images/alagard.ttf', source, media), path.join(media, 'images/alagard.ttf'));
    assert.equal(resolveResource('strangeflesh://game/sound/a.mp3', source, media), path.join(media, 'sound/a.mp3'));
    for (const url of ['https://game/index.html', 'strangeflesh://other/index.html', 'strangeflesh://game/%2e%2e%2fsecret.txt',
        'strangeflesh://game/images/%5csecret.png', 'strangeflesh://game/desktop/main.js', 'strangeflesh://game/node_modules/a.js',
        'strangeflesh://game/.git/config', 'strangeflesh://game/package.json']) assert.throws(() => resolveResource(url, source, media));
});

test('ZIP paths accept only original media files and reject traversal and Windows paths', () => {
    assert.equal(mediaPath('Strange-Flesh/images/test.png'), 'images/test.png');
    assert.equal(mediaPath('Strange-Flesh/sound/a.mp3'), 'sound/a.mp3');
    assert.equal(mediaPath('Strange-Flesh/README.txt'), null);
    assert.equal(mediaPath('Strange-Flesh/images/'), null);
    for (const name of ['Strange-Flesh/images/../bad', 'Strange-Flesh/images/a:stream', 'C:\\bad', 'Strange-Flesh/images/./a'])
        assert.throws(() => mediaPath(name));
});

test('window bridge validates values rather than accepting arbitrary IPC objects', () => {
    assert.deepEqual(validatedBounds({x: -100, y: 10, width: 1280, height: 720}), {x: -100, y: 10, width: 1280, height: 720});
    for (const bounds of [{width: 1}, {height: Infinity}, {x: NaN}, {x: 999999}, {fullscreen: true}, null, []])
        assert.throws(() => validatedBounds(bounds));
});

test('wrong media ZIP is rejected without modifying an existing cache', async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-import-test-'));
    try {
        const archive = path.join(temporary, 'wrong.zip');
        const destination = path.join(temporary, 'media-v1.4');
        await fs.writeFile(archive, 'wrong');
        await fs.mkdir(destination);
        await fs.writeFile(path.join(destination, 'keep.txt'), 'original');
        await assert.rejects(importMedia(archive, destination), /does not match/);
        assert.equal(await fs.readFile(path.join(destination, 'keep.txt'), 'utf8'), 'original');
        assert.equal(await mediaReady(destination), false);
        assert.equal((await fs.readdir(temporary)).length, 2);
    } finally { await fs.rm(temporary, {recursive: true, force: true}); }
});

const archive = process.env.STRANGE_FLESH_MEDIA_ZIP;
test('original media ZIP imports completely, persists across checks, and detects missing or truncated files', {skip: !archive}, async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-media-test-'));
    try {
        const destination = path.join(temporary, 'media-v1.4');
        assert.equal(await hashFile(archive), MEDIA_SHA256);
        const count = await importMedia(archive, destination);
        assert.ok(count > 800);
        assert.equal(await mediaReady(destination), true);
        const marker = JSON.parse(await fs.readFile(path.join(destination, '.import-complete.json'), 'utf8'));
        assert.equal(marker.files.length, count);
        const file = path.join(destination, marker.files[0].path);
        await fs.writeFile(file, 'truncated');
        assert.equal(await mediaReady(destination), false);
        await importMedia(archive, destination);
        assert.equal(await mediaReady(destination), true);
        assert.deepEqual((await fs.readdir(temporary)), ['media-v1.4']);
    } finally { await fs.rm(temporary, {recursive: true, force: true}); }
});

test('desktop integration uses an isolated preload and release version matches the game label', async () => {
    const main = await fs.readFile(path.join(root, 'desktop/main.js'), 'utf8');
    assert.match(main, /contextIsolation: true/);
    assert.match(main, /nodeIntegration: false/);
    assert.match(main, /sandbox: true/);
    const game = require('../desktop/paths').gameRoot(root);
    const source = await fs.readFile(path.join(game, 'StrangeFlesh.js'), 'utf8');
    assert.doesNotMatch(source, /require\('@electron\/remote'\)/);
    const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
    assert.match(source, new RegExp('var gameVersion = "' + version.replaceAll('.', '\\.') + '"'));
});
