class ProjectTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.scene = ONE("#manual");

        this.doubleResolutionButton = elementByPath("project/double-resolution", "button");
        setActionHandler("project/toggle-double-resolution", () => {
            const details = this.flicksyEditor.projectData.details;
            details.doubleResolution = !details.doubleResolution;
            this.doubleResolutionButton.classList.toggle("active", details.doubleResolution);
            document.getElementById("content").classList.toggle("double-resolution", details.doubleResolution);

            invokeAction("map/regenerate-previews");
        });

        this.doubleDialogueButton = elementByPath("project/double-dialogue", "button");
        setActionHandler("project/toggle-double-dialogue", () => {
            const details = this.flicksyEditor.projectData.details;
            details.doubleDialogue = !details.doubleDialogue;
            this.doubleDialogueButton.classList.toggle("active", details.doubleDialogue);
            document.getElementById("content").classList.toggle("double-dialogue", details.doubleDialogue);
        });

        this.projectNameInput = elementByPath("project/name", "input");
        this.projectNameInput.addEventListener("input", () => {
            this.flicksyEditor.projectData.details.name = this.projectNameInput.value;
        });
      
        setActionHandler("project/new", () => {
            const data = JSON.parse(JSON.stringify(EMPTY_PROJECT_DATA));
            data.details.id = nanoid();
            this.flicksyEditor.setProjectData(data);
        });

        setActionHandler("project/demo", () => {
            const data = JSON.parse(ONE("#project-data").innerHTML);
            data.details.id = nanoid();
            this.flicksyEditor.setProjectData(data);
        });

        setActionHandler("project/open", async () => {
            const [file] = await pickFiles(".flicksy2.json,.html");
            const text = await textFromFile(file);

            if (file.name.endsWith(".flicksy2.json")) {
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
            const name = this.flicksyEditor.projectData.details.name + ".flicksy2.json";
            const blob = textToBlob(JSON.stringify(this.flicksyEditor.projectData));
            saveAs(blob, name);
        });

        const projectToHTML = async () => {
            await this.flicksyEditor.prepareSave();
            const clone = createStandalonePlayer(this.flicksyEditor.projectData);
            return clone.outerHTML;
        }

        setActionHandler("project/export/html", async () => {
            const name = this.flicksyEditor.projectData.details.name + ".html";
            const blob = textToBlob(await projectToHTML(), "text/html");
            saveAs(blob, name);
        });

        setActionHandler("project/publish/neocities/start", async () => {
            const openButton = elementByPath("project/publish/neocities/open", "button");
            openButton.disabled = true;

            const name = this.flicksyEditor.projectData.details.name;
            const html = await projectToHTML();
            const url = await runNeocitiesPublish({ name, html });
            
            openButton.disabled = false;
            setActionHandler("project/publish/neocities/open", () => window.open(url));
        });
    }

    refresh() {
        const details = this.flicksyEditor.projectData.details;
        this.projectNameInput.value = details.name;

        const double = !!details.doubleResolution;
        this.doubleResolutionButton.classList.toggle("active", double);
        document.getElementById("content").classList.toggle("double-resolution", double);
    }

    show() {
        this.scene.hidden = false;
    }

    hide() {
        this.scene.hidden = true;
    }
}

/** @param {FlicksyDataProject} projectData */
function createStandalonePlayer(projectData) {
    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    ALL("[data-empty]", clone).forEach(removeAllChildren);
    ALL("[data-editor-only]", clone).forEach((element) => element.remove());
    ONE("body", clone).setAttribute("data-play", "true");
    ONE("title", clone).innerHTML = projectData.details.name;
    ONE("#project-data", clone).innerHTML = JSON.stringify(projectData);
    return clone;
}
