const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const game = fs.existsSync(path.join(root, 'game/StrangeFlesh.js')) ? path.join(root, 'game') : root;

function harness(family = 'xbox', fontSetup = {}) {
    const painted = [];
    const events = {};
    const context = {save() {}, restore() {}, setTransform() {}, clearRect() {},
        measureText(text) {
            const size = parseFloat(this.font);
            const icon = /Pixel Controller/.test(this.font);
            return {width: text.length * size,
                actualBoundingBoxAscent: this.textBaseline === 'middle' ? size / 2 : icon ? size / 2 : size * 0.75,
                actualBoundingBoxDescent: this.textBaseline === 'middle' ? size / 2 : icon ? size / 6 : 0};
        },
        fillText(text, x, y) { painted.push({text, x, y, font: this.font, color: this.fillStyle}); }};
    const c = vm.createContext({
        navigator: {getGamepads() { return []; }}, window: {addEventListener() {}},
        document: {documentElement: {}, readyState: fontSetup.readyState || 'complete',
            addEventListener(type, callback) { events[type] = callback; }, createElement() { return {getContext() { return context; }}; },
            fonts: fontSetup.fonts || {check() { return true; }, load() { return Promise.resolve([]); },
                forEach(callback) { for (const family of ['Pixel Controller Xbox','Pixel Controller PlayStation']) callback({family,status:'loaded'}); }}},
        settings: {gamepadLayout: family, punchKeyCode: 74}, saveSettings() {},
        GlobalResourceLoader: {AddAudioResource() {}}, menuStack: []
    });
    for (const file of ['locales/pt-BR.js','Localization.js','locales/catalogs.js','MathUtility.js','Controller.js','PlayerInputController.js','GamepadSupport.js','SupersampledTextRenderer.js','ControllerGlyphs.js'])
        vm.runInContext(fs.readFileSync(path.join(game,file),'utf8'),c);
    const input = new c.PlayerInputController();
    input.activeGamepad = {id: family, mapping: 'standard'};
    input.lastInputDevice = 'gamepad';
    return {c, input, painted, events};
}

test('controller fonts wait for imported CSS before requesting faces during game startup', async () => {
    let cssReady = false;
    const loaded = new Set();
    const requests = [];
    const fonts = {
        check(font) { return loaded.has(font); },
        forEach(callback) {
            if (cssReady) for (const family of ['Pixel Controller Xbox','Pixel Controller PlayStation'])
                callback({family,status:loaded.has('16px "' + family + '"') ? 'loaded' : 'unloaded'});
        },
        load(font) {
            requests.push(font);
            if (!cssReady) return Promise.resolve([]);
            loaded.add(font);
            return Promise.resolve([{status: 'loaded'}]);
        }
    };
    const {c, input, events} = harness('xbox', {readyState: 'loading', fonts});
    assert.equal(requests.length, 0, 'Do not request fonts before the stylesheet defines them');
    assert.equal(c.ControllerGlyphs.button(input, 0).font, undefined);
    cssReady = true;
    events.DOMContentLoaded();
    await c.ControllerGlyphs.loadFonts();
    assert.equal(requests.length, 2);
    assert.equal(c.ControllerGlyphs.button(input, 0).font, 'Pixel Controller Xbox');
    c.settings.gamepadLayout = 'playstation';
    assert.equal(c.ControllerGlyphs.button(input, 0).font, 'Pixel Controller PlayStation');
});

test('controller fonts also load when the module is included after DOM readiness', async () => {
    const requests = [];
    const fonts = {check() { return false; }, forEach(callback) { callback({family:'Pixel Controller Xbox',status:'error'}); },
        load(font) { requests.push(font); return Promise.reject(new Error('Font unavailable')); }};
    const {c, input} = harness('xbox', {readyState: 'interactive', fonts});
    await c.ControllerGlyphs.loadFonts();
    await c.ControllerGlyphs.loadFonts();
    assert.equal(requests.length, 4, 'Both faces requested automatically and on explicit retry');
    assert.equal(c.ControllerGlyphs.button(input, 0).text, 'A');
    assert.equal(c.ControllerGlyphs.button(input, 0).font, undefined);
});

