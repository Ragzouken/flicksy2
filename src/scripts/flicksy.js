/**
 * @typedef {Object} Vector3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} FlicksyDataDrawing
 * @property {string} id
 * @property {string} name
 * @property {Vector3} position
 * @property {Vector2} pivot
 * @property {string} data
 */

/**
 * @typedef {Object} FlicksyDataObjectBehaviour
 * @property {string} dialogue
 * @property {string} destination
 * @property {string} script
 */

/**
 * @typedef {Object} FlicksyDataObject
 * @property {string} id
 * @property {string} name
 * @property {Vector3} position
 * @property {string} drawing
 * @property {boolean} hidden
 * @property {FlicksyDataObjectBehaviour} behaviour
 */

/**
 * @typedef {Object} FlicksyDataScene
 * @property {string} id
 * @property {string} name
 * @property {Vector3} position
 * @property {FlicksyDataObject[]} objects
 */

/**
 * @typedef {Object} FlicksyDataProjectDetails
 * @property {string} id
 * @property {string} name
 * @property {string[]} palette
 * @property {boolean} doubleResolution
 * @property {boolean} doubleDialogue
 */

/**
 * @typedef {Object} FlicksyPlayState
 * @property {string} scene
 * @property {string} cursor
 * @property {Object} variables
 */

/**
 * @typedef {Object} FlicksyDataProject
 * @property {FlicksyDataProjectDetails} details
 * @property {FlicksyDataDrawing[]} drawings
 * @property {FlicksyDataScene[]} scenes
 * @property {FlicksyPlayState} state
 */

/** @type {FlicksyDataProject} */
const EMPTY_PROJECT_DATA = {
    details: {
        id: "EMPTY.PROJECT",
        name: "empty project",
        doubleResolution: false,
        doubleDialogue: false,
        palette: [
            "#00000000",
            "#FFFF00",
            "#FF6600",
            "#DD0000",
            "#FF0099",
            "#330099",
            "#0000CC",
            "#0099FF",
            "#00AA00",
            "#006600",
            "#663300",
            "#996633",
            "#BBBBBB",
            "#888888",
            "#444444",
            "#000000"
        ]
    },
    drawings: [
        {
            id: "1",
            name: "default cursor",
            position: { x: 0, y: 0, z: 0 },
            pivot: { x: 6, y: 2 },
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAXCAYAAADtNKTnAAAAmklEQVQ4T+2UURKAIAhE83CcmsPV4Aihkq5O/dVXo/BmF1fTEXzMfMoyEaVov13rigRARLmOmSHQD+lHPZ2JtoxOagrxJ/UEXIK0QFW3DRGg5ihpOjWhQdh88ML/DAlkDtNeFBiwgrioI1fmhpRGUwN3l0JRZYP1tlZA70N2bVVKdiCWk9b/ymy+haC2/NMZPsSIJQiCZEVv8QUbvb1oFvm1hQAAAABJRU5ErkJggg=="
        }
    ],
    scenes: [
        {
            id: "0",
            name: "unnamed scene",
            position: { x: 0, y: 0, z: 0 },
            objects: []
        }
    ],
    state: {
        scene: "0",
        cursor: "1",
        variables: {}
    }
}

/** 
 * Add defaults for fields that are missing because the project is older.
 * @param {FlicksyDataProject} project 
 */
function repairProjectData(project) {
    function repairDrawingData(drawing) {
        drawing.pivot ||= { x: 0, y: 0 };
    }

    project.state ||= {
        scene: project.details["start"],
        cursor: project.details["cursor"] || "",
        variables: {},
    };

    project.drawings.forEach(repairDrawingData);
    return project;
}

/**
 * @param {FlicksyDataProject} project 
 * @param {string} sceneId 
 */
function getSceneById(project, sceneId) {
    return project.scenes.find((scene) => scene.id === sceneId);
}

/**
 * @param {FlicksyDataProject} project 
 * @param {string} drawingId 
 */
function getDrawingById(project, drawingId) {
    return project.drawings.find((drawing) => drawing.id === drawingId);
}

/**
 * @param {FlicksyDataProject} project 
 * @param {string} objectId 
 */
function getObjectById(project, objectId) {
    const objects = project.scenes.flatMap((scene) => scene.objects);
    return objects.find((object) => object.id === objectId);
}

/** @param {FlicksyDataObject} object */
function isObjectInteractable(object) {
    return 0 < (object.behaviour.script.length + object.behaviour.dialogue.length + object.behaviour.destination.length);
}

class FlicksyProjectManager {
    constructor() {
        /** @type {FlicksyDataProject} */
        this.projectData = undefined;

        /** @type {Map<string, CanvasRenderingContext2D>} */
        this.drawingIdToRendering = new Map();
    }

    /** @param {FlicksyDataProject} projectData */
    async loadProjectData(projectData) {
        // reload drawings from scratch
        this.drawingIdToRendering.clear();
        const loads = projectData.drawings.map((drawing) => this.reloadDrawingData(drawing));
        await Promise.all(loads);

        this.projectData = projectData;
    }

    /** @param {FlicksyProjectManager} manager */
    async copyFromManager(manager) {
        this.projectData = JSON.parse(JSON.stringify(manager.projectData));

        manager.drawingIdToRendering.forEach((rendering, drawingId) => {
            this.drawingIdToRendering.set(drawingId, copyRendering2D(rendering));
        });
    }

    async saveProjectData() {
        const saves = this.projectData.drawings.map((drawing) => this.saveDrawingData(drawing));
        await Promise.all(saves);
    }
    
    /** @param {FlicksyDataDrawing} drawing */
    async reloadDrawingData(drawing) {
        const image = await loadImage(drawing.data);
        const rendering = imageToRendering2D(image);
        this.drawingIdToRendering.set(drawing.id, rendering);
    }

    /** @param {FlicksyDataDrawing} drawing */
    async saveDrawingData(drawing) {
        const rendering = this.drawingIdToRendering.get(drawing.id);
        drawing.data = rendering.canvas.toDataURL();
    }

    /** 
     * @param {FlicksyDataDrawing} drawing
     * @param {CanvasRenderingContext2D} rendering
     */
    async insertDrawing(drawing, rendering=undefined) {
        this.projectData.drawings.push(drawing);
        if (rendering) {
            this.drawingIdToRendering.set(drawing.id, rendering);
        } else {
            await this.reloadDrawingData(drawing);
        }
    }

    /** @param {FlicksyDataDrawing} drawing */
    removeDrawing(drawing) {
        removeItemFromArray(drawing, this.projectData.drawings);
        this.drawingIdToRendering.delete(drawing.id);
    }

    /** 
     * @param {FlicksyDataDrawing} drawing 
     * @returns {Rect}
     */
    getDrawingRect(drawing) {
        const rendering = this.drawingIdToRendering.get(drawing.id);
        const { x, y } = drawing.position;
        const { width, height } = rendering.canvas;
        return { x, y, width, height };
    }
}
