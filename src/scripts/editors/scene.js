class SceneTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        /** @type {FlicksyDataScene} */
        this.activeScene = undefined;
        /** @type {FlicksyDataObject} */
        this.selectedObject = undefined;

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
            this.selectedObject.behaviour.dialogue = this.objectDestinationInput.value;
        });
        this.objectDestinationInput = elementByPath("scene/selected/destination", "input");

        setActionHandler("scene/add/pick-drawing", async () => {
            // TODO
        });

        setActionHandler("scene/selected/pick-destination", async () => {
            // TODO
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
    }

    show() {
        this.scene.hidden = false;
        this.reframe();
    }

    hide() {
        this.scene.hidden = true;
    }

    reframe() {
        this.scene.frameRect(padRect(new DOMRect(0, 0, 160, 100), 8));
    }
}

/** @type {Map<FlicksyDataObject, CanvasRenderingContext2D>} */
const objectToRendering = new Map();

/**
 * @param {SceneTabEditor} sceneEditor
 * @param {FlicksyDataObject} object
 */
async function initObjectInEditor(sceneEditor, object) {
    const rendering = createRendering2D(64, 64);
    objectToRendering.set(object, rendering);
    fillRendering2D(rendering, 'magenta');

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

        if (grabbing) document.body.style.setProperty("cursor", "grabbed");
        else document.body.style.removeProperty("cursor");

        rendering.canvas.style.setProperty("cursor", grabbing ? "grabbed" : "grab");
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
