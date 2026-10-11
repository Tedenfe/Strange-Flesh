'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const yauzl = require('yauzl');
const MEDIA_SHA256 = 'b86c73af3f47dda18c0119c028d2767449663b09b362f8557daf9040a348081b';
const MARKER = '.import-complete.json';

async function hashFile(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

function mediaPath(name) {
    if (/[\\:\0]/.test(name) || name.split('/').some(part => part === '..' || part === '.')) throw new Error('Unsafe ZIP entry');
    const match = /^Strange-Flesh\/(images|sound)\/(.+)$/.exec(name);
    if (!match || name.endsWith('/')) return null;
    return match[1] + '/' + match[2];
}

async function mediaReady(destination) {
    try {
        const record = JSON.parse(await fsp.readFile(path.join(destination, MARKER), 'utf8'));
        if (record.sha256 !== MEDIA_SHA256 || !Array.isArray(record.files) || !record.files.length) return false;
        for (const file of record.files) {
            if (mediaPath('Strange-Flesh/' + file.path) !== file.path) return false;
            const stat = await fsp.stat(path.join(destination, file.path));
            if (!stat.isFile() || stat.size !== file.size) return false;
        }
        return true;
    } catch { return false; }
}

function extractMedia(archive, destination, progress = () => {}) {
    return new Promise((resolve, reject) => {
        yauzl.open(archive, {lazyEntries: true, strictFileNames: true, validateEntrySizes: true}, (error, zip) => {
            if (error) return reject(error);
            const files = [];
            let bytes = 0;
            let failed = false;
            const fail = error => { if (!failed) { failed = true; zip.close(); reject(error); } };
            zip.on('error', fail);
            zip.on('end', () => { if (!failed) resolve(files); });
            zip.on('entry', async entry => {
                try {
                    const name = mediaPath(entry.fileName);
                    if (!name) { zip.readEntry(); return; }
                    const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
                    if (mode === 0xa000 || entry.generalPurposeBitFlag & 1) throw new Error('Unsupported ZIP entry');
                    bytes += entry.uncompressedSize;
                    if (bytes > 512 * 1024 * 1024 || files.length >= 5000) throw new Error('Media archive too large');
                    const output = path.join(destination, name);
                    await fsp.mkdir(path.dirname(output), {recursive: true});
                    const input = await new Promise((res, rej) => zip.openReadStream(entry, (err, stream) => err ? rej(err) : res(stream)));
                    await pipeline(input, fs.createWriteStream(output, {flags: 'wx'}));
                    files.push({path: name, size: entry.uncompressedSize});
                    progress(files.length);
                    zip.readEntry();
                } catch (error) { fail(error); }
            });
            zip.readEntry();
        });
    });
}

async function importMedia(archive, destination, progress) {
    if (await hashFile(archive) !== MEDIA_SHA256) throw new Error('Choose the original Strange-Flesh-Media-v1.4.zip. This ZIP does not match it.');
    // Unique staging directory is always a sibling of the intended cache.
    const staging = destination + '.import-' + crypto.randomUUID();
    await fsp.mkdir(staging, {recursive: true});
    try {
        const files = await extractMedia(archive, staging, progress);
        if (!files.some(file => file.path === 'images/alagard.ttf') || !files.some(file => file.path.startsWith('sound/')))
            throw new Error('Incomplete media archive');
        await fsp.writeFile(path.join(staging, MARKER), JSON.stringify({sha256: MEDIA_SHA256, files}));
        // Keep the previous cache until the replacement has been completely validated.
        const previous = destination + '.previous-' + crypto.randomUUID();
        let moved = false;
        try { await fsp.rename(destination, previous); moved = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
        try { await fsp.rename(staging, destination); }
        catch (error) { if (moved) await fsp.rename(previous, destination); throw error; }
        if (moved) await fsp.rm(previous, {recursive: true, force: true});
        return files.length;
    } finally { await fsp.rm(staging, {recursive: true, force: true}); }
}
module.exports = {MEDIA_SHA256, hashFile, mediaPath, mediaReady, importMedia};
