/** @param {{ name: string, html: string }} document */
async function runNeocitiesPublish(document) {
    const ready = new Promise((resolve, reject) => {
        const remove = listen(window, "message", (event) => {
            if (event.origin !== "https://kool.tools") return;
            remove();
            resolve();
        });
    });

    /** @type {Promise<string>} */
    const success = new Promise((resolve, reject) => {
        const remove = listen(window, "message", (event) => {
            if (event.origin !== "https://kool.tools") return;

            if (event.data.error) {
                remove();
                reject(event.data.error);
            } else if (event.data.url) {
                remove();
                resolve(event.data.url);
            }
        });
    });

    const popup = window.open(
        "https://kool.tools/neocities-publisher/index.html", 
        "neocities publisher",
        "left=10,top=10,width=320,height=320");
    await ready;
    popup.postMessage(document, "https://kool.tools");
    const url = await success;
    popup.close();
    return url;
}
