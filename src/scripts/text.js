/**
 * @typedef {Object} BlitsyFontCharacter
 * @property {number} codepoint
 * @property {CanvasImageSource} image
 * @property {number} spacing
 */

/**
 * @typedef {Object} BlitsyFont
 * @property {string} name
 * @property {number} lineHeight
 * @property {Map<number, BlitsyFontCharacter>} characters
 */

/**
 * @typedef {Object} Vector2
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} BlitsyGlyph
 * @property {HTMLCanvasElement} image
 * @property {Vector2} position
 * @property {Vector2} offset
 * @property {boolean} hidden
 * @property {string} fillStyle
 * @property {Map<string, any>} styles
 */

/** @typedef {BlitsyGlyph[]} BlitsyPage */

/** @param {HTMLScriptElement} script */
async function loadBasicFont(script) {
    const atlasdata = script.innerHTML;
    const charWidth = parseInt(script.getAttribute("data-char-width"), 10);
    const charHeight = parseInt(script.getAttribute("data-char-height"), 10);
    const indexes = parseRuns(script.getAttribute("data-runs"));

    const atlas = await loadImage(atlasdata);
    const cols = atlas.naturalWidth / charWidth;

    const font = {
        name: "font",
        lineHeight: charHeight,
        characters: new Map(),
    };

    indexes.forEach((codepoint, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const rect = { 
            x: col * charWidth, 
            y: row * charHeight, 
            width: charWidth, 
            height: charHeight,
        };

        const image = copyImageRect(atlas, rect).canvas;
        font.characters.set(codepoint, { codepoint, image, spacing: charWidth });
    });

    return font;
}

/** @param {string} data */
function parseRuns(data) {
    const runs = data.split(",").map((run) => run.split("-").map((index) => parseInt(index, 10)));
    const indexes = [];
    runs.forEach(([min, max]) => indexes.push(...range(min, max)));
    return indexes;
}

/**
 * @param {CanvasImageSource} source 
 * @param {Rect} rect 
 */
function copyImageRect(source, rect) {
    const rendering = createRendering2D(rect.width, rect.height);
    rendering.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return rendering;
}

/** 
 * @param {BlitsyPage} page 
 * @param {number} width
 * @param {number} height
 */
function renderPage(page, width, height)
{
    const result = createRendering2D(width, height);
    const buffer = createRendering2D(width, height);

    for (const glyph of page)
    {
        if (glyph.hidden) continue;

        // padding + position + offset
        const dx = glyph.position.x + glyph.offset.x;
        const dy = glyph.position.y + glyph.offset.y;
        
        // draw tint layer
        result.fillStyle = glyph.fillStyle;
        console.log(result.fillStyle)
        result.fillRect(dx, dy, glyph.image.width, glyph.image.height);
        
        // draw text layer
        buffer.drawImage(glyph.image, dx, dy);
    }

    // draw text layer in tint color
    result.globalCompositeOperation = 'destination-in';
    result.drawImage(buffer.canvas, 0, 0);

    return result;
}

const defaultStyleHandler = (styles, style) => {
    if (style.substr(0, 1) === "+") {
        styles.set(style.substring(1), true);
    } else if (style.substr(0, 1) === "-") {
        styles.delete(style.substring(1));
    } else if (style.includes("=")) {
        const [key, val] = style.split(/\s*=\s*/);
        styles.set(key, val);
    }
}

function scriptToPages(script, options, styleHandler = defaultStyleHandler) {
    const tokens = tokeniseScript(script);
    const commands = tokensToCommands(tokens);
    return commandsToPages(commands, options, styleHandler);
}

function tokeniseScript(script) {
    const tokens = [];
    let buffer = "";
    let braceDepth = 0;

    function openBrace() {
        if (braceDepth === 0) flushBuffer();
        braceDepth += 1;
    }

    function closeBrace() {
        if (braceDepth === 1) flushBuffer();
        braceDepth -= 1;
    }

    function newLine() {
        flushBuffer();
        tokens.push(["markup", "el"]);
    }

    function flushBuffer() {
        if (buffer.length === 0) return;
        const type = braceDepth > 0 ? "markup" : "text";
        tokens.push([type, buffer]);
        buffer = "";
    }

    const actions = {
        "{": openBrace,
        "}": closeBrace,
        "\n": newLine,
    }

    for (const char of script) {
        if (char in actions)
            actions[char]();
        else
            buffer += char;
    }

    flushBuffer();

    return tokens;
}

