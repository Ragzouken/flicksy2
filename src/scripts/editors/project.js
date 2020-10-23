class ProjectTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;

        this.projectNameInput = elementByPath("project/name", "input");
        this.projectNameInput.addEventListener("input", () => {
            this.flicksyEditor.projectData.details.name = this.projectNameInput.value;
        });
      
        setActionHandler("project/new", () => {
            const data = JSON.parse(JSON.stringify(EMPTY_PROJECT_DATA));
            data.details.id = nanoid();
            this.flicksyEditor.setProjectData(data);
        });

        setActionHandler("project/open", async () => {
            const [file] = await pickFiles(".flicksy.json,.html");
            const text = await textFromFile(file);

            if (file.name.endsWith(".flicksy.json")) {
                const data = /** @type {FlicksyDataProject} */ (JSON.parse(text));
                await this.flicksyEditor.setProjectData(data);
            } else if (file.name.endsWith(".html")) {
                const html = await htmlFromText(text);
                const json = ONE("#project-data", html).innerHTML;
                const data = /** @type {FlicksyDataProject} */ (JSON.parse(json));
                await this.flicksyEditor.setProjectData(data);
            }
        });

        setActionHandler("project/export/data", async () => {
            await this.flicksyEditor.prepareSave();
            const name = this.flicksyEditor.projectData.details.name + ".flicksy.json";
            const blob = textToBlob(JSON.stringify(this.flicksyEditor.projectData));
            saveAs(blob, name);
        });

        setActionHandler("project/export/html", async () => {
            await this.flicksyEditor.prepareSave();
            const name = this.flicksyEditor.projectData.details.name + ".html";
            const json = JSON.stringify(this.flicksyEditor.projectData);
            ONE("#project-data").innerHTML = json;
            
            const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
            const blob = textToBlob(clone.outerHTML, "text/html");
            saveAs(blob, name);
        });
    }

    refresh() {
        this.projectNameInput.value = this.flicksyEditor.projectData.details.name;
    }
}