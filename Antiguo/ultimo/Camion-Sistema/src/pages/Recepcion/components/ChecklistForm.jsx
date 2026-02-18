"use client"

import { useState } from "react"
import { FaIdCard, FaFileUpload, FaShieldAlt, FaTachometerAlt, FaCalendarAlt, FaInfoCircle, FaCheck } from "react-icons/fa"
import DocumentoReader from "../../../components/DocumentoReader";

const PLATE_REGEX = /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})$/; // ABCD12 o AB1234
const normalizePlate = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);


export default function ChecklistForm({ onValidated }) {
    const currentYear = new Date().getFullYear()

    const [form, setForm] = useState({
        guiaDespachoFile: null,
        nombreChofer: "",
        patente: "",
        patenteAcoplado: "",
        pesoGuia: "",
        pesoBruto: "",
        pesoTara: "",
        carnetConducir: false,
        carnetIdentidad: false,
        hojaSeguridad: false,
        protocoloDerrames: false,
        kilometraje: "",
        anioFabricacion: "",
    })

    const validateForm = () => {
        const f = form
        const errors = []

        const pat = normalizePlate(f.patente);
        if (!pat) {
        } else if (!PLATE_REGEX.test(pat)) {
            errors.push("La patente no cumple con el formato: ABCD12 o AB1234")
        }
        const patAc = normalizePlate(f.patenteAcoplado);
        if (!patAc) {
        } else if (!PLATE_REGEX.test(patAc)) {
            errors.push("La patente del acoplado no cumple con el formato: ABCD12 o AB1234")
        }

        if (!f.nombreChofer) {
            errors.push("Debe ingresar el nombre del chofer")
        }

        if (!f.guiaDespachoFile) {
            errors.push("Debe seleccionar un archivo de guía de despacho")
        }

        if (f.pesoGuia === "") {
            errors.push("Debe ingresar el peso registrado en la guía")
        } else if (Number(f.pesoGuia) <= 0) {
            errors.push("El peso debe ser mayor a 0 kg")
        }

        if (!f.carnetConducir) {
            errors.push("Debe confirmar que posee el carnet de conducir")
        }

        if (!f.carnetIdentidad) {
            errors.push("Debe confirmar que posee el carnet de identidad")
        }

        if (!f.hojaSeguridad) {
            errors.push("Debe confirmar que posee la hoja de seguridad")
        }

        if (!f.protocoloDerrames) {
            errors.push("Debe confirmar que posee el protocolo frente a derrames")
        }

        if (f.kilometraje === "") {
            errors.push("Debe ingresar el kilometraje del camión")
        } else if (Number(f.kilometraje) > 1_000_000) {
            errors.push("El kilometraje no puede exceder 1.000.000 km")
        } else if (Number(f.kilometraje) <= 0) {
            errors.push("El kilometraje debe ser mayor a 0 km")
        }

        if (f.anioFabricacion === "") {
            errors.push("Debe ingresar el año de fabricación")
        } else if (Number(f.anioFabricacion) < currentYear - 5) {
            errors.push(`El año de fabricación debe ser ${currentYear - 5} o posterior (máximo 5 años de antigüedad)`)
        } else if (Number(f.anioFabricacion) > currentYear) {
            errors.push(`El año de fabricación no puede ser mayor al año actual (${currentYear})`)
        }

        return errors
    }

    const [fileName, setFileName] = useState("")
    const handleDatosExtraidos = (datos) => {
        console.log("Datos del OCR recibidos en ChecklistForm:", datos);
        setForm(prevForm => ({
            ...prevForm,
            nombreChofer: datos.nombreChofer || prevForm.nombreChofer,
            patente: datos.patente || prevForm.patente,
            pesoGuia: datos.pesoNeto || prevForm.pesoGuia,
            pesoBruto: datos.pesoBruto || prevForm.pesoBruto,
            pesoTara: datos.pesoTara || prevForm.pesoTara,
        }));
    };
    const handleChange = (e) => {
        const { name, value, type, checked, files } = e.target

        if (type === "file" && files.length > 0) {
            setFileName(files[0].name)
        }

        let val = value;
        if (name === "patente" || name === "patenteAcoplado") {
            val = normalizePlate(value);
        }
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : type === "file" ? files[0] : val,
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const errors = validateForm()

        if (errors.length === 0) {
            onValidated({
                ...form,
                patente: normalizePlate(form.patente),
                patenteAcoplado: normalizePlate(form.patenteAcoplado),
            })
        } else {
            alert(`❌ Error: ${errors[0]}`)
        }
    }

    return (
        <div className="checklist-form">
            <div className="checklist-header">
                <div className="checklist-header-text">
                    <h2>Documentación de Ingreso</h2>
                    <p>Complete todos los campos requeridos para proceder con la inspección</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="checklist-content">
                <div className="form-section">
                    <h3>
                        <FaIdCard /> Identificación del Vehículo
                    </h3>
                    <label htmlFor="nombreChofer">Nombre del Chofer</label>
                    <input
                        type="text"
                        id="nombreChofer"
                        name="nombreChofer"
                        value={form.nombreChofer}
                        onChange={handleChange}
                        placeholder="Ej: Juan Pérez"
                    />
                    <label htmlFor="patente">Patente del Camión</label>
                    <input
                        type="text"
                        id="patente"
                        name="patente"
                        value={form.patente}
                        onChange={handleChange}
                        placeholder="Ej: AB1234 o ABCD12"
                        maxLength="6"
                        style={{ textTransform: "uppercase" }}
                    />

                    <label htmlFor="patenteAcoplado">Patente Acoplado</label>
                    <input
                        type="text"
                        id="patenteAcoplado"
                        name="patenteAcoplado"
                        value={form.patenteAcoplado}
                        onChange={handleChange}
                        placeholder="Ej: AB1234 o ABCD12"
                        maxLength="6"
                        style={{ textTransform: "uppercase" }}
                    />
                </div>

                <div className="form-section">
                    <h3>
                        <FaFileUpload /> Documentación de Despacho
                    </h3>
                    <label htmlFor="guiaDespacho">Guía de despacho</label>
                    <div className="file-upload">
                        <div className="file-upload-inner">
                            <FaFileUpload size={24} />
                            <p>{fileName ? fileName : "Seleccionar archivo"}</p>
                            <span className="file-types">JPG, PNG o PDF</span>
                        </div>
                        <input
                            type="file"
                            id="guiaDespacho"
                            name="guiaDespachoFile"
                            accept=".jpg,.png,.jpeg,.pdf"
                            onChange={handleChange}
                        />
                    </div>
                    {fileName && (
                        <div className="file-selected">
                            <FaCheck size={14} style={{ color: "#22c55e", marginRight: "8px" }} />
                            Archivo seleccionado: {fileName}
                        </div>
                    )}
                    <DocumentoReader
                        fileToRead={form.guiaDespachoFile}
                        onDataExtraida={handleDatosExtraidos}
                    />

                    <label htmlFor="pesoGuia" className="label-with-tooltip">
                        Peso Neto / Guía (kg)
                        <span className="tooltip-icon"><FaInfoCircle /></span>
                    </label>
                    <input type="number" id="pesoGuia" name="pesoGuia" value={form.pesoGuia} onChange={handleChange} placeholder="Ej: 27000" required />

                    <label htmlFor="pesoBruto" className="label-with-tooltip">
                        Peso Bruto (extraído)
                    </label>
                    <input
                        type="number"
                        id="pesoBruto"
                        name="pesoBruto"
                        value={form.pesoBruto}
                        onChange={handleChange}
                        placeholder="Ingresar manualmente si es necesario"
                    />

                    <label htmlFor="pesoTara" className="label-with-tooltip">
                        Tara (extraída)
                    </label>
                    <input
                        type="number"
                        id="pesoTara"
                        name="pesoTara"
                        value={form.pesoTara}
                        onChange={handleChange}
                        placeholder="Ingresar manualmente si es necesario"
                    />
                </div>

                <div className="form-section">
                    <h3>
                        <FaIdCard /> Información del Conductor
                    </h3>

                    <div className="checkbox-group">
                        <div className="checkbox-item">
                            <input
                                type="checkbox"
                                id="carnetConducir"
                                name="carnetConducir"
                                checked={form.carnetConducir}
                                onChange={handleChange}
                            />
                            <label htmlFor="carnetConducir">Carnet de conducir</label>
                        </div>

                        <div className="checkbox-item">
                            <input
                                type="checkbox"
                                id="carnetIdentidad"
                                name="carnetIdentidad"
                                checked={form.carnetIdentidad}
                                onChange={handleChange}
                            />
                            <label htmlFor="carnetIdentidad">Carnet de identidad</label>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>
                        <FaShieldAlt /> Protocolos de Seguridad
                    </h3>

                    <div className="checkbox-group">
                        <div className="checkbox-item">
                            <input
                                type="checkbox"
                                id="hojaSeguridad"
                                name="hojaSeguridad"
                                checked={form.hojaSeguridad}
                                onChange={handleChange}
                            />
                            <label htmlFor="hojaSeguridad">Hoja de seguridad</label>
                        </div>

                        <div className="checkbox-item">
                            <input
                                type="checkbox"
                                id="protocoloDerrames"
                                name="protocoloDerrames"
                                checked={form.protocoloDerrames}
                                onChange={handleChange}
                            />
                            <label htmlFor="protocoloDerrames">Protocolo frente a derrames</label>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>
                        <FaTachometerAlt /> Estado del Vehículo
                    </h3>

                    <label htmlFor="kilometraje" className="label-with-tooltip">
                        Kilometraje del camión (máx 1 000 000)
                        <span className="tooltip-icon">
                            <FaInfoCircle />
                        </span>
                    </label>
                    <input
                        type="number"
                        id="kilometraje"
                        name="kilometraje"
                        value={form.kilometraje}
                        onChange={handleChange}
                        placeholder="Ej: 85000"
                    />
                </div>

                <div className="form-section">
                    <h3>
                        <FaCalendarAlt /> Información Técnica
                    </h3>

                    <label htmlFor="anioFabricacion" className="label-with-tooltip">
                        Año de fabricación (≤ 5 años)
                        <span className="tooltip-icon">
                            <FaInfoCircle />
                        </span>
                    </label>
                    <input
                        type="number"
                        id="anioFabricacion"
                        name="anioFabricacion"
                        value={form.anioFabricacion}
                        onChange={handleChange}
                        placeholder={`Ej: ${currentYear - 1}`}
                    />
                </div>
            </form>

            <div className="form-footer">
                <button className="btn-primary" onClick={handleSubmit}>
                    Validar y continuar
                </button>
            </div>
        </div>
    )
}
