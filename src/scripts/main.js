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

const toggleStates = new Map();
const actionHandlers = new Map();
const elementMap = {};
const pathToElement = new Map();

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {*} path 
 * @param {K} tagName
 * @returns {HTMLElementTagNameMap[K]}
 */
function elementByPath(path, tagName) {
    /** @type {HTMLElementTagNameMap[K]} */
    const element = pathToElement.get(path);
    if (element === undefined)
        throw Error(`No element at ${path}`);
    if (element.tagName.toLowerCase() !== tagName)
        throw Error(`Element at ${path} is ${element.tagName} not ${tagName}`);
    return element;
}

function setActionHandler(action, callback) {
    actionHandlers.set(action, callback);
}

function initui() {
    const toggles = ALL("[data-tab-toggle]");
    const bodies = ALL("[data-tab-body]");
    const buttons = ALL("[data-action]");
    
    const paths = ALL("[data-path]");
    paths.forEach((element) => {
        const path = element.getAttribute("data-path");
        pathToElement.set(path, element);
        const parts = path.split("/");

        let root = elementMap;
        while (parts.length > 1) {
            const part = parts.shift();
            const next = root[part] || {};
            root[part] = next;
            root = next;
        }
        root[parts.shift()] = element;
    });
    console.log(pathToElement);

    buttons.forEach((element) => {
        const action = element.getAttribute("data-action");

        element.addEventListener("click", (event) => {
            killEvent(event);
            const handler = actionHandlers.get(action);
            if (handler) handler();
        });
    })

    function setGroupActiveTab(group, tab) {
        toggleStates.set(group, tab);
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

        this.drawingsTabEditor = new DrawingsTabEditor(this);

        this.scene = new DrawingBoardScene();
        this.scene.transform.translateSelf(100, 50);
        this.scene.transform.scaleSelf(4, 4);
        this.scene.refresh();

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
