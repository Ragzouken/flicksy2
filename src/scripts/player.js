const CONT_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAAXNSR0IArs4c6QAAADNJREFUCJmNzrENACAMA0E/++/8NAhRBEg6yyc5SePUoNqwDICnWP04ww1tWOHfUqqf1UwGcw4T9WFhtgAAAABJRU5ErkJggg==";
const STOP_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAAXNSR0IArs4c6QAAACJJREFUCJljZICC/////2fAAhgZGRn////PwIRNEhsYCgoBIkQHCf7H+yAAAAAASUVORK5CYII="
const CURSOR_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAXCAYAAADtNKTnAAAAmklEQVQ4T+2UURKAIAhE83CcmsPV4Aihkq5O/dVXo/BmF1fTEXzMfMoyEaVov13rigRARLmOmSHQD+lHPZ2JtoxOagrxJ/UEXIK0QFW3DRGg5ihpOjWhQdh88ML/DAlkDtNeFBiwgrioI1fmhpRGUwN3l0JRZYP1tlZA70N2bVVKdiCWk9b/ymy+haC2/NMZPsSIJQiCZEVv8QUbvb1oFvm1hQAAAABJRU5ErkJggg==";

class FlicksyPlayer {
    constructor() {
        this.events = new EventEmitter();

        this.projectManager = new FlicksyProjectManager();

        // view is twice scene resolution, for text rendering
        this.viewRendering = createRendering2D(160*2, 100*2);
        this.sceneRendering = createRendering2D(160, 100);

        this.dialoguePlayer = new DialoguePlayer();

        /** @type {Map<string, Vector2>} */
        this.drawingIdToPivot = new Map();

        // an awaitable that generates a new promise that resolves once no dialogue is active
        /** @type {PromiseLike<void>} */
        this.dialogueWaiter = {
            then: (resolve, reject) => {
                if (this.dialoguePlayer.active) {
                    return this.dialoguePlayer.events.wait("done").then(resolve, reject);
                } else {
                    resolve();
                }
            },
        };
    }

    async load() {
        await this.dialoguePlayer.load();

        this.cursor = await loadImage(CURSOR_DATA);
        this.mouse = undefined;

        let prev;
        const timer = (next) => {
            prev ||= Date.now();
            this.update((next - prev) / 1000.);
            prev = next;
            window.requestAnimationFrame(timer);
        }
        timer();
    }

    stop() {
        this.gameState = undefined;
    }

    restart(startScene = undefined) {
        this.projectManager.copyFromManager(editor.projectManager);

        // make copies of drawings from editor
        this.drawingIdToPivot.clear();
        editor.projectData.drawings.forEach((drawing) => {
            this.drawingIdToPivot.set(drawing.id, { ...drawing.pivot });
        });

        // set initial game state
        /** @type {FlicksyPlayState} */
        this.gameState = {
            currentScene: startScene || editor.projectData.details.start,
            cursor: editor.projectData.details.cursor,
            variables: {},
        };

        this.log("[restarted]");
    }

    log(text) {
        this.events.emit("log", text);
    }

    update(dt) {
        if (!this.gameState) return;

        if (this.dialoguePlayer.active) {
            this.dialoguePlayer.update(dt);
        }
        this.render();
    }

    render() {
        // clear to black, then render objects in depth order
        fillRendering2D(this.sceneRendering, 'black');
        const scene = getSceneById(this.projectManager.projectData, this.gameState.currentScene);
        const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z);
        objects.forEach((object) => {
            if (object.hidden) return;

            const canvas = this.projectManager.drawingIdToRendering.get(object.drawing).canvas;
            const { x, y } = object.position;
            this.sceneRendering.drawImage(canvas, x, y);
        });

        if (this.mouse && this.gameState.cursor) {
            const { x, y } = this.mouse;
            const { x: px, y: py } = this.drawingIdToPivot.get(this.gameState.cursor);
            const cursor = this.projectManager.drawingIdToRendering.get(this.gameState.cursor);
            this.sceneRendering.drawImage(cursor.canvas, x/2-px, y/2-py);
        }

        // copy scene to view at 2x scale
        this.viewRendering.drawImage(this.sceneRendering.canvas, 0, 0, 160*2, 100*2);

