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
 * @property {string} start
 * @property {Record<string, string>} cursors
 */

/**
 * @typedef {Object} FlicksyDataProject
 * @property {FlicksyDataProjectDetails} details
 * @property {FlicksyDataDrawing[]} drawings
 * @property {FlicksyDataScene[]} scenes
 */

/**
 * @typedef {Object} FlicksyPlayState
 * @property {string} currentScene
 * @property {Object} variables
 */

/** @type {FlicksyDataProject} */
const EMPTY_PROJECT_DATA = {
    details: {
        id: "EMPTY.PROJECT",
        name: "empty project",
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
        ],
        start: "0",
        cursors: {}
    },
    drawings: [],
    scenes: [
        {
            id: "0",
            name: "unnamed scene",
            position: { x: 0, y: 0, z: 0 },
            objects: []
        }
    ]
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