function tokensToCommands(tokens) {
    const commands = [];

    function handleToken([type, buffer]) {
        if (type === "text")
            handleText(buffer)
        else if (type === "markup")
            handleMarkup(buffer)
    }

    function handleText(buffer) {
        for (const char of buffer)
        {
            const breakable = char === " ";
            commands.push({ type: "glyph", char, breakable });
        }
    }

    function handleMarkup(buffer) {
        if (buffer === "ep")
            commands.push({ type: "break", target: "page" });
        else if (buffer === "el")
            commands.push({ type: "break", target: "line" });
        else
            commands.push({ type: "style", style: buffer });
    }

    tokens.forEach(handleToken);

    return commands;
}

function commandsToPages(commands, layout, styleHandler) {
    commandsBreakLongSpans(commands, layout);

    const styles = new Map();
    const pages = [];
    let page = [];
    let currLine = 0;

    function newPage() {
        pages.push(page);
        page = [];
        currLine = 0;
    }

    function endPage() { 
        do { endLine(); } while (currLine % layout.lineCount !== 0)
    }

    function endLine() {
        currLine += 1;
        if (currLine === layout.lineCount) newPage();
    }

    function doBreak(target) {
             if (target === "line") endLine();
        else if (target === "page") endPage(); 
    }

    function findNextBreakIndex() {
        let width = 0;

        for (let i = 0; i < commands.length; ++i) {
            const command = commands[i];
            if (command.type === "break") return i;
            if (command.type === "style") continue;

            width += computeLineWidth(layout.font, command.char);
            // if we overshot, look backward for last possible breakable glyph
            if (width > layout.lineWidth) {
                const result = find(commands, i, -1, command => command.type === "glyph" && command.breakable);
                if (result) return result[1];
            }
        };
    }

    function addGlyph(command, offset) {
        const codepoint = command.char.codePointAt(0);
        const char = layout.font.characters.get(codepoint);
        const position = { x: offset, y: currLine * (layout.font.lineHeight + 4) };
        const glyph = { 
            image: char.image,
            position: position,
            offset: { x: 0, y: 0 },
            hidden: true,
            fillStyle: "white",
            styles: new Map(styles.entries()),
        };

        page.push(glyph);
        return char.spacing;
    }

    function generateGlyphLine(commands) {
        let offset = 0;
        for (const command of commands) {
            if (command.type === "glyph") {
                offset += addGlyph(command, offset);
            } else if (command.type === "style") {
                styleHandler(styles, command.style);
            }
        }
    }

    let index;
    
    while ((index = findNextBreakIndex()) !== undefined) {
        generateGlyphLine(commands.slice(0, index));
        commands = commands.slice(index);

        const command = commands[0];
        if (command.type === "break") {
            doBreak(command.target);
            commands.shift();
        } else {
            if (command.type === "glyph" && command.char === " ") {
                commands.shift();
            }
            endLine();
        }
    }

    generateGlyphLine(commands);
    endPage();

    return pages;
}

/**
 * Find spans of unbreakable commands that are too long to fit within a page 
 * width and amend those spans so that breaking permitted in all positions. 
 */
function commandsBreakLongSpans(commands, context) {
    const canBreak = (command) => command.type === "break" 
                               || (command.type === "glyph" && command.breakable); 

    const spans = filterToSpans(commands, canBreak);

    for (const span of spans) {
        const glyphs = span.filter(command => command.type === "glyph");
        const charWidths = glyphs.map(command => computeLineWidth(context.font, command.char));
        const spanWidth = charWidths.reduce((x, y) => x + y, 0);

        if (spanWidth > context.lineWidth) {
            for (const command of glyphs) command.breakable = true;
        }
    }
}

function computeLineWidth(font, line) {
    let width = 0;
    for (const char of line) {
        const code = char.codePointAt(0);
        const fontchar = font.characters.get(code);
        if (fontchar) {
            width += fontchar.spacing;
        } 
    }
    return width;
}

/**
 * Segment the given array into contiguous runs of elements that are not 
 * considered breakable.
 */
function filterToSpans(array, breakable)
{
    const spans = [];
    let buffer = [];

    array.forEach((element, index) => {
        if (!breakable(element, index)) {
            buffer.push(element);
        } else if (buffer.length > 0) {
            spans.push(buffer);
            buffer = [];
        }
    });

    if (buffer.length > 0) {
        spans.push(buffer);
    }

    return spans;
}

function find(array, start, step, predicate) {
    for (let i = start; 0 <= i && i < array.length; i += step) {
        if (predicate(array[i], i)) return [array[i], i];
    }
}
