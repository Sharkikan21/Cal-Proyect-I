from pydantic import BaseModel, Field
from typing import List, Dict, Any
from datetime import datetime
from models.reactivity_curve import ReactivityCurve


class PlantStatusResponse(BaseModel):
    timestamp: datetime = Field(..., description="El timestamp de los datos de sensores.")
    mode: str = Field(..., description="El modo de operación actual de la planta (ej: 'produciendo', 'inactivo').")
    active_alarms: List[str] = Field(..., description="Una lista de las descripciones de las alarmas actualmente activas.")
    new_reactivity_curves: List[ReactivityCurve] = Field(..., description="Una lista de las curvas de reactividad completadas en este ciclo.")
    sensor_data: Dict[str, Any] = Field(..., description="Los valores crudos de los sensores para este ciclo.")
