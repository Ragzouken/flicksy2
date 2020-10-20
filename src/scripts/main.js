const brushes = [
    textToRendering2D("X"),
    textToRendering2D("XX\nXX"),
    textToRendering2D("_X_\nXXX\n_X_"),
    textToRendering2D("_XX_\nXXXX\nXXXX\n_XX_"),
];

class FlicksyEditor {
    constructor() {
        this.projectData = EMPTY_PROJECT_DATA;
    }

    async setProjectData(data) {
        this.projectData = data;
        this.refresh();

        // reset drawing board
        await setDrawingBoardDrawings(this.projectData.drawings);
    }

    async start() {
        initui();

        this.scene = new DrawingBoardScene();
        this.scene.transform.translateSelf(100, 50);
        this.scene.transform.scaleSelf(4, 4);
        this.scene.refresh();

        this.drawingsTabEditor = new DrawingsTabEditor(this);
        
        function preSave() {
            drawingToContext.forEach((rendering, drawing) => drawing.data = rendering.canvas.toDataURL());
        }

        setActionHandler("sidebar/save", () => {
            preSave();
            const json = JSON.stringify(this.projectData);
            localStorage.setItem("flicksy/test", json);
        });

        setActionHandler("publish/export/data", () => {
            preSave();
            saveAs(textToBlob(JSON.stringify(this.projectData)), "project.flicksy.json");
        });

        setActionHandler("project/new", () => {
            const data = JSON.parse(JSON.stringify(EMPTY_PROJECT_DATA));
            data.details.id = nanoid();

            this.setProjectData(data);
        });

        const nameInput = /** @type {HTMLInputElement} */ (ONE('[data-path="project/name"]'));
        nameInput.addEventListener("input", () => this.projectData.details.name = nameInput.value);

        const json = localStorage.getItem("flicksy/test") || ONE("#project-data").innerHTML;
        const data = JSON.parse(json);
        await this.setProjectData(data);
    }

    refresh() {
        /** @type {HTMLInputElement} */ (ONE('[data-path="project/name"]')).value = this.projectData.details.name;

        ALL("#draw-color-palette div").forEach((element, i) => {
            if (i === 0) return;
            element.style.setProperty("background", this.projectData.details.palette[i]);
        });
    }
}

const editor = new FlicksyEditor();
