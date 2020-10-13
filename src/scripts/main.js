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

function initui() {
    const toggles = Array.from(document.querySelectorAll("[data-tab-toggle]"));
    const bodies = Array.from(document.querySelectorAll("[data-tab-body]"));

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
 * @param {DragObjectTest} object 
 */
function makeObjectDraggable(object) {
    let grab = undefined;
    let draw = undefined;

    function mouseEventToSceneTransform(event) {
        const mouse = object.scene.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(object.scene.transform.inverse());
        return mouse;
    }

    const c = object.element.getContext("2d");

    function getBrush() {
        const index = parseInt(toggleStates.get("drawings/brush"), 10);
        return brushes[index-1].canvas;
    }

    function pointerdownDraw(event) {
        killEvent(event);
        const mouse = mouseEventToSceneTransform(event);
        const pixel = object.transform.inverse().multiply(mouse);
        const [x, y] = [pixel.e, pixel.f];

        c.drawImage(getBrush(), x|0, y|0);
        draw = [x, y];
    }

    function pointermoveDraw(event) {
        killEvent(event);
        const mouse = mouseEventToSceneTransform(event);
        const pixel = object.transform.inverse().multiply(mouse);
        const [x0, y0] = draw;
        const [x1, y1] = [pixel.e, pixel.f];

        lineplot(x0, y0, x1, y1, (x, y) => c.drawImage(getBrush(), x, y))
        draw = [x1, y1];
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
    }

    object.element.addEventListener("pointerdown", (event) => {
        const drag = toggleStates.get("drawings/mode") === "select"
                  || (toggleStates.get("drawings/mode") === "draw" && toggleStates.get("drawings/tool") === "move");
        const free = toggleStates.get("drawings/mode") === "draw" && toggleStates.get("drawings/tool") === "free";

        if (drag) pointerdownDrag(event);
        if (free) pointerdownDraw(event);
    });

    document.addEventListener("pointermove", (event) => {
        if (grab) pointermoveDrag(event);
        if (draw) pointermoveDraw(event);
    });
    
    document.addEventListener("pointerup", (event) => {
        killEvent(event);

        draw = undefined;
        grab = undefined;
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

        const test = () => {
            const test = createRendering2D(64, 64);
            //fillRendering2D(test, `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`);
            test.canvas.classList.toggle("object", true);
            this.container.appendChild(test.canvas);
            const test2 = new DragObjectTest(this, test.canvas);
            makeObjectDraggable(test2);
        }

        test();
        test();
        test();
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

class FlicksyEditor {
    async start() {
        initui();

        const scene = new DrawingBoardScene();
        scene.transform.translateSelf(100, 50);
        scene.transform.scaleSelf(4, 4);
        scene.refresh();
    }
}

const editor = new FlicksyEditor();
