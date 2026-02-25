from fastapi import FastAPI

from .state import alarm_config
from .routers import frontend, visualization, monitoring, simulator

app = FastAPI(
    title="Sistema de Monitoreo de Cal Lechada",
    description="API para la supervisión y análisis operacional del sistema de preparación de lechada de cal.",
    version="0.2.0",
)

if not alarm_config:
    raise RuntimeError("No se pudo cargar la configuración de alarmas. La API no puede iniciar.")

app.include_router(frontend.router)
app.include_router(visualization.router)
app.include_router(monitoring.router)
app.include_router(simulator.router)

# Para ejecutar la app localmente:
# uvicorn cal_monitoring_backend.main:app --reload
