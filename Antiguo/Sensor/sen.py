
import numpy as np

def leer_datos_sensores():
    return {
        "Alimentador - Nivel": np.random.uniform(30, 70),
        "Alimentador - Velocidad": np.random.uniform(1000, 1200),
        "Hidratador - Temp": np.random.uniform(70, 90),
        "Clasificador 1 - Presión": np.random.uniform(1.0, 2.0),
        "Ciclón - Presión": np.random.uniform(1.5, 2.5),
        "Molino - RPM": np.random.uniform(800, 1300)
    }
