class SceneTabEditor {
    get isPicking() { return this.onObjectPicked !== undefined; }

    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        /** @type {FlicksyDataScene} */
        this.activeScene = undefined;
        /** @type {FlicksyDataObject} */
        this.selectedObject = undefined;

        this.onObjectPicked = undefined;
        this.grabbing = false;

        this.scene = new PanningScene(ONE("#scene-scene"));
        this.scene.refresh();

        this.sceneNameInput = elementByPath("scene/active/name", "input");

        this.objectNameInput = elementByPath("scene/selected/name", "input");
        this.objectNameInput.addEventListener("input", () => {
            if (!this.selectedObject) return;
            this.selectedObject.name = this.objectNameInput.value;
        });
        this.objectDrawingInput = elementByPath("scene/selected/drawing", "input");
        this.objectDialogueInput = elementByPath("scene/selected/dialogue", "textarea");
        this.objectDialogueInput.addEventListener("input", () => {
            if (!this.selectedObject) return;
            this.selectedObject.behaviour.dialogue = this.objectDialogueInput.value;
        });
        this.objectDestinationInput = elementByPath("scene/selected/destination", "input");
        this.objectScriptInput = elementByPath("scene/selected/script", "textarea");
        this.objectScriptInput.addEventListener("input", () => {
            if (!this.selectedObject) return;
            this.selectedObject.behaviour.script = this.objectScriptInput.value;
        });
        this.objectHiddenButton = elementByPath("scene/selected/hidden", "button");

        setActionHandler("scene/add/pick-drawing", async () => {
            try {
                const drawing = await this.flicksyEditor.pickDrawing({
                    heading: "pick object drawing",
                    prompt: "pick what this object looks like",
                    allowNone: false,
                    onCancel: undefined, onPicked: undefined,
                })
                const object = {
                    id: nanoid(),
                    name: "unnamed object",
                    position: { x: 0, y: 0, z: 0 },
                    drawing: drawing.id,
                    behaviour: { script: "", dialogue: "", destination: "" },
                    hidden: false,
                };
                this.activeScene.objects.push(object);
                await initObjectInEditor(this, object);
            } catch(e) {}
            switchTab("sidebar/scene");
        });

        setActionHandler("scene/pick-active", async () => {
            try {
                const scene = await this.flicksyEditor.pickScene({
                    heading: "pick a scene to edit",
                    prompt: "pick a scene to start editing",
                    allowNone: false,
                    onCancel: undefined, onPicked: undefined,
                })
                this.setActiveScene(this.flicksyEditor.projectData, scene);
            } catch(e) {}
            switchTab("sidebar/scene");
        });

        setActionHandler("scene/selected/pick-drawing", async () => {
            try {
                const drawing = await this.flicksyEditor.pickDrawing({
                    heading: "pick object drawing",
                    prompt: "pick what this object looks like",
                    allowNone: false,
                    onCancel: undefined, onPicked: undefined,
                })
                this.selectedObject.drawing = drawing.id;
                copyRendering2D(
                    this.flicksyEditor.projectManager.drawingIdToRendering.get(drawing.id),
                    objectToRendering.get(this.selectedObject),
                )
            } catch(e) {}
            switchTab("sidebar/scene");
        });

        setActionHandler("scene/selected/pick-destination", async () => {
            try {
                const scene = await this.flicksyEditor.pickScene({
                    heading: "pick destination scene",
                    prompt: "pick the scene to enter after clicking the object and finishing its dialogue",
                    allowNone: true,
                    onCancel: undefined, onPicked: undefined,
                })
                this.selectedObject.behaviour.destination = scene ? scene.id : "";
                this.setSelectedObject(this.selectedObject);
            } catch(e) {}
            switchTab("sidebar/scene");
        });

        setActionHandler("scene/selected/raise", () => {
            if (!this.selectedObject) return;
            const canvas = objectToRendering.get(this.selectedObject).canvas;
            this.selectedObject.position.z += 1;
            refreshObjectStyle(this.selectedObject, canvas);
        });

        setActionHandler("scene/selected/lower", () => {
            if (!this.selectedObject) return;
            const canvas = objectToRendering.get(this.selectedObject).canvas;
            this.selectedObject.position.z -= 1;
            refreshObjectStyle(this.selectedObject, canvas);
        });

        setActionHandler("scene/selected/toggle-hidden", () => {
            this.selectedObject.hidden = !this.selectedObject.hidden;
            const canvas = objectToRendering.get(this.selectedObject).canvas;
            refreshObjectStyle(this.selectedObject, canvas);
            this.objectHiddenButton.classList.toggle("active", this.selectedObject.hidden);
        });

