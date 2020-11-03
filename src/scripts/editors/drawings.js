const brushes = [
    textToRendering2D("X"),
    textToRendering2D("XX\nXX"),
    textToRendering2D("_X_\nXXX\n_X_"),
    textToRendering2D("_XX_\nXXXX\nXXXX\n_XX_"),
    textToRendering2D("_XXX_\nXXXXX\nXXXXX\nXXXXX\n_XXX_"),
];

class DrawingsTabEditor {
    get drawingsManager() { return this.flicksyEditor.drawingsManager; }
    get isPicking() { return this.onDrawingPicked !== undefined; }

    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.selectedDrawing = undefined;
        this.onDrawingPicked = undefined;

        this.nameInput = elementByPath("drawings/select/name", "input");
        this.widthInput = elementByPath("drawings/select/width", "input");
        this.heightInput = elementByPath("drawings/select/height", "input");
        this.resizeButton = elementByPath("drawings/select/resize", "button");

        this.cursorPivotXInput = elementByPath("drawings/cursor/pivot/x", "input");
        this.cursorPivotYInput = elementByPath("drawings/cursor/pivot/y", "input");

        this.pivotXInput = elementByPath("drawings/select/pivot/x", "input");
        this.pivotYInput = elementByPath("drawings/select/pivot/y", "input");

        this.scene = new PanningScene(ONE("#drawings-scene"));
        this.scene.transform.translateSelf(100, 50);
        this.scene.transform.scaleSelf(4, 4);
        this.scene.refresh();

        this.cursorDrawingLabel = elementByPath("drawings/cursor", "input");
        setActionHandler("drawings/pick-cursor-drawing", async () => {
            try {
                const drawing = await this.flicksyEditor.pickDrawing({
                    heading: "pick cursor drawing",
                    prompt: "pick the drawing to use as a cursor",
                    allowNone: true,
                });
                this.flicksyEditor.projectData.details.cursor = drawing ? drawing.id : "";
                this.refreshCursor();
            } catch(e) {}
        });

        this.nameInput.addEventListener("input", () => {
            if (!this.selectedDrawing) return;
            this.selectedDrawing.name = this.nameInput.value;
        });

        const refreshResize = () => {
            if (!this.selectedDrawing) return;
            const canvas = this.drawingsManager.getRendering(this.selectedDrawing).canvas;
            const width = parseInt(this.widthInput.value, 10);
            const height = parseInt(this.heightInput.value, 10);
            this.resizeButton.disabled = width === canvas.width && height === canvas.height;
        }
        this.widthInput.addEventListener("input", refreshResize);
        this.heightInput.addEventListener("input", refreshResize);

        const refreshPivot = () => {
            if (!this.selectedDrawing) return;
            this.selectedDrawing.pivot.x = parseInt(this.pivotXInput.value, 10);
            this.selectedDrawing.pivot.y = parseInt(this.pivotYInput.value, 10);
        }
        this.pivotXInput.addEventListener("input", refreshPivot);
        this.pivotYInput.addEventListener("input", refreshPivot);

        const refreshCursorPivot = () => {
            const cursor = editor.projectData.details.cursor;
            const cursorDrawing = getDrawingById(this.flicksyEditor.projectData, cursor);
            if (!cursorDrawing) return;
            cursorDrawing.pivot.x = parseInt(this.cursorPivotXInput.value, 10);
            cursorDrawing.pivot.y = parseInt(this.cursorPivotYInput.value, 10);
        }
        this.cursorPivotXInput.addEventListener("input", refreshCursorPivot);
        this.cursorPivotYInput.addEventListener("input", refreshCursorPivot);

        setActionHandler("drawings/select/resize", () => {
            const width = parseInt(this.widthInput.value, 10);
            const height = parseInt(this.heightInput.value, 10);
            resizeRendering2D(this.drawingsManager.getRendering(this.selectedDrawing), width, height);
        });

        setActionHandler("drawings/select/raise", () => {
            if (!this.selectedDrawing) return;
            const canvas = this.drawingsManager.getRendering(this.selectedDrawing).canvas;
            this.selectedDrawing.position.z += 1;
            canvas.style.setProperty("z-index", this.selectedDrawing.position.z.toString());
        });

