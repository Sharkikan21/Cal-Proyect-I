// Ubicación: src/pages/recepcion-cal/ChecklistBModal.jsx

import { AnimatePresence, motion } from "framer-motion";
import { FaClipboardList, FaTimes } from "react-icons/fa";

const ChecklistBModal = ({
    checklistB,
    setChecklistB,
    onClose
}) => {
    // Validación defensiva: asegurar que checklistB existe y es un objeto
    const safeChecklistB = checklistB || {};

    // Validación defensiva: asegurar que onClose existe
    const handleClose = onClose || (() => { });
    // Definimos los ítems del checklist basados en la imagen que enviaste
    const secciones = [
        {
            titulo: "PIPING CAMIÓN SILO",
            items: [
                { id: "pipingMetalico", texto: "Piping metálico en buen estado (sin abolladuras, desacople)" },
                { id: "manguerasBuenEstado", texto: "Mangueras en buen estado" },
                { id: "abrazaderasBuenEstado", texto: "Abrazaderas en buen estado" },
                { id: "pipingGomaBuenEstado", texto: "Piping de goma en buen estado" },
            ]
        },
        {
            titulo: "COMPRESOR O SOPLADOR",
            items: [
                { id: "equipoBuenEstado", texto: "Equipo en buen estado" },
                { id: "manguerasComponentesAcoples", texto: "Mangueras o componentes con acoples en buen estado" },
            ]
        },
        {
            titulo: "MANÓMETROS",
            items: [
                { id: "manometroBuenEstado", texto: "Manómetro en buen estado" },
            ]
        },
        {
            titulo: "DISPOSITIVOS DE SEGURIDAD",
            items: [
                { id: "chorizoDescarga", texto: "Chorizo de descarga en buen estado" },
                { id: "cadenasSeguridadCamion", texto: "Presencia de cadenas de seguridad lado camión" },
                { id: "cadenasSeguridadSilo", texto: "Presencia de cadena de seguridad lado silo" },
                { id: "caballeteApoyoChorizo", texto: "Presencia de caballete de apoyo chorizo" },
                { id: "duchaEmergencia", texto: "Ducha de emergencia operativa y con agua potable" },
                { id: "confinamientoArea", texto: "Confinamiento de área" },
                { id: "barandasMuestreoSilo", texto: "Buen estado de barandas en el muestreo del silo" },
                { id: "inyeccionAireLimpiezaMangas", texto: "Inyección de aire de limpieza de mangas activado" },
            ]
        },
        {
            titulo: "EPP CONDUCTOR",
            items: [
                { id: "eppBasicoConductor", texto: "Porta EPP básico (casco, lentes, guantes, zapatos, fonos o tapones) en buen estado" },
                { id: "trajePapelConductor", texto: "Porta traje de papel en buen estado" },
                { id: "respiradorMedioRostroConductor", texto: "Porta respirador medio rostro con filtros en buen estado" },
                { id: "arnesColasVidaConductor", texto: "Porta arnés y colas de vida en buen estado" },
            ]
        },
        {
            titulo: "EPP OPERADOR PRODUCCIÓN (REACTIVOS)",
            items: [
                { id: "eppBasicoOperador", texto: "Porta EPP básico (casco, lentes, guantes, zapatos, fonos o tapones) en buen estado" },
                { id: "trajePapelOperador", texto: "Porta traje de papel en buen estado" },
                { id: "respiradorMedioRostroOperador", texto: "Porta respirador medio rostro con filtros en buen estado" },
                { id: "arnesColasVidaOperador", texto: "Porta arnés y colas de vida en buen estado" },
            ]
        }
    ];


    const handleChecklistChange = (e) => {
        const { name, checked } = e.target;
        if (setChecklistB) {
            setChecklistB(prev => ({ ...prev, [name]: checked }));
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                key="overlay"
                className="modal-overlay"
                onClick={handleClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
            />
            <motion.div
                key="modal"
                className="part-form" // Reutilizamos estilos del modal principal
                style={{ maxWidth: "600px" }} // Hacemos el modal un poco más ancho
                initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-45%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.95, y: "-45%" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                <button className="close-modal" onClick={handleClose}>
                    <FaTimes />
                </button>
                <h3>
                    <FaClipboardList style={{ marginRight: "12px" }} />
                    Checklist de Inspección de Descarga
                </h3>

                <div className="checklist-container" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '15px' }}>
                    {secciones.map(seccion => (
                        <div key={seccion.titulo} className="checklist-section" style={{ marginBottom: '24px' }}>
                            <h4 style={{
                                paddingBottom: '8px',
                                borderBottom: '2px solid #f1f5f9',
                                marginBottom: '16px',
                                fontSize: '1rem',
                                color: '#334155'
                            }}>{seccion.titulo}</h4>
                            <div className="checklist-items" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {seccion.items.map(item => (
                                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '15px' }}>
                                        <input
                                            type="checkbox"
                                            id={item.id}
                                            name={item.id}
                                            checked={!!safeChecklistB[item.id]}
                                            onChange={handleChecklistChange}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        {item.texto}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="modal-footer" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                        type="button"
                        onClick={handleClose}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#64748b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ChecklistBModal; 