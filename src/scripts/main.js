/**
 * @param {string} path 
 * @returns {[string, string]}
 */
function pathToRootLeaf(path) {
    const parts = path.split('/');
    const root = parts.slice(0, -1).join('/');
    const leaf = parts.slice(-1)[0];
    return [root, leaf];
}

function initui() {
    const toggles = Array.from(document.querySelectorAll("[data-tab-toggle]"));
    const bodies = Array.from(document.querySelectorAll("[data-tab-body]"));

    function setGroupActiveTab(group, tab) {
        toggles.forEach((element) => {
            const [group_, tab_] = pathToRootLeaf(element.getAttribute("data-tab-toggle"));
            if (group_ === group) element.classList.toggle("active", tab_ === tab);
        });
        bodies.forEach((element) => {
            const [group_, tab_] = pathToRootLeaf(element.getAttribute("data-tab-body"));
            if (group_ === group) element.hidden = (tab_ !== tab);
        });
    }

    toggles.forEach((element) => {
        const [group, tab] = pathToRootLeaf(element.getAttribute("data-tab-toggle"));
        element.addEventListener('click', () => setGroupActiveTab(group, tab));
    });

    bodies.forEach((element) => {
        element.hidden = true;
    });
}

async function start() {
    initui();
}
