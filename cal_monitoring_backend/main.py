from fastapi import FastAPI

from .routers import frontend, visualization, monitoring, simulator

app = FastAPI(
    title="Sistema de Monitoreo de Cal Lechada",
    description="API para la supervisión y análisis operacional del sistema de preparación de lechada de cal.",
    version="0.2.0",
)

app.include_router(frontend.router)
app.include_router(visualization.router)
app.include_router(monitoring.router)
app.include_router(simulator.router)
