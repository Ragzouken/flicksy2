export {}

declare global {
    function saveAs(blob: Blob, name: string, options?: any);
}
