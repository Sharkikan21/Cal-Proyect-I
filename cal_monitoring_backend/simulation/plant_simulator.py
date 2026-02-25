"""
PlantSimulator: simulador de planta de cal paso a paso.
Implementa tick(), start_reactivity_scenario() y atributo mode.
Física basada en data_generator.run_simulation() y scenario1_reactivity.
"""

import numpy as np
from datetime import datetime, timezone

# Constantes físicas (igual que data_generator)
RATIO_AGUA_CAL = 4.0
DENSIDAD_MIN, DENSIDAD_MAX = 1.15, 1.25
TEMP_AMBIENTE = 25.0
TEMP_ESTABLE_MIN, TEMP_ESTABLE_MAX = 75.0, 85.0
WI_MIN, WI_MAX = 5.0, 15.0
CONSUMO_NIVEL_POR_PASO = 0.08
TAU_TEMP = 18.0

# Constantes de reactividad (igual que scenario1_reactivity)
DELTA_T_MAX = 45.0
TAU_REACTIVIDAD = {"ALTA": 65.0, "MEDIA": 135.0, "BAJA": 300.0}


def _curva_reactividad_normal(paso: int, paso_inicio: int) -> float:
    """Curva normal: T sube de 25°C y se estabiliza entre 75–85°C."""
    if paso < paso_inicio:
        return TEMP_AMBIENTE
    t = paso - paso_inicio
    T_estable = (TEMP_ESTABLE_MIN + TEMP_ESTABLE_MAX) / 2.0
    delta = T_estable - TEMP_AMBIENTE
    return TEMP_AMBIENTE + delta * (1.0 - np.exp(-t / TAU_TEMP))


def _curva_teorica_reactividad(paso: int, paso_inicio: int, tipo: str) -> float:
    """Curva por tipo de reactividad (ALTA/MEDIA/BAJA) según Coloma / ASTM C-110."""
    if paso < paso_inicio:
        return TEMP_AMBIENTE
    t = paso - paso_inicio
    tau = TAU_REACTIVIDAD.get(tipo.upper(), 135.0)
    temp = TEMP_AMBIENTE + DELTA_T_MAX * (1.0 - np.exp(-t / tau))
    ruido = 0.3 * np.sin(paso * 0.2)
    return temp + ruido


def _densidad_desde_ratio(ratio_agua_cal: float) -> float:
    objetivo = 1.20
    if ratio_agua_cal > 5.0:
        return max(DENSIDAD_MIN, objetivo - 0.05)
    if ratio_agua_cal < 3.0:
        return min(DENSIDAD_MAX, objetivo + 0.05)
    return float(np.clip(objetivo + (3.5 - ratio_agua_cal) * 0.02, DENSIDAD_MIN, DENSIDAD_MAX))


