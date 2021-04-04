class PlayTab {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;

        this.player = playerSetup.player;
        this.scene = playerSetup.scene;

        this.logText = elementByPath("play/log", "div");
        setActionHandler("play/restart", () => this.restart());

        setActionHandler("play/pick-scene", async () => {
            try {
                const scene = await this.flicksyEditor.pickScene({ 
                    heading: "pick scene",
                    prompt: "pick a scene to jump to during playback. the game will not be reset",
                    allowNone: false, 
                });
                switchTab("sidebar/play");
                this.player.projectManager.projectData.state.scene = scene.id;
                this.player.render();
                this.refresh();
            } catch (e) {
                switchTab("sidebar/play");
            }
        });

        setActionHandler("play/edit-scene", () => {
            const scene = getSceneById(this.flicksyEditor.projectData, this.player.projectManager.projectData.state.scene);
            this.flicksyEditor.sceneTabEditor.setActiveScene(this.flicksyEditor.projectData, scene);
            switchTab("sidebar/scene");
        });

        this.player.events.on("next-scene", (sceneId) => {
            this.refresh();
        });

        this.player.events.on("log", (text) => {
            this.logText.innerText += text + "\n";
            this.logText.scrollTo(0, this.logText.scrollHeight);
        });
    }

    show() {
        this.restart();
        this.scene.hidden = false;
    }

    hide() {
        this.scene.hidden = true;
        this.player.projectManager.projectData = undefined;
    }
    
    refresh() {
        const scene = getSceneById(this.player.projectManager.projectData, this.player.projectManager.projectData.state.scene);
        elementByPath("play/scene", "input").value = scene.name;
    }

    restart(startScene = undefined) {
        this.player.projectManager.copyFromManager(this.flicksyEditor.projectManager);
        this.player.dialoguePlayer.restart();
        if (startScene) this.player.changeScene(startScene);
        this.player.log("[restarted]");
        this.player.render();
        this.refresh();
    }
}
