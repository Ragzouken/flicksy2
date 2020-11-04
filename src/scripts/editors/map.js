class MapTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.selectedScene = undefined;

        this.mode = /** @type {"move" | "pick"} */ ("move");
        this.onScenePicked = undefined;
        this.grabbing = false;

        this.scene = new PanningScene(ONE("#map-scene"));

        this.startSceneLabel = elementByPath("map/start", "input");
        this.nameInput = elementByPath("map/selected/name", "input");
        this.nameInput.addEventListener("input", () => {
            if (!this.selectedScene) return;
            this.selectedScene.name = this.nameInput.value;
        });

        document.addEventListener("pointermove", (event) => this.refreshCursors(event));

        setActionHandler("map/add/blank", async () => {
            const scene = {
                id: nanoid(),
                name: "unnamed scene",
                position: { x: 0, y: 0, z: 0 },
                objects: [],
            };
            this.flicksyEditor.projectData.scenes.push(scene);
            await initSceneInEditor(this, scene);
            this.setSelectedScene(scene);
        });

        setActionHandler("map/selected/raise", () => {
            if (!this.selectedScene) return;
            const canvas = sceneToPreviewRendering.get(this.selectedScene).canvas;
            this.selectedScene.position.z += 1;
            canvas.style.setProperty("z-index", this.selectedScene.position.z.toString());
        });

        setActionHandler("map/selected/lower", () => {
            if (!this.selectedScene) return;
            const canvas = sceneToPreviewRendering.get(this.selectedScene).canvas;
            this.selectedScene.position.z -= 1;
            canvas.style.setProperty("z-index", this.selectedScene.position.z.toString());
        });

        setActionHandler("map/selected/edit", () => {
            this.flicksyEditor.sceneTabEditor.setActiveScene(this.flicksyEditor.projectData, this.selectedScene);
            switchTab("sidebar/scene");
        });

        setActionHandler("map/selected/duplicate", async () => {
            function duplicateObject(object) {
                const copy = JSON.parse(JSON.stringify(object));
                copy.id = nanoid();
                return copy;
            }

            const original = this.selectedScene;
            const { x, y, z } = original.position;
            const copy = {
                id: nanoid(),
                name: original.name + " copy",
                position: { x: x+8, y: y+8, z: z+1 },
                objects: original.objects.map(duplicateObject),
            };
            this.flicksyEditor.projectData.scenes.push(copy);
            await initSceneInEditor(this, copy);

            this.setSelectedScene(copy);
        });

        setActionHandler("map/selected/delete", () => {
            const scene = this.selectedScene;
            this.setSelectedScene(undefined);
            const canvas = sceneToPreviewRendering.get(scene).canvas;
            canvas.remove();
            removeItemFromArray(scene, this.flicksyEditor.projectData.scenes);
        });

        setActionHandler("map/pick-starting-scene", async () => {
            try {
                const scene = await this.flicksyEditor.pickScene({
                    heading: "pick starting scene",
                    prompt: "pick the scene to start in when the page first loads",
                    allowNone: false,
                    onCancel: undefined, onPicked: undefined,
                })
                this.flicksyEditor.projectData.state.scene = scene.id;
                this.startSceneLabel.value = scene.name;
            } catch(e) {}
        });

        setActionHandler("map/regenerate-previews", async () => {
            this.flicksyEditor.projectData.scenes.forEach((scene) => {
                const render = renderScenePreview(this.flicksyEditor.projectManager, scene);
                const preview = sceneToPreviewRendering.get(scene);
                copyRendering2D(render, preview);
            });
        });

        setActionHandler("map/selected/play", () => {
            switchTab("sidebar/play");
            this.flicksyEditor.playTab.restart(this.selectedScene.id);
        });
    }

    reframe() {
        const pairs = Array.from(sceneToPreviewRendering.entries());
        const rects = pairs.map(([scene, rendering]) => {
            const { x, y } = scene.position;
            const { width, height } = rendering.canvas;
            return new DOMRect(x, y, width/2, height/2);
        });
        const bounds = boundRects(rects, new DOMRect(0, 0, 160, 100));
        padRect(bounds, 8);
        this.scene.frameRect(bounds);
    }

    /** @param {FlicksyDataProject} project */
    async reloadFromProject(project) {
        const startId = project.state.scene;
        const startScene = getSceneById(project, startId);
        this.startSceneLabel.value = startScene.name;

        sceneToPreviewRendering.clear();
        removeAllChildren(this.scene.container);
        await Promise.all(project.scenes.map((scene) => initSceneInEditor(this, scene)));
    }

    /** @param {FlicksyDataScene} scene */
    setSelectedScene(scene) {
        if (this.selectedScene)
            sceneToPreviewRendering.get(this.selectedScene).canvas.classList.toggle("selected", false);

        this.selectedScene = scene;

        elementByPath("map/selected", "div").hidden = scene === undefined;

        if (this.selectedScene) {
            const rendering =  sceneToPreviewRendering.get(this.selectedScene);
            rendering.canvas.classList.toggle("selected", true);
            this.nameInput.value = this.selectedScene.name;
        }
    }

    /** @param {FlicksyDataScene} scene */
    pickScene(scene) {
        this.mode = "move";
        this.onScenePicked(scene);
    }

    show() {
        this.scene.hidden = false;
        this.reframe();
    }

    hide() {
        this.scene.hidden = true;
    }

    refreshCursors(event) {
        if (this.grabbing) document.body.style.setProperty("cursor", "grabbing");
        else document.body.style.removeProperty("cursor");
    }
}

