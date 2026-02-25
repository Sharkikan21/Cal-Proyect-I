"""
Generador de datos de prueba para el silo de almacenamiento de cal (Etapa 1).
Genera CSV con series temporales por segundo para 5 escenarios operativos.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def crear_timeseries_silo(
    duracion_segundos: int,
    nivel_inicial: float,
    nivel_final: float,
    nivel_constante: float | None = None,
    std_ruido: float = 0.5,
    seed: int | None = 42,
) -> pd.DataFrame:
    """
    Genera un DataFrame con una fila por segundo para el silo de cal.

    Args:
        duracion_segundos: Número de segundos (filas) a generar.
        nivel_inicial: Nivel base inicial (%). Usado cuando no hay nivel_constante.
        nivel_final: Nivel base final (%). Para tendencia lineal.
        nivel_constante: Si se define, el nivel base se mantiene en este valor (sin tendencia).
        std_ruido: Desviación estándar del ruido gaussiano aplicado al nivel.
        seed: Semilla para reproducibilidad (None = aleatorio).

    Returns:
        DataFrame con columnas: timestamp, 2270-LIT-11825, 2270-LSHH-11826, 2270-LSLL-11829.
    """
    if seed is not None:
        np.random.seed(seed)

    # Timestamps: un valor por segundo
    inicio = datetime(2025, 2, 18, 8, 0, 0)  # Fecha de referencia
    timestamps = [inicio + timedelta(seconds=i) for i in range(duracion_segundos)]

    # Nivel base: constante o lineal
    if nivel_constante is not None:
        nivel_base = np.full(duracion_segundos, nivel_constante)
    else:
        nivel_base = np.linspace(nivel_inicial, nivel_final, num=duracion_segundos)

    # Ruido gaussiano sobre el nivel
    ruido = np.random.normal(loc=0.0, scale=std_ruido, size=duracion_segundos)
    nivel_con_ruido = nivel_base + ruido

    # Recortar al rango [0, 100]
    nivel_con_ruido = np.clip(nivel_con_ruido, 0.0, 100.0)

    # Alarmas según umbrales
    # LSHH (Nivel Muy Alto): 1 si nivel >= 95.0
    lshh = (nivel_con_ruido >= 95.0).astype(int)
    # LSLL (Nivel Muy Bajo): 1 si nivel <= 10.0
    lsll = (nivel_con_ruido <= 10.0).astype(int)

    df = pd.DataFrame({
        "timestamp": timestamps,
        "2270-LIT-11825": np.round(nivel_con_ruido, 2),
        "2270-LSHH-11826": lshh,
        "2270-LSLL-11829": lsll,
    })

    return df


def generar_escenarios_etapa1(
    directorio_salida: str = ".",
    std_ruido: float = 0.5,
    seed: int = 42,
) -> None:
    """
    Genera los 5 escenarios del silo de cal y guarda cada uno en un CSV.

    Args:
        directorio_salida: Carpeta donde se guardarán los CSV.
        std_ruido: Desviación estándar del ruido en el nivel (por escenario puede ajustarse).
        seed: Semilla para reproducibilidad.
    """
    escenarios = [
        {
            "archivo": "silo_nivel_estable.csv",
            "duracion": 300,
            "nivel_constante": 65.0,
            "desc": "Nivel estable en 65%, sin alarmas",
        },
        {
            "archivo": "silo_descargando_produccion.csv",
            "duracion": 1800,
            "nivel_inicial": 80.0,
            "nivel_final": 15.0,
            "desc": "Descarga lineal 80% -> 15%, sin alarmas",
        },
        {
            "archivo": "silo_recargando.csv",
            "duracion": 1200,
            "nivel_inicial": 20.0,
            "nivel_final": 90.0,
            "desc": "Recarga lineal 20% -> 90%, sin alarmas",
        },
        {
            "archivo": "silo_alarma_nivel_alto.csv",
            "duracion": 600,
            "nivel_inicial": 85.0,
            "nivel_final": 100.0,
            "desc": "Nivel sube hasta 100%, LSHH activa al cruzar 95%",
        },
        {
            "archivo": "silo_alarma_nivel_bajo.csv",
            "duracion": 600,
            "nivel_inicial": 15.0,
            "nivel_final": 0.0,
            "desc": "Nivel baja hasta 0%, LSLL activa al cruzar 10%",
        },
    ]

    for s in escenarios:
        if "nivel_constante" in s:
            df = crear_timeseries_silo(
                duracion_segundos=s["duracion"],
                nivel_inicial=0.0,  # no usado
                nivel_final=0.0,    # no usado
                nivel_constante=s["nivel_constante"],
                std_ruido=std_ruido,
                seed=seed,
            )
        else:
            df = crear_timeseries_silo(
                duracion_segundos=s["duracion"],
                nivel_inicial=s["nivel_inicial"],
                nivel_final=s["nivel_final"],
                nivel_constante=None,
                std_ruido=std_ruido,
                seed=seed,
            )

        ruta = f"{directorio_salida}/{s['archivo']}" if directorio_salida else s["archivo"]
        df.to_csv(ruta, index=False)
        print(f"Generado: {ruta} ({len(df)} filas) — {s['desc']}")


if __name__ == "__main__":
    import os
    # Guardar en la carpeta del paquete (parent de simulation/)
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    generar_escenarios_etapa1(directorio_salida=script_dir)
