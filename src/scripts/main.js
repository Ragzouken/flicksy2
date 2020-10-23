class FlicksyEditor {
    constructor() {
        this.projectData = EMPTY_PROJECT_DATA;
        this.drawingsManager = new DrawingsManager();
    }

    /** @param {FlicksyDataProject} data */
    async setProjectData(data) {
        this.projectData = data;
        this.refresh();

        // reset drawing board
        await setDrawingBoardDrawings(this.projectData.drawings);
    }

    async start() {
        initui();

        this.sidebarTabs = document.getElementById("menu-buttons");
        this.projectTabEditor = new ProjectTabEditor(this);
        this.drawingsTabEditor = new DrawingsTabEditor(this);
        this.mapTabEditor = new MapTabEditor(this);

        setActionHandler("hide:sidebar", () => {
            this.drawingsTabEditor.hide();
            this.mapTabEditor.hide();
        });
        setActionHandler("show:sidebar/drawings", () => this.drawingsTabEditor.show());
        setActionHandler("show:sidebar/map", () => this.mapTabEditor.show());

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

    enterExclusive() {
        this.sidebarTabs.hidden = true;
    }

    exitExclusive() {
        this.sidebarTabs.hidden = false;
    }

    async prepareSave() {
        this.drawingsManager.flushChanges();
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
