// Strange Flesh © 2017 by Greatest Bear Studios
// 
// Strange Flesh is licensed under a
// Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.
// 
// You should have received a copy of the license along with this
// work. If not, see <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
//
// This sourcecode has not been minified or obfuscated in any way. Enjoy.
//

function SupersampledTextRenderer()
{
	this.canvas = document.createElement("canvas");
	this.canvas.width = 1920;
	this.canvas.height = 1080;
	this.context = this.canvas.getContext("2d");
	this.context.imageSmoothingEnabled = false;
	this.context.webkitImageSmoothingEnabled = false;
	this.context.mozImageSmoothingEnabled = false;
	this.context.setTransform(1, 0, 0, 1, 0.0, 0.0);
	
	this.alpha = 1.0;
	this.font = "alagard";
	this.fontSize = 20;
	this.textAlign = "center";
	this.fillStyle = "#FFF";
	this.textBaseline = 'alphabetic';
	
	this.isClear = true;
};

SupersampledTextRenderer.prototype.DrawText = function(text, x, y, fontSize, fillStyle, alpha, textAlign, textBaseline)
{
	text = localize(text);
	this.isClear = false;
	
	if (typeof fontSize !== 'undefined')
		this.fontSize = fontSize;
	if (typeof fillStyle !== 'undefined')
		this.fillStyle = fillStyle;
	if (typeof alpha !== 'undefined')
		this.alpha = alpha;
	if (typeof textAlign !== 'undefined')
		this.textAlign = textAlign;
	if (typeof textBaseline !== 'undefined')
		this.textBaseline = textBaseline;
	
	this.context.globalAlpha = this.alpha;
	this.context.textAlign = this.textAlign;
	this.context.font = (this.fontSize*3) + "px " + Localization.font(this.font);
	this.context.fillStyle = this.fillStyle;
	this.context.textBaseline = this.textBaseline;
	this.context.fillText(text,x*3,y*3);
};

SupersampledTextRenderer.prototype.DrawTextWithShadow = function(text, x, y, color)
{	
	if (typeof color === "undefined" )
		color = "#FFF";
		
	var shadowColor = "#000";
	if (color === "#000" || color === "#000000")
	{
		shadowColor = "#FFF";
	}
	
	this.DrawText(text,x-2,y+2,this.fontSize, shadowColor);
	this.DrawText(text,x,y,this.fontSize, color);
};

SupersampledTextRenderer.prototype.MeasureText = function(measureString)
{
	measureString = localize(measureString);
	this.context.font = (this.fontSize) + "px " + Localization.font(this.font);
	return this.context.measureText(measureString);
};

SupersampledTextRenderer.prototype.MeasureRuns = function(runs, size)
{
    if (typeof size === 'undefined') size = this.fontSize;
    var width = 0;
    for (var i = 0; i < runs.length; i++) {
        this.context.font = size * (runs[i].scale || 1) + 'px ' + (runs[i].font ? '"' + runs[i].font + '"' : Localization.font(this.font));
        width += this.context.measureText(runs[i].font ? runs[i].text : localize(runs[i].text)).width;
    }
    return {width: width};
};

SupersampledTextRenderer.prototype.DrawRuns = function(runs, x, y, color)
{
    this.isClear = false;
    var width = this.MeasureRuns(runs).width;
    var cursor = x - (this.textAlign === 'right' ? width : this.textAlign === 'center' ? width / 2 : 0);
    this.context.save();
    this.context.textAlign = 'left';
    this.context.textBaseline = this.textBaseline;
    this.context.globalAlpha = this.alpha;
    this.context.fillStyle = typeof color === 'undefined' ? this.fillStyle : color;
    this.context.font = this.fontSize * 3 + 'px ' + Localization.font(this.font);
    var textMetrics = this.context.measureText('M');
    var textCenter = (textMetrics.actualBoundingBoxDescent - textMetrics.actualBoundingBoxAscent) / 2;
    for (var i = 0; i < runs.length; i++) {
        var run = runs[i];
        var text = run.font ? run.text : localize(run.text);
        var runSize = this.fontSize * (run.scale || 1);
        this.context.font = runSize * 3 + 'px ' + (run.font ? '"' + run.font + '"' : Localization.font(this.font));
        var metrics = this.context.measureText(text);
        var iconCenter = (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2;
        // Align visible icon shapes to the text, regardless of font baseline metrics.
        var offset = run.font && Number.isFinite(textCenter) && Number.isFinite(iconCenter) ? textCenter - iconCenter : 0;
        this.context.fillText(text, cursor * 3, y * 3 + offset);
        cursor += metrics.width / 3;
    }
    this.context.restore();
};

SupersampledTextRenderer.prototype.DrawRunsWithShadow = function(runs, x, y, color)
{
    if (typeof color === 'undefined') color = '#FFF';
    this.DrawRuns(runs, x - 2, y + 2, color === '#000' || color === '#000000' ? '#FFF' : '#000');
    this.DrawRuns(runs, x, y, color);
};

SupersampledTextRenderer.prototype.DrawTextWithOutline = function(text, x, y, color)
{
	if (typeof color === "undefined" )
		color = "#FFF";
		
	var shadowColor = "#000";
	if (color === "#000" || color === "#000000")
	{
		shadowColor = "#FFF";
	}
	
	this.DrawText(text,x-2,y-2,this.fontSize, shadowColor);
	this.DrawText(text,x+2,y-2);
	this.DrawText(text,x+2,y+2);
	this.DrawText(text,x-2,y+2);
	this.DrawText(text,x,y-2);
	this.DrawText(text,x,y+2);
	this.DrawText(text,x-2,y);
	this.DrawText(text,x+2,y);
	
	this.DrawText(text,x,y,this.fontSize, color);
};

SupersampledTextRenderer.prototype.Blit = function()
{
	if (!this.isClear)
	{
		// Draw the contents of the internal canvas to the game's render context
		displayCtx.drawImage(this.canvas, 0, 0, displayC.width, displayC.height);
	}
};

SupersampledTextRenderer.prototype.Clear = function()
{
	if (!this.isClear)
	{
		this.context.clearRect(0, 0, 1920, 1080);
		this.isClear = true;
	}
};

SupersampledTextRenderer.prototype.BlitAndClear = function()
{
	this.Blit();
	this.Clear();
};

var sstext = new SupersampledTextRenderer();