        setActionHandler("drawings/select/lower", () => {
            if (!this.selectedDrawing) return;
            const canvas = this.drawingsManager.getRendering(this.selectedDrawing).canvas;
            this.selectedDrawing.position.z -= 1;
            canvas.style.setProperty("z-index", this.selectedDrawing.position.z.toString());
        });

        setActionHandler("drawings/select/duplicate", async () => {
            const original = this.selectedDrawing;
            const originalRendering = this.drawingsManager.getRendering(original);
            const { x, y, z } = original.position;
            const copy = {
                id: nanoid(),
                name: original.name + " copy",
                position: { x: x+8, y: y+8, z: z+1 },
                pivot: { ...original.pivot },
                data: "",
            };
            this.flicksyEditor.projectData.drawings.push(copy);
            this.drawingsManager.insertDrawing(copy, copyRendering2D(originalRendering));
            await initDrawingInEditor(this, copy);

            this.setSelectedDrawing(copy);
        });

        setActionHandler("drawings/select/export", () => {
            const canvas = this.drawingsManager.getRendering(this.selectedDrawing).canvas;
            canvas.toBlob((blob) => saveAs(blob, this.selectedDrawing.name + ".png"));
        });

        setActionHandler("drawings/select/delete", () => {
            const drawing = this.selectedDrawing;
            this.setSelectedDrawing(undefined);
            removeItemFromArray(drawing, this.flicksyEditor.projectData.drawings);
            this.drawingsManager.removeDrawing(drawing);
        });

        setActionHandler("drawings/add/blank", async () => {
            const drawing = drawingFromData("");
            this.flicksyEditor.projectData.drawings.push(drawing);
            this.drawingsManager.insertDrawing(drawing, createRendering2D(64, 64));
            await initDrawingInEditor(this, drawing);

            this.setSelectedDrawing(drawing);
            switchTab("drawings/tool/move");
        });

        setActionHandler("drawings/add/import", async () => {
            const files = await pickFiles("image/*", true);

            async function drawingFromFile(file) {
                const uri = await dataURLFromFile(file);
                const drawing = drawingFromData(uri);
                drawing.name = file.name;
                return drawing;
            }

            const importedDrawings = await Promise.all(files.map(drawingFromFile));
            this.flicksyEditor.projectData.drawings.push(...importedDrawings);
            importedDrawings.forEach((drawing, i) => {
                drawing.position.x = i * 8;
                drawing.position.y = i * 8;
            });
            await Promise.all(importedDrawings.map((drawing) => initDrawingInEditor(this, drawing)));

            const palette = this.flicksyEditor.projectData.details.palette.slice(1);

            importedDrawings.forEach((drawing) => {
                const rendering = this.drawingsManager.getRendering(drawing);
                recolorToPalette(rendering, palette);
            });

            this.setSelectedDrawing(importedDrawings[0]);
            switchTab("drawings/tool/move");
        });

        this.colorReplacer = undefined;
        setActionHandler("drawings/palette/edit", () => {
            const paletteIndex = parseInt(toggleStates.get("drawings/palette"), 10);
            if (paletteIndex === 0) return;
            const hex = editor.projectData.details.palette[paletteIndex];

            const rgb = hexToRGB(hex);
            hsv = RGBToHSV(rgb);
            updateColorWheel();

            const uint32 = hexToNumber(hex);
            const contexts = Array.from(this.drawingsManager.drawingToRendering.values());
            const replacers = contexts.map((rendering) => makeColorReplacer(rendering, uint32));

            this.colorReplacer = (hex) => {
                this.flicksyEditor.projectData.details.palette[paletteIndex] = hex;
                replacers.forEach((replacer) => replacer(hex));
                this.refresh();
            }

            switchTab("modes/color");
        });

        setActionHandler("color/confirm", () => {
            this.colorReplacer = undefined;
            switchTab("modes/main");
        });

