// Strange Flesh adaptations: CC BY-NC-SA 4.0. Controller font assets: CC0.
// Icons are structured text runs; ordinary letters never become button icons.
var ControllerGlyphs = {
    iconScale: 1.5,
    maps: {
        xbox: ['a','b','x','y','[',']','{','}','v','m','<','>','W','X','A','D'],
        playstation: ['x','c','s','t','[',']','{','}','r','q','<','>','W','X','A','D'],
        dualsense: ['x','c','s','t','[',']','{','}','p','o','<','>','W','X','A','D'],
        nintendo: ['b','a','y','x','[',']',null,null,null,null,'<','>','W','X','A','D']
    },
    font: function(family) { return family === 'playstation' ? 'Pixel Controller PlayStation' : 'Pixel Controller Xbox'; },
    loadingFonts: {},
    loadFont: function(font, glyphs) {
        if (this.loadingFonts[font]) return this.loadingFonts[font];
        var pending = this.loadingFonts;
        pending[font] = document.fonts.load('16px "' + font + '"', glyphs)
            .catch(function() { return []; })
            .then(function(faces) { delete pending[font]; return faces; });
        return pending[font];
    },
    loadFonts: function() {
        return Promise.all([
            this.loadFont('Pixel Controller Xbox', 'abxy[]{}<>mvWADX'),
            this.loadFont('Pixel Controller PlayStation', 'xcst[]{}<>rpqoWADX')
        ]);
    },
    ready: function(font, glyph) {
        if (typeof document === 'undefined' || !document.fonts) return false;
        var loaded = false, unloaded = false;
        document.fonts.forEach(function(face) {
            if (face.family.replace(/["']/g, '') !== font) return;
            loaded = loaded || face.status === 'loaded';
            unloaded = unloaded || face.status === 'unloaded';
        });
        // The legacy Alagard loader edits stylesheets during startup. Imported
        // CSS faces can become unloaded again, so request them when first drawn.
        if (unloaded) this.loadFont(font, glyph);
        return loaded && document.fonts.check('16px "' + font + '"', glyph);
    },
    button: function(input, index) {
        var label = input.gamepadButtonName(index);
        var family = input.getGamepadFamily();
        var map = family === 'playstation' && input.getPlayStationModel() === 'dualsense' ? 'dualsense' : family;
        var glyph = (this.maps[map] || [])[index];
        var font = this.font(family);
        if (!Number.isInteger(index) || !glyph || (input.activeGamepad && input.activeGamepad.mapping !== 'standard') || !this.ready(font, glyph))
            return {text: label};
        return {text: glyph, font: font, label: label, scale: this.iconScale};
    },
    binding: function(input, item) {
        var actions = ['up','down','left','right','punch','smoke','grab','special','jump','start'];
        var names = ['Up','Down','Left','Right','Punch','Smoke','Grab','Special','Jump','Start'];
        var action = null;
        for (var i = 0; i < names.length; i++)
            if (item.assignedControllerFunction === input['get' + names[i] + 'ButtonName']) action = actions[i];
        var prefix = {text: '[' + localize(item.assignedKeyboardFunction.call(input)) + '] ' + localize('or') + ' '};
        var monitor = action ? input[action + 'ButtonMonitor'] : null;
        if (!monitor || monitor.buttonType !== 0) return [prefix, {text: item.assignedControllerFunction.call(input)}];
        var button = this.button(input, monitor.index);
        if (!button.font) return [prefix, {text: item.assignedControllerFunction.call(input)}];
        var runs = [prefix, button];
        if (monitor.index >= 12 && monitor.index <= 15 && ['up','down','left','right'].indexOf(action) >= 0)
            runs.push({text: ' / ' + localize('Left Stick')});
        return runs;
    },
    confirm: function(input) {
        if (input.lastInputDevice !== 'gamepad' || !input.activeGamepad) return [{text: input.getConfirmPrompt()}];
        return [this.button(input, 0)];
    },
    skip: function(input) {
        if (input.lastInputDevice !== 'gamepad' || !input.activeGamepad || input.startButtonMonitor.buttonType !== 0)
            return [{text: input.getSkipPrompt()}];
        var prompt = localize('Press {button} to Skip...').split('{button}');
        return [{text: prompt[0]}, this.button(input, input.startButtonMonitor.index), {text: prompt.slice(1).join('{button}')}];
    }
};
if (typeof document !== 'undefined' && document.fonts) {
    // Dynamically included scripts can run before the CSS @import is ready.
    // Loading then resolves with no matching faces and never requests the TTFs.
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', function() { ControllerGlyphs.loadFonts(); }, {once: true});
    else ControllerGlyphs.loadFonts();
}
