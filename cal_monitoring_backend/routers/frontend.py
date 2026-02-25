from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from ..state import TEMPLATES_DIR

router = APIRouter(tags=["Frontend"])
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@router.get("/")
async def index(request: Request):
    """Dashboard general / Visión General de Planta."""
    return templates.TemplateResponse("index.html", {"request": request, "current_phase": "index"})


@router.get("/phase/1")
async def phase1_silo(request: Request):
    """Fase 1: Almacenamiento de Cal Viva."""
    return templates.TemplateResponse("phase1_silo.html", {"request": request, "current_phase": "1"})


@router.get("/phase/2")
async def phase2_dosing(request: Request):
    """Fase 2: Dosificación y Alimentación."""
    return templates.TemplateResponse("phase2_dosing.html", {"request": request, "current_phase": "2"})


@router.get("/phase/3")
async def phase3_slaker(request: Request):
    """Fase 3: Hidratación (Apagado) - Fase crítica."""
    return templates.TemplateResponse("phase3_slaker.html", {"request": request, "current_phase": "3"})


@router.get("/phase/4")
async def phase4_separation(request: Request):
    """Fase 4: Clasificación y Limpieza."""
    return templates.TemplateResponse("phase4_separation.html", {"request": request, "current_phase": "4"})


@router.get("/phase/5")
async def phase5_dist(request: Request):
    """Fase 5: Distribución de Lechada."""
    return templates.TemplateResponse("phase5_dist.html", {"request": request, "current_phase": "5"})
