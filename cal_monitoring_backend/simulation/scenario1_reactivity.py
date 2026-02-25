"""
Generador de Escenario 1: Curvas Exponenciales de Reactividad (Alta, Media, Baja).
Basado en la teoría de Guillermo Coloma y Norma ASTM C-110.
Al ejecutar, elige un tipo (ALTA, MEDIA o BAJA) y se genera un solo CSV en cal_monitoring_backend.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Columnas exactas de tu arquitectura
OUTPUT_COLUMNS = [
    "timestamp",
    "2270-LIT-11825", "2270-LSHH-11826", "2270-LSLL-11829", "2270-PDAH-11827", # Fase 1
    "2280-WI-01769", "2270-SAL-11817", "2270-SAL-11818",                        # Fase 2
    "2270-FIT-11801", "2270-TT-11824B", "2270-ZM-009-06",                       # Fase 3
    "2270-LIT-11850", "2270-ZM-009-31",                                         # Fase 4
    "DT-2270-HDR", "pHT-2270-RGH", "2270-PIT-11895"                             # Fase 5
]

# Ampliamos a 900 pasos (15 minutos) para poder ver las curvas lentas
NUM_STEPS = 900
DT_SECONDS = 1.0
TEMP_AMBIENTE = 25.0
DELTA_T_MAX = 45.0  # Para asegurar que la curva cruce holgadamente los +40°C (llegará asintóticamente a 70°C)

def _curva_teorica_reactividad(paso: int, paso_inicio: int, tipo_reactividad: str) -> float:
    """
    Calcula la temperatura exponencial según la calidad química de la cal.
    """
    if paso < paso_inicio:
        return TEMP_AMBIENTE

    t = paso - paso_inicio

    # Constantes Tau ajustadas matemáticamente para alcanzar +40°C en tiempos ASTM
    if tipo_reactividad == 'ALTA':
        tau = 65.0   # Alcanza +40°C en ~140 seg (< 3 min)
    elif tipo_reactividad == 'MEDIA':
        tau = 135.0  # Alcanza +40°C en ~296 seg (entre 3 y 6 min)
    elif tipo_reactividad == 'BAJA':
        tau = 300.0  # Alcanza +40°C en ~659 seg (> 6 min)
    else:
        tau = 135.0

    temp = TEMP_AMBIENTE + DELTA_T_MAX * (1.0 - np.exp(-t / tau))

    # Pequeño ruido físico de sensor para realismo
    ruido = 0.3 * np.sin(paso * 0.2)
    return temp + ruido

def run_reactivity_scenario(tipo_reactividad: str, seed: int = 42) -> pd.DataFrame:
    """
    Ejecuta 15 minutos de simulación para un tipo de cal específico.
    """
    np.random.seed(seed)
    t0 = datetime.now(timezone.utc)
    rows = []

    nivel_silo = 90.0 # Empezamos con el silo casi lleno
    nivel_camara = 45.0

    paso_tornillo_on = 10
    paso_tornillo_off = 850 # Apagamos casi al final de los 15 min
    paso_agua_on = 10

    for paso in range(NUM_STEPS):
        ts = t0 + timedelta(seconds=paso * DT_SECONDS)
        timestamp_iso = ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        # --- Fase 2: Dosificación ---
        tornillo_on = 1 if paso_tornillo_on <= paso < paso_tornillo_off else 0
        wi = 12.0 + np.random.uniform(-0.5, 0.5) if tornillo_on else 0.0

        # --- Fase 1: Silo ---
        if tornillo_on:
            nivel_silo -= 0.08  # Consumo lógico
        lshh = 1 if nivel_silo > 95.0 else 0
        lsll = 1 if nivel_silo < 5.0 else 0
        pda = 0.5 + 0.008 * nivel_silo + (0.15 if tornillo_on else 0.0)

        # --- Fase 3: Hidratación (El Corazón Químico) ---
        agua_on = 1 if paso_agua_on <= paso < paso_tornillo_off else 0
        flujo_agua = wi * 4.0 if agua_on else 0.0

        if tornillo_on and agua_on:
            temp_slaker = _curva_teorica_reactividad(paso, paso_tornillo_on, tipo_reactividad)
            motor_slaker = 1
        else:
            # Enfriamiento lento si se apaga el sistema
            temp_slaker = max(TEMP_AMBIENTE, 70.0 - (paso - paso_tornillo_off) * 0.2) if paso >= paso_tornillo_off else TEMP_AMBIENTE
            motor_slaker = 0

        # --- Fase 4 & 5: Consecuencias estables para aislar la prueba térmica ---
        if tornillo_on and agua_on:
            nivel_camara = np.clip(nivel_camara + np.random.uniform(-0.02, 0.02), 40.0, 50.0)
            densidad = 1.20 + np.random.uniform(-0.02, 0.02)
            ph = 12.4 + np.random.uniform(-0.1, 0.1)
        else:
            densidad, ph = 1.0, 7.5

        agitador = 1 if nivel_camara > 20.0 else 0

        row = {
            "timestamp": timestamp_iso,
            "2270-LIT-11825": round(nivel_silo, 4), "2270-LSHH-11826": lshh, "2270-LSLL-11829": lsll, "2270-PDAH-11827": round(pda, 4),
            "2280-WI-01769": round(wi, 4), "2270-SAL-11817": tornillo_on, "2270-SAL-11818": tornillo_on,
            "2270-FIT-11801": round(flujo_agua, 4), "2270-TT-11824B": round(float(temp_slaker), 4), "2270-ZM-009-06": motor_slaker,
            "2270-LIT-11850": round(nivel_camara, 4), "2270-ZM-009-31": agitador,
            "DT-2270-HDR": round(densidad, 4), "pHT-2270-RGH": round(ph, 4), "2270-PIT-11895": 65.0
        }
        rows.append(row)

    return pd.DataFrame(rows, columns=OUTPUT_COLUMNS)

TIPOS_REACTIVIDAD = ['ALTA', 'MEDIA', 'BAJA']

def generate_one_scenario(tipo_reactividad: str) -> Path:
    """Genera un solo escenario y lo guarda en la carpeta cal_monitoring_backend."""
    # El CSV se guarda en el paquete principal (parent de simulation/)
    out_dir = Path(__file__).resolve().parent.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    tipo = tipo_reactividad.upper().strip()
    if tipo not in TIPOS_REACTIVIDAD:
        raise ValueError(f"Tipo debe ser uno de: {TIPOS_REACTIVIDAD}")

    print(f"Generando escenario para cal de reactividad: {tipo}...")
    df = run_reactivity_scenario(tipo)
    filepath = out_dir / f"scenario1_reactividad_{tipo.lower()}.csv"
    df.to_csv(filepath, index=False, encoding="utf-8")
    print(f"-> Guardado en: {filepath} ({len(df)} filas)")
    return filepath

def main():
    print("Escenario 1: Curvas de Reactividad (Alta, Media, Baja)")
    print("Elige el tipo de reactividad a generar:\n")
    for i, t in enumerate(TIPOS_REACTIVIDAD, 1):
        print(f"  {i}. {t}")
    print("  0. Salir\n")

    while True:
        try:
            opcion = input("Opción (1=ALTA, 2=MEDIA, 3=BAJA, 0=Salir): ").strip()
            if opcion == "0":
                print("Saliendo.")
                return
            if opcion == "1":
                generate_one_scenario("ALTA")
                break
            if opcion == "2":
                generate_one_scenario("MEDIA")
                break
            if opcion == "3":
                generate_one_scenario("BAJA")
                break
            print("Opción no válida. Usa 1, 2, 3 o 0.")
        except (ValueError, KeyboardInterrupt) as e:
            if isinstance(e, KeyboardInterrupt):
                print("\nSaliendo.")
                return
            print(e)

    print("\nEscenario generado correctamente.")

if __name__ == "__main__":
    main()
