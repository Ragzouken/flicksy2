class DrawingsTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.selectedDrawing = undefined;

        this.nameInput = elementByPath("drawings/select/name", "input");
        this.widthInput = elementByPath("drawings/select/width", "input");
        this.heightInput = elementByPath("drawings/select/height", "input");
        this.resizeButton = elementByPath("drawings/select/resize", "button");

        this.nameInput.addEventListener("input", () => {
            if (!this.selectedDrawing) return;
            this.selectedDrawing.name = this.nameInput.value;
        });

        const refreshResize = () => {
            if (!this.selectedDrawing) return;
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            const width = parseInt(this.widthInput.value, 10);
            const height = parseInt(this.heightInput.value, 10);
            this.resizeButton.disabled = width === canvas.width && height === canvas.height;
        }
        this.widthInput.addEventListener("input", refreshResize);
        this.heightInput.addEventListener("input", refreshResize);

        setActionHandler("drawings/select/resize", () => {
            const width = parseInt(this.widthInput.value, 10);
            const height = parseInt(this.heightInput.value, 10);
            resizeRendering2D(drawingToContext.get(this.selectedDrawing), width, height);
        });

        setActionHandler("drawings/select/raise", () => {
            if (!this.selectedDrawing) return;
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            this.selectedDrawing.position.z += 1;
            canvas.style.setProperty("z-index", this.selectedDrawing.position.z.toString());
        });

        setActionHandler("drawings/select/lower", () => {
            if (!this.selectedDrawing) return;
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            this.selectedDrawing.position.z -= 1;
            canvas.style.setProperty("z-index", this.selectedDrawing.position.z.toString());
        });

        setActionHandler("drawings/select/duplicate", async () => {
            const original = this.selectedDrawing;
            const { x, y, z } = original.position;
            const copy = {
                id: nanoid(),
                name: original.name + " copy",
                position: { x: x+8, y: y+8, z: z+1 },
                data: drawingToContext.get(original).canvas.toDataURL(),
            };
            this.flicksyEditor.projectData.drawings.push(copy);
            await initDrawingInEditor(copy);

            this.setSelectedDrawing(copy);
        });

        setActionHandler("drawings/select/export", () => {
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            canvas.toBlob((blob) => saveAs(blob, this.selectedDrawing.name + ".png"));
        });

        setActionHandler("drawings/select/delete", () => {
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            canvas.remove();

            const index = this.flicksyEditor.projectData.drawings.indexOf(this.selectedDrawing);
            this.flicksyEditor.projectData.drawings.splice(index);

            this.setSelectedDrawing(undefined);
        });

        setActionHandler("drawings/add/blank", async () => {
            const data = createRendering2D(64, 64).canvas.toDataURL();
            const drawing = drawingFromData(data);
            this.flicksyEditor.projectData.drawings.push(drawing);
            await initDrawingInEditor(drawing);

            this.setSelectedDrawing(drawing);
        });

        setActionHandler("drawings/add/import", () => {
            const fileInput = html("input", { type: "file", accept: "image/*", multiple: "true" });
            fileInput.addEventListener("change", async () => {
                const datas = await Promise.all(Array.from(fileInput.files).map(dataURLFromFile));
                fileInput.value = "";
                const drawings = datas.map(drawingFromData);
                this.flicksyEditor.projectData.drawings.push(...drawings);
                await Promise.all(drawings.map(initDrawingInEditor));

                const palette = this.flicksyEditor.projectData.details.palette.slice(1).map(hexToRGB);
                const mapping = new Map();

                drawings.forEach((drawing) => {
                    const rendering = drawingToContext.get(drawing);
                    withPixels(rendering, (pixels) => {
                        for (let i = 0; i < pixels.length; ++i) {
                            const pixel = pixels[i];
                            const alpha = (pixel >>> 24) < 16;
                            const check = pixel & 0xFFF0F0F0;

                            if (alpha) {
                                pixels[i] = 0;
                            } else {
                                const color = mapping.get(check) || colordiff.closest(uint32ToRGB(check), palette).uint32;
                                mapping.set(check, color);
                                pixels[i] = color;
                            }
                        }
                    });
                });

                this.setSelectedDrawing(drawings[0]);
            });
            fileInput.click();
        });

        this.cursor = createRendering2D(16, 16);
        this.cursor.canvas.style.setProperty("pointer-events", "none");
        this.cursor.canvas.style.setProperty("position", "absolute");
        this.cursor.canvas.style.setProperty("z-index", "99999999");
        this.cursor.canvas.hidden = true;
        fillRendering2D(this.cursor, "magenta");
    }

    /** @param {FlicksyDataDrawing} drawing */
    setSelectedDrawing(drawing) {
        
        if (this.selectedDrawing)
            drawingToContext.get(this.selectedDrawing).canvas.classList.toggle("selected", false);

        this.selectedDrawing = drawing;

        elementByPath("drawings/mode/selected", "div").hidden = drawing === undefined;

        if (this.selectedDrawing) {
            const rendering = drawingToContext.get(this.selectedDrawing);
            rendering.canvas.classList.toggle("selected", true);
            this.nameInput.value = this.selectedDrawing.name;
            this.widthInput.value = rendering.canvas.width.toString();
            this.heightInput.value = rendering.canvas.height.toString();
            this.resizeButton.disabled = true;
        }
    }
}