class PlantSimulator:
    """
    Simulador de planta paso a paso.
    Cada llamada a tick() avanza un paso y devuelve el estado de todos los sensores.
    """

    def __init__(self):
        self.mode: str = "produciendo"
        self._paso: int = 0
        self._nivel_silo: float = 70.0
        self._nivel_camara: float = 45.0
        self._temp_slaker: float = TEMP_AMBIENTE
        self._reactivity_tipo: str | None = None
        self._paso_inicio_reactividad: int | None = None

    def tick(self) -> dict:
        """Avanza un paso de simulación y retorna dict con todos los sensores + timestamp."""
        paso = self._paso
        self._paso += 1
        ts = datetime.now(timezone.utc)

        # Determinar estados de actuadores según modo
        if self.mode in ("produciendo", "reactividad"):
            tornillo_on = 1
            agua_on = 1
        elif self.mode == "lavando":
            tornillo_on = 0
            agua_on = 1
        else:  # inactivo
            tornillo_on = 0
            agua_on = 0

        # --- Fase 2: Dosificación ---
        if tornillo_on:
            wi = WI_MIN + (WI_MAX - WI_MIN) * (0.5 + 0.1 * np.sin(paso * 0.3) + 0.05 * np.cos(paso * 0.7))
            wi = float(np.clip(wi, WI_MIN, WI_MAX))
        else:
            wi = 0.0

        # --- Fase 1: Silo ---
        if tornillo_on:
            self._nivel_silo -= CONSUMO_NIVEL_POR_PASO
        self._nivel_silo = float(np.clip(self._nivel_silo, 0.0, 100.0))
        lshh = 1 if self._nivel_silo > 95.0 else 0
        lsll = 1 if self._nivel_silo < 5.0 else 0
        pda = 0.5 + 0.008 * self._nivel_silo + (0.15 if tornillo_on else 0.0)
        pda = float(np.clip(pda, 0.2, 1.2))

        # --- Fase 3: Hidratación ---
        if agua_on and tornillo_on:
            flujo_agua = float(np.clip(wi * RATIO_AGUA_CAL, 20.0, 60.0))
            motor_slaker = 1
            if self._reactivity_tipo is not None:
                if self._paso_inicio_reactividad is None:
                    self._paso_inicio_reactividad = paso
                temp_slaker = _curva_teorica_reactividad(paso, self._paso_inicio_reactividad, self._reactivity_tipo)
            else:
                temp_slaker = _curva_reactividad_normal(paso, paso_inicio=0)
            temp_slaker = float(np.clip(temp_slaker + 0.3 * np.sin(paso * 0.2), TEMP_AMBIENTE, TEMP_ESTABLE_MAX + 5.0))
        else:
            flujo_agua = 0.0
            motor_slaker = 0
            temp_slaker = float(max(TEMP_AMBIENTE, self._temp_slaker - 0.5))

        self._temp_slaker = temp_slaker

        # --- Fase 4: Separación ---
        if tornillo_on and agua_on:
            self._nivel_camara = self._nivel_camara + 0.06 - 0.04
            agitador = 1
        else:
            self._nivel_camara -= 0.02
            agitador = 1 if self._nivel_camara > 20.0 else 0
        self._nivel_camara = float(np.clip(self._nivel_camara, 10.0, 80.0))

        # --- Fase 5: Distribución ---
        if wi > 0 and flujo_agua > 0:
            ratio = flujo_agua / wi
            densidad = _densidad_desde_ratio(ratio)
            ph = float(np.clip(12.2 + 0.15 * (densidad - 1.18), 11.8, 12.6))
            presion_aceite = float(np.clip(65.0 + 2.0 * np.sin(paso * 0.1), 60.0, 75.0))
        else:
            densidad = 1.0
            ph = 7.5
            presion_aceite = 45.0

        return {
            "timestamp": ts,
            "2270-LIT-11825": round(self._nivel_silo, 4),
            "2270-LSHH-11826": lshh,
            "2270-LSLL-11829": lsll,
            "2270-PDAH-11827": round(pda, 4),
            "2280-WI-01769": round(wi, 4),
            "2270-SAL-11817": tornillo_on,
            "2270-SAL-11818": tornillo_on,
            "2270-FIT-11801": round(flujo_agua, 4),
            "2270-TT-11824B": round(temp_slaker, 4),
            "2270-ZM-009-06": motor_slaker,
            "2270-LIT-11850": round(self._nivel_camara, 4),
            "2270-ZM-009-31": agitador,
            "DT-2270-HDR": round(densidad, 4),
            "pHT-2270-RGH": round(ph, 4),
            "2270-PIT-11895": round(presion_aceite, 4),
        }

    def start_reactivity_scenario(self, tipo: str) -> None:
        """Activa el modo de reactividad con el tipo dado (ALTA, MEDIA o BAJA)."""
        self._reactivity_tipo = tipo.upper()
        self._paso_inicio_reactividad = self._paso
        self.mode = "reactividad"
