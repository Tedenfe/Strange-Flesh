const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.existsSync(path.resolve(__dirname, '../game/StrangeFlesh.js')) ? path.resolve(__dirname, '../game') : path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(game, name), 'utf8');

function settingsHarness(music = 0.5, sfx = 1) {
    const c = vm.createContext({
        settings: {musicLevelGameplay: music, baseSFXBoost: sfx, fullscreenMode: false, renderMode: 0, scalingQuality: 0},
        menuStack: [], window: {addEventListener() {}},
        document: {documentElement: {}}, normalizeAngle: value => value,
        saves: 0, saveSettings() { c.saves++; },
        GlobalResourceLoader: {AddAudioResource() {}, GetSound() { return {Play() {}}; }, SetSFXVolume(value) { c.sfxVolume = value; }},
        GlobalMusic: {setVolume(value) { c.musicVolume = value; }}
    });
    for (const file of ['locales/pt-BR.js', 'Localization.js', 'locales/catalogs.js', 'Controller.js', 'SettingsMenu.js']) vm.runInContext(source(file), c);
    c.controller = new c.Controller();
    c.SettingsMenu.prototype.Show = function() { this.timer = 60; c.menuStack.push(this); };
    c.ShowSettingsMenu(false);
    return {c, menu: c.menuStack[0], music: c.menuStack[0].items[1], sfx: c.menuStack[0].items[2]};
}

test('existing Full, Half and Mute volumes open as 10, 5 and 0 with the language selector still in Settings', () => {
    for (const [volume, expected] of [[1, 10], [0.5, 5], [0, 0]]) {
        const {c, menu, music, sfx} = settingsHarness(volume, volume);
        assert.equal(menu.items[0].label, 'Language');
        assert.equal(music.element, 'slider');
        assert.equal(music.value, expected);
        assert.equal(sfx.value, expected);
        assert.equal(c.saves, 0);
    }
});

test('volume sliders clamp at both ends, mute at zero, update audio and save immediately', () => {
    const {c, menu, music, sfx} = settingsHarness();
    assert.equal(menu.SetSliderValue(1, -20), true);
    assert.equal(music.value, 0);
    assert.equal(c.musicVolume, 0);
    assert.equal(c.settings.musicLevelGameplay, 0);
    assert.equal(menu.SetSliderValue(1, -1), false);
    assert.equal(c.saves, 1);
    menu.SetSliderValue(1, 50);
    assert.equal(music.value, 10);
    assert.equal(c.musicVolume, 1);
    menu.SetSliderValue(2, 6.2);
    assert.equal(sfx.value, 6);
    assert.equal(c.sfxVolume, 0.6);
    menu.SetSliderValue(2, 0);
    assert.equal(c.sfxVolume, 0);
    assert.equal(c.settings.baseSFXBoost, 0);
    assert.equal(menu.SetSliderValue(2, NaN), false);
    assert.equal(menu.SetSliderValue(0, 2), false);
    assert.equal(c.saves, 4);
});

test('keyboard/controller directional states adjust and repeat sliders without wrapping from mute to maximum', () => {
    const {c, menu, music} = settingsHarness();
    menu.selectedItem = 1;
    c.controller.leftKeyDown();
    menu.Update();
    assert.equal(music.value, 4);
    for (let frame = 0; frame < 45; frame++) { c.controller.update(); menu.Update(); }
    assert.equal(music.value, 0);
    c.controller.leftKeyUp();
    c.controller.rightKeyDown();
    menu.Update();
    assert.equal(music.value, 1);
});

