// Ubicación: src/pages/Pesaje/ChecklistBModal.jsx

import { AnimatePresence, motion } from "framer-motion";
import { FaClipboardList, FaTimes } from "react-icons/fa";

const ChecklistBModal = ({
    isOpen,
    onClose,
    checklistData,
    onChecklistChange,
    comentarios,
    onComentariosChange,
    loading
}) => {
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
            titulo: "DISPOSITIVOS DE SEGURIDAD",
            items: [
                { id: "cadenasSeguridad", texto: "Presencia de cadenas de seguridad" },
                { id: "botonEmergencia", texto: "Botón de emergencia operativo" },
                { id: "confinamientoArea", texto: "Confinamiento de área" },
            ]
        },
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="overlay"
                className="modal-overlay"
                onClick={onClose}
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
                <button className="close-modal" onClick={onClose}>
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
                                            checked={!!checklistData[item.id]}
                                            onChange={onChecklistChange}
                                            disabled={loading}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        {item.texto}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="comentarios-section">
                        <h4 style={{
                            paddingBottom: '8px',
                            borderBottom: '2px solid #f1f5f9',
                            marginBottom: '16px',
                            fontSize: '1rem',
                            color: '#334155'
                        }}>COMENTARIOS (OPCIONAL)</h4>
                        <textarea
                            value={comentarios}
                            onChange={onComentariosChange}
                            placeholder="Ingrese comentarios adicionales si es necesario..."
                            disabled={loading}
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>
                <button className="btn-primary" onClick={onClose} style={{ marginTop: '24px' }}>
                    Cerrar
                </button>
            </motion.div>
        </AnimatePresence>
    );
};

export default ChecklistBModal;