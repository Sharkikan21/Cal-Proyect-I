from fastapi import APIRouter

from ..core_logic import determinar_modo_actual, evaluar_alarmas_directo
from ..models import PlantStatusResponse
from ..state import simulator, reactivity_monitor, alarm_config, setpoints

router = APIRouter(tags=["Monitoreo"])


@router.get("/api", tags=["General"])
async def api_info():
    """Información de la API (raíz de servicios REST)."""
    return {"message": "API de Monitoreo de Cal Lechada en funcionamiento!"}


@router.get("/api/v1/status", response_model=PlantStatusResponse)
async def get_plant_status():
    """
    Ejecuta un ciclo de simulación y devuelve el estado completo y actual de la planta.
    """
    # 1. Obtener los datos más recientes del simulador
    sensor_data = simulator.tick()

    # 2. Determinar el modo de operación
    screw_val = sensor_data.get("2270-SAL-11817", 0.0)
    rotary_val = sensor_data.get("2270-SAL-11818", 0.0)
    agua_val = sensor_data.get("2270-FIT-11801", 0.0)
    cal_val = screw_val

    current_mode = determinar_modo_actual(cal=cal_val, agua=agua_val, rotary_val=rotary_val, screw_val=screw_val)
    simulator.mode = current_mode

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
