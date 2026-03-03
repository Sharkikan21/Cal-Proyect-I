"""
Generador de datos del simulador de planta de cal — La Historia de la Cal (5 etapas).
Simulación física y lógica (Teoría de Guillermo Coloma), sin valores puramente aleatorios.
Salida: plant_simulator_output.csv con TAGs exactos e interdependencias correctas.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# Columnas exactas del CSV (orden: timestamp + Fase 1 → 5)
OUTPUT_COLUMNS = [
    "timestamp",
    # Fase 1 — Silo
    "2270-LIT-11825",   # AI: Nivel silo 0–100%
    "2270-LSHH-11826",  # DI: Alarma nivel alto-alto
    "2270-LSLL-11829",  # DI: Alarma nivel bajo-bajo
    "2270-PDAH-11827",  # AI: Presión filtro
    # Fase 1 — Instrumentación eléctrica y control (Blower ZM-009-02, Activador ZM-009-14)
    "2270-ZM-009-02_CMD_RUN",
    "2270-ZM-009-02_RUN_FB",
    "2270-ZM-009-02_VFD_FAULT",
    "2270-ZM-009-02_SPEED_REF",
    "2270-ZM-009-02_SPEED_FB",
    "2270-ZM-009-02_MOTOR_CURRENT",
    "2270-ZM-009-14_CMD_RUN",
    "2270-ZM-009-14_RUN_FB",
    "2270-ZM-009-14_MOTOR_CURRENT",
    # Fase 2 — Dosificación
    "2280-WI-01769",    # AI: Pesómetro Ton/h
    "2270-SAL-11817",   # DI: Estado tornillo
    "2270-SAL-11818",   # DI: Válvula rotatoria
    # Fase 2 — Instrumentación eléctrica (Tornillo ZM-009-04, Válvula SAL-11818)
    "2270-ZM-009-04_CMD_RUN",
    "2270-ZM-009-04_RUN_FB",
    "2270-ZM-009-04_SPEED_REF",
    "2270-ZM-009-04_SPEED_FB",
    "2270-ZM-009-04_MOTOR_CURRENT",
    "2270-ZM-009-04_MOTOR_POWER",
    "2270-ZM-009-04_TRANSMISSION_FAULT",  # 1 si SPEED_REF>0 y SPEED_FB=0 por ≥3 pasos
    "2270-SAL-11818_MOTOR_CURRENT",
    "2270-SAL-11818_SPEED_FB",
    # Fase 3 — Hidratación
    "2270-FIT-11801",   # AI: Flujo agua
    "2270-TT-11824A",   # AI: Temperatura slaker (redundante, base)
    "2270-TT-11824B",   # AI: Temperatura slaker (redundante, con desviación)
    "2270-TAHH-11801",  # DI: Alarma temperatura alta-alta (>90°C)
    "2270-PALL-11834",  # AI: Presión agua (kPa)
    "2270-ZM-009-06",   # DI: Motor slaker
    "2270-ZM-009-06_CMD_RUN",
    "2270-ZM-009-06_RUN_FB",
    "2270-ZM-009-06_SPEED_FB",
    "2270-ZM-009-06_MOTOR_CURRENT",
    "2270-ZM-009-06_MOTOR_POWER",
    # Fase 4 — Separación
    "2270-LIT-11850",   # AI: Nivel cámara
    "2270-ZM-009-31",   # DI: Agitador
    "2270-ZM-009-31_CMD_RUN",
    "2270-ZM-009-31_RUN_FB",
    "2270-ZM-009-31_SPEED_REF",
    "2270-ZM-009-31_SPEED_FB",
    "2270-ZM-009-31_MOTOR_CURRENT",
    "2270-ZM-009-31_DRY_RUN_FAULT",  # 1 si nivel < 5% y agitador en marcha (interlock aspas)
    # Fase 5 — Distribución y almacenamiento final
    "DT-2270-HDR",      # AI: Densidad lechada g/cm³
    "pHT-2270-RGH",     # AI: pH
    "2270-PIT-11895",   # AI: Presión aceite bombas (vinculada a PP-208)
    "2270-TK-068_AG_CMD_RUN", "2270-TK-068_AG_RUN_FB", "2270-TK-068_AG_MOTOR_CURRENT",
    "2270-TK-069_AG_CMD_RUN", "2270-TK-069_AG_RUN_FB",
    "2270-PP-208_CMD_RUN", "2270-PP-208_RUN_FB", "2270-PP-208_SPEED_FB", "2270-PP-208_MOTOR_CURRENT",
    "2270-PP-098_CMD_RUN", "2270-PP-098_RUN_FB",
    "2220-PP-300_CMD_RUN", "2220-PP-300_RUN_FB",
]

NUM_STEPS = 100
# Relación agua/cal típica Coloma ~4:1 → densidad estable ~1.15–1.25 g/cm³
RATIO_AGUA_CAL = 4.0
DENSIDAD_MIN, DENSIDAD_MAX = 1.15, 1.25
TEMP_AMBIENTE = 25.0
TEMP_ESTABLE_MIN, TEMP_ESTABLE_MAX = 75.0, 85.0
# Pesómetro cuando tornillo ON (Ton/h)
WI_MIN, WI_MAX = 5.0, 15.0
# Consumo de nivel silo por paso cuando tornillo ON (% por paso)
CONSUMO_NIVEL_POR_PASO = 0.08
# Constante de tiempo para curva de temperatura (pasos)
TAU_TEMP = 18.0
# Blower (ZM-009-02): setpoint 50 Hz, constante de tiempo para SPEED_FB → SPEED_REF
SPEED_REF_BLOWER_HZ = 50.0
TAU_SPEED_BLOWER = 0.2  # factor asintótico por paso (speed_fb → speed_ref)
# Corriente blower: base ~25 A a 50 Hz, aporte por presión filtro
BLOWER_CURRENT_BASE_A = 25.0
BLOWER_CURRENT_PRESSURE_FACTOR = 8.0  # A extra por unidad de presión filtro
# Activador de fondo (ZM-009-14): corriente base + ruido (vibración)
ACTIVADOR_CURRENT_BASE_A = 4.0
ACTIVADOR_CURRENT_NOISE_A = 0.5
# Fase 2 — Tornillo alimentador (ZM-009-04): 10 Ton/h ↔ 35 Hz (transferencia de masa Coloma)
WI_TO_SPEED_HZ = 3.5   # Hz por Ton/h → 10 Ton/h = 35 Hz
# Corriente y potencia tornillo: lineales con flujo (Ton/h); mayor flujo = mayor torque
SCREW_CURRENT_BASE_A = 8.0
SCREW_CURRENT_PER_TONH = 1.8   # A por Ton/h
SCREW_POWER_BASE_KW = 2.0
SCREW_POWER_PER_TONH_KW = 0.5  # kW por Ton/h
# Válvula rotatoria (SAL-11818): velocidad fija, corriente baja estable
VALVE_SPEED_FB_HZ = 20.0
VALVE_MOTOR_CURRENT_A = 2.5
TRANSMISSION_FAULT_STEPS = 3  # pasos con SPEED_REF>0 y SPEED_FB=0 para alarma
# Fase 3 — Slaker: temperatura dual ±0.5°C; presión agua; motor proporcional a densidad
TEMP_SLAKER_DEVIATION_C = 0.5  # desviación TT-11824B respecto a A
TAHH_TEMP_THRESHOLD_C = 90.0   # TAHH-11801 = 1 si max(A,B) > 90°C
PRESION_AGUA_NOMINAL_KPA = 300.0
PRESION_AGUA_CAIDA_TRANSITORIA_KPA = 15.0  # caída cuando flujo sube bruscamente
SLAKER_SPEED_FB_HZ = 35.0      # velocidad nominal motor slaker
SLAKER_CURRENT_BASE_A = 8.0
SLAKER_CURRENT_DENSITY_FACTOR = 40.0  # A por (densidad - 1.0); más espeso = más torque
SLAKER_POWER_BASE_KW = 4.0
SLAKER_POWER_DENSITY_FACTOR = 25.0     # kW por (densidad - 1.0)
# Fase 4 — Agitador cámara (ZM-009-31): comando por nivel > 40%; rampa 5 s; corriente por densidad + 20% re-arranque
AGITATOR_LEVEL_THRESHOLD_PCT = 40.0
AGITATOR_RAMP_STEPS = 5               # pasos para rampa 0→100% (5 s)
AGITATOR_CURRENT_BASE_A = 6.0
AGITATOR_CURRENT_DENSITY_FACTOR = 30.0  # A por (densidad - 1.0)
AGITATOR_RESTART_CURRENT_FACTOR = 1.2   # +20% corriente por sedimentación al re-arranque
# Fase 5 — Tanques acondicionamiento (TK-068/069), bombas distribución (PP-208, PP-098, 2220-PP-300)
TK_068_AG_MOTOR_CURRENT_A = 3.0        # agitador tanque, corriente baja constante
PP_208_SPEED_FB_MIN_HZ, PP_208_SPEED_FB_MAX_HZ = 40.0, 50.0
PP_208_CURRENT_BASE_A = 25.0
PP_208_CURRENT_DENSITY_FACTOR = 15.0   # A por (densidad - 1.0)
DENSIDAD_UMBRAL_PH = 1.10              # por debajo: pH cae rápido (lechada pobre Coloma)
PH_NOMINAL_BASE = 12.2
PH_LOG_FACTOR = 0.8                    # pH como función log de densidad


def _curva_reactividad(paso: int, paso_inicio_reaccion: int) -> float:
    """
    Curva de reactividad: temperatura sube de 25°C y se estabiliza entre 75–85°C.
    T(paso) = T_amb + (T_estable - T_amb) * (1 - exp(-t/tau))
    """
    if paso < paso_inicio_reaccion:
        return TEMP_AMBIENTE
    t = paso - paso_inicio_reaccion
    T_estable = (TEMP_ESTABLE_MIN + TEMP_ESTABLE_MAX) / 2.0
    delta = T_estable - TEMP_AMBIENTE
    return TEMP_AMBIENTE + delta * (1.0 - np.exp(-t / TAU_TEMP))


def _densidad_desde_ratio(ratio_agua_cal: float) -> float:
    """
    Densidad lechada a partir de relación agua/cal (Coloma ~4:1 → 1.15–1.25 g/cm³).
    Más agua → menor densidad; más cal → mayor densidad.
    """
    # ratio 4:1 → densidad objetivo ~1.20; desviaciones suaves
    objetivo = 1.20
    if ratio_agua_cal > 5.0:
        return max(DENSIDAD_MIN, objetivo - 0.05)
    if ratio_agua_cal < 3.0:
        return min(DENSIDAD_MAX, objetivo + 0.05)
    return np.clip(objetivo + (3.5 - ratio_agua_cal) * 0.02, DENSIDAD_MIN, DENSIDAD_MAX)


def _ph_desde_densidad(densidad: float) -> float:
    """
    pH como función de la densidad (estabilidad del reactivo, Coloma).
    Función logarítmica; si densidad < 1.10, pH baja rápidamente (lechada pobre).
    """
    if densidad >= DENSIDAD_UMBRAL_PH:
        # Zona estable: relación logarítmica suave
        ph = PH_NOMINAL_BASE + PH_LOG_FACTOR * np.log10(densidad / 1.18)
        return np.clip(ph, 11.5, 12.6)
    # Densidad < 1.10: caída rápida del pH
    ph = 11.0 + 10.0 * (densidad - 1.0)
    return np.clip(ph, 9.0, 12.0)


def run_simulation(
    num_steps: int = NUM_STEPS,
    nivel_silo_inicial: float = 70.0,
    paso_tornillo_on: int = 5,
    paso_tornillo_off: int = 95,
    paso_agua_on: int = 5,
    dt_seconds: float = 1.0,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    """
    Ejecuta la simulación física de las 5 fases para `num_steps` pasos.
    - Consumo de cal: si tornillo ON, nivel silo baja y pesómetro 5–15 Ton/h.
    - Reacción: con flujo cal y agua, temperatura sigue curva de reactividad 25°C → 75–85°C.
    - Densidad: calculada por relación agua/cal ~4:1 → 1.15–1.25 g/cm³.
    - Alarmas: LSHH=1 si nivel > 95%; LSLL=1 si nivel < 5%.
    """
    if seed is not None:
        np.random.seed(seed)

    t0 = datetime.now(timezone.utc)
    rows = []
    nivel_silo = nivel_silo_inicial
    nivel_camara = 45.0
    # Presión filtro: depende de nivel y de si hay dosificación (polvo)
    presion_filtro_base = 0.5
    # Presión aceite bombas (PSI), estable en operación
    presion_aceite_nominal = 65.0
    # Estado previo para Blower (RUN_FB con 1 paso de retraso; SPEED_FB asintótica)
    cmd_run_blower_prev = 0
    speed_fb_blower = 0.0
    # Estado previo Fase 2: RUN_FB con 1 paso de retraso; contador falla de transmisión
    cmd_run_tornillo_prev = 0
    cmd_run_valvula_prev = 0
    speed_fault_steps = 0
    flujo_agua_prev = 0.0
    cmd_run_slaker_prev = 0
    cmd_run_agitador_prev = 0
    run_fb_agitador_prev = 0
    steps_agitador_on = 0
    cmd_run_pp208_prev = 0
    cmd_run_pp098_prev = 0
    cmd_run_pp300_prev = 0

    for paso in range(num_steps):
        ts = t0 + timedelta(seconds=paso * dt_seconds)
        timestamp_iso = ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        # --- Fase 2: Dosificación (causa) ---
        tornillo_on = 1 if paso_tornillo_on <= paso < paso_tornillo_off else 0
        valvula_on = 1 if paso_tornillo_on <= paso < paso_tornillo_off else 0
        if tornillo_on:
            # Pesómetro 5–15 Ton/h (ligera variación física, no aleatoria pura)
            wi = WI_MIN + (WI_MAX - WI_MIN) * (0.5 + 0.1 * np.sin(paso * 0.3) + 0.05 * np.cos(paso * 0.7))
            wi = np.clip(wi, WI_MIN, WI_MAX)
        else:
            wi = 0.0

        # --- Fase 2 — Tornillo (ZM-009-04) y Válvula rotatoria (SAL-11818) — transferencia de masa Coloma
        cmd_run_tornillo = tornillo_on
        cmd_run_valvula = valvula_on
        run_fb_tornillo = cmd_run_tornillo_prev
        run_fb_valvula = cmd_run_valvula_prev
        # SPEED_REF tornillo: proporcional al pesómetro (10 Ton/h → 35 Hz)
        speed_ref_tornillo = wi * WI_TO_SPEED_HZ
        speed_ref_tornillo = np.clip(speed_ref_tornillo, 0.0, 55.0)
        if run_fb_tornillo:
            speed_fb_tornillo = speed_ref_tornillo  # vinculado directamente al flujo (ley de transferencia)
        else:
            speed_fb_tornillo = 0.0
        # Corriente y potencia tornillo: lineales con flujo (Ton/h); cero si motor parado
        if run_fb_tornillo:
            motor_current_tornillo = SCREW_CURRENT_BASE_A + SCREW_CURRENT_PER_TONH * wi
            motor_power_tornillo = SCREW_POWER_BASE_KW + SCREW_POWER_PER_TONH_KW * wi
            motor_current_tornillo = np.clip(motor_current_tornillo, 0.5, 35.0)
            motor_power_tornillo = np.clip(motor_power_tornillo, 0.2, 12.0)
        else:
            motor_current_tornillo = 0.0
            motor_power_tornillo = 0.0
        # Discrepancia SPEED_REF > 0 y SPEED_FB = 0 por ≥3 pasos → Falla de transmisión
        if speed_ref_tornillo > 0 and speed_fb_tornillo == 0:
            speed_fault_steps = speed_fault_steps + 1
        else:
            speed_fault_steps = 0
        transmission_fault = 1 if speed_fault_steps >= TRANSMISSION_FAULT_STEPS else 0
        # Válvula rotatoria: activa con tornillo (sello del silo); velocidad fija 20 Hz, corriente estable
        if run_fb_valvula:
            valve_speed_fb = VALVE_SPEED_FB_HZ
            valve_motor_current = VALVE_MOTOR_CURRENT_A + 0.1 * np.sin(paso * 0.5)  # estable con poco ruido
            valve_motor_current = np.clip(valve_motor_current, 2.0, 3.5)
        else:
            valve_speed_fb = 0.0
            valve_motor_current = 0.0
        cmd_run_tornillo_prev = cmd_run_tornillo
        cmd_run_valvula_prev = cmd_run_valvula

        # --- Fase 1: Silo (efecto del consumo) ---
        if tornillo_on:
            nivel_silo = nivel_silo - CONSUMO_NIVEL_POR_PASO
        nivel_silo = np.clip(nivel_silo, 0.0, 100.0)
        lshh = 1 if nivel_silo > 95.0 else 0
        lsll = 1 if nivel_silo < 5.0 else 0
        # Presión filtro: sube con nivel (más carga) y con dosificación (polvo)
        pda = presion_filtro_base + 0.008 * nivel_silo + (0.15 if tornillo_on else 0.0)
        pda = np.clip(pda, 0.2, 1.2)

        # --- Fase 1 — Blower (ZM-009-02) y Activador de fondo (ZM-009-14) ---
        # Descarga neumática: blower se activa cuando hay dosificación (tornillo)
        descarga_neumatica = tornillo_on
        cmd_run_blower = 1 if descarga_neumatica else 0
        run_fb_blower = cmd_run_blower_prev  # RUN_FB sigue al comando con 1 paso de retraso
        vfd_fault_blower = 0  # sin fallo en simulación normal
        speed_ref_blower = SPEED_REF_BLOWER_HZ
        if run_fb_blower:
            speed_fb_blower = speed_fb_blower + TAU_SPEED_BLOWER * (speed_ref_blower - speed_fb_blower)
        else:
            speed_fb_blower = speed_fb_blower * 0.85  # rampa de bajada
        speed_fb_blower = np.clip(speed_fb_blower, 0.0, speed_ref_blower)
        # Corriente blower: proporcional a velocidad; aumenta con presión del filtro (mayor esfuerzo)
        if run_fb_blower and not vfd_fault_blower:
            motor_current_blower = (
                BLOWER_CURRENT_BASE_A * (speed_fb_blower / speed_ref_blower)
                + BLOWER_CURRENT_PRESSURE_FACTOR * (pda - 0.2)
            )
            motor_current_blower = np.clip(motor_current_blower, 0.5, 55.0)
        else:
            motor_current_blower = 0.0
        cmd_run_blower_prev = cmd_run_blower

        # Activador de fondo (ZM-009-14): ON cuando tornillo Fase 2 opera (evitar rat-hole / puenteo Coloma)
        activador_cmd = 1 if tornillo_on else 0
        activador_fb = activador_cmd
        if activador_fb:
            activador_current = ACTIVADOR_CURRENT_BASE_A + (np.random.rand() - 0.5) * 2.0 * ACTIVADOR_CURRENT_NOISE_A
            activador_current = np.clip(activador_current, 0.5, 8.0)
        else:
            activador_current = 0.0

        # --- Fase 3: Hidratación (flujo agua + curva de temperatura) ---
        agua_on = 1 if paso_agua_on <= paso < paso_tornillo_off else 0
        if agua_on and tornillo_on:
            # Flujo agua proporcional a relación 4:1 con pesómetro
            flujo_agua = wi * RATIO_AGUA_CAL
            flujo_agua = np.clip(flujo_agua, 20.0, 60.0)
            motor_slaker = 1
            paso_inicio_reaccion = min(paso_tornillo_on, paso_agua_on)
            temp_slaker_base = _curva_reactividad(paso, paso_inicio_reaccion)
            temp_slaker_base = temp_slaker_base + 0.3 * np.sin(paso * 0.2)
            temp_slaker_base = np.clip(temp_slaker_base, TEMP_AMBIENTE, TEMP_ESTABLE_MAX + 2.0)
            # Sensores duales: A = base, B = base + desviación ±0.5°C (redundancia real)
            temp_slaker_a = temp_slaker_base
            temp_slaker_b = temp_slaker_base + (np.random.rand() - 0.5) * 2.0 * TEMP_SLAKER_DEVIATION_C
            temp_slaker_b = np.clip(temp_slaker_b, TEMP_AMBIENTE, TEMP_ESTABLE_MAX + 3.0)
        else:
            flujo_agua = 0.0
            motor_slaker = 0
            if paso < paso_agua_on:
                temp_slaker_a = TEMP_AMBIENTE
                temp_slaker_b = TEMP_AMBIENTE
            else:
                temp_cool = max(TEMP_AMBIENTE, 80.0 - (paso - paso_tornillo_off) * 0.5)
                temp_slaker_a = temp_cool
                temp_slaker_b = temp_cool + (np.random.rand() - 0.5) * 2.0 * TEMP_SLAKER_DEVIATION_C
                temp_slaker_b = np.clip(temp_slaker_b, TEMP_AMBIENTE, 95.0)
        # TAHH-11801: señal digital = 1 si cualquiera de las temperaturas supera 90°C
        tahh_11801 = 1 if max(temp_slaker_a, temp_slaker_b) > TAHH_TEMP_THRESHOLD_C else 0
        # Presión agua (PALL-11834): estable ~300 kPa con flujo; caída transitoria si flujo sube bruscamente
        if flujo_agua > 0:
            presion_agua = PRESION_AGUA_NOMINAL_KPA
            if flujo_agua_prev > 0 and flujo_agua > flujo_agua_prev * 1.15:
                presion_agua = PRESION_AGUA_NOMINAL_KPA - PRESION_AGUA_CAIDA_TRANSITORIA_KPA
            presion_agua = np.clip(presion_agua, 250.0, 320.0)
        else:
            presion_agua = 0.0
        flujo_agua_prev = flujo_agua
        # Motor slaker: CMD_RUN y RUN_FB con retraso 1 paso; SPEED_FB y eléctricos se calculan tras tener densidad
        cmd_run_slaker = motor_slaker
        run_fb_slaker = cmd_run_slaker_prev
        cmd_run_slaker_prev = cmd_run_slaker

        # --- Fase 4: Separación ---
        if tornillo_on and agua_on:
            # Nivel cámara sube con alimentación, con balance de salida
            nivel_camara = nivel_camara + 0.06 - 0.04
        else:
            nivel_camara = nivel_camara - 0.02
        nivel_camara = np.clip(nivel_camara, 10.0, 80.0)
        # Agitador (ZM-009-31): CMD_RUN si nivel > 40%; RUN_FB sigue al comando; rampa velocidad 0→100% en 5 s
        cmd_run_agitador = 1 if nivel_camara > AGITATOR_LEVEL_THRESHOLD_PCT else 0
        run_fb_agitador = cmd_run_agitador_prev
        if run_fb_agitador:
            steps_agitador_on = min(AGITATOR_RAMP_STEPS, steps_agitador_on + 1)
        else:
            steps_agitador_on = 0
        speed_ref_agitador = 100.0 if cmd_run_agitador else 0.0
        speed_fb_agitador = 100.0 * (steps_agitador_on / AGITATOR_RAMP_STEPS) if run_fb_agitador else 0.0
        cmd_run_agitador_prev = cmd_run_agitador
        agitador = int(run_fb_agitador)  # DI refleja estado real de marcha

        # --- Fase 5: Distribución y almacenamiento final (calidad, bombas, tanques) ---
        produccion = wi > 0 and flujo_agua > 0
        if produccion:
            ratio = flujo_agua / wi
            densidad = _densidad_desde_ratio(ratio)
            ph = _ph_desde_densidad(densidad)
        else:
            densidad = 1.0
            ph = 7.5
        # Bombas: PP-208 (principal a mina), PP-098, 2220-PP-300 — RUN_FB con 1 paso de retraso
        cmd_run_pp208 = 1 if produccion else 0
        cmd_run_pp098 = 1 if produccion else 0
        cmd_run_pp300 = 1 if produccion else 0
        run_fb_pp208 = cmd_run_pp208_prev
        run_fb_pp098 = cmd_run_pp098_prev
        run_fb_pp300 = cmd_run_pp300_prev
        # Presión aceite (PIT-11895) vinculada a marcha de PP-208: nominal ~65 PSI con bomba, ~45 sin
        if run_fb_pp208:
            presion_aceite = presion_aceite_nominal + 2.0 * np.sin(paso * 0.1)
            presion_aceite = np.clip(presion_aceite, 60.0, 75.0)
        else:
            presion_aceite = 45.0
        # PP-208: SPEED_FB oscila 40–50 Hz; MOTOR_CURRENT con densidad (más densa = más corriente)
        if run_fb_pp208:
            speed_fb_pp208 = PP_208_SPEED_FB_MIN_HZ + (PP_208_SPEED_FB_MAX_HZ - PP_208_SPEED_FB_MIN_HZ) * (0.5 + 0.1 * np.sin(paso * 0.4))
            speed_fb_pp208 = np.clip(speed_fb_pp208, PP_208_SPEED_FB_MIN_HZ, PP_208_SPEED_FB_MAX_HZ)
            motor_current_pp208 = PP_208_CURRENT_BASE_A + PP_208_CURRENT_DENSITY_FACTOR * (densidad - 1.0)
            motor_current_pp208 = np.clip(motor_current_pp208, 5.0, 65.0)
        else:
            speed_fb_pp208 = 0.0
            motor_current_pp208 = 0.0
        cmd_run_pp208_prev = cmd_run_pp208
        cmd_run_pp098_prev = cmd_run_pp098
        cmd_run_pp300_prev = cmd_run_pp300
        # Agitadores tanques (TK-068/069): siempre en marcha para evitar sedimentación
        tk068_ag_cmd_run = 1
        tk068_ag_run_fb = 1
        tk068_ag_motor_current = TK_068_AG_MOTOR_CURRENT_A + 0.1 * np.sin(paso * 0.3)
        tk068_ag_motor_current = np.clip(tk068_ag_motor_current, 2.5, 3.5)
        tk069_ag_cmd_run = 1
        tk069_ag_run_fb = 1

        # --- Fase 3 (continuación): Motor Slaker — corriente/potencia proporcionales a densidad ---
        if run_fb_slaker and densidad >= 1.0:
            motor_current_slaker = SLAKER_CURRENT_BASE_A + SLAKER_CURRENT_DENSITY_FACTOR * (densidad - 1.0)
            motor_power_slaker = SLAKER_POWER_BASE_KW + SLAKER_POWER_DENSITY_FACTOR * (densidad - 1.0)
            motor_current_slaker = np.clip(motor_current_slaker, 0.5, 28.0)
            motor_power_slaker = np.clip(motor_power_slaker, 0.2, 12.0)
        else:
            motor_current_slaker = 0.0
            motor_power_slaker = 0.0
        speed_fb_slaker = SLAKER_SPEED_FB_HZ if run_fb_slaker else 0.0

        # --- Fase 4 (continuación): Corriente agitador (proporcional a densidad + 20% si re-arranque) ---
        if run_fb_agitador and densidad >= 1.0:
            motor_current_agitador = AGITATOR_CURRENT_BASE_A + AGITATOR_CURRENT_DENSITY_FACTOR * (densidad - 1.0)
            if run_fb_agitador_prev == 0:  # re-arranque: mayor corriente por sedimentación (Coloma)
                motor_current_agitador *= AGITATOR_RESTART_CURRENT_FACTOR
            motor_current_agitador = np.clip(motor_current_agitador, 0.5, 30.0)
        else:
            motor_current_agitador = 0.0
        dry_run_fault = 1 if (nivel_camara < 5.0 and run_fb_agitador) else 0
        run_fb_agitador_prev = run_fb_agitador

        row = {
            "timestamp": timestamp_iso,
            "2270-LIT-11825": round(nivel_silo, 4),
            "2270-LSHH-11826": int(lshh),
            "2270-LSLL-11829": int(lsll),
            "2270-PDAH-11827": round(pda, 4),
            "2270-ZM-009-02_CMD_RUN": int(cmd_run_blower),
            "2270-ZM-009-02_RUN_FB": int(run_fb_blower),
            "2270-ZM-009-02_VFD_FAULT": int(vfd_fault_blower),
            "2270-ZM-009-02_SPEED_REF": round(speed_ref_blower, 4),
            "2270-ZM-009-02_SPEED_FB": round(speed_fb_blower, 4),
            "2270-ZM-009-02_MOTOR_CURRENT": round(motor_current_blower, 4),
            "2270-ZM-009-14_CMD_RUN": int(activador_cmd),
            "2270-ZM-009-14_RUN_FB": int(activador_fb),
            "2270-ZM-009-14_MOTOR_CURRENT": round(activador_current, 4),
            "2280-WI-01769": round(wi, 4),
            "2270-SAL-11817": int(tornillo_on),
            "2270-SAL-11818": int(valvula_on),
            "2270-ZM-009-04_CMD_RUN": int(cmd_run_tornillo),
            "2270-ZM-009-04_RUN_FB": int(run_fb_tornillo),
            "2270-ZM-009-04_SPEED_REF": round(speed_ref_tornillo, 4),
            "2270-ZM-009-04_SPEED_FB": round(speed_fb_tornillo, 4),
            "2270-ZM-009-04_MOTOR_CURRENT": round(motor_current_tornillo, 4),
            "2270-ZM-009-04_MOTOR_POWER": round(motor_power_tornillo, 4),
            "2270-ZM-009-04_TRANSMISSION_FAULT": int(transmission_fault),
            "2270-SAL-11818_MOTOR_CURRENT": round(valve_motor_current, 4),
            "2270-SAL-11818_SPEED_FB": round(valve_speed_fb, 4),
            "2270-FIT-11801": round(flujo_agua, 4),
            "2270-TT-11824A": round(float(temp_slaker_a), 4),
            "2270-TT-11824B": round(float(temp_slaker_b), 4),
            "2270-TAHH-11801": int(tahh_11801),
            "2270-PALL-11834": round(presion_agua, 4),
            "2270-ZM-009-06": int(motor_slaker),
            "2270-ZM-009-06_CMD_RUN": int(cmd_run_slaker),
            "2270-ZM-009-06_RUN_FB": int(run_fb_slaker),
            "2270-ZM-009-06_SPEED_FB": round(speed_fb_slaker, 4),
            "2270-ZM-009-06_MOTOR_CURRENT": round(motor_current_slaker, 4),
            "2270-ZM-009-06_MOTOR_POWER": round(motor_power_slaker, 4),
            "2270-LIT-11850": round(nivel_camara, 4),
            "2270-ZM-009-31": int(agitador),
            "2270-ZM-009-31_CMD_RUN": int(cmd_run_agitador),
            "2270-ZM-009-31_RUN_FB": int(run_fb_agitador),
            "2270-ZM-009-31_SPEED_REF": round(speed_ref_agitador, 4),
            "2270-ZM-009-31_SPEED_FB": round(speed_fb_agitador, 4),
            "2270-ZM-009-31_MOTOR_CURRENT": round(motor_current_agitador, 4),
            "2270-ZM-009-31_DRY_RUN_FAULT": int(dry_run_fault),
            "DT-2270-HDR": round(densidad, 4),
            "pHT-2270-RGH": round(ph, 4),
            "2270-PIT-11895": round(presion_aceite, 4),
            "2270-TK-068_AG_CMD_RUN": int(tk068_ag_cmd_run),
            "2270-TK-068_AG_RUN_FB": int(tk068_ag_run_fb),
            "2270-TK-068_AG_MOTOR_CURRENT": round(tk068_ag_motor_current, 4),
            "2270-TK-069_AG_CMD_RUN": int(tk069_ag_cmd_run),
            "2270-TK-069_AG_RUN_FB": int(tk069_ag_run_fb),
            "2270-PP-208_CMD_RUN": int(cmd_run_pp208),
            "2270-PP-208_RUN_FB": int(run_fb_pp208),
            "2270-PP-208_SPEED_FB": round(speed_fb_pp208, 4),
            "2270-PP-208_MOTOR_CURRENT": round(motor_current_pp208, 4),
            "2270-PP-098_CMD_RUN": int(cmd_run_pp098),
            "2270-PP-098_RUN_FB": int(run_fb_pp098),
            "2220-PP-300_CMD_RUN": int(cmd_run_pp300),
            "2220-PP-300_RUN_FB": int(run_fb_pp300),
        }
        rows.append(row)

    df = pd.DataFrame(rows, columns=OUTPUT_COLUMNS)
    return df


def generate_data_to_csv(
    num_steps: int = NUM_STEPS,
    filepath: str | Path = "plant_simulator_output.csv",
    **kwargs,
) -> pd.DataFrame:
    """
    Genera la simulación y guarda el CSV en `filepath`.
    Usa pandas y columna `timestamp` en formato ISO8601.
    """
    df = run_simulation(num_steps=num_steps, **kwargs)
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8")
    return df


# Compatibilidad con código que instanciaba PlantSimulator
class PlantSimulator:
    """
    Wrapper que mantiene la interfaz generate_data_to_csv(seconds, filepath)
    y tick() para la API. Internamente usa la simulación física de 100 pasos.
    """

    def __init__(self):
        self.mode = "inactivo"
        self._cached_df: Optional[pd.DataFrame] = None
        self._tick_index = 0

    def tick(self) -> dict:
        """
        Devuelve una fila de datos de sensores (un paso de simulación) como dict.
        Usa una simulación precalculada y cicla por sus filas para coherencia.
        """
        if self._cached_df is None:
            self._cached_df = run_simulation(num_steps=NUM_STEPS, seed=42)
        idx = self._tick_index % len(self._cached_df)
        row = self._cached_df.iloc[idx].to_dict()
        self._tick_index += 1
        return row

    def start_reactivity_scenario(self, name: str) -> None:
        """Configura el modo según el escenario de reactividad (API)."""
        self.mode = "produciendo" if name in ("ALTA", "MEDIA", "BAJA") else self.mode

    def generate_data(self, seconds: int) -> pd.DataFrame:
        return run_simulation(num_steps=seconds, dt_seconds=1.0)

    def generate_data_to_csv(
        self, seconds: int, filepath: str = "plant_simulator_output.csv"
    ) -> pd.DataFrame:
        return generate_data_to_csv(num_steps=seconds, filepath=filepath)


if __name__ == "__main__":
    out_path = Path(__file__).resolve().parent / "plant_simulator_output.csv"
    print("Simulando 100 pasos (La Historia de la Cal — 5 etapas)...")
    df = generate_data_to_csv(NUM_STEPS, filepath=out_path, seed=42)
    print(df.head(12).to_string())
    print(f"\n... ({len(df)} filas)")
    print(f"Columnas: {list(df.columns)}")
    print(f"Datos guardados en: {out_path}")