        // render dialogue box if necessary
        if (this.dialoguePlayer.active) {
            const dw = this.dialoguePlayer.dialogueRendering.canvas.width;
            const dh = this.dialoguePlayer.dialogueRendering.canvas.height;
            const x = (160*2-dw)/2;
            const y = (100+(100-dh)/2);

            this.dialoguePlayer.render();
            this.viewRendering.drawImage(this.dialoguePlayer.dialogueRendering.canvas, x, y);
        }
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    isInteractableHovered(x, y) {
        this.mouse = { x, y, };
        const object = this.pointcast(x, y);
        return object !== undefined && isObjectInteractable(object);
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    click(x, y) {
        if (this.dialoguePlayer.active) {
            this.dialoguePlayer.skip();
        } else {
            const object = this.pointcast(x, y);
            if (object) this.runObjectBehaviour(object);
        }
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    pointcast(x, y) {
        x /= 2; y /= 2;
        const scene = getSceneById(this.projectManager.projectData, this.gameState.currentScene);
        return pointcastScene(this.projectManager, scene, { x, y }, true);
    }

    /** @param {string} sceneId */
    changeScene(sceneId) {
        this.gameState.currentScene = sceneId;
        this.events.emit("next-scene", sceneId);
    }

    /** @param {FlicksyDataObject} object */
    async runObjectBehaviour(object) { 
        if (object.behaviour.script) {
            const scene = getSceneById(this.projectManager.projectData, this.gameState.currentScene);
            const defines = generateScriptingDefines(this, this.gameState, scene, object);
            const names = Object.keys(defines).join(", ");
            const preamble = `const { ${names} } = COMMANDS;\n`;

            try {
                const script = new AsyncFunction("COMMANDS", preamble + object.behaviour.script);
                await script(defines);
            } catch (e) {
                this.log(`SCRIPT ERROR in OBJECT '${object.name}' of SCENE '${scene.name}'\n${e}`);
            }
        }

        if (object.behaviour.dialogue) {
            this.dialoguePlayer.queueScript(object.behaviour.dialogue);
        }

        await this.dialogueWaiter;

        if (object.behaviour.destination) {
            this.changeScene(object.behaviour.destination);
        }
    }
}

class DialoguePlayer {
    get active() {
        return this.currentPage !== undefined;
    }

    get currentGlyph() {
        return this.currentPage ? this.currentPage[this.showGlyphCount] : undefined;
    } 

    constructor() {
        this.events = new EventEmitter();
        this.dialogueRendering = createRendering2D(8, 8);
        this.restart();
    }

    async load() {
        this.font = await loadBasicFont(/** @type {HTMLScriptElement} */ (ONE("#font-data")));
        this.contIcon = await loadImage(CONT_ICON_DATA);
        this.stopIcon = await loadImage(STOP_ICON_DATA);
    }

    restart() {
        this.showCharTime = .05;
        /** @type {BlitsyPage[]} */
        this.queuedPages = [];

        this.setPage(undefined);
    }

    /** @param {BlitsyPage} page */
    setPage(page) {
        this.currentPage = page;
        this.pageTime = 0;
        this.showGlyphCount = 0;
        this.showGlyphElapsed = 0;
        this.pageGlyphCount = page ? page.length : 0;

        if (page !== undefined) {
            this.events.emit("next-page", page);
        } else {
            this.events.emit("done");
        }
    }

    /** @param {number} dt */
    update(dt) {
        if (!this.currentPage)
            return;

        this.pageTime += dt;
        this.showGlyphElapsed += dt;

        this.applyStyle();

        while (this.showGlyphElapsed > this.showCharTime && this.showGlyphCount < this.pageGlyphCount) {
            this.showGlyphElapsed -= this.showCharTime;
            this.revealNextChar();
            this.applyStyle();
        }
    }

    render() {
        const padding = 8;
        const lines = 3;
        const height = ((lines + 1) * 4) + this.font.lineHeight * lines + 15;
        const width = 256;

        resizeRendering2D(this.dialogueRendering, width, height);
        fillRendering2D(this.dialogueRendering, "#222222");
        const render = renderPage(this.currentPage, width, height, padding, padding);
        this.dialogueRendering.drawImage(render.canvas, 0, 0);

        if (this.showGlyphCount === this.pageGlyphCount) {
            const prompt = this.queuedPages.length > 0 
                         ? this.contIcon 
                         : this.stopIcon;
            this.dialogueRendering.drawImage(prompt, width-padding-prompt.width, height-4-prompt.height);
        }
    }

    revealNextChar() {
        this.showGlyphCount = Math.min(this.showGlyphCount + 1, this.pageGlyphCount);
        
        if (!this.currentPage) return;

        this.currentPage.forEach((glyph, i) => {
            if (i < this.showGlyphCount) glyph.hidden = false;
        });
    }

    revealAll() {
        if (!this.currentPage) return;

        this.showGlyphCount = this.currentPage.length;
        this.revealNextChar();
    }

    cancel() {
        this.queuedPages.length = 0;
        this.currentPage = undefined;
    }

    skip() {
        if (this.showGlyphCount === this.pageGlyphCount) {
            this.moveToNextPage();
        } else {
            this.showGlyphCount = this.pageGlyphCount;

            if (this.currentPage)
                this.currentPage.forEach((glyph) => glyph.hidden = false);
        }
    }

    moveToNextPage() {
        const nextPage = this.queuedPages.shift();
        this.setPage(nextPage);
    }

    queueScript(script) {
        const pages = scriptToPages(script, { font: this.font, lineWidth: 240, lineCount: 3 });
        this.queuedPages.push(...pages);
        
        if (!this.currentPage)
            this.moveToNextPage();
    
        const last = pages[pages.length - 1];
        return new Promise((resolve) => {
            const remove = this.events.on("next-page", (page) => {
                if (page !== last && !this.queuedPages.includes(last)) {
                    remove();
                    resolve();
                }
            });
        });
    }

    applyStyle() {
        if (!this.currentPage) return;

        if (this.currentGlyph) {
            if (this.currentGlyph.styles.has("delay")) {
                this.showCharTime = parseFloat(this.currentGlyph.styles.get("delay"));
            } else {
                this.showCharTime = .05;
            }
        }

        this.currentPage.forEach((glyph, i) => {
            if (glyph.styles.has("r"))
                glyph.hidden = false;
            if (glyph.styles.has("clr"))
                glyph.fillStyle = glyph.styles.get("clr");
            if (glyph.styles.has("shk")) 
                glyph.offset = { x: randomInt(-1, 1), y: randomInt(-1, 1) };
            if (glyph.styles.has("wvy"))
                glyph.offset.y = (Math.sin(i + this.pageTime * 5) * 3) | 0;
        });
    }
}

/** 
 * @param {FlicksyProjectManager} projectManager
 * @param {FlicksyDataScene} scene
 * @param {number} scale
 */
function renderScene(projectManager, scene, scale = 2) {
    const sceneRendering = createRendering2D(160 * scale, 100 * scale);
    fillRendering2D(sceneRendering, 'black');
    const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z);
    objects.forEach((object) => {
        if (object.hidden) return;

        const canvas = projectManager.drawingIdToRendering.get(object.drawing).canvas;

        sceneRendering.drawImage(
            canvas,
            object.position.x * scale, 
            object.position.y * scale, 
            canvas.width * scale, 
            canvas.height * scale,
        );
    });

    return sceneRendering;
}

/** 
 * @param {FlicksyProjectManager} projectManager
 * @param {FlicksyDataScene} scene
 * @param {number} scale
 */
function renderScenePreview(projectManager, scene, scale = 2) {
    const sceneRendering = renderScene(projectManager, scene, scale);

    const font = editor.playTab.player.dialoguePlayer.font;
    const page = scriptToPages(scene.name, { font, lineCount: 1, lineWidth: 160*scale-4 })[0];
    page.forEach((glyph) => glyph.hidden = false);
    const render = renderPage(page, 160, 20, 2, 2);
    sceneRendering.fillRect(0, 0, 4+8*scene.name.length, 4+13);
    sceneRendering.drawImage(render.canvas, 0, 0);

    return sceneRendering;
}

/**
 * @param {FlicksyProjectManager} projectManager
 * @param {FlicksyDataScene} scene
 * @param {Vector2} point
 * @returns {FlicksyDataObject}
 */
function pointcastScene(projectManager, scene, point, onlyVisible = false) {
    const { x: sx, y: sy } = point;

    const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z).reverse();
    for (let object of objects) {
        if (object.hidden && onlyVisible) continue;

        const drawing = getDrawingById(projectManager.projectData, object.drawing);
        const rendering = projectManager.drawingIdToRendering.get(drawing.id);

        const { x, y } = object.position;
        const { width, height } = rendering.canvas;
        const rect = { x, y, width, height };

        if (rectContainsPoint(rect, point)) {
            const [ cx, cy ] = [ sx - object.position.x, sy - object.position.y ];
            const alpha = rendering.getImageData(cx, cy, 1, 1).data[3];
            if (alpha !== 0) return object;
        }
    }
}

