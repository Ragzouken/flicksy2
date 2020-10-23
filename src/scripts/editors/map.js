class MapTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.selectedScene = undefined;

        this.scene = new PanningScene(ONE("#map-scene"));
        this.scene.refresh();

        this.nameInput = elementByPath("map/selected/name", "input");
        this.nameInput.addEventListener("input", () => {
            if (!this.selectedScene) return;
            this.selectedScene.name = this.nameInput.value;
        });

        setActionHandler("map/add/blank", async () => {
            const scene = {
                id: nanoid(),
                name: "unnamed scene",
                position: { x: 0, y: 0, z: 0 },
                objects: [],
            };
            this.flicksyEditor.projectData.scenes.push(scene);
            await initSceneInEditor(scene);
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

        setActionHandler("map/selected/duplicate", async () => {
            console.log("HELLO");
            const original = this.selectedScene;
            const { x, y, z } = original.position;
            const copy = {
                id: nanoid(),
                name: original.name + " copy",
                position: { x: x+8, y: y+8, z: z+1 },
                objects: [],
            };
            this.flicksyEditor.projectData.scenes.push(copy);
            await initSceneInEditor(copy);

            this.setSelectedScene(copy);
        });

        setActionHandler("map/selected/delete", () => {
            const canvas = sceneToPreviewRendering.get(this.selectedScene).canvas;
            canvas.remove();

            const index = this.flicksyEditor.projectData.scenes.indexOf(this.selectedScene);
            this.flicksyEditor.projectData.scenes.splice(index);

            this.setSelectedScene(undefined);
        });
    }

    reframe() {
        const pairs = Array.from(sceneToPreviewRendering.entries());
        const rects = pairs.map(([scene, rendering]) => {
            const { x, y } = scene.position;
            const { width, height } = rendering.canvas;
            return new DOMRect(x, y, width, height);
        });
        const padding = 8;
        const bounds = boundRects(rects);
        bounds.x -= padding;
        bounds.y -= padding;
        bounds.width += padding*2;
        bounds.height += padding*2;
        this.scene.frameRect(bounds);
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

    show() {
        this.scene.hidden = false;
        this.reframe();
    }

    hide() {
        this.scene.hidden = true;
    }
}

/** @type {Map<FlicksyDataScene, CanvasRenderingContext2D>} */
const sceneToPreviewRendering = new Map();

/**
 * @param {FlicksyDataScene} scene
 */
async function initSceneInEditor(scene) {
    const rendering = createRendering2D(160, 100);
    sceneToPreviewRendering.set(scene, rendering);
    fillRendering2D(rendering, 'magenta');

    rendering.canvas.classList.toggle("object", true);
    editor.mapTabEditor.scene.container.appendChild(rendering.canvas);
    const object = new DragObjectTest(editor.mapTabEditor.scene, rendering.canvas);

    rendering.canvas.style.setProperty("z-index", scene.position.z.toString());

    object.transform.e = scene.position.x;
    object.transform.f = scene.position.y;
    object.refresh();

    let grab = undefined;
    let hovered = undefined;
    
    function mouseEventToSceneTransform(event) {
        const mouse = object.scene.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(object.scene.transform.inverse());
        return mouse;
    }

    function mouseEventToPixel(event) {
        const mouse = mouseEventToSceneTransform(event);
        const pixel = object.transform.inverse().multiply(mouse);
        return [pixel.e, pixel.f];
    }
    
    function refreshCursors(event) {
        const grabbing = grab !== undefined;

        if (grabbing) document.body.style.setProperty("cursor", "grabbed");
        else document.body.style.removeProperty("cursor");

        rendering.canvas.style.setProperty("cursor", grabbing ? "grabbed" : "grab");
    }

    function pointerdownDrag(event) {
        killEvent(event);
        // determine and save the relationship between mouse and element
        // G = M1^ . E (element relative to mouse)
        const mouse = mouseEventToSceneTransform(event);
        grab = mouse.invertSelf().multiplySelf(object.transform);
    }

    function pointermoveDrag(event) {
        if (!grab) return;
        killEvent(event);

        // preserve the relationship between mouse and element
        // D2 = M2 . G (drawing relative to scene)
        const mouse = mouseEventToSceneTransform(event);
        object.transform = mouse.multiply(grab);
        snap(object.transform);
        object.refresh();

        scene.position.x = object.transform.e;
        scene.position.y = object.transform.f;
    }

    object.element.addEventListener("pointerdown", (event) => {
        editor.mapTabEditor.setSelectedScene(scene);
        pointerdownDrag(event);
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
        if (grab) pointermoveDrag(event);
        refreshCursors(event);
    });
    
    document.addEventListener("pointerup", (event) => {
        if (editor.mapTabEditor.scene.hidden) return;
        killEvent(event);
        grab = undefined;
        refreshCursors(event);
    });
}
