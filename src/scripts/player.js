class FlicksyPlayer {
    constructor() {
        this.sceneRendering = createRendering2D(160, 100);

        /** @type {Map<string, CanvasRenderingContext2D>} */
        this.drawingIdToRendering = new Map();
        /** @type {Map<string, FlicksyDataScene>} */
        this.sceneIdToScene = new Map();
    }

    restart() {
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
            currentScene: editor.projectData.details.start,
        };
    }

    render() {
        const scene = this.sceneIdToScene.get(this.gameState.currentScene);

        fillRendering2D(this.sceneRendering, 'black');
        scene.objects.sort((a, b) => a.position.z - b.position.z);
        scene.objects.forEach((object) => {
            const canvas = this.drawingIdToRendering.get(object.drawing).canvas;
            this.sceneRendering.drawImage(
                canvas,
                object.position.x, 
                object.position.y, 
                canvas.width, 
                canvas.height,
            );
        });
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    click(x, y) {
        const scene = this.sceneIdToScene.get(this.gameState.currentScene);
        const object = pointcastScene(scene, { x, y });

        if (!object) return;

        if (object.behaviour.script) {
            const DO = {
                RESKIN: (drawing) => object.drawing = drawing,
                REDRAW: () => this.render(),
                MOVE: (scene) => this.gameState.currentScene = scene,
                SAY: console.log,
            }

            try {
                const script = new Function("DO", object.behaviour.script);
                script(DO);
            } catch (e) {
                console.log(`SCRIPT ERROR in OBJECT '${object.name}' of SCENE '${scene.name}'`, e);
            }
        }

        if (object.behaviour.dialogue) {
            console.log(object.behaviour.dialogue);
        }

        if (object.behaviour.destination) {
            this.gameState.currentScene = object.behaviour.destination;
        }

        this.render();
    }
}
