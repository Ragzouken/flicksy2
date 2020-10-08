/**
 * @param {number} width
 * @param {number} height
 * @returns {CanvasRenderingContext2D}
 */
function createRendering2D(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    return context;
}

/**
 * @param {CanvasRenderingContext2D} rendering 
 * @param {string | CanvasGradient | CanvasPattern | undefined} fillStyle
 */
function fillRendering2D(rendering, fillStyle = undefined) {
    if (fillStyle !== undefined) {
        const prevStyle = rendering.fillStyle;
        rendering.fillStyle = fillStyle;
        rendering.fillRect(0, 0, rendering.canvas.width, rendering.canvas.height);
        rendering.fillStyle = prevStyle;
    } else {
        rendering.clearRect(0, 0, rendering.canvas.width, rendering.canvas.height);
    }
}

/**
 * @param {CanvasRenderingContext2D} rendering
 */
function copyRendering2D(rendering) {
    const copy = createRendering2D(rendering.canvas.width, rendering.canvas.height);
    copy.drawImage(rendering.canvas, 0, 0);
    return copy;
}

/**

 * @param {CanvasRenderingContext2D} rendering 
 * @param {number} width 
 * @param {number} height 
 */
function resizeRendering2D(rendering, width, height) {
    const copy = copyRendering2D(rendering);
    rendering.canvas.width = width;
    rendering.canvas.height = height;
    rendering.drawImage(copy.canvas, 0, 0);
}

/**
 * @callback pixelsAction
 * @param {Uint32Array} pixels
 */

/**
 * @param {CanvasRenderingContext2D} rendering 
 * @param {pixelsAction} action 
 */
function withPixels(rendering, action) {
    const imageData = rendering.getImageData(0, 0, rendering.canvas.width, rendering.canvas.height);
    action(new Uint32Array(imageData.data.buffer));
    rendering.putImageData(imageData, 0, 0);
}

/**
 * @param {CanvasRenderingContext2D} mask 
 * @param {string} style 
 */
function recolorMask(mask, style) {
    const recolored = copyRendering2D(mask);
    recolored.globalCompositeOperation = "source-in";
    fillRendering2D(recolored, style);
    return recolored;
}

/**
 * @param {number} x0 
 * @param {number} y0 
 * @param {number} x1 
 * @param {number} y1 
 * @param {(x: number, y: number) => void} plot 
 */
// adapted from https://stackoverflow.com/a/34267311
function lineplot(x0, y0, x1, y1, plot) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;

    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const ystep = Math.sign(y1 - y0);
    const xstep = Math.sign(x1 - x0);

    let err = Math.floor(dx / 2);
    let y = y0;

    for (let x = x0; x != (x1 + xstep); x += xstep) {
        plot(steep ? y : x, steep ? x : y);
        err -= dy;
        if (err < 0) {
            y += ystep;
            err += dx;
        }
    }
}


/**
 * @param {string} hex 
 * @param {number} alpha
 */
function hexToNumber(hex, alpha = 255) {
    if (hex.charAt(0) === '#') hex = hex.substring(1);
    hex = hex.substr(4, 2) + hex.substr(2, 2) + hex.substr(0, 2);
    return (parseInt(hex, 16) | (alpha << 24)) >>> 0;
}

/**
 * @param {number} number
 * @param {string} prefix 
 */
function numberToHex(number, prefix = '#') {
    number = (number | 0xff000000) >>> 0;
    let hex = number.toString(16).substring(2, 8);
    hex = hex.substr(4, 2) + hex.substr(2, 2) + hex.substr(0, 2);
    return prefix + hex;
}

const MASK_PALETTE = {
    '_': hexToNumber('#000000', 0),
    default: hexToNumber('#FFFFFF', 255),
};

/**
 * @param {string} text 
 * @param {Record<string, number>} palette 
 * @returns {CanvasRenderingContext2D}
 */
function textToRendering2D(text, palette = MASK_PALETTE) {
    text = text.trim();
    const lines = text.split('\n').map((line) => [...line.trim()]);

    const width = lines[0].length;
    const height = lines.length;

    const rendering = createRendering2D(width, height);
    withPixels(rendering, (pixels) => {
        lines.forEach((line, y) => line.forEach((char, x) => {
            const color = palette[char];
            pixels[y * width + x] = color !== undefined ? color : palette.default;
        }));
    });

    return rendering;
}