test('mouse/touch pointer dragging uses the displayed canvas scale and clamps outside the slider track', () => {
    const {c, menu, music} = settingsHarness();
    const handlers = {};
    let capture = false;
    const canvas = {
        addEventListener: (type, callback) => { handlers[type] = callback; },
        getBoundingClientRect: () => ({left: 100, top: 60, width: 1280, height: 720}),
        focus() {}, setPointerCapture() { capture = true; }, hasPointerCapture() { return capture; }, releasePointerCapture() { capture = false; }
    };
    menu.sliderRegions = [{index: 1, x: 333, y: 158, width: 128}];
    c.enableSettingsSliderInput(canvas);
    const event = x => ({button: 0, pointerId: 1, clientX: 100 + x * 2, clientY: 60 + 158 * 2, preventDefault() {}});
    handlers.pointerdown(event(333));
    assert.equal(menu.selectedItem, 1);
    assert.equal(music.value, 0);
    assert.equal(capture, true);
    handlers.pointermove(event(397));
    assert.equal(music.value, 5);
    handlers.pointermove(event(700));
    assert.equal(music.value, 10);
    handlers.pointerup(event(700));
    assert.equal(capture, false);
    handlers.pointermove(event(333));
    assert.equal(music.value, 10);
});

function audioHarness() {
    const nodes = [];
    const audioContext = {currentTime: 100, destination: {},
        createGain() {
            const calls = [];
            const gain = {value: 1,
                setValueAtTime(value, time) { this.value = value; calls.push(['set', value, time]); },
                exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); calls.push(['ramp', value, time]); },
                cancelScheduledValues(time) { calls.push(['cancel', time]); }
            };
            const node = {gain, calls, connect(destination) { this.output = destination; }};
            nodes.push(node);
            return node;
        },
        createBufferSource() { return {connect(destination) { this.output = destination; }, start() {}, stop() {}}; }
    };
    const c = vm.createContext({settings: {baseSFXBoost: 0.2}, navigator: {userAgent: '', maxTouchPoints: 0},
        XMLHttpRequest: function() {}, window: {AudioContext: function() { return audioContext; }},
        document: {getElementById: () => ({addEventListener() {}}), addEventListener() {}}, audioContext
    });
    return {c, audioContext, nodes};
}

test('SFX volume has one shared gain so zero also mutes effects already playing', () => {
    const {c, audioContext} = audioHarness();
    vm.runInContext(source('ResourceLoader.js'), c);
    const sound = new c.AudioResource('effect', 'effect.mp3');
    sound.buffer = {};
    c.GlobalResourceLoader.SetSFXVolume(0.2);
    const playing = sound.Play(0.8);
    assert.equal(playing.output, sound.destination);
    assert.equal(sound.destination.output, c.GlobalResourceLoader.sfxGain);
    assert.equal(sound.destination.gain.value, 0.8);
    assert.equal(c.GlobalResourceLoader.sfxGain.gain.value, 0.2);
    c.GlobalResourceLoader.SetSFXVolume(0);
    assert.equal(c.GlobalResourceLoader.sfxGain.gain.value, 0);
    assert.equal(c.GlobalResourceLoader.sfxGain.output, audioContext.destination);
    c.GlobalResourceLoader.SetSFXVolume(1);
    assert.equal(c.GlobalResourceLoader.sfxGain.gain.value, 1);
});

test('music mute cancels pending fades and can start/stop a fading track without a zero exponential ramp', () => {
    const {c} = audioHarness();
    vm.runInContext(source('Music.js'), c);
    const music = new c.Music();
    music.tracks.title = {};
    music.selectedTrack = 'title';
    music.Update = function() { this.lastQueuedTrack = {source: {stop() {}}}; };
    music.setVolume(0.5);
    music.play(0, 1);
    const firstOutput = music.destination;
    music.setVolume(0);
    assert.deepEqual(firstOutput.calls.slice(-2), [['cancel', 100], ['set', 0, 100]]);
    music.stop(1);
    assert.equal(firstOutput.calls.filter(call => call[0] === 'ramp').length, 1);
    music.play(0, 1);
    assert.equal(music.destination.gain.value, 0);
    assert.equal(music.destination.calls.filter(call => call[0] === 'ramp').length, 0);
    music.setVolume(0.7);
    assert.equal(music.destination.gain.value, 0.7);
});

