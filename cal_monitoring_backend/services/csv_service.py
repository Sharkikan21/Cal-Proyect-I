"""
Servicio de acceso a datos CSV de simulación.
Provee funciones de lectura y transformación para los endpoints de visualización.
"""
from typing import Dict, List, Any

import pandas as pd

from ..state import CSV_VISUALIZATION_PATH

# Mapeo de sensores por fase (La Historia de la Cal) — coincide con columnas del CSV
PHASE_SENSORS: Dict[str, List[str]] = {
    "1": ["2270-LIT-11825", "2270-LSHH-11826", "2270-LSLL-11829", "2270-PDAH-11827"],  # Silo
    "2": ["2280-WI-01769", "2270-SAL-11817", "2270-SAL-11818"],                         # Dosificación
    "3": ["2270-FIT-11801", "2270-TT-11824B", "2270-ZM-009-06"],                        # Hidratación
    "4": ["2270-LIT-11850", "2270-ZM-009-31"],                                           # Separación
    "5": ["DT-2270-HDR", "pHT-2270-RGH", "2270-PIT-11895"],                             # Distribución
}


def get_csv_visualization_data() -> Dict[str, Any]:
    """
    Lee el CSV del simulador y devuelve los datos necesarios para la visualización:
    timestamps + columnas Nivel Silo, Flujo Cal y Temperatura Slaker.
    """
    if not CSV_VISUALIZATION_PATH.exists():
        return {"timestamps": [], "2270-LIT-11825": [], "2280-WI-01769": [], "2270-TT-11824B": []}
    df = pd.read_csv(CSV_VISUALIZATION_PATH)
    if "timestamp" not in df.columns:
        return {"timestamps": [], "2270-LIT-11825": [], "2280-WI-01769": [], "2270-TT-11824B": []}
    out: Dict[str, Any] = {"timestamps": df["timestamp"].astype(str).tolist()}
    for col in ["2270-LIT-11825", "2280-WI-01769", "2270-TT-11824B"]:
        out[col] = df[col].tolist() if col in df.columns else []
    return out


def get_phase_data(phase_id: str) -> Dict[str, Any]:
    """
    Lee el CSV y devuelve timestamps + columnas de sensores para la fase indicada.
    Retorna listas vacías si no hay CSV, la fase no existe o faltan columnas.
    """
    if phase_id not in PHASE_SENSORS:
        return {"timestamps": [], **{tag: [] for tag in PHASE_SENSORS.get("1", [])}}
    if not CSV_VISUALIZATION_PATH.exists():
        return {"timestamps": [], **{tag: [] for tag in PHASE_SENSORS[phase_id]}}
    df = pd.read_csv(CSV_VISUALIZATION_PATH)
    if "timestamp" not in df.columns:
        return {"timestamps": [], **{tag: [] for tag in PHASE_SENSORS[phase_id]}}
    out: Dict[str, Any] = {"timestamps": df["timestamp"].astype(str).tolist()}
    for tag in PHASE_SENSORS[phase_id]:
        out[tag] = df[tag].tolist() if tag in df.columns else []
    return out
