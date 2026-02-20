from pydantic import BaseModel
from datetime import datetime


class ReactivityCurve(BaseModel):
    timestamp_inicio: datetime
    timestamp_fin: datetime
    temp_inicio: float
    temp_fin: float
    tipo: str
    minutos: int
    segundos: int
