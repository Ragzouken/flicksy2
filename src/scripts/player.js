const CONT_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAAXNSR0IArs4c6QAAADNJREFUCJmNzrENACAMA0E/++/8NAhRBEg6yyc5SePUoNqwDICnWP04ww1tWOHfUqqf1UwGcw4T9WFhtgAAAABJRU5ErkJggg==";
const STOP_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAAXNSR0IArs4c6QAAACJJREFUCJljZICC/////2fAAhgZGRn////PwIRNEhsYCgoBIkQHCf7H+yAAAAAASUVORK5CYII="

class FlicksyPlayer {
    constructor() {
        this.viewRendering = createRendering2D(160*2, 100*2);
        this.sceneRendering = createRendering2D(160, 100);

        this.dialoguePlayer = new DialoguePlayer();

        /** @type {Map<string, CanvasRenderingContext2D>} */
        this.drawingIdToRendering = new Map();
        /** @type {Map<string, FlicksyDataScene>} */
        this.sceneIdToScene = new Map();

        this.logText = elementByPath("play/log", "textarea");
    }

    async load() {
        await this.dialoguePlayer.load();

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
        // make copies of drawings from editor
        this.drawingIdToRendering.clear();
        editor.projectData.drawings.forEach((drawing) => {
            const rendering = editor.drawingsManager.getRendering(drawing);
            const copy = copyRendering2D(rendering);
            this.drawingIdToRendering.set(drawing.id, copy);
        });

        // make copies of scenes from editor
        this.sceneIdToScene.clear();
        editor.projectData.scenes.forEach((scene) => {
            this.sceneIdToScene.set(scene.id, JSON.parse(JSON.stringify(scene)));
        });

        // set initial game state
        this.gameState = {
            currentScene: startScene || editor.projectData.details.start,
            nextScene: undefined,
            runningScript: false,
            variables: {},
        };

        this.logText.value = "";
    }

    log(text) {
        this.logText.value += text + "\n";
        this.logText.scrollTo(0, this.logText.scrollHeight);
    }

    update(dt) {
        if (!this.gameState) return;

        if (this.dialoguePlayer.active) {
            this.dialoguePlayer.update(dt);
        } else if (this.gameState.nextScene) {
            this.gameState.currentScene = this.gameState.nextScene;
            this.gameState.nextScene = undefined;
        }
        this.render();
    }

    render() {
        const scene = this.sceneIdToScene.get(this.gameState.currentScene);

        fillRendering2D(this.sceneRendering, 'black');
        const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z);
        objects.forEach((object) => {
            if (object.hidden) return;

            const canvas = this.drawingIdToRendering.get(object.drawing).canvas;
            this.sceneRendering.drawImage(
                canvas,
                object.position.x, 
                object.position.y, 
                canvas.width, 
                canvas.height,
            );
        });

        this.viewRendering.drawImage(this.sceneRendering.canvas, 0, 0, 160*2, 100*2);

        const dw = this.dialoguePlayer.dialogueRendering.canvas.width;
        const dh = this.dialoguePlayer.dialogueRendering.canvas.height;
        const x = (160*2-dw)/2;
        const y = (100+(100-dh)/2);

