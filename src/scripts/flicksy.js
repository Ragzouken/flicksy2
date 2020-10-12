/**
 * @typedef {Object} Vector2
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} FlicksyDataDrawing
 * @property {string} id
 * @property {string} name
 * @property {Vector2} position
 * @property {string} data
 */

/**
 * @typedef {Object} FlicksyDataObjectData
 * @property {string} id
 * @property {string} name
 * @property {Vector2} position
 * @property {string} drawing
 */

/**
 * @typedef {Object} FlicksyDataScene
 * @property {string} id
 * @property {string} name
 * @property {Vector2} position
 * @property {FlicksyDataObjectData[]} objects
 */

/**
 * @typedef {Object} FlicksyDataProjectDetails
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} FlicksyDataProject
 * @property {FlicksyDataProjectDetails} details
 * @property {FlicksyDataDrawing[]} drawings
 * @property {FlicksyDataScene[]} scenes
 */

/** @type {FlicksyDataProject} */
const TEST_PROJECT_DATA = {
    details: {
        id: "QQWoA9EmJUNE8Kv0pSBvC",
        name: "test project"
    },
    drawings: [
        {
            id: "KjYJHtlIAztSeslXVTSgL",
            name: "test drawing",
            position: { x: 64, y: 32 },
            data: "data:image/png;base64,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"
        }
    ],
    scenes: [
        {
            id: "_DQVDseNwoX100S6h1KHo",
            name: "test scene",
            position: { x: 32, y: 64 },
            objects: [
                {
                    id: "ZfJJOkQIxQf03A_VuHkDk",
                    name: "test object",
                    position: { x: 16, y: 96 },
                    drawing: "KjYJHtlIAztSeslXVTSgL",
                }
            ]
        }
    ]
}
