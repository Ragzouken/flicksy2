class FlicksyEditor {
    constructor() {
        this.projectData = EMPTY_PROJECT_DATA;
        this.drawingsManager = new DrawingsManager();
    }

    /** @param {FlicksyDataProject} data */
    async setProjectData(data) {
        this.projectData = data;
        this.refresh();

        // reset tabs
        await setDrawingBoardDrawings(this.projectData.drawings);
        await this.mapTabEditor.reloadFromProject(this.projectData);
        await this.sceneTabEditor.setActiveScene(this.projectData, this.projectData.scenes[0]);
    }

    async start() {
        initui();

        this.sidebarTabs = document.getElementById("menu-buttons");
        this.pickerTab = new PickerTab(this);
        this.projectTabEditor = new ProjectTabEditor(this);
        this.drawingsTabEditor = new DrawingsTabEditor(this);
        this.mapTabEditor = new MapTabEditor(this);
        this.sceneTabEditor = new SceneTabEditor(this);
        this.playTab = new PlayTab(this);

        setActionHandler("hide:sidebar", () => {
            this.drawingsTabEditor.hide();
            this.mapTabEditor.hide();
            this.sceneTabEditor.hide();
            this.playTab.hide();
        });
        setActionHandler("show:sidebar/drawings", () => this.drawingsTabEditor.show());
        setActionHandler("show:sidebar/map", () => this.mapTabEditor.show());
        setActionHandler("show:sidebar/scene", () => this.sceneTabEditor.show());
        setActionHandler("show:sidebar/play", () => this.playTab.show());

        setActionHandler("sidebar/save", async () => {
            await this.prepareSave();
            const json = JSON.stringify(this.projectData);
            localStorage.setItem("flicksy/test", json);
        });

        const json = localStorage.getItem("flicksy/test") || ONE("#project-data").innerHTML;
        const data = JSON.parse(json);
        await this.setProjectData(data);
    }

    refresh() {
        this.projectTabEditor.refresh();
        this.drawingsTabEditor.refresh();
    }

    async prepareSave() {
        this.drawingsManager.flushChanges();
    }

    /** 
     * @param {PickerOptions} options 
     * @returns {Promise<FlicksyDataScene>}
     */
    async pickScene(options) {
        return new Promise((resolve, reject) => {
            this.mapTabEditor.onScenePicked = (scene) => this.pickerTab.onPicked(scene);
            this.mapTabEditor.mode = "pick";

            const cleanup = () => {
                this.mapTabEditor.mode = "move";
                elementByPath("toggle:modes/main", "button").click();
            }

            const onCancel = () => reject("cancelled");
            const onPicked = (scene) => {
                cleanup();
                resolve(scene);
            }

            options.onCancel = onCancel;
            options.onPicked = onPicked;

            elementByPath("toggle:modes/picker", "button").click();
            elementByPath("toggle:sidebar/map", "button").click();
            this.pickerTab.setup(options);
        });
    }

    /** 
     * @param {PickerOptions} options 
     * @returns {Promise<FlicksyDataDrawing>}
     */
    async pickDrawing(options) {
        return new Promise((resolve, reject) => {
            this.drawingsTabEditor.onDrawingPicked = (drawing) => this.pickerTab.onPicked(drawing);

            const cleanup = () => {
                elementByPath("toggle:modes/main", "button").click();
            }

            const onCancel = () => reject("cancelled");
            const onPicked = (drawing) => {
                cleanup();
                resolve(drawing);
            }

            options.onCancel = onCancel;
            options.onPicked = onPicked;

            elementByPath("toggle:modes/picker", "button").click();
            elementByPath("toggle:sidebar/drawings", "button").click();
            this.pickerTab.setup(options);
        });
    }
}

/** @typedef PickerOptions
 * @property {string} heading
 * @property {string} prompt
 * @property {() => void} onCancel
 * @property {(any) => void} onPicked
 * @property {boolean} allowNone
 */

class PickerTab {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.onPicked = undefined;

        this.headingText = elementByPath("picker/heading", "h3");
        this.promptText = elementByPath("picker/prompt", "p");
        this.noneButton = elementByPath("picker/none", "button");
        this.cancelButton = elementByPath("picker/cancel", "button");
    }

    /** @param {PickerOptions} options */
    setup(options) {
        this.headingText.innerHTML = options.heading;
        this.promptText.innerHTML = options.prompt;
        this.noneButton.hidden = !options.allowNone;

        const onNone = options.allowNone 
                     ? () => options.onPicked(undefined)
                     : () => {}; 

        this.onPicked = options.onPicked;
        setActionHandler("picker/none", onNone);
        setActionHandler("picker/cancel", options.onCancel);
    }
}

class DrawingsManager {
    constructor() {
        /** @type {Map<FlicksyDataDrawing, CanvasRenderingContext2D>} */
        this.drawingToRendering = new Map();
    }

    getRendering(drawing) {
        return this.drawingToRendering.get(drawing);
    }

    /**
     * @param {FlicksyDataDrawing} drawing
     * @returns {Promise<CanvasRenderingContext2D>}
     */
    async loadDrawing(drawing) {
        const image = await loadImage(drawing.data);
        const rendering = imageToRendering2D(image);
        this.insertDrawing(drawing, rendering);
        return rendering;
    }