/** * @param {PointerEvent} event */
function trackGesture(event) {
    const emitter = new EventEmitter();
    const pointer = event.pointerId;

    const removes = [
        listen(document, "pointerup", (event) => {
            if (event.pointerId === pointer) {
                removes.forEach((remove) => remove());
                emitter.emit("pointerup", event);
            }
        }),
        listen(document, "pointermove", (event) => {
            if (event.pointerId === pointer) emitter.emit("pointermove", event);
        }),
    ];

    return emitter;
}

/** @type {Map<FlicksyDataScene, CanvasRenderingContext2D>} */
const sceneToPreviewRendering = new Map();

/**
 * @param {MapTabEditor} mapEditor
 * @param {FlicksyDataScene} scene
 */
async function initSceneInEditor(mapEditor, scene) {
    const rendering = renderScenePreview(mapEditor.flicksyEditor.projectManager, scene);
    sceneToPreviewRendering.set(scene, rendering);

    rendering.canvas.classList.toggle("object", true);
    mapEditor.scene.container.appendChild(rendering.canvas);
    const object = new DragObjectTest(mapEditor.scene, rendering.canvas);

    rendering.canvas.style.setProperty("z-index", scene.position.z.toString());

    object.transform.e = scene.position.x;
    object.transform.f = scene.position.y;
    object.transform.scaleSelf(.5);
    object.refresh();

    let hovered = undefined;
    
    function refreshCursors(event) {
        const cursor = mapEditor.grabbing
                     ? "grabbing"
                     : mapEditor.mode === "move"
                     ? "grab"
                     : "pointer";
        rendering.canvas.style.setProperty("cursor", cursor);
    }

    object.element.addEventListener("dblclick", (event) => {
        killEvent(event);
        editor.sceneTabEditor.setActiveScene(editor.projectData, scene);
        switchTab("sidebar/scene");
    })

    function startDrag(event) {
        mapEditor.setSelectedScene(scene);
        mapEditor.grabbing = true;

        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = this.scene.mouseEventToSceneTransform(event);
        const grab = mouse.invertSelf().multiplySelf(object.transform);

        const drag = trackGesture(event);
        drag.on("pointermove", (event) => {
            // preserve the relationship between mouse and element
            // D2 = M2 . G (drawing relative to scene)
            const mouse = this.scene.mouseEventToSceneTransform(event);
            object.transform = mouse.multiply(grab);
            snap(object.transform);
            object.refresh();

            scene.position.x = object.transform.e;
            scene.position.y = object.transform.f;
        });
        drag.on("pointerup", (event) => mapEditor.grabbing = false);
    }

    object.element.addEventListener("pointerdown", (event) => {
        killEvent(event);
        if (mapEditor.mode === "pick") mapEditor.pickScene(scene);
        else startDrag(event);
        refreshCursors(event);
    });

    object.element.addEventListener("pointerenter", (event) => {
        killEvent(event);
        hovered = true;
        refreshCursors(event);
    });

    object.element.addEventListener("pointerout", (event) => {
        killEvent(event);
        refreshCursors(event);
    });

    document.addEventListener("pointermove", (event) => {
        if (mapEditor.scene.hidden) return;
        refreshCursors(event);
    });
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
