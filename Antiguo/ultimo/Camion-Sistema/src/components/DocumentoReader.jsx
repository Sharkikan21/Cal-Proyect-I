// Ubicación: src/components/DocumentoReader.jsx (VERSIÓN CORREGIDA)

import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import Tesseract from 'tesseract.js';

function textoANumero(texto) {
    const mapaNumeros = {
        'un': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
        'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
        'veinte': 20, 'veintiun': 21, 'veintiuno': 21, 'veintidos': 22, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25, 'veintiseis': 26, 'veintisiete': 27,
        'veintiocho': 28, 'veintinueve': 29,
        'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
        'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300, 'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600, 'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
        'mil': 1000
    };

    const textoLimpio = texto
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\n/g, ' ')
        .trim();

    const procesarFragmento = (fragmento) => {
        const palabras = fragmento.trim().split(/[\s-]+/);
        let totalFragmento = 0;
        let acumulador = 0;

        for (let i = 0; i < palabras.length; i++) {
            const palabra = palabras[i];
            const valor = mapaNumeros[palabra];

            if (valor === 1000) {
                acumulador = (acumulador === 0) ? 1 : acumulador;
                totalFragmento += acumulador * 1000;
                acumulador = 0;
            } else if (valor === 100 && acumulador > 0 && acumulador < 10) {
                // Para casos como "dos cientos" = 200
                acumulador *= 100;
            } else if (valor) {
                acumulador += valor;
            }
        }
        totalFragmento += acumulador;
        return totalFragmento;
    };

    if (textoLimpio.includes('coma')) {
        const partesComa = textoLimpio.split('coma');
        const valorEntero = procesarFragmento(partesComa[0]);
        let valorDecimal = 0;
        if (partesComa.length > 1) {
            const decimalProcesado = procesarFragmento(partesComa[1]);
            if (decimalProcesado > 0) {
                valorDecimal = decimalProcesado / Math.pow(10, String(decimalProcesado).length);
            }
        }
        const resultado = valorEntero + valorDecimal;
        return resultado > 0 ? resultado : null;
    } else {
        const resultado = procesarFragmento(textoLimpio);
        return resultado > 0 ? resultado : null;
    }
}

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function DocumentoReader({ fileToRead, onDataExtraida }) {
    const [estado, setEstado] = useState('inactivo');
    const [progreso, setProgreso] = useState(0);
    const canvasRef = useRef(null);

    useEffect(() => {
        setEstado(fileToRead ? 'listo' : 'inactivo');
    }, [fileToRead]);

    const procesarDocumento = async () => {
        if (!fileToRead) return;
        setEstado('procesando');
        try {
            const pdf = await pdfjsLib.getDocument(URL.createObjectURL(fileToRead)).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = canvasRef.current;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const canvasContext = canvas.getContext('2d');
            await page.render({ canvasContext, viewport }).promise;

            const { data: { text } } = await Tesseract.recognize(canvas, 'spa', {
                logger: m => { if (m.status === 'recognizing text') setProgreso(Math.floor(m.progress * 100)) },
            });

            console.log('Texto extraído del OCR:', text);
            const datos = extraerDatosDelTexto(text);
            onDataExtraida(datos);
            setEstado('completado');
        } catch (error) {
            console.error('Error procesando el documento:', error);
            setEstado('error');
        }
    };

    const extraerDatosDelTexto = (textoOriginal) => {
        const texto = textoOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        console.log('Texto procesado para extracción:', texto);

        const datos = {
            nombreChofer: null,
            patente: null,
            pesoBruto: null,
            pesoNeto: null,
            pesoTara: null,
        };

        let match;

        // Extraer patente
        match = texto.match(/PATENTE\s*:\s*([A-Z0-9]{6})/);
        if (match && match[1]) {
            datos.patente = match[1].trim().replace(/O/g, '0');
        }

        // Extraer nombre del chofer
        match = texto.match(/CONDUCTOR(?:\s|\/)*OPERADOR\s*S?R?\s*:?\s*([\w\sÁÉÍÓÚÑ]+)/);
        if (match && match[1]) {
            datos.nombreChofer = match[1].replace(/(\r\n|\n|\r)/gm, " ").trim();
        }

        // Extraer pesos con números directos
        const pesosNumericos = texto.matchAll(/(BRUTO|TARA)\s+([\d.,]+)\s*(KG|TO|TONELADAS)?/gi);
        for (const pesoMatch of pesosNumericos) {
            const tipo = pesoMatch[1].toUpperCase();
            let valor = parseFloat(pesoMatch[2].replace(/,/g, '.').replace(/[^\d.]/g, ''));
            const unidad = pesoMatch[3]?.toUpperCase();

            // Convertir a kg si está en toneladas
            if (unidad === 'TO' || unidad === 'TONELADAS') {
                valor *= 1000;
            }

            if (tipo === 'BRUTO') datos.pesoBruto = valor;
            if (tipo === 'TARA') datos.pesoTara = valor;
        }

        // Extraer peso neto desde "SON:" - versión simplificada
        // Primero normalizar todo el texto eliminando saltos de línea problemáticos
        const textoNormalizado = texto.replace(/(\r\n|\n|\r)/g, ' ').replace(/\s+/g, ' ');

        // Buscar el patrón SON: seguido de texto hasta TONELADAS, TO, KG, etc.
        match = textoNormalizado.match(/SON\s*:\s*([A-Z\s]+?)\s+(KILOGRAMOS|TONELADAS|TO|KG)/);

        if (match && match[1]) {
            let textoCapturado = match[1].trim();
            console.log('Texto encontrado después de "SON:":', textoCapturado);

            let valorNeto = textoANumero(textoCapturado);
            const unidadNeto = match[2]?.toUpperCase();

            console.log('Valor convertido de texto:', valorNeto);
            console.log('Unidad detectada:', unidadNeto);

            if (valorNeto) {
                // Si la unidad es toneladas y el valor es pequeño, convertir a kg
                if ((unidadNeto === 'TO' || unidadNeto === 'TONELADAS') && valorNeto < 1000) {
                    valorNeto *= 1000;
                }
                datos.pesoNeto = Math.round(valorNeto);
            }
        }

        // Si no funcionó, intentar extraer desde el peso bruto - tara
        if (!datos.pesoNeto && datos.pesoBruto && datos.pesoTara) {
            datos.pesoNeto = datos.pesoBruto - datos.pesoTara;
            console.log('Peso neto calculado (Bruto - Tara):', datos.pesoNeto);
        }

        // Intentar extraer peso neto de formato numérico directo como respaldo
        if (!datos.pesoNeto) {
            // Buscar patrones como "32.72 $" o "32.72 TO"
            const pesoDirecto = textoNormalizado.match(/(\d+\.?\d*)\s*(?:TO|TONELADAS|KG)?\s*\$?/);
            if (pesoDirecto) {
                let valorNeto = parseFloat(pesoDirecto[1]);
                // Si es un decimal pequeño como 32.72, probablemente está en toneladas
                if (valorNeto < 100 && valorNeto > 0) {
                    valorNeto *= 1000; // Convertir a kg
                }
                datos.pesoNeto = Math.round(valorNeto);
                console.log('Peso extraído directamente del número:', datos.pesoNeto);
            }
        }

        if (datos.pesoNeto) {
            datos.pesoGuia = datos.pesoNeto;
        }

        // Validación de coherencia
        if (datos.pesoBruto && datos.pesoTara && !datos.pesoNeto) {
            datos.pesoNeto = datos.pesoBruto - datos.pesoTara;
            datos.pesoGuia = datos.pesoNeto;
        }

        console.log('Datos finales extraídos (en KG):', datos);
        return datos;
    };

    return (
        <div style={{ width: '100%', marginTop: '16px' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            <button
                onClick={procesarDocumento}
                disabled={!fileToRead || estado === 'procesando'}
                className="btn-primary"
                style={{ width: '100%' }}
            >
                {estado === 'procesando' ? `Procesando... ${progreso}%` : 'Leer Documento'}
            </button>
            {estado === 'completado' && <p style={{ color: 'green', marginTop: '5px' }}>✓ Datos extraídos.</p>}
            {estado === 'error' && <p style={{ color: 'red', marginTop: '5px' }}>✗ No se pudo leer el archivo.</p>}
        </div>
    );
}