        const hswheelCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("hswheel"));
        hswheelCanvas.width = hswheel.canvas.width;
        hswheelCanvas.height = hswheel.canvas.height;
        const hswheelContext = hswheelCanvas.getContext('2d');
        
        const valueSlider = /** @type {HTMLInputElement} */ (document.getElementById("vslider"));
        const hexInput = /** @type {HTMLInputElement} */ (document.getElementById("hexinput"));
        let hsv = { h: 0, s: 1, v: 1 };

        const updateColorWheel = (skipHex = false) => {
            const { h, s, v } = hsv;
            fillRendering2D(hswheelContext);
            hswheelContext.drawImage(hswheel.canvas, 0, 0);
            hswheelContext.globalCompositeOperation = "multiply";
            const valueHex = rgbToHex({ r: v * 255, g: v * 255, b: v * 255 });
            fillRendering2D(hswheelContext, valueHex);
            hswheelContext.globalCompositeOperation = "destination-in";
            hswheelContext.drawImage(hswheel.canvas, 0, 0);
            hswheelContext.globalCompositeOperation = "source-over";

            const w = hswheelCanvas.width;
            const angle = h * Math.PI * 2;
            const radius = s * w/2;
            const [dx, dy] = [radius * Math.cos(angle), radius * Math.sin(angle)];
            hswheelContext.beginPath();
            hswheelContext.arc(w/2+dx, w/2+dy, 8, 0, 2 * Math.PI);
            hswheelContext.strokeStyle = "black";
            hswheelContext.fillStyle = rgbToHex(HSVToRGB(hsv));
            hswheelContext.fill();
            hswheelContext.stroke();

            const hex = rgbToHex(HSVToRGB(hsv));
            valueSlider.value = v.toString();
            if (!skipHex) hexInput.value = hex;

            if (this.colorReplacer) {
                this.colorReplacer(hex);
            }
        }

        updateColorWheel();

        hswheelCanvas.addEventListener("pointerdown", (event) => {
            if (this.colorReplacer === undefined) return;

            mouseEventWheel(event);
            document.addEventListener("pointermove", mouseEventWheel);
            document.addEventListener("pointerup", () => {
                document.removeEventListener("pointermove", mouseEventWheel);
            }, { once: true });
        });

        const mouseEventWheel = (event) => {
            killEvent(event);

            const rect = hswheelCanvas.getBoundingClientRect();
            const [x, y] = [event.clientX - rect.x, event.clientY - rect.y];
            const [w, h] = [rect.width, rect.height];
            const [dx, dy] = [x - w/2, y - h/2];

            hsv.h = (2 + Math.atan2(dy, dx) / (Math.PI * 2)) % 1;
            hsv.s = Math.min(1, Math.sqrt(dx*dx+dy*dy)*2/w);
            updateColorWheel();
        };

        valueSlider.addEventListener("input", (event) => {
            hsv.v = parseFloat(valueSlider.value);
            updateColorWheel();
        });

        hexInput.addEventListener("input", () => {
            hsv = RGBToHSV(hexToRGB(hexInput.value));
            updateColorWheel(true);
        });

        this.cursor = createRendering2D(16, 16);
        this.cursor.canvas.style.setProperty("pointer-events", "none");
        this.cursor.canvas.style.setProperty("position", "absolute");
        this.cursor.canvas.style.setProperty("z-index", "99999999");
        this.cursor.canvas.hidden = true;
        fillRendering2D(this.cursor, "magenta");
    }

    show() {
        this.scene.hidden = false;
        this.reframe();
        this.refreshCursor();
    }

    hide() {
        this.scene.hidden = true;
    }

    reframe(drawing = undefined) {
        if (drawing !== undefined) {
            const rendering = this.drawingsManager.drawingToRendering.get(drawing);
            const { x, y } = drawing.position;
            const { width, height } = rendering.canvas;
            const bounds = new DOMRect(x, y, width, height);
            padRect(bounds, 8);
            this.scene.frameRect(bounds);
            return;
        }

        const pairs = Array.from(this.drawingsManager.drawingToRendering.entries());
        const rects = pairs.map(([drawing, rendering]) => {
            const { x, y } = drawing.position;
            const { width, height } = rendering.canvas;
            return new DOMRect(x, y, width, height);
        });
        const bounds = boundRects(rects, new DOMRect(0, 0, 160, 100));
        padRect(bounds, 8);
        this.scene.frameRect(bounds);
    }

    /** @param {FlicksyDataDrawing} drawing */
    setSelectedDrawing(drawing) {
        if (this.selectedDrawing)
            this.flicksyEditor.drawingsManager.getRendering(this.selectedDrawing).canvas.classList.toggle("selected", false);

        this.selectedDrawing = drawing;

        elementByPath("drawings/selected", "div").hidden = drawing === undefined;

        if (this.selectedDrawing) {
            const rendering = this.flicksyEditor.drawingsManager.getRendering(this.selectedDrawing);
            rendering.canvas.classList.toggle("selected", true);
            this.nameInput.value = this.selectedDrawing.name;
            this.widthInput.value = rendering.canvas.width.toString();
            this.heightInput.value = rendering.canvas.height.toString();
            this.resizeButton.disabled = true;
        }
    }

    setSelectedColorIndex(index) {
        elementByPath(`toggle:drawings/palette/${index}`, "button").click();
    }

    /** @param {FlicksyDataDrawing} drawing */
    pickDrawing(drawing) {
        if (this.onDrawingPicked) {
            const onPicked = this.onDrawingPicked;
            this.onDrawingPicked = undefined;
            onPicked(drawing);
        }
    }

    refreshCursor() {
        const cursor = editor.projectData.details.cursor;
        elementByPath("drawings/cursor/pivot", "div").hidden = cursor === "";
        const cursorDrawing = getDrawingById(this.flicksyEditor.projectData, cursor);
        this.cursorDrawingLabel.value = cursorDrawing ? cursorDrawing.name : "[system]";
        
        if (cursorDrawing) {
            this.cursorPivotXInput.value = cursorDrawing.pivot.x.toString();
            this.cursorPivotYInput.value = cursorDrawing.pivot.y.toString();
        }
    }

    refresh() {
        ALL("#draw-color-palette div").forEach((element, i) => {
            if (i === 0) return;
            element.style.setProperty("background", editor.projectData.details.palette[i]);
        });

        this.refreshCursor();
    }
}

