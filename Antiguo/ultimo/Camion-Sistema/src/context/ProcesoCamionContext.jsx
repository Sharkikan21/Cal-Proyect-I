import React, { createContext, useState, useContext, useEffect } from 'react';
import { useProcesoLock } from '../hooks/useProcesoLock';
import { useAuth } from './AuthContext';
const ProcesoCamionContext = createContext();
export const useProcesoCamion = () => useContext(ProcesoCamionContext);
export const ProcesoCamionProvider = ({ children }) => {
  const { user } = useAuth();
  const [camionActual, setCamionActual] = useState(null);
  const procesoId = camionActual?.id;
  const { hasLock, holder, releaseLock, resumeLock, takeLock } = useProcesoLock(procesoId);
  useEffect(() => {
    if (procesoId) { resumeLock().catch(() => { }); }
  }, [procesoId, resumeLock]);
  const ensureLockOrExplain = async () => {
    if (hasLock) return true;
    if (await resumeLock()) return true;
    if (await takeLock()) return true;
    alert(holder ? `El proceso está en uso por ${holder}.` : 'El proceso está en uso por otro usuario.');
    return false;
  };
  const [etapaActual, setEtapaActual] = useState('lista');
  const [pesoBruto, setPesoBruto] = useState(0);
  const [pesoTara, setPesoTara] = useState(0);
  const [checklistB, setChecklistB] = useState({
    pipingMetalico: false,
    manguerasBuenEstado: false,
    abrazaderasBuenEstado: false,
    pipingGomaBuenEstado: false,
    equipoBuenEstado: false,
    manguerasComponentesAcoples: false,
    manometroBuenEstado: false,
    chorizoDescargaBuenEstado: false,
    cadenasSeguridadCamion: false,
    cadenasSeguridadSilo: false,
    caballeteApoyoChorizo: false,
    duchaEmergencia: false,
    confinamientoArea: false,
    barandasMuestreoSilo: false,
    inyeccionAireLimpieza: false,
    eppBasicoConductor: false,
    trajePapelConductor: false,
    respiradorConductor: false,
    arnesConductor: false,
    eppBasicoOperador: false,
    trajePapelOperador: false,
    respiradorOperador: false,
    arnesOperador: false,
  });
  const [comentarios, setComentarios] = useState('');

  // Función para determinar las etapas disponibles según el rol
  const getEtapasDisponibles = () => {
    if (!user) return [];

    if (user.rol === 'pesaje') {
      return ['pesaje-inicial', 'pesaje-final'];
    } else if (user.rol === 'recepcionista-cal') {
      return ['inspeccion-b', 'evacuacion'];
    } else if (user.rol === 'admin') {
      // Admin puede acceder a todas las etapas
      return ['pesaje-inicial', 'inspeccion-b', 'evacuacion', 'pesaje-final'];
    }
    return [];
  };

  // Función para verificar si una etapa está disponible para el rol actual
  const isEtapaDisponible = (etapa) => {
    const etapasDisponibles = getEtapasDisponibles();
    return etapasDisponibles.includes(etapa);
  };

  const iniciarProceso = (camion) => {
    console.log("[ProcesoCamionContext] iniciarProceso llamado con:", {
      camion: camion,
      userRol: user?.rol,
      pesajesRegistrados: camion.pesajes_registrados,
      inspeccionesRealizadas: camion.inspecciones_realizadas,
      evacuacionRegistrada: camion.evacuacion_registrada
    });

    setCamionActual(camion);

    // Determinar la etapa inicial según el rol y el estado del proceso
    if (user?.rol === 'pesaje') {
      // Verificar si ya tiene pesaje inicial
      const tienePesajeInicial = camion.pesajes_registrados?.some(p => p.tipo === 'inicial');
      const tieneInspeccionB = camion.inspecciones_realizadas?.some(i => i.nombre_parte?.includes('B'));
      const tieneEvacuacion = camion.evacuacion_registrada;
      const tienePesajeFinal = camion.pesajes_registrados?.some(p => p.tipo === 'final');

      console.log("[ProcesoCamionContext] Análisis para rol pesaje:", {
        tienePesajeInicial,
        tieneInspeccionB,
        tieneEvacuacion,
        tienePesajeFinal
      });

      if (!tienePesajeInicial) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: pesaje-inicial");
        setEtapaActual('pesaje-inicial');
      } else if (tieneInspeccionB && tieneEvacuacion && !tienePesajeFinal) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: pesaje-final");
        setEtapaActual('pesaje-final');
      } else {
        // Si tiene pesaje inicial pero no inspección B o evacuación, no debería estar aquí
        console.log("[ProcesoCamionContext] Estableciendo etapa: pesaje-inicial (fallback)");
        setEtapaActual('pesaje-inicial');
      }
    } else if (user?.rol === 'recepcionista-cal') {
      // Para recepcionista-cal, verificar si tiene pesaje inicial pero no inspección B
      const tienePesajeInicial = camion.pesajes_registrados?.some(p => p.tipo === 'inicial');
      const tieneInspeccionB = camion.inspecciones_realizadas?.some(i => i.nombre_parte?.includes('B'));
      const tieneEvacuacion = camion.evacuacion_registrada;
      const tienePesajeFinal = camion.pesajes_registrados?.some(p => p.tipo === 'final');

      console.log("[ProcesoCamionContext] Análisis para rol recepcionista-cal:", {
        tienePesajeInicial,
        tieneInspeccionB,
        tieneEvacuacion,
        tienePesajeFinal
      });

      // Solo procesar si tiene pesaje inicial y no está finalizado
      if (!tienePesajeInicial) {
        console.log("[ProcesoCamionContext] No tiene pesaje inicial - no disponible para recepcionista-cal");
        setEtapaActual('lista');
      } else if (tienePesajeFinal) {
        console.log("[ProcesoCamionContext] Proceso ya finalizado - no disponible para recepcionista-cal");
        setEtapaActual('lista');
      } else if (tienePesajeInicial && !tieneInspeccionB) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: inspeccion-b para recepcionista-cal");
        setEtapaActual('inspeccion-b');
      } else if (tienePesajeInicial && tieneInspeccionB && !tieneEvacuacion) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: evacuacion para recepcionista-cal");
        setEtapaActual('evacuacion');
      } else {
        console.log("[ProcesoCamionContext] Proceso no disponible para recepcionista-cal");
        setEtapaActual('lista');
      }
    } else if (user?.rol === 'admin') {
      // Para admin, usar la misma lógica que recepcionista-cal cuando está en Recepción Cal
      const tienePesajeInicial = camion.pesajes_registrados?.some(p => p.tipo === 'inicial');
      const tieneInspeccionB = camion.inspecciones_realizadas?.some(i => i.nombre_parte?.includes('B'));
      const tieneEvacuacion = camion.evacuacion_registrada;
      const tienePesajeFinal = camion.pesajes_registrados?.some(p => p.tipo === 'final');
      const pesoInicial = camion.pesajes_registrados?.find(p => p.tipo === 'inicial');
      if (pesoInicial?.peso_kg) setPesoBruto(Number(pesoInicial.peso_kg));

      console.log("[ProcesoCamionContext] Análisis para rol admin:", {
        tienePesajeInicial,
        tieneInspeccionB,
        tieneEvacuacion,
        tienePesajeFinal
      });

      // Determinar la etapa correcta según el estado del proceso
      if (!tienePesajeInicial) {
        console.log("[ProcesoCamionContext] No tiene pesaje inicial - estableciendo pesaje-inicial para admin");
        setEtapaActual('pesaje-inicial');
      } else if (tienePesajeFinal) {
        console.log("[ProcesoCamionContext] Proceso ya finalizado - estableciendo lista para admin");
        setEtapaActual('lista');
      } else if (tienePesajeInicial && !tieneInspeccionB) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: inspeccion-b para admin");
        setEtapaActual('inspeccion-b');
      } else if (tienePesajeInicial && tieneInspeccionB && !tieneEvacuacion) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: evacuacion para admin");
        setEtapaActual('evacuacion');
      } else if (tienePesajeInicial && tieneInspeccionB && tieneEvacuacion && !tienePesajeFinal) {
        console.log("[ProcesoCamionContext] Estableciendo etapa: pesaje-final para admin");
        setEtapaActual('pesaje-final');
      } else {
        console.log("[ProcesoCamionContext] Proceso no disponible - estableciendo lista para admin");
        setEtapaActual('lista');
      }
    } else {
      console.log("[ProcesoCamionContext] Rol no reconocido:", user?.rol);
      setEtapaActual('lista');
    }
  };

  const finalizarProceso = () => {
    console.log("[ProcesoCamionContext] finalizarProceso() llamado");
    console.log("[ProcesoCamionContext] Estado antes de finalizar:", {
      camionActual,
      etapaActual,
      pesoBruto,
      pesoTara
    });
    try { releaseLock(); } catch { }
    setCamionActual(null);
    setEtapaActual('lista');
    setPesoBruto(0);
    setPesoTara(0);
    console.log("[ProcesoCamionContext] Estado después de finalizar: camionActual=null, etapaActual='lista'");
  };

  const avanzarEtapa = () => {
    const etapasDisponibles = getEtapasDisponibles();
    const currentIndex = etapasDisponibles.indexOf(etapaActual);

    if (currentIndex < etapasDisponibles.length - 1) {
      setEtapaActual(etapasDisponibles[currentIndex + 1]);
    } else {
      setEtapaActual('completado');
    }
  };

  // Función para ir a una etapa específica (útil para navegación entre roles)
  const irAEtapa = (etapa) => {
    if (isEtapaDisponible(etapa)) {
      setEtapaActual(etapa);
    }
  };

  const reiniciarProceso = () => {
    setCamionActual(null);
    setEtapaActual('lista');
    setPesoBruto(0);
    setPesoTara(0);
    setChecklistB({
      pipingMetalico: false,
      manguerasBuenEstado: false,
      abrazaderasBuenEstado: false,
      pipingGomaBuenEstado: false,
      equipoBuenEstado: false,
      manguerasComponentesAcoples: false,
      manometroBuenEstado: false,
      chorizoDescargaBuenEstado: false,
      cadenasSeguridadCamion: false,
      cadenasSeguridadSilo: false,
      caballeteApoyoChorizo: false,
      duchaEmergencia: false,
      confinamientoArea: false,
      barandasMuestreoSilo: false,
      inyeccionAireLimpieza: false,
      eppBasicoConductor: false,
      trajePapelConductor: false,
      respiradorConductor: false,
      arnesConductor: false,
      eppBasicoOperador: false,
      trajePapelOperador: false,
      respiradorOperador: false,
      arnesOperador: false,
    });
    setComentarios('');
  };

  return (
    <ProcesoCamionContext.Provider
      value={{
        camionActual,
        etapaActual,
        pesoBruto,
        pesoTara,
        checklistB,
        comentarios,
        setCamionActual,
        setEtapaActual,
        setPesoBruto,
        setPesoTara,
        setChecklistB,
        setComentarios,
        iniciarProceso,
        avanzarEtapa,
        irAEtapa,
        reiniciarProceso,
        finalizarProceso,
        getEtapasDisponibles,
        isEtapaDisponible,
        hasLock,
        holder,
        ensureLockOrExplain,
        releaseLock,
      }}
    >
      {children}
    </ProcesoCamionContext.Provider>
  );
};
