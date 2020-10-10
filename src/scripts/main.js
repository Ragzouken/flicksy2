const brushes = [
    textToRendering2D("X"),
    textToRendering2D("XX\nXX"),
    textToRendering2D("_X_\nXXX\n_X_"),
    textToRendering2D("_XX_\nXXXX\nXXXX\n_XX_"),
];

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

function initui() {
    const toggles = Array.from(document.querySelectorAll("[data-tab-toggle]"));
    const bodies = Array.from(document.querySelectorAll("[data-tab-body]"));

    function setGroupActiveTab(group, tab) {
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

class DragObjectTest {
    /**
     * @param {DrawingBoardScene} scene
     * @param {HTMLElement} element 
     */
    constructor(scene, element) {
        this.scene = scene;
        this.element = element;
        this.transform = new DOMMatrix();

        let grab = undefined;

        /**
         * @param {DOMMatrix} transform 
         */
        function snap(transform) {
            transform.e = Math.round(transform.e);
            transform.f = Math.round(transform.f);
        }

        function mouseEventToSceneTransform(event) {
            const mouse = scene.mouseEventToViewportTransform(event);
            mouse.preMultiplySelf(scene.transform.inverse());
            return mouse;
        }

        this.element.addEventListener("pointerdown", (event) => {
            killEvent(event);

            // determine and save the relationship between mouse and element
            // G = M1^ . E (element relative to mouse)
            const mouse = mouseEventToSceneTransform(event);
            grab = mouse.invertSelf().multiplySelf(this.transform);
            document.body.style.setProperty("cursor", "grabbing");
            this.element.style.setProperty("cursor", "grabbing");
            
            // test
            const c = this.element.getContext("2d");
            const p = mouseEventToSceneTransform(event).preMultiplySelf(this.transform.inverse()).transformPoint();
            c.drawImage(brushes[3].canvas, p.x|0, p.y|0);
        });
        
        document.addEventListener("pointermove", (event) => {
            if (!grab) return;
            killEvent(event);
    
            // preserve the relationship between mouse and element
            // D2 = M2 . G (drawing relative to scene)
            const mouse = mouseEventToSceneTransform(event);
            this.transform = mouse.multiply(grab);
            snap(this.transform);
            this.refresh();
        });
        
        document.addEventListener("pointerup", (event) => {
            killEvent(event);

            grab = undefined;
            document.body.style.removeProperty("cursor");
            this.element.style.setProperty("cursor", "grab");
        });
        
        /*
        this.element.addEventListener('wheel', (event) => {
            killEvent(event);

            const mouse = mouseEventToSceneTransform(event);
            const origin = (this.transform.inverse().multiply(mouse)).transformPoint();
            const deltaScale = Math.pow(2, event.deltaY * -0.01);
            this.transform.scaleSelf(
                deltaScale, deltaScale, deltaScale,
                origin.x, origin.y, origin.z,
            );
            this.refresh();
        });
        */
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
            fillRendering2D(test, `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`);
            test.canvas.classList.toggle("object", true);
            this.container.appendChild(test.canvas);
            const test2 = new DragObjectTest(this, test.canvas);
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