test('drawing reloads a CSS face invalidated by legacy font stylesheet changes without duplicate requests', async () => {
    let state = 'loaded', finishLoad, requests = 0;
    const fonts = {
        forEach(callback) { callback({family:'Pixel Controller Xbox',status:state}); },
        check() { return state === 'loaded'; },
        load() { requests++; return new Promise(resolve => { finishLoad = () => { state = 'loaded'; resolve([{}]); }; }); }
    };
    const {c, input} = harness('xbox', {readyState:'loading', fonts});
    assert.equal(c.ControllerGlyphs.button(input, 0).font, 'Pixel Controller Xbox');
    state = 'unloaded';
    assert.equal(c.ControllerGlyphs.button(input, 0).text, 'A');
    assert.equal(c.ControllerGlyphs.button(input, 2).text, 'X');
    assert.equal(requests, 1);
    const pending = c.ControllerGlyphs.loadingFonts['Pixel Controller Xbox'];
    finishLoad(); await pending;
    assert.equal(c.ControllerGlyphs.button(input, 0).font, 'Pixel Controller Xbox');
    assert.equal(c.ControllerGlyphs.button(input, 2).text, 'x');
    fonts.forEach = () => {};
    fonts.check = () => true; // Browser check succeeds for an undefined family using system fallback.
    assert.equal(c.ControllerGlyphs.button(input, 0).font, undefined);
});

test('Xbox, PS4 and DualSense buttons map to the inspected font glyphs without changing human-readable names', () => {
    for (const [family, expected] of [['xbox','abxy[]{}vm<>WXAD'], ['playstation','xcst[]{}rq<>WXAD'], ['dualsense','xcst[]{}po<>WXAD']]) {
        const {c,input} = harness(family);
        for (let index = 0; index < expected.length; index++) {
            const name = input.gamepadButtonName(index);
            const run = c.ControllerGlyphs.button(input,index);
            assert.equal(run.text,expected[index]);
            assert.equal(run.label,name);
            assert.equal(input.gamepadButtonName(index),name);
            assert.match(run.font, family === 'xbox' ? /Xbox/ : /PlayStation/);
        }
    }
});

test('Nintendo face buttons respect Nintendo letters; triggers and plus/minus keep readable text', () => {
    const {c,input} = harness('nintendo');
    for (const [index,glyph] of [[0,'b'],[1,'a'],[2,'y'],[3,'x']]) assert.equal(c.ControllerGlyphs.button(input,index).text,glyph);
    for (const [index,label] of [[6,'ZL'],[7,'ZR'],[8,'−'],[9,'+']]) {
        const run = c.ControllerGlyphs.button(input,index);
        assert.equal(run.text,label); assert.equal(run.font,undefined);
    }
});

test('raw devices, unknown buttons, and fonts that have not loaded stay readable', () => {
    const {c,input} = harness();
    input.activeGamepad.mapping = '';
    for (const index of [0,12,42]) {
        assert.equal(c.ControllerGlyphs.button(input,index).text,'Button ' + index);
        assert.equal(c.ControllerGlyphs.button(input,index).font,undefined);
    }
    input.activeGamepad.mapping = 'standard';
    assert.equal(c.ControllerGlyphs.button(input,42).font,undefined);
    c.document.fonts.check = () => false;
    assert.equal(c.ControllerGlyphs.button(input,0).text,'A');
    assert.equal(c.ControllerGlyphs.button(input,0).font,undefined);
});

