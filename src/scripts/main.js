class FlicksyEditor {
    constructor() {
        this.projectData = EMPTY_PROJECT_DATA;
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

        this.scene = new DrawingBoardScene();
        this.scene.transform.translateSelf(100, 50);
        this.scene.transform.scaleSelf(4, 4);
        this.scene.refresh();

        this.sidebarTabs = document.getElementById("menu-buttons");
        this.projectTabEditor = new ProjectTabEditor(this);
        this.drawingsTabEditor = new DrawingsTabEditor(this);

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
        drawingToContext.forEach((rendering, drawing) => drawing.data = rendering.canvas.toDataURL());
    }
}

const editor = new FlicksyEditor();