/**
 * @param {DOMMatrix} transform 
 */
function snap(transform) {
    transform.e = Math.round(transform.e);
    transform.f = Math.round(transform.f);
}

/**
 * @param {DrawingsTabEditor} drawingsEditor
 * @param {FlicksyDataDrawing} drawing
 */
async function initDrawingInEditor(drawingsEditor, drawing) {
    let rendering = editor.drawingsManager.drawingToRendering.get(drawing)
                 || await editor.drawingsManager.loadDrawing(drawing);

    rendering.canvas.classList.toggle("object", true);
    editor.drawingsTabEditor.scene.container.appendChild(rendering.canvas);
    const object = new DragObjectTest(editor.drawingsTabEditor.scene, rendering.canvas);

    rendering.canvas.style.setProperty("z-index", drawing.position.z.toString());

    object.transform.e = drawing.position.x;
    object.transform.f = drawing.position.y;
    object.refresh();

    let grab = undefined;
    let draw = undefined;
    let line = undefined;
    let hovered = undefined;
    
    const cursor = editor.drawingsTabEditor.cursor

    function mouseEventToSceneTransform(event) {
        const mouse = object.scene.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(object.scene.transform.inverse());
        return mouse;
    }

    function mouseEventToPixel(event) {
        const mouse = mouseEventToSceneTransform(event);
        const pixel = object.transform.inverse().multiply(mouse);
        return [pixel.e, pixel.f];
    }

    const isErasing = () => toggleStates.get("drawings/palette") === "0";
    const getColor = () => editor.projectData.details.palette[parseInt(toggleStates.get("drawings/palette"), 10)];

    let plot = undefined;
    function makePlot() {
        rendering.globalCompositeOperation = isErasing() ? "destination-out" : "source-over";
        const index = parseInt(toggleStates.get("drawings/brush"), 10);
        const brush = recolorMask(brushes[index-1], isErasing() ? "white" : getColor()).canvas;
        const [ox, oy] = [brush.width / 2, brush.height / 2];
        return (x, y) => rendering.drawImage(brush, Math.round(x-ox), Math.round(y-oy));
    }

    function makePlotCursor() {
        const index = parseInt(toggleStates.get("drawings/brush"), 10);
        const brush = recolorMask(brushes[index-1], isErasing() ? "white" : getColor()).canvas;
        const [ox, oy] = [brush.width / 2, brush.height / 2];
        return (x, y) => cursor.drawImage(brush, Math.round(x-ox), Math.round(y-oy));
    }
    
    function refreshCursors(event) {
        const tool = toggleStates.get("drawings/tool");
        
        const drawable = tool !== "move";
        const grabbing = grab !== undefined;
        const drawing = draw || line;
        const picking = drawingsEditor.isPicking;

        if (grabbing) document.body.style.setProperty("cursor", "grabbed");
        else if (drawing) document.body.style.setProperty("cursor", "crosshair")
        else document.body.style.removeProperty("cursor");

        const objectCursor = grabbing ? "grabbed" 
                           : picking ? "pointer" 
                           : drawable ? "crosshair" 
                           : "grab";

        rendering.canvas.style.setProperty("cursor", objectCursor);

        if ((hovered && !picking) || drawing) {
            if (drawable) {
                cursor.canvas.hidden = false;
                cursor.canvas.style.setProperty("transform", object.element.style.getPropertyValue("transform"));
                cursor.canvas.width = rendering.canvas.width;
                cursor.canvas.height = rendering.canvas.height;

                fillRendering2D(cursor);
                if (tool === "free" || (tool === "line" && line === undefined)) {
                    const [x, y] = mouseEventToPixel(event);
                    makePlotCursor()(x|0, y|0);
                } else if (tool === "line" && line !== undefined) {
                    const [x0, y0] = line;
                    const [x1, y1] = mouseEventToPixel(event);
                    lineplot(x0, y0, x1, y1, makePlotCursor());
                }
            } else {
                cursor.canvas.hidden = true;
            }
        }
    }

    function pointerdownDraw(event) {
        killEvent(event);
        const [x, y] = mouseEventToPixel(event);

        plot = makePlot();
        plot(x|0, y|0);
        draw = [x, y];
    }

    function pointermoveDraw(event) {
        killEvent(event);
        const [x1, y1] = mouseEventToPixel(event);
        const [x0, y0] = draw;

        lineplot(x0, y0, x1, y1, makePlot());
        draw = [x1, y1];
    }

    function pointerdownFill(event) {
        killEvent(event);
        const [x, y] = mouseEventToPixel(event);
        floodfill(rendering, x|0, y|0, isErasing() ? 0 : hexToNumber(getColor()));
    }

    function pointerdownLine(event) {
        killEvent(event);
        line = mouseEventToPixel(event);
    }

    function pointerupLine(event) {
        const [x0, y0] = line;
        const [x1, y1] = mouseEventToPixel(event);
        lineplot(x0, y0, x1, y1, makePlot());
    }

    function pointerdownPick(event) {
        killEvent(event);
        const [x, y] = mouseEventToPixel(event);
        const [r, g, b, a] = rendering.getImageData(x, y, 1, 1).data;

        let index = 0;

        if (a > 0) {
            const palette = editor.projectData.details.palette.map(hexToRGB);
            index = Math.max(1, palette.findIndex((rgb) => rgb.r === r && rgb.g === g && rgb.b === b));
        }

        editor.drawingsTabEditor.setSelectedColorIndex(index);
    }

    function pointerdownDrag(event) {
        killEvent(event);
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = mouseEventToSceneTransform(event);
        grab = mouse.invertSelf().multiplySelf(object.transform);
    }

    function pointermoveDrag(event) {
        if (!grab) return;
        killEvent(event);

        // preserve the relationship between mouse and element
        // D2 = M2 . G (drawing relative to scene)
        const mouse = mouseEventToSceneTransform(event);
        object.transform = mouse.multiply(grab);
        snap(object.transform);
        object.refresh();

        drawing.position.x = object.transform.e;
        drawing.position.y = object.transform.f;
    }

    object.element.addEventListener("dblclick", (event) => {
        drawingsEditor.reframe(drawing);
    })

    object.element.addEventListener("pointerdown", (event) => {
        if (drawingsEditor.isPicking) {
            killEvent(event);
            drawingsEditor.pickDrawing(drawing);
            return;
        }

        editor.drawingsTabEditor.setSelectedDrawing(drawing);

        const tool = toggleStates.get("drawings/tool");

        if (tool === "move") pointerdownDrag(event);
        if (tool === "free") pointerdownDraw(event);
        if (tool === "fill") pointerdownFill(event);
        if (tool === "line") pointerdownLine(event);
        if (tool === "pick") pointerdownPick(event);
        
        refreshCursors(event);
    });

    object.element.addEventListener("pointerenter", (event) => {
        killEvent(event);
        hovered = true;
        refreshCursors(event);
    });

    object.element.addEventListener("pointerout", (event) => {
        killEvent(event);
        // TODO: track single hovered thing
        if (hovered) {
            hovered = false;
            cursor.canvas.hidden = true;
        }
        refreshCursors(event);
    });

    document.addEventListener("pointermove", (event) => {
        if (grab) pointermoveDrag(event);
        if (draw) pointermoveDraw(event);

        refreshCursors(event);
    });
    
    document.addEventListener("pointerup", (event) => {
        if (editor.drawingsTabEditor.scene.hidden) return;

        killEvent(event);

        if (line) pointerupLine(event);

        draw = undefined;
        grab = undefined;
        line = undefined;
        
        refreshCursors(event);
    });
}

