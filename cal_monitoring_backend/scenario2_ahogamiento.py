"""
Generador de Escenario 2: "Ahogamiento de la Cal" (Exceso de Agua).
Basado en la teoría de estequiometría de Guillermo Coloma (Ratio ideal 3.3:1 a 5:1).
Genera 1 archivo CSV independiente simulando una falla en la válvula de agua.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from pathlib import Path

OUTPUT_COLUMNS = [
    "timestamp",
    "2270-LIT-11825", "2270-LSHH-11826", "2270-LSLL-11829", "2270-PDAH-11827", # Fase 1
    "2280-WI-01769", "2270-SAL-11817", "2270-SAL-11818",                        # Fase 2
    "2270-FIT-11801", "2270-TT-11824B", "2270-ZM-009-06",                       # Fase 3
    "2270-LIT-11850", "2270-ZM-009-31",                                         # Fase 4
    "DT-2270-HDR", "pHT-2270-RGH", "2270-PIT-11895"                             # Fase 5
]

NUM_STEPS = 900  # 15 minutos de simulación
DT_SECONDS = 1.0
TEMP_AMBIENTE = 25.0

def run_drowning_scenario(seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    t0 = datetime.now(timezone.utc)
    rows = []
    
    nivel_silo = 85.0
    nivel_camara = 45.0
    temp_slaker = 25.0
    densidad = 1.0
    
    # Tiempos de la falla
    paso_inicio_falla = 300   # Minuto 5: Se traba abierta la válvula de agua
    paso_fin_falla = 720      # Minuto 12: El operador detecta y corrige
    
    for paso in range(NUM_STEPS):
        ts = t0 + timedelta(seconds=paso * DT_SECONDS)
        timestamp_iso = ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        
        # --- Fase 2: Dosificación (Estable, todo funciona normal aquí) ---
        tornillo_on = 1 if paso > 10 else 0
        wi = 12.0 + np.random.uniform(-0.2, 0.2) if tornillo_on else 0.0
        
        # --- Fase 1: Silo ---
        if tornillo_on:
            nivel_silo -= 0.08
        pda = 0.5 + 0.008 * nivel_silo + (0.15 if tornillo_on else 0.0)
        
        # --- Fase 3: Hidratación (Inyección de la falla) ---
        if tornillo_on:
            if paso_inicio_falla <= paso < paso_fin_falla:
                # FALLA: El flujo de agua salta al doble (Ratio ~ 8:1)
                flujo_agua = (wi * 8.0) + np.random.uniform(-1.0, 1.0) 
            else:
                # NORMAL: Ratio ideal ~ 4:1
                flujo_agua = (wi * 4.0) + np.random.uniform(-0.5, 0.5) 
            motor_slaker = 1
        else:
            flujo_agua = 0.0
            motor_slaker = 0

        # Termodinámica del ahogamiento
        if tornillo_on and flujo_agua > 0:
            ratio_real = flujo_agua / wi
            # Si el ratio es alto (ej. 8), el calor se diluye en el exceso de agua.
            # Temperatura objetivo ideal = 80°C. Si ratio sube, temp cae.
            temp_objetivo = TEMP_AMBIENTE + (55.0 * (4.0 / ratio_real))
            
            # Suavizado exponencial para que el cambio de temperatura tome algo de tiempo
            temp_slaker += (temp_objetivo - temp_slaker) * 0.05
        else:
            temp_slaker = max(TEMP_AMBIENTE, temp_slaker - 0.2)
            
        temp_con_ruido = temp_slaker + np.random.uniform(-0.3, 0.3)

        # --- Fase 5: Distribución (Caída de Densidad por exceso de agua) ---
        if tornillo_on and flujo_agua > 0:
            # Densidad ideal (Ratio 4) es ~1.20. Si ratio es 8, baja drásticamente.
            dens_objetivo = 1.20 - ((ratio_real - 4.0) * 0.03)
            densidad += (dens_objetivo - densidad) * 0.1
            ph = 12.4 if dens_objetivo > 1.05 else 11.5 # El ahogamiento afecta el pH
        else:
            densidad = max(1.0, densidad - 0.05)
            ph = 7.5

        row = {
            "timestamp": timestamp_iso,
            "2270-LIT-11825": round(nivel_silo, 4), 
            "2270-LSHH-11826": 0, "2270-LSLL-11829": 0, "2270-PDAH-11827": round(pda, 4),
            "2280-WI-01769": round(wi, 4), 
            "2270-SAL-11817": tornillo_on, "2270-SAL-11818": tornillo_on,
            "2270-FIT-11801": round(flujo_agua, 4), 
            "2270-TT-11824B": round(float(temp_con_ruido), 4), 
            "2270-ZM-009-06": motor_slaker,
            "2270-LIT-11850": round(nivel_camara, 4), "2270-ZM-009-31": 1 if nivel_camara > 20 else 0,
            "DT-2270-HDR": round(densidad, 4), 
            "pHT-2270-RGH": round(ph, 4), 
            "2270-PIT-11895": 65.0
        }
        rows.append(row)
        
    return pd.DataFrame(rows, columns=OUTPUT_COLUMNS)

if __name__ == "__main__":
    # CSV en la misma carpeta que este script (cal_monitoring_backend)
    out_dir = Path(__file__).resolve().parent
    df = run_drowning_scenario()
    filepath = out_dir / "scenario2_ahogamiento.csv"
    df.to_csv(filepath, index=False, encoding="utf-8")
    print(f"¡Escenario 2 completado! Guardado en: {filepath} ({len(df)} filas)")