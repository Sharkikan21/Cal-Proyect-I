import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class PlantSimulator:
    """
    Simulador para generar datos de sensores ficticios de una planta de cal.
    """
    def __init__(self):
        self.timestamp = datetime.now()
        self.state = self._get_initial_state()
        self.mode = "inactivo"  # inactivo, produciendo, lavando
        self.reactivity_scenario = None # None, o un dict con {tipo, t_inicio, duracion}
        self.scenario_steps = 0

    def _get_initial_state(self) -> dict:
        """Define el estado inicial de todos los sensores."""
        # Estos son los TAGs extraídos de alarm_config.json
        tags = [
            "2270-LSHH-11826", "2270-LSLL-11829", "2270-LIT-11825", "2270-SAL-11818",
            "2270-SAL-11817", "2270-TAHH-11801", "2270-TAH-11801", "2270-TAL-11801",
            "2270-PALL-11834", "2270-FIT-11801", "2270-LIT-11850", "2270-LIT-11845",
            "2270-TT-11824A", "2270-TAH-11824A", "2270-TT-11824B", "2270-TAH-11824B",
            "2270-TAHH-11824B", "2270-PDIA-11892", "2270-PIT-11895", "2270-TIT-11893",
            "2270-TAH-11893", "2270-TAHH-11893", "2270-TIT-118934", "2270-TAH-11894",
            "2270-TAHH-11894", "2270-FSL-11896", "2270-FAL-11896", "2270-PDAH-11827",
            "2270-YL-11826"
            # Tags de custom_eval/logica no se simulan como valores numéricos directos
        ]
        
        initial_state = {tag: 0.0 for tag in tags}

        # Establecer valores iniciales más realistas
        initial_state["2270-LIT-11825"] = 60.0  # Nivel Silo Principal
        initial_state["2270-LIT-11850"] = 50.0  # Nivel Cámara de Separación
        initial_state["2270-LIT-11845"] = 50.0  # Nivel Bomba de Descarga
        initial_state["2270-TT-11824A"] = 25.0  # Temp Slaker A
        initial_state["2270-TT-11824B"] = 25.0  # Temp Slaker B (para reactividad)
        initial_state["2270-PALL-11834"] = 300.0 # Presión Vortex
        initial_state["2270-PIT-11895"] = 60.0   # Presión Lubricación
        initial_state["2270-TIT-11893"] = 30.0   # Temp Lubricación T1
        initial_state["2270-TIT-118934"] = 30.0  # Temp Lubricación T2
        initial_state["2270-FSL-11896"] = 12.0   # Flujo Lubricación

        # Switches de nivel (activos en 0 o 1, aqui asumimos valor numerico que representa estado)
        initial_state["2270-LSHH-11826"] = 0 # No en alarma alta
        initial_state["2270-LSLL-11829"] = 1 # No en alarma baja
        
        return initial_state

    def tick(self):
        """Avanza la simulación un paso (1 segundo) y devuelve el estado actual."""
        self.timestamp += timedelta(seconds=1)
        
        # Lógica de modos
        if self.mode == "inactivo":
            self.state["2270-SAL-11817"] = 0.0 # Screw feeder off
            self.state["2270-SAL-11818"] = 0.0 # Rotary valve off
            self.state["2270-FIT-11801"] = 0.0 # Agua off
            # Las temperaturas tienden a normalizarse
            self.state["2270-TT-11824B"] -= 0.05
            if self.state["2270-TT-11824B"] < 25: self.state["2270-TT-11824B"] = 25

        elif self.mode == "lavando":
            self.state["2270-SAL-11817"] = 0.0
            self.state["2270-SAL-11818"] = 0.0
            self.state["2270-FIT-11801"] = 15.0 # Flujo de agua de lavado
            self.state["2270-LIT-11850"] += 0.05 # Nivel sube lentamente

        elif self.mode == "produciendo":
            self.state["2270-SAL-11817"] = 1.0 # Screw feeder ON
            self.state["2270-SAL-11818"] = 1.0 # Rotary valve ON
            self.state["2270-FIT-11801"] = 20.0 # Flujo de agua de produccion
            self.state["2270-LIT-11825"] -= 0.01 # Nivel silo baja
            self.state["2270-LIT-11850"] += 0.1  # Nivel camara sube

        # Lógica de escenarios
        if self.reactivity_scenario:
            self._handle_reactivity_scenario()

        # Añadir ruido a todas las señales para realismo
        noisy_state = {}
        for tag, value in self.state.items():
            if tag not in ["2270-SAL-11817", "2270-SAL-11818"]: # No añadir ruido a switches
                 noisy_state[tag] = value + np.random.normal(0, 0.1)
            else:
                 noisy_state[tag] = value
        
        return {**{"timestamp": self.timestamp}, **noisy_state}

    def _handle_reactivity_scenario(self):
        """Maneja la lógica de un escenario de reactividad en progreso."""
        t_actual = (self.timestamp - self.reactivity_scenario["t_inicio"]).total_seconds()
        duracion_total = self.reactivity_scenario["duracion"]
        
        if t_actual <= duracion_total:
            # Aumento de temperatura progresivo hasta 40 grados
            aumento = 40 * (t_actual / duracion_total)
            self.state["2270-TT-11824B"] = self.reactivity_scenario["temp_base"] + aumento
        else:
            # Fin del escenario
            self.mode = "inactivo"
            self.reactivity_scenario = None

    def start_reactivity_scenario(self, tipo: str):
        """
        Inicia un escenario de reactividad.
        Tipo puede ser 'ALTA', 'MEDIA', 'BAJA'.
        """
        print(f"Iniciando escenario de reactividad: {tipo}")
        self.mode = "produciendo"
        duraciones = {'ALTA': 150, 'MEDIA': 300, 'BAJA': 480} # en segundos
        
        self.reactivity_scenario = {
            "tipo": tipo,
            "t_inicio": self.timestamp,
            "duracion": duraciones.get(tipo, 300),
            "temp_base": self.state["2270-TT-11824B"]
        }
        # Asegurarse que el tornillo esté encendido para que core_logic lo detecte
        self.state["2270-SAL-11817"] = 1.0

    def generate_data(self, duration_seconds: int) -> pd.DataFrame:
        """
        Genera un DataFrame de pandas con datos simulados para una duración dada.
        """
        data = []
        for _ in range(duration_seconds):
            data.append(self.tick())
        
        df = pd.DataFrame(data)
        df = df.set_index("timestamp")
        
        # Renombrar columnas para que coincidan con el formato esperado por core_logic
        # core_logic espera los TAGs como nombres de columna.
        # Nuestro `tick` ya devuelve un dict con los tags correctos.
        
        return df

if __name__ == '__main__':
    # --- Ejemplo de Uso ---
    simulator = PlantSimulator()

    # 1. Generar 60 segundos de datos en modo inactivo
    df_inactive = simulator.generate_data(60)
    print("--- Datos en modo Inactivo ---")
    print(df_inactive.tail())

    # 2. Simular una curva de reactividad ALTA
    simulator.start_reactivity_scenario('ALTA')
    df_reactivity = simulator.generate_data(200) # Generar datos durante el escenario
    print("\n--- Datos durante escenario de Reactividad ALTA ---")
    print(df_reactivity.tail())
    
    # 3. Volver a modo inactivo
    df_post_reactivity = simulator.generate_data(60)
    print("\n--- Datos después del escenario ---")
    print(df_post_reactivity.tail())
