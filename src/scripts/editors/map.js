class MapTabEditor {
    /** @param {FlicksyEditor} flicksyEditor */
    constructor(flicksyEditor) {
        this.flicksyEditor = flicksyEditor;
        this.selectedScene = undefined;

        this.scene = new PanningScene(ONE("#map-scene"));
        this.scene.refresh();
    }

    show() {
        this.scene.hidden = false;
    }

    hide() {
        this.scene.hidden = true;
    }
}
