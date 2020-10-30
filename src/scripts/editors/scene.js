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
                };
                this.activeScene.objects.push(object);
                await initObjectInEditor(this, object);
            } catch(e) {}
            elementByPath("toggle:sidebar/scene", "button").click();
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
            elementByPath("toggle:sidebar/scene", "button").click();
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
                    this.flicksyEditor.drawingsManager.getRendering(drawing),
                    objectToRendering.get(this.selectedObject),
                )
            } catch(e) {}
            elementByPath("toggle:sidebar/scene", "button").click();
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
            elementByPath("toggle:sidebar/scene", "button").click();
        });

        setActionHandler("scene/selected/raise", () => {
            if (!this.selectedObject) return;
            const canvas = objectToRendering.get(this.selectedObject).canvas;
            this.selectedObject.position.z += 1;
            canvas.style.setProperty("z-index", this.selectedObject.position.z.toString());
        });

        setActionHandler("scene/selected/lower", () => {
            if (!this.selectedObject) return;
            const canvas = objectToRendering.get(this.selectedObject).canvas;
            this.selectedObject.position.z -= 1;
            canvas.style.setProperty("z-index", this.selectedObject.position.z.toString());
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
            
            try {
                const scene = await this.flicksyEditor.pickScene({
                    heading: "pick scene",
                    prompt: "pick a scene to reference in an object's script",
                    allowNone: true,
                });
                this.selectedObject.behaviour.script = replacer(`"${scene ? scene.id : ""}"`);
                this.objectScriptInput.value = this.selectedObject.behaviour.script;
            } catch (e) { console.log(e) }
            elementByPath("toggle:sidebar/scene", "button").click();
        });

        setActionHandler("scene/selected/script/reference/drawing", async () => {
            const replacer = makeReplacer(this.selectedObject.behaviour.script);
            
            try {
                const drawing = await this.flicksyEditor.pickDrawing({
                    heading: "pick drawing",
                    prompt: "pick a drawing to reference in an object's script",
                    allowNone: true,
                });
                this.selectedObject.behaviour.script = replacer(`"${drawing ? drawing.id : ""}"`);
                this.objectScriptInput.value = this.selectedObject.behaviour.script;
            } catch (e) { console.log(e) }
            elementByPath("toggle:sidebar/scene", "button").click();
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
            elementByPath("toggle:sidebar/scene", "button").click();
            this.setActiveScene(this.flicksyEditor.projectData, activeScene);
            this.setSelectedObject(selectedObject);
        });

        setActionHandler("scene/active/play", () => {
            elementByPath("toggle:sidebar/play", "button").click();
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
            const scene = this.flicksyEditor.projectData.scenes.find((scene) => scene.id === this.selectedObject.behaviour.destination);
            this.objectDestinationInput.value = scene ? scene.name : "no change";

            const drawing = this.flicksyEditor.projectData.drawings.find((drawing) => drawing.id === this.selectedObject.drawing);
            this.objectDrawingInput.value = drawing.name;
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
                renderScene(this.activeScene),
                sceneToPreviewRendering.get(this.activeScene),
            );
        }
    }

    reframe() {
        this.scene.frameRect(padRect(new DOMRect(0, 0, 160, 100), 8));
    }

    refreshDrawings() {
        this.activeScene.objects.forEach((object) => {
            const drawing = this.flicksyEditor.projectData.drawings.find((drawing) => drawing.id === object.drawing);
            const rendering = this.flicksyEditor.drawingsManager.getRendering(drawing);
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

/** @type {Map<FlicksyDataObject, CanvasRenderingContext2D>} */
const objectToRendering = new Map();

/**
 * @param {SceneTabEditor} sceneEditor
 * @param {FlicksyDataObject} object
 */
async function initObjectInEditor(sceneEditor, object) {
    const drawing = sceneEditor.flicksyEditor.projectData.drawings.find((drawing) => drawing.id === object.drawing);
    const rendering = copyRendering2D(editor.drawingsManager.getRendering(drawing));
    objectToRendering.set(object, rendering);

    rendering.canvas.classList.toggle("object", true);
    sceneEditor.scene.container.appendChild(rendering.canvas);
    const draggable = new DragObjectTest(sceneEditor.scene, rendering.canvas);

    rendering.canvas.style.setProperty("z-index", object.position.z.toString());

    draggable.transform.e = object.position.x;
    draggable.transform.f = object.position.y;
    draggable.refresh();

    let grab = undefined;
    let hovered = undefined;
    
    function mouseEventToSceneTransform(event) {
        const mouse = draggable.scene.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(draggable.scene.transform.inverse());
        return mouse;
    }
    
    function refreshCursors(event) {
        const grabbing = grab !== undefined;
        const picking = sceneEditor.isPicking;

        if (grabbing) document.body.style.setProperty("cursor", "grabbed");
        else document.body.style.removeProperty("cursor");

        rendering.canvas.style.setProperty("cursor", grabbing ? "grabbed" : picking ? "pointer" : "grab");
    }

    function pointerdownDrag(event) {
        killEvent(event);
        sceneEditor.setSelectedObject(object);
        
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = mouseEventToSceneTransform(event);
        grab = mouse.invertSelf().multiplySelf(draggable.transform);
    }

    function pointermoveDrag(event) {
        if (!grab) return;
        killEvent(event);

        // preserve the relationship between mouse and element
        // D2 = M2 . G (drawing relative to scene)
        const mouse = mouseEventToSceneTransform(event);
        draggable.transform = mouse.multiply(grab);
        snap(draggable.transform);
        draggable.refresh();

        object.position.x = draggable.transform.e;
        object.position.y = draggable.transform.f;
    }

    draggable.element.addEventListener("pointerdown", (event) => {
        if (sceneEditor.isPicking) {
            killEvent(event);
            sceneEditor.pickObject(object);
            return;
        }

        pointerdownDrag(event);
        refreshCursors(event);
    });

    draggable.element.addEventListener("pointerenter", (event) => {
        killEvent(event);
        hovered = true;
        refreshCursors(event);
    });

    draggable.element.addEventListener("pointerout", (event) => {
        killEvent(event);
        refreshCursors(event);
    });

    document.addEventListener("pointermove", (event) => {
        if (grab) pointermoveDrag(event);
        refreshCursors(event);
    });
    
    document.addEventListener("pointerup", (event) => {
        if (sceneEditor.scene.hidden) return;
        killEvent(event);
        grab = undefined;
        refreshCursors(event);
    });
}
