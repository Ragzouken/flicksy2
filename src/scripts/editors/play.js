class PlayTab {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.player = new FlicksyPlayer();

        this.scene = new PanningScene(ONE("#play-scene"));
        this.player.viewRendering.canvas.classList.add('.object');
        this.scene.container.appendChild(this.player.viewRendering.canvas);

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

        this.player.viewRendering.canvas.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
        });
        this.player.viewRendering.canvas.addEventListener("click", (event) => {
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
        const width = this.player.viewRendering.canvas.width;
        const height = this.player.viewRendering.canvas.height;

        this.scene.frameRect(padRect(new DOMRect(0, 0, width, height), 8));
        this.player.restart();
        this.player.render();
    }
}
