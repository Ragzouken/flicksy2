async function start() {
    const dataElement = ONE("#project-data");
    const play = ONE("body").getAttribute("data-play") === "true";

    const save = localStorage.getItem("flicksy2/test-save");
    const json = (play || !save) ? dataElement.innerHTML : save;
    const data = JSON.parse(json);

    playerSetup = await setup();

    if (play) {
        const player = playerSetup.player;
        player.events.on("log", console.log);
        await player.load();
        await player.projectManager.loadProjectData(data);
        playerSetup.scene.hidden = false;
    } else {
        await editor.start();
        await editor.setProjectData(data);
    }
}

let playerSetup;

async function setup() {
    const font = await loadBasicFont(/** @type {HTMLScriptElement} */ (ONE("#font-data")));
    const scene = new PanningScene(ONE("#play-scene"));
    const player = new FlicksyPlayer(font);

    scene.locked = true;
    scene.container.appendChild(player.viewRendering.canvas);

    let prev;
    const timer = (next) => {
        prev ||= Date.now();
        player.update((next - prev) / 1000.);
        prev = next;
        window.requestAnimationFrame(timer);
    }
    timer();

    function reframe() {
        const width = player.viewRendering.canvas.width;
        const height = player.viewRendering.canvas.height;
        scene.frameRect(padRect(new DOMRect(0, 0, width, height), 8));
    }
    window.addEventListener("resize", reframe);
    reframe();

    const mouseEventToPixel = (event) => {
        const mouse = scene.mouseEventToSceneTransform(event);
        return [mouse.e, mouse.f];
    }

    const viewport = ONE("#content");

    player.viewRendering.canvas.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
    });
    player.viewRendering.canvas.addEventListener("click", (event) => {
        killEvent(event);
        const [x, y] = mouseEventToPixel(event);
        player.click(x, y);
    });
    viewport.addEventListener("pointermove", (event) => {
        if (scene.hidden) return;
        //killEvent(event);
        const [x, y] = mouseEventToPixel(event);
        const clickable = player.isInteractableHovered(x, y);
        
        if (player.projectManager.projectData.state.cursor) {
            player.viewRendering.canvas.style.setProperty("cursor", "none");
        } else {
            player.viewRendering.canvas.style.setProperty("cursor", clickable ? "pointer" : "default");
        }
    });

    return { scene, player };
}

class PanningScene {
    get hidden() { return this.container.hidden; }
    set hidden(value) { this.container.hidden = value; }

    /**
     * @param {HTMLElement} container 
     */
    constructor(container) {
        this.viewport = container.parentElement;
        this.container = container;
        this.transform = new DOMMatrix();
        this.locked = false;

        this.viewport.addEventListener("pointerdown", (event) => {
            if (this.hidden || this.locked) return;
            killEvent(event);
    
            // determine and save the relationship between mouse and scene
            // G = M1^ . S (scene relative to mouse)
            const mouse = this.mouseEventToViewportTransform(event);
            const grab = mouse.invertSelf().multiplySelf(this.transform);
            document.body.style.setProperty("cursor", "grabbing");
            this.viewport.style.setProperty("cursor", "grabbing");

            const gesture = trackGesture(event);
            gesture.on("pointermove", (event) => {
                // preserve the relationship between mouse and scene
                // D2 = M2 . G (drawing relative to scene)
                const mouse = this.mouseEventToViewportTransform(event);
                this.transform = mouse.multiply(grab);
                this.refresh();
            });
            gesture.on("pointerup", (event) => {
                document.body.style.removeProperty("cursor");
                this.viewport.style.removeProperty("cursor");
            });
        });
        
        this.viewport.addEventListener('wheel', (event) => {
            if (this.hidden) return;
            const mouse = this.mouseEventToViewportTransform(event);
            const origin = (this.transform.inverse().multiply(mouse)).transformPoint();

            const [minScale, maxScale] = [.5, 16];
            const prevScale = getMatrixScale(this.transform).x;
            const [minDelta, maxDelta] = [minScale/prevScale, maxScale/prevScale];
            const deltaScale = clamp(Math.pow(2, event.deltaY * -0.01), minDelta, maxDelta);

            // prev * delta <= max -> delta <= max/prev
            this.transform.scaleSelf(
                deltaScale, deltaScale, deltaScale,
                origin.x, origin.y, origin.z,
            );

            this.refresh();
        });

        this.refresh();
    }

    refresh() {
        this.container.style.setProperty("transform", this.transform.toString());
    }

    frameRect(rect) {
        const bounds = this.viewport.getBoundingClientRect();

        // find scale that contains all width, all height, and is within limits
        const sx = bounds.width / rect.width;
        const sy = bounds.height / rect.height;
        const scale = clamp(Math.min(sx, sy), .5, 16);

        // find translation that centers the rect in the viewport
        const ex = (1/scale - 1/sx) * bounds.width * .5;
        const ey = (1/scale - 1/sy) * bounds.height * .5;
        const [ox, oy] = [-rect.x + ex, -rect.y + ey];

        this.transform = new DOMMatrix();
        this.transform.scaleSelf(scale, scale);
        this.transform.translateSelf(ox, oy);
        this.refresh();
    }

    mouseEventToViewportTransform(event) {
        const rect = this.viewport.getBoundingClientRect();
        const [sx, sy] = [event.clientX - rect.x, event.clientY - rect.y];
        const matrix = (new DOMMatrixReadOnly()).translate(sx, sy);
        return matrix;
    }

    mouseEventToSceneTransform(event) {
        const mouse = this.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(this.transform.inverse());
        return mouse;
    }
}

