class PlayTab {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;

        this.scene = new PanningScene(ONE("#play-scene"));
        this.rendering = createRendering2D(160, 100);
        this.rendering.canvas.classList.add('.object');
        this.scene.container.appendChild(this.rendering.canvas);

        setActionHandler("play/restart", () => this.restart());

        const mouseEventToSceneTransform = (event) => {
            const mouse = this.scene.mouseEventToViewportTransform(event);
            mouse.preMultiplySelf(this.scene.transform.inverse());
            return mouse;
        }

        const mouseEventToPixel = (event) => {
            const mouse = mouseEventToSceneTransform(event);
            //const pixel = object.transform.inverse().multiply(mouse);
            return [mouse.e, mouse.f];
        }

        this.rendering.canvas.addEventListener("click", (event) => {
            killEvent(event);
            const [x, y] = mouseEventToPixel(event);

            const scene = this.flicksyEditor.projectData.scenes.find((scene) => scene.id === this.flicksyEditor.projectData.details.start);
            const object = pointcastScene(scene, { x, y });

            console.log(object ? object.name : "none");
        });
    }

    show() {
        this.restart();
        this.scene.hidden = false;
    }

    hide() {
        this.scene.hidden = true;
    }
    
    restart() {
        this.scene.frameRect(padRect(new DOMRect(0, 0, 160, 100), 8));

        const scene = this.flicksyEditor.projectData.scenes.find((scene) => scene.id === this.flicksyEditor.projectData.details.start);
        const render = renderScene(scene, 1, false);
        this.rendering.drawImage(render.canvas, 0, 0);
    }
}
