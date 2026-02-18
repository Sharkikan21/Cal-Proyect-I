// genera una URL válida tanto en dev (http://localhost) como en Electron (file://)
export const asset = (relPath) =>
    new URL(relPath, window.location.href).toString();