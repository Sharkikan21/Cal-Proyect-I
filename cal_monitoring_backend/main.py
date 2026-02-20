from fastapi import FastAPI, HTTPException
from pathlib import Path

# Importar la lógica y el simulador
from data_generator import PlantSimulator
from core_logic import (
    load_alarm_config_from_json,
    determinar_modo_actual,
    evaluar_alarmas_directo,
    ReactivityMonitor
)
from models import ReactivityCurve, PlantStatusResponse, ScenarioControlResponse

# Ruta al config relativa a este archivo (funciona desde cualquier directorio de ejecución)
_THIS_DIR = Path(__file__).resolve().parent
ALARM_CONFIG_PATH = _THIS_DIR / "config" / "alarm_config.json"


# --- Inicialización de la Aplicación y Estado Global ---

app = FastAPI(
    title="Sistema de Monitoreo de Cal Lechada",
    description="API para la supervisión y análisis operacional del sistema de preparación de lechada de cal.",
    version="0.2.0",
)

# Estado global de la aplicación (para una PoC, en producción se usaría un sistema de estado más robusto)
simulator = PlantSimulator()
reactivity_monitor = ReactivityMonitor()
alarm_config = load_alarm_config_from_json(str(ALARM_CONFIG_PATH))
setpoints = {} # Diccionario para futuros setpoints dinámicos

if not alarm_config:
    raise RuntimeError("No se pudo cargar la configuración de alarmas. La API no puede iniciar.")

# --- Endpoints de la API ---

@app.get("/", tags=["General"])
async def read_root():
    return {"message": "API de Monitoreo de Cal Lechada en funcionamiento!", "version": app.version}

@app.get("/api/v1/status", response_model=PlantStatusResponse, tags=["Monitoreo"])
async def get_plant_status():
    """
    Ejecuta un ciclo de simulación y devuelve el estado completo y actual de la planta.
    """
    # 1. Obtener los datos más recientes del simulador
    sensor_data = simulator.tick()

    # 2. Determinar el modo de operación
    # Mapeo de valores a los argumentos de la función
    screw_val = sensor_data.get("2270-SAL-11817", 0.0)
    rotary_val = sensor_data.get("2270-SAL-11818", 0.0)
    agua_val = sensor_data.get("2270-FIT-11801", 0.0)

    # Asumimos que 'cal' está relacionado con la operación del tornillo
    cal_val = screw_val

    current_mode = determinar_modo_actual(cal=cal_val, agua=agua_val, rotary_val=rotary_val, screw_val=screw_val)
    simulator.mode = current_mode # Sincronizar el modo del simulador si la lógica lo cambia

    # 3. Evaluar alarmas
    active_alarms = evaluar_alarmas_directo(
        datos_sensores=sensor_data,
        timestamp=sensor_data["timestamp"],
        setpoints_dict=setpoints,
        config_json_sensores=alarm_config
    )

    # 4. Procesar curva de reactividad
    temp_reactividad = sensor_data.get("2270-TT-11824B", 25.0)
    new_curves = reactivity_monitor.process_reactivity(
        timestamp_fila=sensor_data["timestamp"],
        temp=temp_reactividad,
        screw_val=screw_val
    )

    # 5. Construir y devolver la respuesta
    return PlantStatusResponse(
        timestamp=sensor_data["timestamp"],
        mode=current_mode,
        active_alarms=active_alarms,
        new_reactivity_curves=new_curves,
        sensor_data=sensor_data
    )

@app.post("/api/v1/simulator/scenario/{scenario_name}", response_model=ScenarioControlResponse, tags=["Simulador"])
async def start_scenario(scenario_name: str):
    """
    Inicia un escenario de prueba en el simulador.

    Escenarios válidos:
    - `reactividad_alta`
    - `reactividad_media`
    - `reactividad_baja`
    - `lavado`
    - `inactivo`
    """
    scenario_name = scenario_name.lower()
    if scenario_name == "reactividad_alta":
        simulator.start_reactivity_scenario('ALTA')
    elif scenario_name == "reactividad_media":
        simulator.start_reactivity_scenario('MEDIA')
    elif scenario_name == "reactividad_baja":
        simulator.start_reactivity_scenario('BAJA')
    elif scenario_name == "lavado":
        simulator.mode = "lavando"
    elif scenario_name == "inactivo":
        simulator.mode = "inactivo"
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Escenario '{scenario_name}' no reconocido. Escenarios válidos: reactividad_alta, reactividad_media, reactividad_baja, lavado, inactivo."
        )

    return ScenarioControlResponse(
        message=f"Comando recibido. Iniciando escenario: {scenario_name}",
        scenario_started=scenario_name
    )

# Para ejecutar la app localmente:
# uvicorn cal_monitoring_backend.main:app --reload
