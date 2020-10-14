const brushes = [
    textToRendering2D("X"),
    textToRendering2D("XX\nXX"),
    textToRendering2D("_X_\nXXX\n_X_"),
    textToRendering2D("_XX_\nXXXX\nXXXX\n_XX_"),
];

const icons = {
    freehand: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAYUlEQVQ4jb2RUQ7AIAhDi/e/c/fDjHMI1Szrn4b3agT4MyQ539kJbGadkwRhs0tKQQSPklRQwekLFHgpUOFQsAO/BLvwQ3ACA0C74WVDsamWDVdwDz3jWQLhfzADcvMXuQC15zwLU3quDgAAAABJRU5ErkJggg==",
    line: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQElEQVQ4jWNgoBAwkqrh/////+GaGRkZmciylZERbjFZBiC7gj4aRzUPds2M6JqQUxkxAJ4SSdWIYQBF/qYEAAB/ei/rTsuX6AAAAABJRU5ErkJggg==",
    fill: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAXUlEQVQ4jcWOQRKAUAhC4d//zrZyxqiUappY4gMBvlRExOvwoxIN3Sq5gq2SCWrv7kzlmCZJOiXJkSQALOerhusSu0A/p1Z3nMIH1Xmp6ivXlnRw9U4n7YBp9u/aAKUMc8GnWuIfAAAAAElFTkSuQmCC",
}

/**
 * @param {string} path 
 * @returns {[string, string]}
 */
function pathToRootLeaf(path) {
    const parts = path.split('/');
    const root = parts.slice(0, -1).join('/');
    const leaf = parts.slice(-1)[0];
    return [root, leaf];
}

const toggleStates = new Map();
const actionSubs = new Map();

function subAction(action, callback) {
    const subs = actionSubs.get(action) || [];
    actionSubs.set(action, subs);
    subs.push(callback);
}

function initui() {
    const toggles = ALL("[data-tab-toggle]");
    const bodies = ALL("[data-tab-body]");
    const buttons = ALL("[data-action]");

    buttons.forEach((element) => {
        const action = element.getAttribute("data-action");

        element.addEventListener("click", (event) => {
            killEvent(event);
            
            const subs = actionSubs.get(action) || [];
            subs.forEach((callback) => callback());
        });
    })

    function setGroupActiveTab(group, tab) {
        toggleStates.set(group, tab);
        toggles.forEach((element) => {
            const [group_, tab_] = pathToRootLeaf(element.getAttribute("data-tab-toggle"));
            if (group_ === group) element.classList.toggle("active", tab_ === tab);
        });
        bodies.forEach((element) => {
            const [group_, tab_] = pathToRootLeaf(element.getAttribute("data-tab-body"));
            if (group_ === group) element.hidden = (tab_ !== tab);
        });
    }

    toggles.forEach((element) => {
        const [group, tab] = pathToRootLeaf(element.getAttribute("data-tab-toggle"));
        element.addEventListener('click', (event) => {
            killEvent(event);
            setGroupActiveTab(group, tab);
        });
    });

    bodies.forEach((element) => {
        element.hidden = true;
    });
}

/**
 * @param {DOMMatrix} transform 
 */
function snap(transform) {
    transform.e = Math.round(transform.e);
    transform.f = Math.round(transform.f);
}

/**
 * @param {FlicksyDataDrawing} drawing
 */
async function initDrawingInEditor(drawing) {
    const image = await loadImage(drawing.data);
    const rendering = imageToRendering2D(image);
    
    rendering.canvas.classList.toggle("object", true);
    editor.scene.container.appendChild(rendering.canvas);
    const object = new DragObjectTest(editor.scene, rendering.canvas);

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
        const drag = toggleStates.get("drawings/mode") === "select"
                  || (toggleStates.get("drawings/mode") === "draw" && toggleStates.get("drawings/tool") === "move");
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

class FlicksyEditor {
    constructor() {
        this.projectData = TEST_PROJECT_DATA;
    }

    async start() {
        initui();

        this.scene = new DrawingBoardScene();
        this.scene.transform.translateSelf(100, 50);
        this.scene.transform.scaleSelf(4, 4);
        this.scene.refresh();

        this.refresh();

        subAction("drawings/add/blank", () => {
            const drawing = {
                id: nanoid(),
                name: "unnamed drawing",
                position: { x: 0, y: 0 },
                data: createRendering2D(64, 64).canvas.toDataURL(),
            };
            this.projectData.drawings.push(drawing);
            initDrawingInEditor(drawing);
        });

        await initDrawingInEditor(this.projectData.drawings[0]);
    }

    refresh() {
        ALL("#draw-color-palette div").forEach((element, i) => {
            if (i === 0) return;
            element.style.setProperty("background", this.projectData.details.palette[i]);
        });
    }
}

const editor = new FlicksyEditor();