test('localized binding rows combine ordinary keyboard text with icon runs and preserve axis binds', () => {
    const {c,input} = harness('playstation');
    c.Localization.setLanguage('pt-BR');
    const item = {assignedKeyboardFunction() { return 'J'; },assignedControllerFunction:input.getPunchButtonName};
    let runs = c.ControllerGlyphs.binding(input,item);
    assert.equal(runs[0].text,'[J] ou '); assert.equal(runs[0].font,undefined);
    assert.equal(runs[1].text,'s');
    input.punchButtonMonitor.SetConfig([0,1,2]);
    runs = c.ControllerGlyphs.binding(input,item);
    assert.equal(runs[1].text,'−Eixo 1'); assert.equal(runs[1].font,undefined);
});

test('Square never uses Share; automatic PS4/DualSense detection and manual overrides choose the matching symbols', () => {
    const {c,input} = harness('auto');
    for (const [id,model,share,options,label] of [
        ['DualShock 4','dualshock','r','q','Share'],
        ['Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)','dualshock','r','q','Share'],
        ['DualSense Wireless Controller','dualsense','p','o','Create'],
        ['Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)','dualsense','p','o','Create'],
        ['054c-0df2-Wireless Controller','dualsense','p','o','Create']
    ]) {
        input.activeGamepad.id = id;
        assert.equal(input.getGamepadFamily(),'playstation');
        assert.equal(input.getPlayStationModel(),model);
        assert.equal(c.ControllerGlyphs.button(input,2).text,'s');
        assert.equal(c.ControllerGlyphs.button(input,2).label,'□');
        assert.equal(c.ControllerGlyphs.button(input,8).text,share);
        assert.equal(c.ControllerGlyphs.button(input,8).label,label);
        assert.equal(c.ControllerGlyphs.button(input,9).text,options);
        assert.notEqual(c.ControllerGlyphs.button(input,2).text,share);
        input.startButtonMonitor.SetConfig([0,8,0]);
        assert.equal(c.ControllerGlyphs.skip(input)[1].text,share);
    }
    c.settings.gamepadLayout = 'playstation';
    assert.equal(c.ControllerGlyphs.button(input,8).text,'r', 'Existing PlayStation preference selects PS4');
    assert.equal(c.ControllerGlyphs.button(input,9).text,'q');
    input.activeGamepad.id = 'DualShock 4';
    c.settings.gamepadLayout = 'dualsense';
    assert.equal(c.ControllerGlyphs.button(input,8).text,'p');
    assert.equal(c.ControllerGlyphs.button(input,9).text,'o');
});

test('Controls offers PS4 and DualSense layouts and preserves existing saved family choices', () => {
    const {c,input} = harness();
    const menus = [];
    c.controller = input;
    c.GlobalResourceLoader.GetSound = () => ({Play() {}});
    vm.runInContext(fs.readFileSync(path.join(game,'SettingsMenu.js'),'utf8'),c);
    c.SettingsMenu.prototype.Show = function() { menus.push(this); };
    for (const [layout,index] of [['playstation',2],['dualsense',3],['nintendo',4]]) {
        c.settings.gamepadLayout = layout;
        c.ShowControlsMenu();
        const item = menus.at(-1).items[0];
        assert.equal(item.selected,index);
        assert.equal(item.options[2],'PlayStation 4');
        assert.equal(item.options[3],'DualSense');
        item.selected = 3; item.onChange();
        assert.equal(c.settings.gamepadLayout,'dualsense');
    }
});

test('cutscene icons follow device and remapped skip button, including readable analog skip controls', () => {
    const {c,input} = harness();
    assert.equal(c.ControllerGlyphs.confirm(input)[0].text,'a');
    input.startButtonMonitor.SetConfig([0,1,0]);
    let runs = c.ControllerGlyphs.skip(input);
    assert.equal(runs[1].text,'b'); assert.match(input.getSkipPrompt(), /Press B to Skip/);
    input.startButtonMonitor.SetConfig([0,0,1]);
    runs = c.ControllerGlyphs.skip(input);
    assert.equal(runs[0].font,undefined); assert.match(runs[0].text,/\+Axis 0/);
    input.lastInputDevice = 'keyboard';
    assert.equal(c.ControllerGlyphs.confirm(input)[0].text,'J');
    assert.equal(c.ControllerGlyphs.confirm(input)[0].font,undefined);
    assert.match(c.ControllerGlyphs.skip(input)[0].text,/Enter/);
});

