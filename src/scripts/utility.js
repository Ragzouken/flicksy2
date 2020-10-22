'use strict'

/**
 * @param {string} query 
 * @param {ParentNode} element 
 * @returns {HTMLElement}
 */
const ONE = (query, element = undefined) => (element || document).querySelector(query);
/**
 * @param {string} query 
 * @param {HTMLElement | Document} element 
 * @returns {HTMLElement[]}
 */
const ALL = (query, element = undefined) => Array.from((element || document).querySelectorAll(query));

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

// from https://github.com/ai/nanoid/blob/master/non-secure/index.js
const urlAlphabet = 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
function nanoid(size = 21) {
    let id = '';
    let i = size;
    while (i--) id += urlAlphabet[(Math.random() * 64) | 0];
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

/**
 * @param {string} text 
 */
function textToBlob(text, type = "text/plain") {
    return new Blob([text], { type });
}

/**
 * @param {string} accept 
 * @param {boolean} multiple 
 * @returns {Promise<File[]>}
 */
async function pickFiles(accept = "*", multiple = false) {
    return new Promise((resolve) => {
        const fileInput = html("input", { type: "file", accept, multiple });
        fileInput.addEventListener("change", () => resolve(Array.from(fileInput.files)));
        fileInput.click();
    });
}
