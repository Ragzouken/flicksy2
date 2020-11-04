async function start() {
    const dataElement = ONE("#project-data");
    const play = ONE("body").getAttribute("data-play") === "true";

    const save = localStorage.getItem("flicksy2/test-save");
    const json = (play || !save) ? dataElement.innerHTML : save;
    const data = JSON.parse(json);

    playerSetup = setup();

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

function setup() {
    const scene = new PanningScene(ONE("#play-scene"));
    const player = new FlicksyPlayer();

    scene.locked = true;
    player.viewRendering.canvas.classList.add('.object');
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

    const mouseEventToSceneTransform = (event) => {
        const mouse = scene.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(scene.transform.inverse());
        return mouse;
    }

    const mouseEventToPixel = (event) => {
        const mouse = mouseEventToSceneTransform(event);
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
