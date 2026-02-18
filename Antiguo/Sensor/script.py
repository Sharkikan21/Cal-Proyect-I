sensores_definidos = [
    {
        "tag_equipo": "2270-ZM-009-01",
        "tag": "2270-LSHH-11826",
        "nombre_equipo": "LIME SILO - Alarma Alta Alta",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Permite descargar cal si LAHH-11826 == 0. Bloquea al finalizar. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-01",
        "tag": "2270-LSLL-11829",
        "nombre_equipo": "LIME SILO - Alarma Baja Baja",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Alarma de nivel bajo en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-01",
        "tag": "2270-LIT-11825",
        "nombre_equipo": "LIME SILO - Transmisor de Nivel",
        "condiciones": [
            {"operador": ">", "valor": 95}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Nivel sobre 95%. Bloquea descarga al terminar. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-01",
        "tag": "2270-LIT-11825",
        "nombre_equipo": "LIME SILO - Transmisor de Nivel",
        "condiciones": [
            {"operador": "<=", "valor": 5}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Nivel bajo (≤ 5%). Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-21",
        "tag": "2270-SAL-11818",
        "nombre_equipo": "LIME SILO ROTARY VALVE",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Detener válvula rotatoria. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-04",
        "tag": "2270-SAL-11817",
        "nombre_equipo": "LIME SLAKER SCREW FEEDER",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Detener alimentador de tornillo. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TAHH-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Alta Alta Temperatura",
        "condiciones": [
            {"tipo": "relativo_a_SP", "operador": "+", "delta": 10, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Secuencia Start/Stop. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TAH-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Alta Temperatura",
        "condiciones": [
            {"tipo": "relativo_a_SP", "operador": "+", "delta": 5, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Detiene alimentador de tornillo. Mantiene abierta válvula 2270-TV-11801. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TAL-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Baja Temperatura",
        "condiciones": [
            {"tipo": "relativo_a_SP", "operador": "-", "delta": 5, "unidad": "°C"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Temperatura baja. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-PALL-11834",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Baja Presión",
        "condiciones": [
            {"operador": "<", "valor": 275.8, "unidad": "kPa"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Presión baja. Secuencia Start/Stop. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-FIT-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Transmisor de Flujo",
        "condiciones": [
            {"operador": "<", "valor": 86.36, "unidad": "m3/h"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Flujo bajo. Secuencia Start/Stop. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-18",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "LIME SEPARATING CHAMBER - Transmisor de Nivel",
        "condiciones": [
            {"operador": "<", "valor": 5, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No operar agitadores ni bombas de recirculación o transferencia. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-18",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "LIME SEPARATING CHAMBER - Transmisor de Nivel",
        "condiciones": [
            {"operador": "<", "valor": 40, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No operar agitadores 1 y 2. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-18",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "LIME SEPARATING CHAMBER - Transmisor de Nivel",
        "condiciones": [
            {"operador": ">", "valor": 95, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Cerrar válvulas 2270-TV-11801 y 2270-TV-11808. Detener tornillo alimentador. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-19",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMP BOX - Transmisor de Nivel",
        "condiciones": [
            {"operador": "<", "valor": 5, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Alarma: bajo nivel en tanque. Bombas PP-208/209. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-19",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMP BOX - Transmisor de Nivel",
        "condiciones": [
            {"operador": "<", "valor": 40, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No operar agitador de caja de bomba de descarga. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-19",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMP BOX - Transmisor de Nivel",
        "condiciones": [
            {"operador": ">", "valor": 95, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No operar bomba de transferencia ZM-009-12/13. Alarma en DCS."
    },
    # === LIME SLAKER ===
    {
        "tag_equipo": "2270-ZM-009-06",
        "tag": "2270-TT-11824A",
        "nombre_equipo": "LIME SLAKER - Transmisor de Temperatura A",
        "condiciones": [
            {"operador": "between", "rango": [40, 60], "unidad": "°C"}
        ],
        "tipo_alarma": "NORMAL",
        "descripcion": "Operación normal entre 40°C y 60°C."
    },
    {
        "tag_equipo": "2270-ZM-009-06",
        "tag": "2270-TAH-11824A",
        "nombre_equipo": "LIME SLAKER - Alarma Alta Temperatura A",
        "condiciones": [
            {"operador": ">", "valor": 80, "unidad": "°C"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Temperatura alta. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-06",
        "tag": "2270-TT-11824B",
        "nombre_equipo": "LIME SLAKER - Transmisor de Temperatura B",
        "condiciones": [
            {"operador": "<", "valor": 65, "unidad": "°C"}
        ],
        "tipo_alarma": "NORMAL",
        "descripcion": "Operación normal si < 65°C."
    },
    {
        "tag_equipo": "2270-ZM-009-06",
        "tag": "2270-TAH-11824B",
        "nombre_equipo": "LIME SLAKER - Alarma Alta Temperatura B",
        "condiciones": [
            {"operador": ">", "valor": 80, "unidad": "°C"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Temperatura alta. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-06",
        "tag": "2270-TAHH-11824B",
        "nombre_equipo": "LIME SLAKER - Alarma Alta Alta Temperatura B",
        "condiciones": [
            {"operador": ">", "valor": 85, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Parada de emergencia. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-PDIA-11892",
        "nombre_equipo": "LUBRICATION - Presión de línea",
        "condiciones": [
            {"operador": "==", "valor": 70, "unidad": "kPa"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Presión específica detectada. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-PIT-11895",
        "nombre_equipo": "LUBRICATION - Transmisor de Presión",
        "condiciones": [
            {"operador": "<", "valor": 50, "unidad": "kPa"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Presión baja. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-TIT-11893",
        "nombre_equipo": "LUBRICATION - Temperatura T1",
        "condiciones": [
            {"operador": "<", "valor": 65, "unidad": "°C"}
        ],
        "tipo_alarma": "NORMAL",
        "descripcion": "Temperatura < 65°C. Operación normal."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-TAH-11893",
        "nombre_equipo": "LUBRICATION - Alarma Alta Temperatura T1",
        "condiciones": [
            {"operador": ">", "valor": 80, "unidad": "°C"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Temperatura alta. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-TAHH-11893",
        "nombre_equipo": "LUBRICATION - Alarma Alta Alta Temperatura T1",
        "condiciones": [
            {"operador": ">", "valor": 85, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Parada de emergencia. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-TIT-118934",
        "nombre_equipo": "LUBRICATION - Temperatura T2",
        "condiciones": [
            {"operador": "<", "valor": 45, "unidad": "°C"}
        ],
        "tipo_alarma": "NORMAL",
        "descripcion": "Temperatura < 45°C. Operación normal."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-TAH-11894",
        "nombre_equipo": "LUBRICATION - Alarma Alta Temperatura T2",
        "condiciones": [
            {"operador": ">", "valor": 70, "unidad": "°C"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Temperatura alta. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-TAHH-11894",
        "nombre_equipo": "LUBRICATION - Alarma Alta Alta Temperatura T2",
        "condiciones": [
            {"operador": ">", "valor": 80, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Parada de emergencia. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-FSL-11896",
        "nombre_equipo": "LUBRICATION - Flujo Línea Principal",
        "condiciones": [
            {"operador": ">", "valor": 10, "unidad": "L/min"}
        ],
        "tipo_alarma": "NORMAL",
        "descripcion": "Flujo mayor a 10 L/min. Operación normal."
    },
    {
        "tag_equipo": "2270-ZM-009-34",
        "tag": "2270-FAL-11896",
        "nombre_equipo": "LUBRICATION - Alarma Baja Flujo",
        "condiciones": [
            {"operador": "<", "valor": 5, "unidad": "L/min"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Flujo < 5 L/min. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-01",
        "tag": "2270-LIT-11825",
        "nombre_equipo": "LIME SILO - Interlock de carga",
        "condiciones": [
            {"operador": "<", "valor": 70, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Puede iniciar el proceso de carga si el nivel es menor al 70%."
    },
    {
        "tag_equipo": "2270-ZM-009-02A",
        "tag": "2270-LIT-11825",
        "nombre_equipo": "LIME UNLOADING COMPRESSOR - Interlock bloqueo",
        "condiciones": [
            {"operador": ">=", "valor": 70, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "El compresor no puede operar si el nivel es igual o mayor al 70%."
    },
    {
        "tag_equipo": "2270-ZM-009-02A",
        "tag": "2270-LIT-11825",
        "nombre_equipo": "LIME UNLOADING COMPRESSOR - Interlock habilitación",
        "condiciones": [
            {"operador": "==", "valor": 70, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "El compresor opera hasta el final de la descarga si el nivel es 70%."
    },
    {
        "tag_equipo": "2270-ZM-009-22",
        "tag": "2270-PDAH-11827",
        "nombre_equipo": "LIME SILO VENT - Alarma Alta Presión",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Alarma por condición de presión. Mostrar en DCS."
    },
    {
        "tag_equipo": "2260-ZM-009-02",
        "tag": "2270-YL-11826",
        "nombre_equipo": "LIME UNLOADING COMPRESSOR - Indicador de Nivel",
        "condiciones": [
            {"operador": "==", "valor": 1}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Alarma por switch de nivel activo (70% capacidad). Mostrar en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-19",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMPBOX - Interlock de carga a VORTEX",
        "condiciones": [
            {"operador": ">", "valor": 70, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Puede iniciar proceso de carga al VORTEX PRE-MIXER 2270-ZM-009-30"
    },
    {
        "tag_equipo": "2270-ZM-009-21",
        "tag": "2270-ZM-009-14A/B",
        "nombre_equipo": "LIME SILO ROTATORY VALVE - Interlock de activación",
        "condiciones": [
            {"custom": "MANUAL_GATE_VALVE == OPEN"},
            {"custom": "BOTTOM_BIN_14A == OFF"},
            {"custom": "BOTTOM_BIN_14B == OFF"},
            {"custom": "PNEUMATIC_GATE_VALVE == CLOSED"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Se puede iniciar válvula rotatoria del silo de cal."
    },
    {
        "tag_equipo": "2270-ZM-009-04",
        "tag": "2270-ZM-009-21",
        "nombre_equipo": "LIME SLAKER SCREW FEEDER - Interlock de arranque",
        "condiciones": [
            {"custom": "LIME_SILO_ROTARY_VALVE == STOPPED"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Se puede iniciar el tornillo alimentador si la válvula rotatoria está detenida."
    },
    {
        "tag_equipo": "2270-ZM-009-01",
        "tag": "2270-LIT-11825",
        "nombre_equipo": "LIME SILO - Alarma Bajo Nivel para carga VORTEX",
        "condiciones": [
            {"operador": "<", "valor": 5, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No se puede iniciar proceso de carga al VORTEX. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-21",
        "tag": "2270-SAL-11818",
        "nombre_equipo": "LIME SILO ROTARY VALVE - Estado detenido",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "La válvula rotatoria del silo está detenida. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-04",
        "tag": "2270-SAL-11817",
        "nombre_equipo": "LIME SLAKER SCREW FEEDER - Estado detenido",
        "condiciones": [
            {"operador": "==", "valor": 0}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "El alimentador de tornillo está detenido. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-20",
        "tag": "2270-ZV-11852",
        "nombre_equipo": "LIME SCRUBBER EXHAUST FAN",
        "condiciones": [
            {"custom": "SOLENOID_VALVE == OPEN"},
            {"custom": "STATE_2270-HS-11810 == ENABLED_FROM_DCS"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Permite iniciar ventilador de escape de cal."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TV-11801",
        "nombre_equipo": "VORTEX PRE-MIXER",
        "condiciones": [
            {"custom": "SCRUBBER_FAN_2270-ZM-009-20 == OPERATING"},
            {"custom": "VALVE_2270-TV-11801 == OPEN"},
            {"custom": "SCREW_FEEDER_2270-ZM-009-04 == OPERATING"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Permite iniciar Vortex Pre-Mixer si se cumplen todas las condiciones."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TIC-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Control de válvulas",
        "condiciones": [
            {"custom": "VALOR_TIC_11801 controla apertura de 2270-TV-11801 y 2270-HV-11808"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Control de apertura de válvulas TV/HV basado en valor TIC."
    },
    {
        "tag_equipo": "2270-ZM-009-31A/32A",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "AGITATORS LIME SEPARATING CHAMBERS 1 & 2",
        "condiciones": [
            {"operador": ">", "valor": 40, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Iniciar agitadores si nivel > 40%."
    },
    {
        "tag_equipo": "2270-ZM-009-08/09",
        "tag": "2270-ZM-009-31A/32",
        "nombre_equipo": "LIME RECYCLE PUMP",
        "condiciones": [
            {"custom": "TIEMPO_OPERACION_AGITADOR >= 2 minutos"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Inicia bomba de recirculación tras 2 min de operación del agitador."
    },
    {
        "tag_equipo": "2270-ZM-009-12A/13A",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "LIME TRANSFER PUMP",
        "condiciones": [
            {"operador": ">", "valor": 40, "unidad": "%"},
            {"operador": "<", "valor": 100, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Iniciar bomba de transferencia si nivel está entre 40% y 100%."
    }, 
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TAHH-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Alta Alta Temperatura",
        "condiciones": [
            {"tipo": "relativo_a_SP", "operador": "+", "delta": 10, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Secuencia start/stop. Mostrar alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TAH-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Alta Temperatura",
        "condiciones": [
            {"tipo": "relativo_a_SP", "operador": "+", "delta": 5, "unidad": "°C"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Detiene tornillo alimentador. Mantiene abierta válvula 2270-TV-11801. Alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-30",
        "tag": "2270-TAL-11801",
        "nombre_equipo": "VORTEX PRE-MIXER - Alarma Baja Temperatura",
        "condiciones": [
            {"tipo": "relativo_a_SP", "operador": "-", "delta": 5, "unidad": "°C"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "Temperatura baja. Mostrar alarma en DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-18",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "LIME SEPARATING CHAMBER - Nivel Muy Bajo",
        "condiciones": [
            {"operador": "<", "valor": 5, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No se puede operar agitador, bomba de recirculación ni bomba de transferencia. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-18",
        "tag": "2270-LIT-11850",
        "nombre_equipo": "LIME SEPARATING CHAMBER - Nivel Muy Alto",
        "condiciones": [
            {"operador": ">", "valor": 95, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "Cerrar válvula 2270-TV-11801 y HV-11808. Detener tornillo alimentador. Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-29",
        "tag": "2270-ZV-11880",
        "nombre_equipo": "LIME SCRUBBER EXHAUST FAN",
        "condiciones": [
            {"custom": "VALVULA_SOLENOIDE_2270-ZV-11880 == OPEN"},
            {"custom": "STATE_2270-HS-11810 == ENABLED_FROM_DCS"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Puede operar el ventilador de extracción."
    },
    {
        "tag_equipo": "2270-ZM-009-12/13",
        "tag": "2270-LALL-11850",
        "nombre_equipo": "LIME TRANSFER PUMP",
        "condiciones": [
            {"custom": "LALL-11850 debe estar presente"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Permite iniciar bombas de transferencia ZM-009-12 o 13."
    },
    {
        "tag_equipo": "2270-ZM-009-2",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMPBOX - Interlock de agitador",
        "condiciones": [
            {"operador": ">=", "valor": 40, "unidad": "%"}
        ],
        "tipo_alarma": "INTERLOCK",
        "descripcion": "Permite iniciar agitador de descarga (2270-ZM-009-23)."
    },
    {
        "tag_equipo": "2270-ZM-009-19",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMP BOX - Nivel Bajo",
        "condiciones": [
            {"operador": "<", "valor": 40, "unidad": "%"}
        ],
        "tipo_alarma": "WARNING",
        "descripcion": "No se puede operar agitador de caja de bomba de descarga (2270-ZM-009-23). Alarma DCS."
    },
    {
        "tag_equipo": "2270-ZM-009-19",
        "tag": "2270-LIT-11845",
        "nombre_equipo": "LIME SLAKER DISCHARGE PUMP BOX - Nivel Alto Alto",
        "condiciones": [
            {"operador": ">", "valor": 95, "unidad": "%"}
        ],
        "tipo_alarma": "FAULT",
        "descripcion": "No operar bomba de transferencia (2270-ZM-009-12/13). Detener preparación de lechada. Alarma DCS."
    }
]

from collections import defaultdict
import json
import copy

sensores_por_tag = defaultdict(lambda: {"equipos": set(), "condiciones": []})

for sensor in sensores_definidos:
    tag = sensor["tag"]
    equipo = sensor.get("tag_equipo", "SIN_EQUIPO")
    nombre_equipo = sensor.get("nombre_equipo", "")

    sensores_por_tag[tag]["equipos"].add(equipo)

    for condicion in sensor["condiciones"]:
        nueva_cond = copy.deepcopy(condicion)
        nueva_cond["tipo_alarma"] = sensor["tipo_alarma"]
        nueva_cond["descripcion"] = sensor["descripcion"]
        nueva_cond["nombre_equipo"] = nombre_equipo
        sensores_por_tag[tag]["condiciones"].append(nueva_cond)

# Finalmente conviertes el set en lista
for tag in sensores_por_tag:
    sensores_por_tag[tag]["equipos"] = list(sensores_por_tag[tag]["equipos"])
    
with open("salida_sensores.json", "w", encoding="utf-8") as f:
    json.dump(sensores_por_tag, f, indent=4, ensure_ascii=False)