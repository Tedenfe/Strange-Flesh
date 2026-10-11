// Strange Flesh © 2017 Greatest Bear Studios. Modifications © 2026.
// Licensed under CC BY-NC-SA 4.0. See License.txt.
// Uses the browser's standard Gamepad mapping for Xbox, PlayStation, Nintendo
// Switch Pro, and compatible controllers. Raw devices can be remapped in Controls.
(function() {
    var actions = ["up", "down", "left", "right", "punch", "smoke", "grab", "special", "jump", "start"];
    var permanentKeys = {up: 38, down: 40, left: 37, right: 39, start: 13};
    var originalKeyDown = PlayerInputController.prototype.keyDown;

    function pressed(button) {
        return typeof button === "number" ? button > 0.5 : !!(button && (button.pressed || button.value > 0.5));
    }
    function pads() {
        try { return navigator.getGamepads ? navigator.getGamepads() : []; }
        catch (error) { return []; }
    }
    function read(pad, index, type, threshold) {
        if (!pad || pad.connected === false) return false;
        if (type === 0) return pressed((pad.buttons || [])[index]);
        var value = (pad.axes || [])[index] || 0;
        return value * (type === 1 ? 1 : -1) > threshold;
    }

    PlayerInputController.prototype.setInputSource = function(action, source, down) {
        if (!this.inputSources) this.inputSources = {};
        var sources = this.inputSources[action] || (this.inputSources[action] = {});
        sources[source] = !!down;
        var held = Object.keys(sources).some(function(key) { return sources[key]; });
        if (held !== this[action]) Controller.prototype[action + (held ? "KeyDown" : "KeyUp")].call(this);
    };

    // Touch/click input uses these entry points. It must not release a held pad/key.
    actions.concat(["any"]).forEach(function(action) {
        PlayerInputController.prototype[action + "KeyDown"] = function() { this.setInputSource(action, "external", true); };
        PlayerInputController.prototype[action + "KeyUp"] = function() { this.setInputSource(action, "external", false); };
    });

    PlayerInputController.prototype.refreshKeyboard = function() {
        var keys = this.heldKeys || {};
        var self = this;
        actions.forEach(function(action) {
            var down = !!keys[settings[action + "KeyCode"]] ||
                !!(self.usePermBindings && permanentKeys[action] && keys[permanentKeys[action]]);
            self.setInputSource(action, "keyboard", down);
        });
        this.setInputSource("any", "keyboard", Object.keys(keys).some(function(key) { return keys[key]; }));
    };

    PlayerInputController.prototype.cancelBinding = function() {
        if (this.buttonToBind) this.buttonToBind.bindMode = false;
        this.bindingKey = false;
        this.keyToBind = -1;
        this.buttonToBind = null;
        this.bindingBlocked = null;
        this.waitForGamepadRelease = true;
    };

    PlayerInputController.prototype.keyDown = function(evt) {
        this.lastInputDevice = "keyboard";
        if (this.oneShotCallback) {
            var callback = this.oneShotCallback;
            this.oneShotCallback = null;
            callback(evt);
            return;
        }
        if (this.bindingKey) {
            if (evt.keyCode === 27) this.cancelBinding();
            else {
                originalKeyDown.call(this, evt);
                this.cancelBinding();
                saveSettings();
            }
            return;
        }
        this.heldKeys = this.heldKeys || {};
        this.heldKeys[evt.keyCode] = true;
        this.refreshKeyboard();
    };

    PlayerInputController.prototype.keyUp = function(evt) {
        if (this.heldKeys) delete this.heldKeys[evt.keyCode];
        this.refreshKeyboard();
    };

    PlayerInputController.prototype.releaseInputs = function() {
        this.heldKeys = {};
        this.inputSources = {};
        var self = this;
        actions.concat(["any"]).forEach(function(action) {
            if (self[action]) Controller.prototype[action + "KeyUp"].call(self);
        });
        this.cancelBinding();
    };

    PlayerInputController.prototype.bindGamepad = function(connected) {
        var blocked = this.bindingBlocked;
        var firstFrame = !blocked;
        if (!blocked) blocked = this.bindingBlocked = {};
        for (var p = 0; p < connected.length; p++) {
            var pad = connected[p];
            if (!pad || pad.connected === false) continue;
            for (var type = 0; type < 3; type++) {
                var length = type === 0 ? (pad.buttons || []).length : (pad.axes || []).length;
                for (var index = 0; index < length; index++) {
                    var key = p + ":" + index + ":" + type;
                    var held = read(pad, index, type, 0.6);
                    if (firstFrame) blocked[key] = held;
                    if (!held) blocked[key] = false;
                    if (held && !blocked[key]) {
                        this.buttonToBind.SetConfig([p, index, type]);
                        this.activeGamepadIndex = p;
                        this.cancelBinding();
                        saveSettings();
                        return;
                    }
                }
            }
        }
    };

    PlayerInputController.prototype.update = function() {
        Controller.prototype.update.call(this);
        var connected = pads();
        var pad = connected[this.activeGamepadIndex];
        if (!pad || pad.connected === false) {
            this.activeGamepadIndex = -1;
            for (var p = 0; p < connected.length; p++) {
                if (connected[p] && connected[p].connected !== false) {
                    this.activeGamepadIndex = p;
                    break;
                }
            }
            pad = connected[this.activeGamepadIndex];
        }
        this.activeGamepad = pad || null;
        var states = {};
        var deadzone = typeof settings.gamepadDeadzone === "number" ? settings.gamepadDeadzone : 0.25;
        deadzone = Math.max(0.1, Math.min(0.75, deadzone));
        var anyHeld = !!pad && ((pad.buttons || []).some(pressed) || (pad.axes || []).some(function(axis) { return Math.abs(axis) > deadzone; }));
        if (this.bindingKey) this.bindGamepad(connected);
        else if (this.waitForGamepadRelease) {
            if (!anyHeld) this.waitForGamepadRelease = false;
        }
        else if (pad) {
            for (var a = 0; a < actions.length; a++) {
                var action = actions[a];
                var monitor = this[action + "ButtonMonitor"];
                states[action] = read(pad, monitor.index, monitor.buttonType, deadzone);
            }
            // Both D-pad and left stick work without having to choose one binding.
            states.left = states.left || read(pad, 0, 2, deadzone);
            states.right = states.right || read(pad, 0, 1, deadzone);
            states.up = states.up || read(pad, 1, 2, deadzone);
            states.down = states.down || read(pad, 1, 1, deadzone);
            // Standard physical south/east buttons always confirm/back in menus.
            if (typeof menuStack !== "undefined" && menuStack.length) {
                states.punch = states.punch || read(pad, 0, 0, deadzone);
                states.smoke = states.smoke || read(pad, 1, 0, deadzone);
            }
            states.any = anyHeld;
            if (anyHeld) {
                this.lastInputDevice = "gamepad";
                if (typeof GlobalResourceLoader !== "undefined" && GlobalResourceLoader.webAudioLocked && GlobalResourceLoader.unlockAudio && !this.previousPadAny) GlobalResourceLoader.unlockAudio();
                if (this.oneShotCallback && !this.previousPadAny) {
                    var callback = this.oneShotCallback;
                    this.oneShotCallback = null;
                    callback({type: "gamepad"});
                    states = {};
                    this.waitForGamepadRelease = true;
                }
            }
        }
        this.previousPadAny = anyHeld;
        for (var a = 0; a < actions.length; a++) this.setInputSource(actions[a], "gamepad", !!states[actions[a]]);
        this.setInputSource("any", "gamepad", !!states.any);
    };

    PlayerInputController.prototype.getGamepadFamily = function() {
        var preference = settings.gamepadLayout;
        if (preference === "xbox" || preference === "playstation" || preference === "nintendo") return preference;
        var id = this.activeGamepad ? this.activeGamepad.id : "";
        if (/dualsense|dualshock|playstation|054c|sony/i.test(id)) return "playstation";
        if (/nintendo|switch|057e/i.test(id)) return "nintendo";
        return "xbox";
    };

    PlayerInputController.prototype.gamepadButtonName = function(index) {
        var family = this.getGamepadFamily();
        var names = {
            xbox: ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS"],
            playstation: ["×", "○", "□", "△", "L1", "R1", "L2", "R2", "Share", "Options", "L3", "R3"],
            nintendo: ["B", "A", "Y", "X", "L", "R", "ZL", "ZR", "−", "+", "LS", "RS"]
        };
        if (index >= 12 && index <= 15) return localize("D-pad") + " " + localize(["Up", "Down", "Left", "Right"][index - 12]);
        if (this.activeGamepad && this.activeGamepad.mapping !== "standard") return localize("Button") + " " + index;
        return names[family][index] || localize("Button") + " " + index;
    };

    PlayerInputController.prototype.getConfirmPrompt = function() {
        return this.lastInputDevice === "gamepad" && this.activeGamepad ? this.gamepadButtonName(0) : getStringFromKeyCode(settings.punchKeyCode);
    };
    PlayerInputController.prototype.getSkipPrompt = function() {
        var button = this.lastInputDevice === "gamepad" && this.activeGamepad ? this.gamepadButtonName(this.startButtonMonitor.index) : "Enter";
        return localize("Press {button} to Skip...").replace("{button}", button);
    };

    GamepadButtonMonitor.prototype.getName = function() {
        if (this.buttonType === 0) {
            var result = this.controller.gamepadButtonName(this.index);
            if (this.index >= 12 && this.index <= 15) result += " / " + localize("Left Stick");
            return result;
        }
        return (this.buttonType === 1 ? "+" : "−") + localize("Axis") + " " + this.index;
    };
    GamepadButtonMonitor.prototype.SetConfig = function(config) {
        if (!Array.isArray(config) || config.length !== 3 || config.some(function(value) { return !Number.isInteger(value) || value < 0; }) || config[2] > 2) return;
        this.gamepadID = config[0];
        this.index = config[1];
        this.buttonType = config[2];
        this.lastState = false;
    };

    window.addEventListener("blur", function() { if (typeof controller !== "undefined" && controller) controller.releaseInputs(); });
    document.addEventListener("visibilitychange", function() { if (document.hidden && typeof controller !== "undefined" && controller) controller.releaseInputs(); });
})();
