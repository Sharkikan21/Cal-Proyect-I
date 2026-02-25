from fastapi import APIRouter, HTTPException

from models import ScenarioControlResponse
from state import simulator

router = APIRouter(tags=["Simulador"])


@router.post("/api/v1/simulator/scenario/{scenario_name}", response_model=ScenarioControlResponse)
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
