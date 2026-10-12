// Strange Flesh © 2017 Greatest Bear Studios. Modifications © 2026.
// Licensed under CC BY-NC-SA 4.0. See License.txt.
// English source strings are stable translation keys; unknown text stays readable.
var Localization = {
    languages: ["en", "pt-BR"],
    names: ["English", "Português (Brasil)"],
    catalogs: {"pt-BR": typeof PortugueseBrazil !== "undefined" ? PortugueseBrazil : {}},
    language: "en",
    setLanguage: function(language, persist) {
        this.language = this.languages.indexOf(language) >= 0 ? language : "en";
        if (typeof settings !== "undefined" && settings) settings.language = this.language;
        if (typeof document !== "undefined") document.documentElement.lang = this.language;
        // Internal canvases are detached from the DOM, so tag their language too.
        if (typeof sstext !== "undefined" && sstext.canvas) sstext.canvas.lang = this.language;
        if (typeof c !== "undefined" && c) c.lang = this.language;
        if (typeof displayC !== "undefined" && displayC) displayC.lang = this.language;
        if (persist && typeof saveSettings === "function") saveSettings();
    },
    text: function(value) {
        if (typeof value !== "string" || this.language === "en") return value;
        var dictionary = this.catalogs[this.language] || {};
        if (Object.prototype.hasOwnProperty.call(dictionary, value)) return dictionary[value];
        // Menu punctuation is added after the source label.
        if (value.slice(-1) === ":") {
            var label = value.slice(0, -1);
            if (Object.prototype.hasOwnProperty.call(dictionary, label)) return dictionary[label] + ":";
        }
        return value;
    },
    font: function(original) {
        var fallback = '"Fusion Bold Pixel Latin", "Noto Sans", "Noto Sans CJK", sans-serif';
        if (this.language === "en") return original + ', "Alagard Unicode", ' + fallback;
        if (/^zh-(Hant|TW|HK|MO)(-|$)/i.test(this.language)) return '"Fusion Bold Pixel TC", ' + fallback;
        if (/^zh(-|$)/.test(this.language)) return '"Fusion Bold Pixel SC", ' + fallback;
        if (/^ja(-|$)/.test(this.language)) return '"Fusion Bold Pixel JP", ' + fallback;
        if (/^ko(-|$)/.test(this.language)) return '"Fusion Bold Pixel KR", ' + fallback;
        if (/^(pt|ga|it|de|fr|pl|ru|es|tr|uk)(-|$)/.test(this.language)) return '"Alagard Unicode", ' + fallback;
        return fallback;
    },
    registerLanguage: function(code, name, dictionary) {
        var index = this.languages.indexOf(code);
        if (index < 0) { this.languages.push(code); this.names.push(name); }
        else this.names[index] = name;
        this.catalogs[code] = dictionary;
    },
    localizeCutscene: function(scene) {
        for (var s = 0; s < scene.screens.length; s++) {
            var lines = scene.screens[s].lines || [];
            for (var l = 0; l < lines.length; l++) {
                var line = lines[l];
                if (typeof line.sourceText === "undefined") line.sourceText = line.text;
                var wasComplete = line.i >= line.text.length;
                line.text = this.text(line.sourceText);
                // Completed captions must stay complete when translation changes length.
                line.i = wasComplete ? line.text.length : Math.min(line.i, line.text.length);
            }
        }
    }
};

function localize(value) { return Localization.text(value); }

function languageMenuItem() {
    return {
        element: "multi", label: "Language", options: Localization.names,
        selected: Localization.languages.indexOf(Localization.language),
        onChange: function() { Localization.setLanguage(Localization.languages[this.selected], true); }
    };
}
