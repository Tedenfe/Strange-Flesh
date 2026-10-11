'use strict';
const path = require('node:path');

function gameRoot(root) {
    return require('node:fs').existsSync(path.join(root, 'game', 'StrangeFlesh.js')) ? path.join(root, 'game') : root;
}

function resolveResource(url, source, media, desktop = path.resolve(__dirname)) {
    const target = new URL(url);
    if (target.protocol !== 'strangeflesh:' || target.host !== 'game') throw new Error('Invalid origin');
    const relative = decodeURIComponent(target.pathname).replace(/^\//, '') || 'index.html';
    if (/[\\:\0]/.test(relative) || relative.split('/').some(part => part === '..' || part === '.'))
        throw new Error('Invalid resource path');
    // Only public game resources and the first-launch page are served.
    const first = relative.split('/')[0];
    if (first === 'desktop' && !['desktop/setup.html', 'desktop/setup.css', 'desktop/setup.js'].includes(relative))
        throw new Error('Private desktop resource');
    if (!['images', 'sound', 'levels', 'locales', 'fonts', 'desktop'].includes(first) && relative.includes('/'))
        throw new Error('Private resource');
    if (!relative.includes('/') && !/\.(js|html|css|txt)$/.test(relative)) throw new Error('Private resource');
    const root = first === 'desktop' ? desktop : ['images', 'sound'].includes(first) ? media : source;
    const file = path.resolve(root, first === 'desktop' ? relative.slice(8) : relative);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Outside resource root');
    return file;
}

function validatedBounds(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid bounds');
    const bounds = {};
    for (const [key, number] of Object.entries(value)) {
        if (!['x', 'y', 'width', 'height'].includes(key) || !Number.isFinite(number)) throw new Error('Invalid bounds');
        if (['width', 'height'].includes(key) && (number < 360 || number > 8192)) throw new Error('Invalid size');
        if (Math.abs(number) > 32768) throw new Error('Invalid position');
        bounds[key] = Math.round(number);
    }
    return bounds;
}
module.exports = {gameRoot, resolveResource, validatedBounds};
