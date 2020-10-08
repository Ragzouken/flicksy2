/**
 * @param {HTMLElement} element 
 */
function removeAllChildren(element) {
    while (element.children.length) 
        element.removeChild(element.children[0]);   
}

/**
 * @param {MouseEvent | Touch} event 
 * @param {HTMLElement} element 
 */
function eventToElementPixel(event, element) {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.x, event.clientY - rect.y];
}

/**
 * @param {Event} event
 */
function killEvent(event) {
    event.stopPropagation();
    event.preventDefault();
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>} image
 */
async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.addEventListener("load", () => resolve(image));
        image.src = src;
    });
}

/**
 * 
 * @param {HTMLImageElement} image 
 */
function imageToRendering2D(image) {
    const rendering = createRendering2D(image.naturalWidth, image.naturalHeight);
    rendering.drawImage(image, 0, 0);
    return rendering;
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName 
 * @param {*} attributes 
 * @param  {...(Node | string)} children 
 * @returns {HTMLElementTagNameMap[K]}
 */
function html(tagName, attributes = {}, ...children) {
    const element = /** @type {HTMLElementTagNameMap[K]} */ (document.createElement(tagName)); 
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    children.forEach((child) => element.append(child));
    return element;
}

/**
 * 
 * @param {HTMLElement} element 
 * @param {(x: number, y: number) => void} callback
 */
function addPressListener(element, callback) {
    let held = false;
    element.addEventListener('pointerdown', (event) => {
        killEvent(event);
        const [x, y] = eventToElementPixel(event, element);
        callback(x, y);
        held = true;
    });
    document.addEventListener('pointermove', (event) => {
        if (!held) return;
        const [x, y] = eventToElementPixel(event, element);
        callback(x, y);
    });
    document.addEventListener('pointerup', (event) => held = false);
}

// from https://github.com/ai/nanoid/blob/master/non-secure/index.js
const urlAlphabet = 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
function nanoid(size = 21) {
    let id = ''
    // A compact alternative for `for (var i = 0; i < step; i++)`.
    let i = size
    while (i--) {
    // `| 0` is more compact and faster than `Math.floor()`.
    id += urlAlphabet[(Math.random() * 64) | 0]
    }
    return id
}

/**
 * @param {File} file 
 * @return {Promise<string>}
 */
async function textFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.readAsText(file); 
    });
}

/**
 * @param {File} file 
 * @return {Promise<string>}
 */
async function dataURLFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.readAsDataURL(file); 
    });
}

/**
 * @param {string} source
 */
async function htmlFromText(source) {
    const template = document.createElement('template');
    template.innerHTML = source;
    return template.content;
}
