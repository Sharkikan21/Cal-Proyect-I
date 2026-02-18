import React from 'react';
import { useProcesoCamion } from '../../../context/ProcesoCamionContext';
import { FaTimes } from 'react-icons/fa';

export default function ChecklistInspeccionB({ onClose }) {
    // Obtenemos los estados y funciones del checklist desde el contexto
    const { checklistB, setChecklistB, comentarios, setComentarios, loading } = useProcesoCamion();

    const handleChecklistChange = (e) => {
        const { name, checked } = e.target;
        setChecklistB((prev) => ({ ...prev, [name]: checked }));
    };

    const handleComentariosChange = (e) => {
        setComentarios(e.target.value);
    };

    return (
        <div className="modal-overlay">
            <div className="checklist-modal-content" style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>
                    <h3>Checklist de Inspección B</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>
                        <FaTimes />
                    </button>
                </div>

                <div className="checklist-sections">
                    {/* Aquí va toda la estructura de tu checklist original */}
                    <div className="checklist-section">
                        <h3>PIPING CAMIÓN SILO</h3>
                        <div className="checklist-item">
                            <input type="checkbox" id="pipingMetalico" name="pipingMetalico" checked={checklistB.pipingMetalico} onChange={handleChecklistChange} disabled={loading} />
                            <label htmlFor="pipingMetalico">Piping metálico en buen estado (abolladura, desacople)</label>
                        </div>
                        <div className="checklist-item">
                            <input type="checkbox" id="manguerasBuenEstado" name="manguerasBuenEstado" checked={checklistB.manguerasBuenEstado} onChange={handleChecklistChange} disabled={loading} />
                            <label htmlFor="manguerasBuenEstado">Mangueras en buen estado</label>
                        </div>
                        {/* ... Agrega aquí todos los otros checkboxes ... */}
                    </div>

                    <div className="checklist-section">
                        <h3>COMPRESOR O SOPLADOR</h3>
                        {/* ... los checkboxes de esta sección ... */}
                    </div>
                </div>

                <div className="comentarios-section">
                    <h3>COMENTARIOS (OPCIONAL)</h3>
                    <textarea
                        value={comentarios}
                        onChange={handleComentariosChange}
                        placeholder="Ingrese comentarios adicionales..."
                        disabled={loading}
                    />
                </div>

                <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button className="btn-secondary" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}