function autoplayHarness() {
    const result = audioHarness();
    const handlers = new Map();
    const canvas = {addEventListener: (type, callback) => handlers.set(type, callback), removeEventListener: type => handlers.delete(type)};
    result.c.document = {getElementById: () => canvas, addEventListener: (type, callback) => handlers.set(type, callback), removeEventListener: type => handlers.delete(type)};
    result.audioContext.state = 'suspended';
    return {...result, handlers};
}

test('permitted autoplay resumes audio at startup and removes gesture listeners', async () => {
    const {c, audioContext, handlers} = autoplayHarness();
    let resumes = 0;
    audioContext.resume = () => { resumes++; audioContext.state = 'running'; return Promise.resolve(); };
    vm.runInContext(source('ResourceLoader.js'), c);
    await Promise.resolve();
    assert.equal(resumes, 1);
    assert.equal(c.GlobalResourceLoader.webAudioLocked, false);
    assert.equal(handlers.size, 0);
});

test('blocked autoplay keeps gesture listeners until a successful key/click resume', async () => {
    const {c, audioContext, handlers} = autoplayHarness();
    let allowed = false;
    audioContext.resume = () => {
        if (!allowed) return Promise.reject(new Error('Autoplay blocked'));
        audioContext.state = 'running';
        return Promise.resolve();
    };
    vm.runInContext(source('ResourceLoader.js'), c);
    await Promise.resolve();
    assert.equal(c.GlobalResourceLoader.webAudioLocked, true);
    assert.ok(handlers.has('keydown'));
    assert.ok(handlers.has('click'));
    allowed = true;
    handlers.get('keydown')();
    await Promise.resolve();
    assert.equal(c.GlobalResourceLoader.webAudioLocked, false);
    assert.equal(handlers.size, 0);
});

function titleHarness() {
    const text = [];
    const c = vm.createContext({
        include() {}, c: {height: 360}, blitInternalBuffer() {},
        ctx: {save() {}, restore() {}, setTransform() {}, fillRect() {}},
        sstext: {DrawText(...args) { text.push(args); }},
        GlobalResourceLoader: {webAudioLocked: true, AddImageResource() {}, AddAudioResource() {}, AddSequentialImageResources() {}}
    });
    vm.runInContext(source('MathUtility.js'), c);
    vm.runInContext(source('MainMenu.js'), c);
    const sprite = {Draw() {}};
    const menu = {menuMode: false, menuTimer: 0, timer: 60, pulse: 0, oneshotPulse: 0, pulsedOnce: false,
        image: sprite, logo: sprite, image_pulse: sprite, logo_pulse: sprite,
        spriteAnim: {GetFrame: () => null}, backgroundSmoke: {children: []}, items: []
    };
    return {c, text, menu};
}

test('title prompt is visible before the first music beat, including when music is muted or autoplay is blocked', () => {
    const {c, text, menu} = titleHarness();
    c.MainMenu.prototype.Draw.call(menu);
    const prompt = text.find(args => args[0] === 'Press Any Key');
    assert.ok(prompt);
    assert.deepEqual(prompt, ['Press Any Key', 566, 316, 20, '#FFF', 0.6, 'right']);
    assert.equal(text.filter(args => args[0].startsWith('Press ')).length, 1);
    text.length = 0;
    c.GlobalResourceLoader.webAudioLocked = false;
    c.MainMenu.prototype.Draw.call(menu);
    assert.ok(text.some(args => args[0] === 'Press Any Key'));
    assert.equal(text.filter(args => args[0].startsWith('Press ')).length, 1);
    text.length = 0;
    menu.pulsedOnce = true;
    menu.oneshotPulse = 20;
    c.MainMenu.prototype.Draw.call(menu);
    assert.deepEqual(text.find(args => args[0] === 'Press Any Key'), ['Press Any Key', 566, 316, 20, '#FFF', 1, 'right']);
});
