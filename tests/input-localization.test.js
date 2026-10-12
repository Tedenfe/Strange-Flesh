const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.existsSync(path.resolve(__dirname, '../game/StrangeFlesh.js')) ? path.resolve(__dirname, '../game') : path.resolve(__dirname, '..');

function harness() {
    const events = {};
    let connected = [];
    const context = vm.createContext({
        console, navigator: {getGamepads: () => connected},
        window: {addEventListener: (type, callback) => { events[type] = callback; }},
        document: {documentElement: {}, addEventListener: (type, callback) => { events[type] = callback; }},
        settings: {language: 'en', gamepadLayout: 'auto', gamepadDeadzone: 0.25,
            upKeyCode: 87, downKeyCode: 83, leftKeyCode: 65, rightKeyCode: 68,
            punchKeyCode: 74, smokeKeyCode: 75, grabKeyCode: 76, specialKeyCode: 186, jumpKeyCode: 32, startKeyCode: 13},
        menuStack: [], saves: 0, saveSettings() { context.saves++; },
        getStringFromKeyCode: code => code === 74 ? 'J' : String(code)
    });
    for (const name of ['locales/pt-BR.js', 'Localization.js', 'locales/catalogs.js', 'Controller.js', 'PlayerInputController.js', 'GamepadSupport.js']) {
        vm.runInContext(fs.readFileSync(path.join(game, name), 'utf8'), context, {filename: name});
    }
    context.controller = vm.runInContext('new PlayerInputController()', context);
    return {context, events, input: context.controller, connect: pads => { connected = pads; }};
}
function pad(id = 'Xbox Wireless Controller', index = 0) {
    return {id, index, mapping: 'standard', connected: true, buttons: Array.from({length: 17}, () => ({pressed: false, value: 0})), axes: [0, 0, 0, 0]};
}