/**
 * @param {FlicksyPlayer} player 
 * @param {FlicksyPlayState} state 
 * @param {FlicksyDataScene} scene 
 * @param {FlicksyDataObject} object 
 */
function generateScriptingDefines(player, state, scene, object) {
    const objectFromId = (id) => {
        const object = getObjectById(player.projectManager.projectData, id);
        if (object === undefined) throw new Error(`NO OBJECT ${id}`);
        return object;
    }

    // edit here to add new scripting functions
    const defines = {};
    
    defines.OBJECT = object.id;
    defines.SCENE = scene.id;
    defines.VARS = state.variables;

    defines.LOG = (text) => player.log(text);
    defines.SET = (key, value) => state.variables[key] = value;
    defines.GET = (key, fallback=0) => state.variables[key] || fallback;

    defines.TRANSFORM = (object, drawing) => objectFromId(object).drawing = drawing;
    defines.TRAVEL = (scene) => player.changeScene(scene);
    
    defines.HIDE = (object) => objectFromId(object).hidden = true;
    defines.SHOW = (object) => objectFromId(object).hidden = false;

    defines.SAY = async (dialogue) => player.dialoguePlayer.queueScript(dialogue);
    defines.DELAY = async (seconds) => sleep(seconds * 1000);
    defines.DIALOGUE = player.dialogueWaiter;
    defines.DIALOG = defines.DIALOGUE;

    return defines;
}