        if (this.dialoguePlayer.active) {
            this.dialoguePlayer.render();
            this.viewRendering.drawImage(this.dialoguePlayer.dialogueRendering.canvas, x, y);
        }
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    doesHoveredObjectHaveBehaviour(x, y) {
        x /= 2;
        y /= 2;
        const scene = this.sceneIdToScene.get(this.gameState.currentScene);
        const object = pointcastScene(scene, { x, y }, true);

        return object !== undefined
            && (object.behaviour.destination.length + object.behaviour.dialogue.length + object.behaviour.script.length) > 0;
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    async click(x, y) {
        if (this.dialoguePlayer.active) {
            this.dialoguePlayer.skip();
            return;
        }

        x /= 2;
        y /= 2;
        const scene = this.sceneIdToScene.get(this.gameState.currentScene);
        const object = pointcastScene(scene, { x, y }, true);

        if (!object) return;

        if (object.behaviour.script) {
            const DONE_WAITER = {}
            DONE_WAITER.then = (resolve) => {
                const check = () => {
                    if (this.dialoguePlayer.currentPage === undefined) {
                        resolve();
                        clearInterval(handle);
                    }
                }
                const handle = setInterval(check, 50);
            };

            const objectFromId = (id) => {
                for (const scene of this.sceneIdToScene.values()) {
                    for (const object of scene.objects) {
                        if (object.id === id) return object;
                    }
                }

                throw new Error(`NO OBJECT ${id}`);
            }

            const DEFINES = {
                OBJECT: object.id,
                SCENE: scene.id,
                VARS: this.gameState.variables,
                LOG: (text) => this.log(text),

                TRANSFORM: (object, drawing) => objectFromId(object).drawing = drawing,
                TRAVEL: (scene) => this.gameState.currentScene = scene,
                SAY: (dialogue) => this.dialoguePlayer.queueScript(dialogue),
                DELAY: async (time) => new Promise((resolve) => setInterval(resolve, time * 1000)),

                HIDE: (object) => objectFromId(object).hidden = true,
                SHOW: (object) => objectFromId(object).hidden = false,

                SET: (key, value) => this.gameState.variables[key] = value,
                GET: (key) => this.gameState.variables[key],

                DIALOGUE: DONE_WAITER,
                DIALOG: DONE_WAITER,
            }

            const names = Object.keys(DEFINES).join(", ");
            const preamble = `const { ${names} } = COMMANDS;\n`;

            try {
                const script = new AsyncFunction("COMMANDS", preamble + object.behaviour.script);
                this.gameState.runningScript = true;
                await script(DEFINES);
            } catch (e) {
                this.gameState.runningScript = false;
                console.log(`SCRIPT ERROR in OBJECT '${object.name}' of SCENE '${scene.name}'`, e);
            }
        }

        if (object.behaviour.dialogue) {
            this.dialoguePlayer.queueScript(object.behaviour.dialogue);
        }

        if (object.behaviour.destination) {
            this.gameState.nextScene = object.behaviour.destination;
        }

        this.render();
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

        return new Promise((resolve) => {
            const last = pages[pages.length - 1];
            const handle = setInterval(() => {
                if (!this.queuedPages.includes(last) && this.currentPage !== last) {
                    clearInterval(handle);
                    resolve();
                }
            }, 50);
        });
    }

    applyStyle() {
        if (!this.currentPage) return;

        const current = this.currentGlyph;

        if (current) {
            if (current.styles.has("delay")) {
                this.showCharTime = parseFloat(current.styles.get("delay"));
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
 * @param {FlicksyDataScene} scene
 * @param {number} scale
 */
function renderScene(scene, scale = 2) {
    const sceneRendering = createRendering2D(160 * scale, 100 * scale);
    fillRendering2D(sceneRendering, 'black');
    const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z);
    objects.forEach((object) => {
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

    const font = editor.playTab.player.dialoguePlayer.font;
    const page = scriptToPages(scene.name, { font, lineCount: 1, lineWidth: 160*scale-4 })[0];
    page.forEach((glyph) => glyph.hidden = false);
    const render = renderPage(page, 160, 20, 2, 2);
    sceneRendering.fillRect(0, 0, 4+8*scene.name.length, 4+13);
    sceneRendering.drawImage(render.canvas, 0, 0);

    return sceneRendering;
}

/**
 * @param {FlicksyDataScene} scene
 * @param {{ x: number, y: number }} point
 * @returns {FlicksyDataObject}
 */
function pointcastScene(scene, point, onlyVisible = false) {
    const { x: sx, y: sy } = point;

    const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z).reverse();
    for (let object of objects) {
        if (object.hidden && onlyVisible) continue;

        const drawing = editor.projectData.drawings.find((drawing) => drawing.id === object.drawing);
        const rendering = editor.drawingsManager.getRendering(drawing);

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
