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
 * @typedef {Object} FlicksyDataObjectData
 * @property {string} id
 * @property {string} name
 * @property {Vector3} position
 * @property {string} drawing
 */

/**
 * @typedef {Object} FlicksyDataScene
 * @property {string} id
 * @property {string} name
 * @property {Vector3} position
 * @property {FlicksyDataObjectData[]} objects
 */

/**
 * @typedef {Object} FlicksyDataProjectDetails
 * @property {string} id
 * @property {string} name
 * @property {string[]} palette
 */

/**
 * @typedef {Object} FlicksyDataProject
 * @property {FlicksyDataProjectDetails} details
 * @property {FlicksyDataDrawing[]} drawings
 * @property {FlicksyDataScene[]} scenes
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
        ]
    },
    drawings: [],
    scenes: []
}
