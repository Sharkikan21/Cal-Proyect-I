import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class PlantSimulator:
    """
    Simulador avanzado para generar datos de sensores de la planta de cal,
    basado en el Listado Definitivo de Sensores (19/02/2026) y las 5 etapas de la Historia de la Cal.
    """
    def __init__(self):
        self.timestamp = datetime.now()
        self.mode = "inactivo"  # inactivo, produciendo, lavando
        self.reactivity_scenario = None # None, o un dict con {tipo, t_inicio, duracion}
        self.state = self._get_initial_state()

    def _get_initial_state(self) -> dict:
        """Define el estado inicial de todos los sensores del listado definitivo."""
        tags = [
            # Etapa 1: Silo
            "2270-LIT-11825", "2270-LSHH-11826", "2270-LSLL-11829", "2270-YL-11826", 
            "2270-PDAH-11827", "2270-ZM-009-22", "2270-ZM-009-02",
            # Etapa 2: Dosificación
            "2280-WI-01769", "2270-SAL-11817", "2270-SAL-11818", "2270-SE-11817", "2270-SE-11818",
            # Etapa 3: Hidratación (Vortex/Slaker)
            "2270-FIT-11801", "2270-TIC-11801", "2270-TAHH-11801", "2270-PALL-11834", 
            "2270-TT-11824A", "2270-TT-11824B", "2270-TAHH-11824B", "2270-ZM-009-06",
            # Etapa 4: Separación
            "2270-LIT-11850", "2270-LALL-11850", "2270-ZM-009-31", "2270-ZM-009-32",
            # Etapa 5: Distribución y Auxiliares
            "2270-LIT-11845", "2270-ZM-009-23", "2270-ZM-009-12", "2270-ZM-009-13",
            "2270-PIT-11895", "2270-FSL-11896", "2270-TIT-11893", "2270-TIT-118934",
            "DT-2270-HDR", "pHT-2270-RGH", "pHT-2270-CLN"
        ]
        
        initial_state = {tag: 0.0 for tag in tags}

        # Valores base realistas
        initial_state["2270-LIT-11825"] = 65.0   # Silo al 65%
        initial_state["2270-LIT-11850"] = 45.0   # Cámara Separación al 45%
        initial_state["2270-LIT-11845"] = 50.0   # Caja Bomba al 50%
        initial_state["2270-TT-11824A"] = 25.0   # Temp Ambiente Slaker
        initial_state["2270-TT-11824B"] = 25.0
        initial_state["2270-PALL-11834"] = 350.0 # Presión Vortex normal (kPa)
        initial_state["2270-PIT-11895"] = 65.0   # Presión Lubricación (PSI)
        initial_state["2270-FSL-11896"] = 12.5   # Flujo Lubricación (L/min)
        initial_state["2270-TIT-11893"] = 35.0   # Temp Lubricación T1
        initial_state["DT-2270-HDR"] = 1.05      # Densidad base (agua ~1.0)
        initial_state["pHT-2270-RGH"] = 9.5      # pH base
        
        # Switches (1 = OK/Cerrado, 0 = Alarma/Abierto según lógica típica DCS)
        # Aquí asumiremos 1 como estado "normal" para switches de seguridad
        initial_state["2270-LSHH-11826"] = 1 
        initial_state["2270-LSLL-11829"] = 1
        initial_state["2270-TAHH-11824B"] = 1
        
        return initial_state

    def tick(self):
        """Avanza la simulación un paso (1 segundo) con lógica interconectada."""
        self.timestamp += timedelta(seconds=1)
        
        # 1. Lógica de Modos de Operación
        if self.mode == "inactivo":
            self._update_inactive()
        elif self.mode == "lavando":
            self._update_washing()
        elif self.mode == "produciendo":
            self._update_producing()

        # 2. Lógica de Escenarios (Sobrescribe valores de modo si es necesario)
        if self.reactivity_scenario:
            self._handle_reactivity_scenario()

        # 3. Mantenimiento de Switches de Seguridad basado en niveles
        self._update_safety_switches()

        # 4. Añadir ruido y devolver estado
        return self._apply_noise_and_return()

    def _update_inactive(self):
        """Estado de planta detenida."""
        # Etapa 2: Motores OFF
        self.state["2270-SAL-11817"] = 0.0
        self.state["2270-SAL-11818"] = 0.0
        self.state["2280-WI-01769"] = 0.0
        # Etapa 3: Agua OFF, enfriamiento
        self.state["2270-FIT-11801"] = 0.0
        self.state["2270-TT-11824B"] = max(25.0, self.state["2270-TT-11824B"] - 0.02)
        self.state["2270-TT-11824A"] = max(25.0, self.state["2270-TT-11824A"] - 0.02)
        # Etapa 5: Calidad vuelve a base
        self.state["DT-2270-HDR"] = max(1.0, self.state["DT-2270-HDR"] - 0.001)
        self.state["pHT-2270-RGH"] = max(7.0, self.state["pHT-2270-RGH"] - 0.01)

    def _update_washing(self):
        """Estado de lavado (solo agua)."""
        self.state["2270-SAL-11817"] = 0.0
        self.state["2270-SAL-11818"] = 0.0
        self.state["2280-WI-01769"] = 0.0
        self.state["2270-FIT-11801"] = 12.0 # Flujo agua lavado
        # Dilución
        self.state["DT-2270-HDR"] = max(1.0, self.state["DT-2270-HDR"] - 0.005)
        self.state["pHT-2270-RGH"] = max(7.5, self.state["pHT-2270-RGH"] - 0.02)

    def _update_producing(self):
        """Estado de producción normal."""
        # Etapa 2: Alimentación ON
        self.state["2270-SAL-11817"] = 1.0
        self.state["2270-SAL-11818"] = 1.0
        self.state["2280-WI-01769"] = 4.5 # 4.5 Tph de cal
        # Etapa 1: Consumo Silo
        self.state["2270-LIT-11825"] -= 0.005
        # Etapa 3: Agua y Calor
        self.state["2270-FIT-11801"] = 18.0 # 18 m3/h agua
        if not self.reactivity_scenario:
            # Calentamiento operacional normal (no reactividad extrema)
            self.state["2270-TT-11824B"] = min(72.0, self.state["2270-TT-11824B"] + 0.05)
            self.state["2270-TT-11824A"] = min(68.0, self.state["2270-TT-11824A"] + 0.04)
        # Etapa 5: Calidad de Lechada
        self.state["DT-2270-HDR"] = 1.15 # Densidad típica 15% sólidos
        self.state["pHT-2270-RGH"] = 12.4 # pH típico cal

    def _update_safety_switches(self):
        """Lógica de switches basada en valores analógicos."""
        # Nivel Silo
        self.state["2270-LSHH-11826"] = 0 if self.state["2270-LIT-11825"] >= 95.0 else 1
        self.state["2270-LSLL-11829"] = 0 if self.state["2270-LIT-11825"] <= 10.0 else 1
        # Nivel Cámara
        self.state["2270-LALL-11850"] = 0 if self.state["2270-LIT-11850"] <= 15.0 else 1
        # Temperatura Crítica Slaker
        self.state["2270-TAHH-11824B"] = 0 if self.state["2270-TT-11824B"] >= 85.0 else 1

    def _handle_reactivity_scenario(self):
        """Maneja el aumento de temperatura según el escenario de reactividad."""
        t_transcurrido = (self.timestamp - self.reactivity_scenario["t_inicio"]).total_seconds()
        duracion = self.reactivity_scenario["duracion"]
        
        if t_transcurrido <= duracion:
            aumento = 40.0 * (t_transcurrido / duracion)
            self.state["2270-TT-11824B"] = self.reactivity_scenario["temp_base"] + aumento
        else:
            self.reactivity_scenario = None

    def start_reactivity_scenario(self, tipo: str):
        """Inicia un escenario de reactividad ALTA, MEDIA o BAJA."""
        duraciones = {'ALTA': 150, 'MEDIA': 300, 'BAJA': 500}
        self.mode = "produciendo"
        self.reactivity_scenario = {
            "tipo": tipo,
            "t_inicio": self.timestamp,
            "duracion": duraciones.get(tipo, 300),
            "temp_base": self.state["2270-TT-11824B"]
        }

    def _apply_noise_and_return(self):
        """Añade ruido gaussiano específico por tipo de sensor y retorna el dict."""
        noisy = {"timestamp": self.timestamp}
        for tag, val in self.state.items():
            if "LIT" in tag or "WI" in tag or "FIT" in tag: # Niveles y flujos (más ruido)
                noisy[tag] = val + np.random.normal(0, 0.2)
            elif "TT" in tag or "TIT" in tag: # Temperaturas (menos ruido)
                noisy[tag] = val + np.random.normal(0, 0.05)
            elif "DT" in tag or "pHT" in tag: # Calidad (muy estable)
                noisy[tag] = val + np.random.normal(0, 0.01)
            else: # Estados DI/DO (sin ruido)
                noisy[tag] = val
        return noisy

    def generate_data(self, seconds: int) -> pd.DataFrame:
        """Genera un lote de datos."""
        return pd.DataFrame([self.tick() for _ in range(seconds)]).set_index("timestamp")

    def generate_data_to_csv(self, seconds: int, filepath: str = "plant_simulator_output.csv") -> pd.DataFrame:
        """
        Genera un lote de datos, lo guarda en CSV (mismo formato que la tabla mostrada)
        y devuelve el DataFrame.
        """
        df = self.generate_data(seconds)
        df.to_csv(filepath, index=True, encoding="utf-8")
        return df

if __name__ == '__main__':
    from pathlib import Path
    sim = PlantSimulator()
    print("Simulando 10 segundos de producción...")
    sim.mode = "produciendo"
    out_path = Path(__file__).resolve().parent / "plant_simulator_output.csv"
    df = sim.generate_data_to_csv(10, filepath=str(out_path))
    print(df)
    print(f"\nDatos guardados en: {out_path}")
