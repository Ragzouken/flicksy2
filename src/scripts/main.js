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