    /**
     * @param {FlicksyDataDrawing} drawing 
     * @param {CanvasRenderingContext2D} rendering 
     */
    insertDrawing(drawing, rendering) {
        this.drawingToRendering.set(drawing, rendering);
    }

    /**
     * @param {FlicksyDataDrawing} drawing
     */
    removeDrawing(drawing) {
        this.drawingToRendering.get(drawing).canvas.remove();
        this.drawingToRendering.delete(drawing);
    }

    clear() {
        this.drawingToRendering.clear();
    }

    flushChanges() {
        this.drawingToRendering.forEach((rendering, drawing) => drawing.data = rendering.canvas.toDataURL());
    }
}

class PanningScene {
    get hidden() { return this.container.hidden; }
    set hidden(value) { this.container.hidden = value; }

    /**
     * @param {HTMLElement} container 
     */
    constructor(container) {
        this.viewport = container.parentElement;
        this.container = container;
        this.transform = new DOMMatrix();

        let grab = undefined;
    
        const viewport = this.container.parentElement;
        viewport.addEventListener("pointerdown", (event) => {
            if (this.hidden) return;
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
            if (!grab) return;
            grab = undefined;
            document.body.style.removeProperty("cursor");
            this.viewport.style.setProperty("cursor", "grab");
        });
        
        this.viewport.addEventListener('wheel', (event) => {
            if (this.hidden) return;
            const mouse = this.mouseEventToViewportTransform(event);
            const origin = (this.transform.inverse().multiply(mouse)).transformPoint();

            const [minScale, maxScale] = [.5, 16];
            const prevScale = getMatrixScale(this.transform).x;
            const [minDelta, maxDelta] = [minScale/prevScale, maxScale/prevScale];
            const deltaScale = clamp(Math.pow(2, event.deltaY * -0.01), minDelta, maxDelta);

            // prev * delta <= max -> delta <= max/prev
            this.transform.scaleSelf(
                deltaScale, deltaScale, deltaScale,
                origin.x, origin.y, origin.z,
            );

            this.refresh();
        });

        this.refresh();
    }

    refresh() {
        this.container.style.setProperty("transform", this.transform.toString());
    }

    frameRect(rect) {
        const bounds = this.viewport.getBoundingClientRect();

        // find scale that contains all width, all height, and is within limits
        const sx = bounds.width / rect.width;
        const sy = bounds.height / rect.height;
        const scale = clamp(Math.min(sx, sy), .5, 16);

        // find translation that centers the rect in the viewport
        const ex = (1/scale - 1/sx) * bounds.width * .5;
        const ey = (1/scale - 1/sy) * bounds.height * .5;
        const [ox, oy] = [-rect.x + ex, -rect.y + ey];

        this.transform = new DOMMatrix();
        this.transform.scaleSelf(scale, scale);
        this.transform.translateSelf(ox, oy);
        this.refresh();
    }

    mouseEventToViewportTransform(event) {
        const rect = this.viewport.getBoundingClientRect();
        const [sx, sy] = [event.clientX - rect.x, event.clientY - rect.y];
        const matrix = (new DOMMatrixReadOnly()).translate(sx, sy);
        return matrix;
    }
}

const editor = new FlicksyEditor();

/** 
 * @param {FlicksyDataScene} scene
 * @param {number} scale
 */
function renderScene(scene, scale = 1, label = true) {
    const sceneRendering = createRendering2D(160 * scale, 100 * scale);
    fillRendering2D(sceneRendering, 'black');
    scene.objects.sort((a, b) => a.position.z - b.position.z);
    scene.objects.forEach((object) => {
        const drawing = editor.projectData.drawings.find((drawing) => drawing.id === object.drawing);
        const canvas = editor.drawingsManager.getRendering(drawing).canvas;

        sceneRendering.drawImage(
            canvas,
            object.position.x * scale, 
            object.position.y * scale, 
            canvas.width * scale, 
            canvas.height * scale,
        );
    });
    if (label) {
        sceneRendering.fillStyle = 'white';
        sceneRendering.strokeStyle = 'black';
        sceneRendering.lineWidth = 4;
        sceneRendering.font = "16px monospace";
        sceneRendering.textBaseline = "hanging";
        sceneRendering.strokeText(scene.name, 0, 0, 160 * scale);
        sceneRendering.fillText(scene.name, 0, 0, 160 * scale);
    }
    return sceneRendering;
}

/**
 * @param {FlicksyDataScene} scene
 * @param {{ x: number, y: number }} point
 * @returns {FlicksyDataObject}
 */
function pointcastScene(scene, point) {
    const { x: sx, y: sy } = point;

    console.log(sx, sy);

    scene.objects.sort((a, b) => a.position.z - b.position.z);
    scene.objects.reverse();
    for (let object of scene.objects) {
        const drawing = editor.projectData.drawings.find((drawing) => drawing.id === object.drawing);
        const rendering = editor.drawingsManager.getRendering(drawing);

        const { x, y } = object.position;
        const { width, height } = rendering.canvas;
        const rect = { x, y, width, height };

        if (rectContainsPoint(rect, point)) {
            const [ cx, cy ] = [ sx - object.position.x, sy - object.position.y ];
            const pixel = rendering.getImageData(cx, cy, 1, 1).data[0];
            if (pixel !== 0) return object;
        }
    }
}
