class PlayTab {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.player = new FlicksyPlayer();

        this.scene = new PanningScene(ONE("#play-scene"));
        this.player.sceneRendering.canvas.classList.add('.object');
        this.scene.container.appendChild(this.player.sceneRendering.canvas);

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

        this.player.sceneRendering.canvas.addEventListener("click", (event) => {
            killEvent(event);
            const [x, y] = mouseEventToPixel(event);
            this.player.click(x, y);
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
        this.player.restart();
        this.player.render();
    }
}