        setActionHandler("scene/selected/duplicate", async () => {
            const original = this.selectedObject;
            const { x, y, z } = original.position;
            const copy = {
                id: nanoid(),
                name: original.name + " copy",
                position: { x: x+8, y: y+8, z: z+1 },
                drawing: original.drawing,
                behaviour: { ...original.behaviour },
                hidden: original.hidden,
            };
            this.activeScene.objects.push(copy);
            await initObjectInEditor(this, copy);

            this.setSelectedObject(copy);
        });

        setActionHandler("scene/selected/delete", () => {
            const object = this.selectedObject;
            this.setSelectedObject(undefined);
            const canvas = objectToRendering.get(object).canvas;
            canvas.remove();
            removeItemFromArray(object, this.activeScene.objects);
        });

        const makeReplacer = (initial) => {
            const start = this.objectScriptInput.selectionStart || 0;
            const end = this.objectScriptInput.selectionEnd || 0;
            return (text) => insertText(initial, text, start, end);
        }

        setActionHandler("scene/selected/script/reference/scene", async () => {
            const replacer = makeReplacer(this.selectedObject.behaviour.script);
            const selectedObject = this.selectedObject;
            try {
                const scene = await this.flicksyEditor.pickScene({
                    heading: "pick scene",
                    prompt: "pick a scene to reference in an object's script",
                    allowNone: true,
                });
                this.selectedObject.behaviour.script = replacer(`"${scene ? scene.id : ""}"`);
                this.objectScriptInput.value = this.selectedObject.behaviour.script;
            } catch (e) { console.log(e) }
            switchTab("sidebar/scene");
            this.setSelectedObject(selectedObject);
        });

        setActionHandler("scene/selected/script/reference/drawing", async () => {
            const replacer = makeReplacer(this.selectedObject.behaviour.script);
            const selectedObject = this.selectedObject;
            try {
                const drawing = await this.flicksyEditor.pickDrawing({
                    heading: "pick drawing",
                    prompt: "pick a drawing to reference in an object's script",
                    allowNone: true,
                });
                this.selectedObject.behaviour.script = replacer(`"${drawing ? drawing.id : ""}"`);
                this.objectScriptInput.value = this.selectedObject.behaviour.script;
            } catch (e) { console.log(e) }
            switchTab("sidebar/scene");
            this.setSelectedObject(selectedObject);
        });

        setActionHandler("scene/selected/script/reference/object", async () => {
            const replacer = makeReplacer(this.selectedObject.behaviour.script);
            const activeScene = this.activeScene;
            const selectedObject = this.selectedObject;
            
            try {
                const scene = await this.flicksyEditor.pickScene({
                    heading: "pick scene",
                    prompt: "pick the scene containing an object to reference in an object's script",
                    allowNone: false,
                });
                const object = await this.flicksyEditor.pickObject({
                    heading: "pick object",
                    prompt: "pick an object to reference in an object's script",
                    allowNone: false,
                }, scene);
                selectedObject.behaviour.script = replacer(`"${object ? object.id : ""}"`);
            } catch (e) { console.log(e) }
            switchTab("sidebar/scene");
            this.setActiveScene(this.flicksyEditor.projectData, activeScene);
            this.setSelectedObject(selectedObject);
        });

