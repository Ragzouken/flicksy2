class FlicksyEditor {
    get projectData() { return this.projectManager.projectData; }

    constructor() {
        this.projectManager = new FlicksyProjectManager();
    }

    /** @param {FlicksyDataProject} data */
    async setProjectData(data) {
        repairProjectData(data);
        await this.projectManager.loadProjectData(data);
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
        await this.playTab.player.load();

        setActionHandler("hide:sidebar", () => {
            this.drawingsTabEditor.hide();
            this.mapTabEditor.hide();
            this.sceneTabEditor.hide();
            this.playTab.hide();
            this.projectTabEditor.hide();
        });
        setActionHandler("show:sidebar/drawings", () => this.drawingsTabEditor.show());
        setActionHandler("show:sidebar/map", () => this.mapTabEditor.show());
        setActionHandler("show:sidebar/scene", () => this.sceneTabEditor.show());
        setActionHandler("show:sidebar/play", () => this.playTab.show());
        setActionHandler("show:sidebar/project", () => this.projectTabEditor.show());

        setActionHandler("sidebar/save", async () => {
            await this.prepareSave();
            const json = JSON.stringify(this.projectData);
            localStorage.setItem("flicksy2/test-save", json);
        });
    }

    refresh() {
        this.projectTabEditor.refresh();
        this.drawingsTabEditor.refresh();
    }

    async prepareSave() {
        await this.projectManager.saveProjectData();
    }

    /** 
     * @param {Partial<PickerOptions>} options 
     * @returns {Promise<FlicksyDataScene>}
     */
    async pickScene(options) {
        return new Promise((resolve, reject) => {
            this.mapTabEditor.onScenePicked = (scene) => this.pickerTab.onPicked(scene);
            this.mapTabEditor.mode = "pick";

            const cleanup = () => {
                this.mapTabEditor.mode = "move";
                switchTab("modes/main");
            }

            const onCancel = () => {
                reject("cancelled");
                cleanup();
            };
            const onPicked = (scene) => {
                cleanup();
                resolve(scene);
            }

            options.onCancel = onCancel;
            options.onPicked = onPicked;

            switchTab("modes/picker");
            switchTab("sidebar/map");
            this.pickerTab.setup(options);
        });
    }

    /** 
     * @param {Partial<PickerOptions>} options 
     * @returns {Promise<FlicksyDataDrawing>}
     */
    async pickDrawing(options) {
        return new Promise((resolve, reject) => {
            this.drawingsTabEditor.onDrawingPicked = (drawing) => this.pickerTab.onPicked(drawing);

            const cleanup = () => {
                switchTab("modes/main");
            }

            const onCancel = () => {
                reject("cancelled");
                cleanup();
            };
            const onPicked = (drawing) => {
                cleanup();
                resolve(drawing);
            }

            options.onCancel = onCancel;
            options.onPicked = onPicked;

            switchTab("modes/picker");
            switchTab("sidebar/drawings");
            this.pickerTab.setup(options);
        });
    }

    /** 
     * @param {Partial<PickerOptions>} options 
     * @param {FlicksyDataScene} scene
     * @returns {Promise<FlicksyDataObject>}
     */
    async pickObject(options, scene) {
        return new Promise((resolve, reject) => {
            this.sceneTabEditor.setActiveScene(editor.projectData, scene);
            this.sceneTabEditor.onObjectPicked = (object) => this.pickerTab.onPicked(object);

            const cleanup = () => {
                switchTab("modes/main");
            }

            const onCancel = () => {
                reject("cancelled");
                cleanup();
            };
            const onPicked = (object) => {
                cleanup();
                resolve(object);
            }

            options.onCancel = onCancel;
            options.onPicked = onPicked;

            switchTab("modes/picker");
            switchTab("sidebar/scene");
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

const editor = new FlicksyEditor();
