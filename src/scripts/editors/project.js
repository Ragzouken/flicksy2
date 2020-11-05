class ProjectTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.scene = ONE("#manual");

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
            const name = this.flicksyEditor.projectData.details.name + ".html";
            const json = JSON.stringify(this.flicksyEditor.projectData);
            const dataElement = ONE("#project-data");
            dataElement.innerHTML = json;
            
            const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
            ALL("[data-empty]", clone).forEach(removeAllChildren);
            ONE("#sidebar", clone).hidden = true;
            ONE("body", clone).setAttribute("data-play", "true");
            ONE("title", clone).innerHTML = this.flicksyEditor.projectData.details.name;
            ALL("[data-editor-only]", clone).forEach((element) => element.remove());
            
            return clone.outerHTML;
        }

        setActionHandler("project/export/html", async () => {
            const blob = textToBlob(await projectToHTML(), "text/html");
            saveAs(blob, name);
        });

        setActionHandler("project/publish/neocities/start", async () => {
            const openButton = elementByPath("project/publish/neocities/open", "button");
            openButton.disabled = true;

            const ready = new Promise((resolve, reject) => {
                const remove = listen(window, "message", (event) => {
                    if (event.origin !== "https://kool.tools") return;
                    remove();
                    resolve();
                });
            });

            const success = new Promise((resolve, reject) => {
                const remove = listen(window, "message", (event) => {
                    if (event.origin !== "https://kool.tools") return;

                    if (event.data.error) {
                        remove();
                        reject(event.data.error);
                    } else if (event.data.url) {
                        remove();
                        resolve(event.data.url);
                    }
                });
            });

            const popup = window.open(
                "https://kool.tools/neocities-publisher/index.html", 
                "neocities publisher",
                "left=10,top=10,width=320,height=320");
            const name = this.flicksyEditor.projectData.details.name;
            const html = await projectToHTML();
            await ready;
            popup.postMessage({ name, html }, "https://kool.tools");
            const url = await success;
            popup.close();
            openButton.disabled = false;
            setActionHandler("project/publish/neocities/open", () => window.open(url));
        });
    }

    refresh() {
        this.projectNameInput.value = this.flicksyEditor.projectData.details.name;
    }

    show() {
        this.scene.hidden = false;
    }

    hide() {
        this.scene.hidden = true;
    }
}