class DragObjectTest {
    /**
     * @param {PanningScene} scene
     * @param {HTMLElement} element 
     */
    constructor(scene, element) {
        this.scene = scene;
        this.element = element;
        this.transform = new DOMMatrix();
    }

    refresh() {
        this.element.style.setProperty("transform", this.transform.toString());
    }
}

function setPaletteColors(colors) {
    ALL("#draw-color-palette div").forEach((element, i) => {
        if (i === 0) return;
        element.style.setProperty("background", colors[i])
    });
}

function drawingFromData(data) {
    return {
        id: nanoid(),
        name: "unnamed",
        position: { x: 0, y: 0, z: 0 },
        pivot: { x: 0, y: 0},
        data
    };
}

/** @param {FlicksyDataDrawing[]} drawings */
async function setDrawingBoardDrawings(drawings) {
    editor.drawingsManager.clear();
    removeAllChildren(editor.drawingsTabEditor.scene.container);
    editor.drawingsTabEditor.scene.container.appendChild(editor.drawingsTabEditor.cursor.canvas);
    await Promise.all(drawings.map((drawing) => initDrawingInEditor(editor.drawingsTabEditor, drawing)));
}

function uint32ToRGB(uint32) {
    return {
        r: uint32 >>>  0 & 0xFF,
        g: uint32 >>>  8 & 0xFF,
        b: uint32 >>> 16 & 0xFF,
        uint32,
    };
}

