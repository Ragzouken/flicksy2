async function start() {
    const dataElement = ONE("#project-data");
    const play = ONE("body").getAttribute("data-play") === "true";

    const save = localStorage.getItem("flicksy2/test-save");
    const json = (play || !save) ? dataElement.innerHTML : save;
    const data = JSON.parse(json);

    await editor.start();
    await editor.setProjectData(data);

    if (play) {
        editor.playTab.player.events.on("log", console.log);
        switchTab("sidebar/play");
    }
}