        setActionHandler("scene/active/play", () => {
            switchTab("sidebar/play");
            this.flicksyEditor.playTab.restart(this.activeScene.id);
        });
    }

    /** @param {FlicksyDataObject} object */
    setSelectedObject(object) {
        if (this.selectedObject)
            objectToRendering.get(this.selectedObject).canvas.classList.toggle("selected", false);

        this.selectedObject = object;

        elementByPath("scene/selected", "div").hidden = object === undefined;

        if (this.selectedObject) {
            const rendering =  objectToRendering.get(this.selectedObject);
            rendering.canvas.classList.toggle("selected", true);
            this.objectNameInput.value = this.selectedObject.name;

            this.objectDialogueInput.value = this.selectedObject.behaviour.dialogue;
            this.objectScriptInput.value = this.selectedObject.behaviour.script;
            const scene = getSceneById(this.flicksyEditor.projectData, this.selectedObject.behaviour.destination);
            this.objectDestinationInput.value = scene ? scene.name : "no change";

            const drawing = getDrawingById(this.flicksyEditor.projectData, this.selectedObject.drawing);
            this.objectDrawingInput.value = drawing.name;

            this.objectHiddenButton.classList.toggle("active", object.hidden === true);
        }
    }

    /** 
     * @param {FlicksyDataProject} project 
     * @param {FlicksyDataScene} scene
     */
    async setActiveScene(project, scene) {
        this.setSelectedObject(undefined);
        this.activeScene = scene;
        
        this.sceneNameInput.value = scene.name;

        objectToRendering.clear();
        removeAllChildren(this.scene.container);
        await Promise.all(scene.objects.map((object) => initObjectInEditor(this, object)));
        this.refreshDrawings();
    }

    show() {
        this.scene.hidden = false;
        this.reframe();
        this.setActiveScene(editor.projectData, this.activeScene);
    }

    hide() {
        if (!this.scene.hidden) {
            this.scene.hidden = true;
            copyRendering2D(
                renderScenePreview(this.flicksyEditor.projectManager, this.activeScene),
                sceneToPreviewRendering.get(this.activeScene),
            );
        }
    }

    reframe() {
        this.scene.frameRect(padRect(new DOMRect(0, 0, 160, 100), 8));
    }

    refreshDrawings() {
        this.activeScene.objects.forEach((object) => {
            const drawing = getDrawingById(this.flicksyEditor.projectData, object.drawing);
            const rendering = this.flicksyEditor.projectManager.drawingIdToRendering.get(drawing.id);
            copyRendering2D(rendering, objectToRendering.get(object));
        });
    }

    /** @param {FlicksyDataObject} object */
    pickObject(object) {
        if (this.onObjectPicked) {
            const onPicked = this.onObjectPicked;
            this.onObjectPicked = undefined;
            onPicked(object);
        }
    }
}

/**
 * @param {FlicksyDataObject} object 
 * @param {HTMLCanvasElement} canvas 
 */
function refreshObjectStyle(object, canvas) {
    canvas.style.setProperty("z-index", object.position.z.toString());
    canvas.style.setProperty("opacity", object.hidden ? "50%" : "100%");
    canvas.style.setProperty("transform", translationMatrix(object.position).toString());
}

/** @type {Map<FlicksyDataObject, CanvasRenderingContext2D>} */
const objectToRendering = new Map();

/**
 * @param {SceneTabEditor} sceneEditor
 * @param {FlicksyDataObject} object
 */
async function initObjectInEditor(sceneEditor, object) {
    const drawing = getDrawingById(sceneEditor.flicksyEditor.projectData, object.drawing);
    const rendering = copyRendering2D(editor.projectManager.drawingIdToRendering.get(drawing.id));
    objectToRendering.set(object, rendering);

    refreshObjectStyle(object, rendering.canvas);
    rendering.canvas.classList.toggle("object", true);
    sceneEditor.scene.container.appendChild(rendering.canvas);

    function refreshCursors() {
        if (sceneEditor.scene.hidden) return;

        if (sceneEditor.grabbing) document.body.style.setProperty("cursor", "grabbing");
        else document.body.style.removeProperty("cursor");

        rendering.canvas.style.setProperty(
            "cursor",
              sceneEditor.grabbing ? "grabbing" 
            : sceneEditor.isPicking ? "pointer" 
            : "grab",
        );
    }

    function startDragGesture(event) {
        killEvent(event);
        sceneEditor.setSelectedObject(object);
        sceneEditor.grabbing = true;
        
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = sceneEditor.scene.mouseEventToSceneTransform(event);
        const grab = mouse.invertSelf().multiplySelf(translationMatrix(object.position));
    
        const drag = trackGesture(event);
        drag.on("pointermove", (event) => {
            // preserve the relationship between mouse and element
            // D2 = M2 . G (drawing relative to scene)
            const mouse = sceneEditor.scene.mouseEventToSceneTransform(event);
            const matrix = mouse.multiply(grab);
            snap(matrix);
            const { x, y } = getMatrixTranslation(matrix);
            object.position.x = x;
            object.position.y = y;
            refreshObjectStyle(object, rendering.canvas);
        });
        drag.on("pointerup", (event) => sceneEditor.grabbing = false);
    }

    rendering.canvas.addEventListener("pointerdown", (event) => {
        if (sceneEditor.isPicking) {
            sceneEditor.pickObject(object);
        } else {
            startDragGesture(event);
        }

        killEvent(event);
        refreshCursors();
    });

    document.addEventListener("pointermove", refreshCursors);
}