function hexToRGB(hex) {
    if (hex.charAt(0) === '#') hex = hex.substring(1);
    return {
        b: parseInt(hex.substr(4, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        r: parseInt(hex.substr(0, 2), 16),
        uint32: hexToNumber(hex),
    };
}

function RGBToNumber(rgb) {
    return rgb.r | rgb.g << 8 | rgb.b << 16 | 0xFF << 24;
}

/** 
 * @param {CanvasRenderingContext2D} context 
 * @param {number} color
 */
function extractMask(context, color) {
    const mask = copyRendering2D(context);
    withPixels(mask, (pixels) => {
        for (let i = 0; i < pixels.length; ++i)
            pixels[i] = pixels[i] === color ? 0xFFFFFFFF : 0;
    });
    return mask;
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} color 
 */
function makeColorReplacer(context, color) {
    const mask = extractMask(context, color);
    return (style) => {
        const changes = recolorMask(mask, style);
        context.drawImage(changes.canvas, 0, 0);
    };
}

function hsToUint32(h, s) {
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

    return ((0xFF << 24) | (b*255 << 16) | (g*255 << 8) | (r*255 << 0)) >>> 0;
}

const hswheel = createRendering2D(239, 239);
withPixels(hswheel, (pixels) => {
    const [w, h] = [hswheel.canvas.width, hswheel.canvas.height];
    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            const [dx, dy] = [x-w/2, y-h/2];
            const sat = Math.sqrt(dx*dx + dy*dy)*2/w;
            
            if (sat <= 1) {
                const hue = (10 + Math.atan2(dy, dx) / Math.PI / 2) % 1;
                pixels[y * w + x] = hsToUint32(hue, sat);
            } else {
                pixels[y * w + x] = 0;
            }
        }
    }
});
