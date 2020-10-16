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

        subAction("drawings/select/resize", () => {
            const width = parseInt(this.widthInput.value, 10);
            const height = parseInt(this.heightInput.value, 10);
            resizeRendering2D(drawingToContext.get(this.selectedDrawing), width, height);
        });

        subAction("drawings/select/raise", () => {
            if (!this.selectedDrawing) return;
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            this.selectedDrawing.position.z += 1;
            canvas.style.setProperty("z-index", this.selectedDrawing.position.z.toString());
        });

        subAction("drawings/select/lower", () => {
            if (!this.selectedDrawing) return;
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            this.selectedDrawing.position.z -= 1;
            canvas.style.setProperty("z-index", this.selectedDrawing.position.z.toString());
        });

        subAction("drawings/select/duplicate", async () => {
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

        subAction("drawings/select/export", () => {
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            canvas.toBlob((blob) => saveAs(blob, this.selectedDrawing.name + ".png"));
        });

        subAction("drawings/select/delete", () => {
            const canvas = drawingToContext.get(this.selectedDrawing).canvas;
            canvas.remove();

            const index = this.flicksyEditor.projectData.drawings.indexOf(this.selectedDrawing);
            this.flicksyEditor.projectData.drawings.splice(index);

            this.setSelectedDrawing(undefined);
        });
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
        document.body.style.setProperty("cursor", "grabbing");
        object.element.style.setProperty("cursor", "grabbing");
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
    });

    document.addEventListener("pointermove", (event) => {
        if (grab) pointermoveDrag(event);
        if (draw) pointermoveDraw(event);
    });
    
    document.addEventListener("pointerup", (event) => {
        killEvent(event);

        if (line) pointerupLine(event);

        draw = undefined;
        grab = undefined;
        line = undefined;
        document.body.style.removeProperty("cursor");
        object.element.style.setProperty("cursor", "grab");
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
        position: { x: 0, y: 0 },
        data
    };
}

/** @param {FlicksyDataDrawing[]} drawings */
async function setDrawingBoardDrawings(drawings) {
    removeAllChildren(editor.scene.container);
    await Promise.all(drawings.map(initDrawingInEditor));
}