test('all game scripts parse', () => {
    for (const file of fs.readdirSync(game).filter(file => file.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(game, file), 'utf8'), {filename: file});
    for (const file of fs.readdirSync(path.join(game, 'locales')).filter(file => file.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(game, 'locales', file), 'utf8'), {filename: file});
});
test('Portuguese selection, punctuation, fallback, persistence and HTML language', () => {
    const {context: c} = harness();
    c.Localization.setLanguage('pt-BR', true);
    assert.equal(c.localize('Settings'), 'Configurações');
    assert.equal(c.localize('Language:'), 'Idioma:');
    assert.equal(c.localize('New untranslated text'), 'New untranslated text');
    assert.equal(c.settings.language, 'pt-BR');
    assert.equal(c.document.documentElement.lang, 'pt-BR');
    assert.equal(c.saves, 1);
    assert.match(c.Localization.font('alagard'), /^"Alagard Unicode",/);
    c.Localization.setLanguage('en', false);
    assert.equal(c.localize('Settings'), 'Settings');
    assert.match(c.Localization.font('alagard'), /^alagard, "Alagard Unicode",/);
    c.Localization.setLanguage('invalid', false);
    assert.equal(c.Localization.language, 'en');
});
test('cutscene localization preserves typewriter and completed line state', () => {
    const {context: c} = harness();
    c.Localization.setLanguage('pt-BR');
    const scene = {screens: [{lines: [{text: 'Years passed.', i: 13}, {text: 'Joe was happy.', i: 0}]}]};
    c.Localization.localizeCutscene(scene);
    assert.equal(scene.screens[0].lines[0].text, 'Anos se passaram.');
    assert.equal(scene.screens[0].lines[0].i, 17);
    assert.equal(scene.screens[0].lines[1].i, 0);
    c.Localization.setLanguage('en');
    c.Localization.localizeCutscene(scene);
    assert.equal(scene.screens[0].lines[0].text, 'Years passed.');
    assert.equal(scene.screens[0].lines[0].i, 13);
});
test('future locales can register a dictionary and use the multilingual font stack', () => {
    const {context: c} = harness();
    c.Localization.registerLanguage('ja', '日本語', {'Menu': 'メニュー'});
    c.Localization.setLanguage('ja', true);
    assert.equal(c.localize('Menu'), 'メニュー');
    assert.equal(c.document.documentElement.lang, 'ja');
    c.sstext = {canvas: {}};
    c.Localization.setLanguage('ja');
    assert.equal(c.sstext.canvas.lang, 'ja');
    assert.match(c.Localization.font('alagard'), /^"Fusion Bold Pixel JP",/);
    c.Localization.registerLanguage('ja', '日本語', {'Menu': 'メニュー'});
    assert.equal(c.Localization.languages.filter(code => code === 'ja').length, 1);
});
test('controller works at a nonzero slot and releases on disconnect', () => {
    const {input, connect} = harness();
    const p = pad('Xbox', 2);
    connect([null, null, p]);
    p.buttons[2].pressed = true;
    input.update();
    assert.equal(input.punch, true);
    assert.equal(input.activeGamepadIndex, 2);
    connect([]);
    input.update();
    assert.equal(input.punch, false);
    assert.equal(input.any, false);
});
test('D-pad and analog stick work together with deadzone', () => {
    const {input, connect} = harness();
    const p = pad(); connect([p]);
    p.axes[0] = 0.1; input.update(); assert.equal(input.right, false);
    p.axes[0] = 0.8; input.update(); assert.equal(input.right, true);
    p.buttons[15].pressed = true; p.axes[0] = 0; input.update(); assert.equal(input.right, true);
    p.buttons[15].pressed = false; input.update(); assert.equal(input.right, false);
    p.axes[0] = -0.8; p.axes[1] = -0.8; input.update();
    assert.equal(input.left, true); assert.equal(input.up, true);
});
test('keyboard and controller releases cannot cancel each other', () => {
    const {input, connect} = harness(); const p = pad(); connect([p]);
    input.keyDown({keyCode: 68});
    p.axes[0] = 0.8; input.update();
    input.keyUp({keyCode: 68}); assert.equal(input.right, true);
    p.axes[0] = 0; input.update(); assert.equal(input.right, false);
    input.keyDown({keyCode: 68}); p.axes[0] = 0.8; input.update();
    connect([]); input.update(); assert.equal(input.right, true);
    input.keyUp({keyCode: 68}); assert.equal(input.right, false);
});
test('keyboard aliases preserve movement until both keys are released', () => {
    const {input} = harness(); input.keyDown({keyCode: 68}); input.keyDown({keyCode: 39});
    input.keyUp({keyCode: 68}); assert.equal(input.right, true);
    input.keyUp({keyCode: 39}); assert.equal(input.right, false);
});
test('standard family labels match physical positions and menu prompts', () => {
    for (const [id, south, west] of [['Xbox', 'A', 'X'], ['Sony DualSense 054c', '×', '□'], ['Nintendo Switch Pro 057e', 'B', 'Y']]) {
        const {input, connect} = harness(); const p = pad(id); connect([p]);
        p.buttons[2].pressed = true; input.update();
        assert.equal(input.gamepadButtonName(0), south);
        assert.equal(input.getPunchButtonName(), west);
        assert.equal(input.getConfirmPrompt(), south);
    }
});
test('south confirms menus, east cancels, south jumps in gameplay', () => {
    const {input, connect, context: c} = harness(); const p = pad(); connect([p]);
    p.buttons[0].pressed = true; input.update(); assert.equal(input.jump, true); assert.equal(input.punch, false);
    c.menuStack.push({}); input.update(); assert.equal(input.punch, true);
    p.buttons[1].pressed = true; input.update(); assert.equal(input.smoke, true);
});
test('binding ignores already-held buttons, saves a new button, and waits for release', () => {
    const {input, connect, context: c} = harness(); const p = pad(); connect([p]);
    p.buttons[0].pressed = true; input.update(); input.bindPunchKey(); input.update();
    assert.equal(input.bindingKey, true);
    p.buttons[0].pressed = false; input.update(); p.buttons[5].pressed = true; input.update();
    assert.equal(input.bindingKey, false); assert.equal(input.punchButtonMonitor.index, 5);
    assert.equal(c.saves, 1); assert.equal(input.punch, false);
    p.buttons[5].pressed = false; input.update(); p.buttons[5].pressed = true; input.update(); assert.equal(input.punch, true);
});
test('axis remapping and Escape binding cancellation', () => {
    const {input, connect} = harness(); const p = pad(); connect([p]);
    input.bindSpecialKey(); input.update(); p.axes[2] = -0.9; input.update();
    assert.equal(input.specialButtonMonitor.index, 2); assert.equal(input.specialButtonMonitor.buttonType, 2);
    input.bindGrabKey(); const monitor = input.buttonToBind; input.keyDown({keyCode: 27});
    assert.equal(input.bindingKey, false); assert.equal(monitor.bindMode, false); assert.equal(input.buttonToBind, null);
});
test('focus loss clears inputs and requires neutral pad before resuming', () => {
    const {input, connect, events} = harness(); const p = pad(); connect([p]);
    p.buttons[2].pressed = true; input.keyDown({keyCode: 68}); input.update();
    events.blur(); assert.equal(input.punch, false); assert.equal(input.right, false);
    input.update(); assert.equal(input.punch, false);
    p.buttons[2].pressed = false; input.update(); p.buttons[2].pressed = true; input.update(); assert.equal(input.punch, true);
});
test('short/raw controllers, denied API access, and invalid saved bindings are safe', () => {
    const {input, connect, context: c} = harness(); connect([{id: 'Generic', mapping: '', buttons: [], axes: []}]);
    input.update(); assert.equal(input.punch, false);
    assert.equal(input.getPunchButtonName(), 'Button 2');
    input.punchButtonMonitor.SetConfig(null); assert.equal(input.punchButtonMonitor.index, 2);
    c.navigator.getGamepads = () => { throw new Error('Permissions Policy'); };
    input.update(); assert.equal(input.activeGamepad, null);
});
test('a controller can consume one-shot callbacks once', () => {
    const {input, connect} = harness(); const p = pad(); connect([p]); let calls = 0;
    input.oneShotCallback = () => calls++;
    p.buttons[9].pressed = true; input.update(); input.update();
    assert.equal(calls, 1); assert.equal(input.oneShotCallback, null); assert.equal(input.start, false);
});
test('story captions and all menu labels have catalog coverage', () => {
    const {context: c} = harness(); const source = fs.readFileSync(path.join(game, 'Cutscene.js'), 'utf8');
    const properNames = new Set(['Aaron "HumDog" Scott', 'Majkol "Zaru" Robuschi', 'Donkey Punch', 'The Punk Puppy', 'Satan, Lord of Darkness', 'Fann', 'bearpad', 'Captaingerbear', 'Bellua']);
    ['Pixel Art Controller Fonts','Spriteshift / azagaya','CC0 1.0','spriteshift.itch.io/pixelartcontrollerfonts'].forEach(value => properNames.add(value));
    const captions = [...source.matchAll(/(?:"text"|\btext)\s*:\s*("(?:[^"\\]|\\.)*")/g)].map(match => JSON.parse(match[1]));
    for (const match of source.matchAll(/\.AddSingleLineScreens\([\s\S]*?\);/g)) {
        for (const literal of match[0].matchAll(/"(?:[^"\\]|\\.)*"/g)) {
            const value = JSON.parse(literal[0]); if (value.includes(' ') && !value.startsWith('images/')) captions.push(value);
        }
    }
    const menus = fs.readFileSync(path.join(game, 'SettingsMenu.js'), 'utf8') + fs.readFileSync(path.join(game, 'MainMenu.js'), 'utf8');
    const labels = [...menus.matchAll(/"label"\s*:\s*("(?:[^"\\]|\\.)*")/g)].map(match => JSON.parse(match[1]));
    const missing = [...new Set(captions.concat(labels))].filter(value => /[A-Za-z]/.test(value) && !properNames.has(value) && !Object.hasOwn(c.PortugueseBrazil, value));
    assert.deepEqual(missing, []);
});