test('fullscreen and other notification dialogs use controller icons with keyboard/raw-device fallbacks and unchanged dismissal', () => {
    for (const [family,glyph] of [['xbox','a'],['playstation','x'],['dualsense','x'],['nintendo','b']]) {
        const {c,input,painted} = harness(family);
        c.controller = input;
        c.c = {height:360};
        c.ctx = {save() {},restore() {},setTransform() {},fillRect() {}};
        c.GlobalResourceLoader.AddImageResource = () => {};
        c.GlobalResourceLoader.GetSprite = () => ({DrawSprite() {}});
        vm.runInContext(fs.readFileSync(path.join(game,'ModalMessage.js'),'utf8'),c);
        for (const message of ['Press Any Key to Go Fullscreen','Cutscene gallery unlocked!','Debug mode unlocked!','Cannot save. You must be idle to save.']) {
            painted.length = 0;
            new c.ModalMessage(message).Draw();
            assert.equal(painted[0].text,message);
            assert.equal(painted.at(-1).text,glyph);
            assert.match(painted.at(-1).font,/^72px "Pixel Controller /);
        }
        const modal = new c.ModalMessage('Press Any Key to Go Fullscreen');
        input.lastInputDevice = 'keyboard';
        painted.length = 0; modal.Draw();
        assert.equal(painted.at(-1).text,'J');
        assert.doesNotMatch(painted.at(-1).font,/Pixel Controller/);
        input.lastInputDevice = 'gamepad'; input.activeGamepad.mapping = '';
        painted.length = 0; modal.Draw();
        assert.equal(painted.at(-1).text,'Button 0');
        assert.doesNotMatch(painted.at(-1).font,/Pixel Controller/);
        modal.autoDismiss = true;
        painted.length = 0; modal.Draw();
        assert.equal(painted.length,1,'Automatic notices have no dismissal prompt');
        let closed = 0;
        modal.onClose = () => { closed++; };
        c.menuStack = [modal]; input.anyKeyDown(); modal.Update();
        assert.equal(closed,1); assert.equal(c.menuStack.length,0);
    }
});

test('mixed renderer sizes and centers larger icons, preserves alignment, and leaves normal text in Alagard', () => {
    const {c,input,painted} = harness();
    const renderer = c.sstext;
    renderer.fontSize = 12; renderer.textAlign = 'right';
    const runs = [{text:'[J] or '},c.ControllerGlyphs.button(input,0)];
    const width = renderer.MeasureRuns(runs).width;
    renderer.DrawRuns(runs,100,50);
    assert.equal(painted[0].x,(100-width)*3);
    assert.match(painted[0].font,/alagard/);
    assert.match(painted[1].font,/Pixel Controller Xbox/);
    assert.match(painted[0].font,/^36px /);
    assert.match(painted[1].font,/^54px /);
    assert.equal(width, '[J] or '.length * 12 + 18);
    assert.equal(painted[0].y,150);
    assert.equal(painted[0].y - 36 * 0.75 / 2, painted[1].y + (54 / 6 - 54 / 2) / 2);
    renderer.DrawText('A normal sentence',20,30);
    assert.match(painted[2].font,/alagard/);
    assert.doesNotMatch(painted[2].font,/Pixel Controller/);
    renderer.DrawRunsWithShadow([c.ControllerGlyphs.button(input,0)],50,20);
    assert.equal(painted.at(-2).color,'#000'); assert.equal(painted.at(-1).color,'#FFF');
    renderer.textBaseline = 'middle';
    renderer.DrawRuns([c.ControllerGlyphs.button(input,0)],50,20);
    assert.equal(painted.at(-1).y,60);
});
