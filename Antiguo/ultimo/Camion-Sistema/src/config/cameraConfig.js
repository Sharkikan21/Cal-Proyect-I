// Configuración de cámaras para la aplicación de pesaje
const cameraMapping = {
  CAM_GENERAL: {
    type: "general",
    name: "Vista General",
    nodeName: null,
    dataKey: null,
    grupo: null, // no pertenece a ningún grupo
  },
  // ---------- CÁMARAS PARA INSPECCIÓN B ----------
  CAM_TAPA_SUP: {
    type: "tapa",
    name: "Tapa Superior",
    nodeName: "TAOA_SOLA_SILO_SEMI_REMOLCADOR",
    dataKey: "tapaSuperior",
    grupo: "B",
  },
  CAM_MANGUERA: {
    type: "manguera",
    name: "Manguera",
    nodeName: "TUBO_DESCARGA",
    dataKey: "manguera",
    grupo: "B",
  },
  CAM_MANGUERA_AIRE: {
    type: "manguera",
    name: "Manguera de Aire",
    nodeName: "TAPA_MANGUERA_AIRE",
    dataKey: "mangueraAire",
    grupo: "B",
  },
}

export default cameraMapping
