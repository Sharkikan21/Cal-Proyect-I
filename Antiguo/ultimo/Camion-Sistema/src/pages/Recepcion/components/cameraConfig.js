// cameraConfig.js
const cameraMapping = {
  CAM_GENERAL: {
    type: 'general',
    name: 'Vista General',
    nodeName: null,
    dataKey: null,
    grupo: null                // no pertenece a ningún grupo
  },
  // ---------- PESTAÑA 2 (Inspección A) ----------
  CAM_PARABRISAS: {
    type: 'parabrisas',
    name: 'Parabrisas',
    nodeName: 'PARABRISAS',
    dataKey: 'parabrisa',
    grupo: 'A'
  },
  CAM_RUEDA_DEL: {  // …ruedas derechas
    type: 'rueda',
    name: 'Rueda Delantera Derecha',
    nodeName: 'RUEDA_CAMION_DEL001',
    dataKey: 'ruedaDelanteraDerecha',
    grupo: 'A'
  },
  CAM_RUEDA_TRAS: {
    type: 'rueda',
    name: 'Rueda Trasera Derecha',
    nodeName: 'RUEDA_CAMION_DEL002',
    dataKey: 'ruedaTraseraDerecha',
    grupo: 'A'
  },
  CAM_RUEDAS: {
    type: 'rueda',
    name: 'Ruedas Triple Derecha',
    nodeName: 'RUEDA_CAMION_TRAS003',
    dataKey: 'ruedasTripleDerecha',
    grupo: 'A'
  },
  CAM_RUEDAS01: {
    type: 'rueda',
    name: 'Ruedas Triple Izquierda',
    nodeName: 'RUEDA_CAMION_TRAS011',
    dataKey: 'ruedasTripleIzquierda',
    grupo: 'A'
  },
  CAM_RUEDA_TRAS1: {
    type: 'rueda',
    name: 'Rueda Trasera Izquierda',
    nodeName: 'RUEDA_CAMION_TRAS001',
    dataKey: 'ruedaTraseraIzquierda',
    grupo: 'A'
  },
  CAM_RUEDA_DEL1: {
    type: 'rueda',
    name: 'Rueda Delantera Izquierda',
    nodeName: 'RUEDA_CAMION_DEL',
    dataKey: 'ruedaDelanteraIzquierda',
    grupo: 'A'
  },

  // ---------- PESTAÑA 3 (Inspección B) ----------
  CAM_TAPA_SUP: {
    type: 'tapa',
    name: 'Tapa Superior',
    nodeName: 'TAOA_SOLA_SILO_SEMI_REMOLCADOR',
    dataKey: 'tapaSuperior',
    grupo: 'B'
  },
  CAM_MANGUERA: {
    type: 'manguera',
    name: 'Manguera',
    nodeName: 'TUBO_DESCARGA',
    dataKey: 'manguera',
    grupo: 'B'
  },
  CAM_MANGUERA_AIRE: {
    type: 'manguera',
    name: 'Manguera de Aire',
    nodeName: 'TAPA_MANGUERA_AIRE',
    dataKey: 'mangueraAire',
    grupo: 'B',
  }  
};

export default cameraMapping;
