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
 * @param {CanvasRenderingContext2D} destination
 */
function copyRendering2D(rendering, destination = undefined) {
    destination ||= createRendering2D(rendering.canvas.width, rendering.canvas.height);
    resizeRendering2D(destination, rendering.canvas.width, rendering.canvas.height);
    destination.drawImage(rendering.canvas, 0, 0);
    return destination;
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

    if (dx === 0 && dy === 0) {
        plot(x0, y0);
    }

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
 * @param {CanvasRenderingContext2D} rendering 
 * @param {number} x 
 * @param {number} y 
 * @param {number} color 
 */
function floodfill(rendering, x, y, color) {
    const [width, height] = [rendering.canvas.width, rendering.canvas.height];
    withPixels(rendering, pixels => {
        const queue = [[x, y]];
        const done = new Array(width * height);
        const initial = pixels[y * width + x];

        function enqueue(x, y) {
            const within = x >= 0 && y >= 0 && x < width && y < height;

            if (within && pixels[y * width + x] === initial && !done[y * width + x]) {
                queue.push([x, y]);
            }
        }

        while (queue.length > 0) {
            const [x, y] = queue.pop();
            pixels[y * width + x] = color;
            done[y * width + x] = true;

            enqueue(x - 1, y);
            enqueue(x + 1, y);
            enqueue(x, y - 1);
            enqueue(x, y + 1);
        }
    });
};

/**
 * @param {{r:number,g:number,b:number}} rgb 
 */
function rgbToHex(rgb) {
    const packed = (0xFF000000 + (rgb.r << 16) + (rgb.g << 8) + (rgb.b << 0));
    return "#" + packed.toString(16).substr(-6);
}

/**
 * @param {string} hex 
 * @param {number} alpha
 */
function hexToNumber(hex, alpha = undefined) {
    if (hex.charAt(0) === '#') hex = hex.substring(1);
    if (alpha === undefined && hex.length === 8) alpha = parseInt(hex.substr(6, 2), 16);
    if (alpha === undefined) alpha = 255;
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

/**
 * @param {{ h: number, s: number, v: number }} hsv
 */
function HSVToRGB(hsv) {
    const { h, s, v } = hsv;
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = (1 - s);
    const q = (1 - f * s);
    const t = (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = 1, g = t, b = p; break;
        case 1: r = q, g = 1, b = p; break;
        case 2: r = p, g = 1, b = t; break;
        case 3: r = p, g = q, b = 1; break;
        case 4: r = t, g = p, b = 1; break;
        case 5: r = 1, g = p, b = q; break;
    }

    r *= v * 255;
    g *= v * 255;
    b *= v * 255;

    return { r, g, b };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 */
function RGBToHSV(rgb) {
    const { r, g, b } = rgb;
    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

    return { h, s, v };
}