/**
 * @param {DOMMatrix} transform 
 */
function snap(transform) {
    transform.e = Math.round(transform.e);
    transform.f = Math.round(transform.f);
}

/** @type {Map<FlicksyDataDrawing, CanvasRenderingContext2D>} */
const drawingToContext = new Map();

/**
 * @param {FlicksyDataDrawing} drawing
 */
async function initDrawingInEditor(drawing) {
    const image = await loadImage(drawing.data);
    const rendering = imageToRendering2D(image);
    drawingToContext.set(drawing, rendering);
    
    rendering.canvas.classList.toggle("object", true);
    editor.scene.container.appendChild(rendering.canvas);
    const object = new DragObjectTest(editor.scene, rendering.canvas);

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
        return (x, y) => rendering.drawImage(brush, x-ox, y-oy);
    }

    function makePlotCursor() {
        const index = parseInt(toggleStates.get("drawings/brush"), 10);
        const brush = recolorMask(brushes[index-1], isErasing() ? "white" : getColor()).canvas;
        const [ox, oy] = [brush.width / 2, brush.height / 2];
        return (x, y) => cursor.drawImage(brush, x-ox, y-oy);
    }
    
    function refreshCursors(event) {
        const mode = toggleStates.get("drawings/mode");
        const tool = toggleStates.get("drawings/tool");
        
        const drawable = mode === "draw" && tool !== "move";
        const grabbing = grab !== undefined;
        const drawing = draw || line;

        if (grabbing) document.body.style.setProperty("cursor", "grabbed");
        else if (drawing) document.body.style.setProperty("cursor", "crosshair")
        else document.body.style.removeProperty("cursor");

        rendering.canvas.style.setProperty("cursor", grabbing ? "grabbed" : drawable ? "crosshair" : "grab");

        if (hovered || drawing) {
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

    object.element.addEventListener("pointerdown", (event) => {
        editor.drawingsTabEditor.setSelectedDrawing(drawing);

        const drag = toggleStates.get("drawings/mode") !== "draw" || toggleStates.get("drawings/tool") === "move";
        const free = toggleStates.get("drawings/mode") === "draw" && toggleStates.get("drawings/tool") === "free";
        const fill = toggleStates.get("drawings/mode") === "draw" && toggleStates.get("drawings/tool") === "fill";
        const line = toggleStates.get("drawings/mode") === "draw" && toggleStates.get("drawings/tool") === "line";

        if (drag) pointerdownDrag(event);
        if (free) pointerdownDraw(event);
        if (fill) pointerdownFill(event);
        if (line) pointerdownLine(event);
        
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
     * @param {DrawingBoardScene} scene
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

class DrawingBoardScene {
    constructor() {
        this.viewport = document.getElementById("content");
        this.container = document.getElementById("scene");
        this.transform = new DOMMatrix();

        let grab = undefined;
    
        const viewport = this.container.parentElement;
        viewport.addEventListener("pointerdown", (event) => {
            killEvent(event);
    
            // determine and save the relationship between mouse and scene
            // G = M1^ . S (scene relative to mouse)
            const mouse = this.mouseEventToViewportTransform(event);
            grab = mouse.invertSelf().multiplySelf(this.transform);
            document.body.style.setProperty("cursor", "grabbing");
            this.viewport.style.setProperty("cursor", "grabbing");
        });
        
        document.addEventListener("pointermove", (event) => {
            if (!grab) return;
    
            // preserve the relationship between mouse and scene
            // D2 = M2 . G (drawing relative to scene)
            const mouse = this.mouseEventToViewportTransform(event);
            this.transform = mouse.multiply(grab);
            this.refresh();
        });
        
        document.addEventListener("pointerup", (event) => {
            grab = undefined;
            document.body.style.removeProperty("cursor");
            this.viewport.style.setProperty("cursor", "grab");
        });
        
        this.viewport.addEventListener('wheel', (event) => {
            const mouse = this.mouseEventToViewportTransform(event);
            const origin = (this.transform.inverse().multiply(mouse)).transformPoint();
            const deltaScale = Math.pow(2, event.deltaY * -0.01);
            this.transform.scaleSelf(
                deltaScale, deltaScale, deltaScale,
                origin.x, origin.y, origin.z,
            );
            this.refresh();
        });
    }

    refresh() {
        this.container.style.setProperty("transform", this.transform.toString());
    }

    mouseEventToViewportTransform(event) {
        const rect = this.viewport.getBoundingClientRect();
        const [sx, sy] = [event.clientX - rect.x, event.clientY - rect.y];
        const matrix = (new DOMMatrixReadOnly()).translate(sx, sy);
        return matrix;
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
        data
    };
}

/** @param {FlicksyDataDrawing[]} drawings */
async function setDrawingBoardDrawings(drawings) {
    removeAllChildren(editor.scene.container);
    editor.scene.container.appendChild(editor.drawingsTabEditor.cursor.canvas);
    await Promise.all(drawings.map(initDrawingInEditor));
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
