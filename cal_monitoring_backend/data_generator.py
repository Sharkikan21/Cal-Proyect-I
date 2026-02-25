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
    # Fase 2 — Dosificación
    "2280-WI-01769",    # AI: Pesómetro Ton/h
    "2270-SAL-11817",   # DI: Estado tornillo
    "2270-SAL-11818",   # DI: Válvula rotatoria
    # Fase 3 — Hidratación
    "2270-FIT-11801",   # AI: Flujo agua
    "2270-TT-11824B",   # AI: Temperatura slaker
    "2270-ZM-009-06",   # DI: Motor slaker
    # Fase 4 — Separación
    "2270-LIT-11850",   # AI: Nivel cámara
    "2270-ZM-009-31",   # DI: Agitador
    # Fase 5 — Distribución
    "DT-2270-HDR",      # AI: Densidad lechada g/cm³
    "pHT-2270-RGH",     # AI: pH
    "2270-PIT-11895",   # AI: Presión aceite bombas
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

        # --- Fase 1: Silo (efecto del consumo) ---
        if tornillo_on:
            nivel_silo = nivel_silo - CONSUMO_NIVEL_POR_PASO
        nivel_silo = np.clip(nivel_silo, 0.0, 100.0)
        lshh = 1 if nivel_silo > 95.0 else 0
        lsll = 1 if nivel_silo < 5.0 else 0
        # Presión filtro: sube con nivel (más carga) y con dosificación (polvo)
        pda = presion_filtro_base + 0.008 * nivel_silo + (0.15 if tornillo_on else 0.0)
        pda = np.clip(pda, 0.2, 1.2)

        # --- Fase 3: Hidratación (flujo agua + curva de temperatura) ---
        agua_on = 1 if paso_agua_on <= paso < paso_tornillo_off else 0
        if agua_on and tornillo_on:
            # Flujo agua proporcional a relación 4:1 con pesómetro
            flujo_agua = wi * RATIO_AGUA_CAL
            flujo_agua = np.clip(flujo_agua, 20.0, 60.0)
            motor_slaker = 1
            paso_inicio_reaccion = min(paso_tornillo_on, paso_agua_on)
            temp_slaker = _curva_reactividad(paso, paso_inicio_reaccion)
            # Pequeña fluctuación física alrededor de la curva
            temp_slaker = temp_slaker + 0.3 * np.sin(paso * 0.2)
            temp_slaker = np.clip(temp_slaker, TEMP_AMBIENTE, TEMP_ESTABLE_MAX + 2.0)
        else:
            flujo_agua = 0.0
            motor_slaker = 0
            if paso < paso_agua_on:
                temp_slaker = TEMP_AMBIENTE
            else:
                # Enfriamiento cuando se apaga
                temp_slaker = max(TEMP_AMBIENTE, 80.0 - (paso - paso_tornillo_off) * 0.5)

        # --- Fase 4: Separación ---
        if tornillo_on and agua_on:
            # Nivel cámara sube con alimentación, con balance de salida
            nivel_camara = nivel_camara + 0.06 - 0.04
            agitador = 1
        else:
            nivel_camara = nivel_camara - 0.02
            agitador = 1 if nivel_camara > 20.0 else 0
        nivel_camara = np.clip(nivel_camara, 10.0, 80.0)

        # --- Fase 5: Distribución (calidad y auxiliares) ---
        if wi > 0 and flujo_agua > 0:
            ratio = flujo_agua / wi
            densidad = _densidad_desde_ratio(ratio)
            ph = 12.2 + 0.15 * (densidad - 1.18)
            ph = np.clip(ph, 11.8, 12.6)
            presion_aceite = presion_aceite_nominal + 2.0 * np.sin(paso * 0.1)
            presion_aceite = np.clip(presion_aceite, 60.0, 75.0)
        else:
            densidad = 1.0
            ph = 7.5
            presion_aceite = 45.0

        row = {
            "timestamp": timestamp_iso,
            "2270-LIT-11825": round(nivel_silo, 4),
            "2270-LSHH-11826": int(lshh),
            "2270-LSLL-11829": int(lsll),
            "2270-PDAH-11827": round(pda, 4),
            "2280-WI-01769": round(wi, 4),
            "2270-SAL-11817": int(tornillo_on),
            "2270-SAL-11818": int(valvula_on),
            "2270-FIT-11801": round(flujo_agua, 4),
            "2270-TT-11824B": round(float(temp_slaker), 4),
            "2270-ZM-009-06": int(motor_slaker),
            "2270-LIT-11850": round(nivel_camara, 4),
            "2270-ZM-009-31": int(agitador),
            "DT-2270-HDR": round(densidad, 4),
            "pHT-2270-RGH": round(ph, 4),
            "2270-PIT-11895": round(presion_aceite, 4),
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
    para no romper main.py. Internamente usa la simulación física de 100 pasos.
    """

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
