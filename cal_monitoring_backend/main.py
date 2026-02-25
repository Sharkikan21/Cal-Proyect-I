from fastapi import FastAPI

from .state import alarm_config
from .routers import frontend, visualization, monitoring, simulator
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import pandas as pd

# Importar la l?gica y el simulador
from data_generator import PlantSimulator
from core_logic import (
    load_alarm_config_from_json,
    determinar_modo_actual,
    evaluar_alarmas_directo,
    ReactivityMonitor
)

# Ruta al config relativa a este archivo (funciona desde cualquier directorio de ejecuci?n)
_THIS_DIR = Path(__file__).resolve().parent
ALARM_CONFIG_PATH = _THIS_DIR / "config" / "alarm_config.json"
TEMPLATES_DIR = _THIS_DIR / "templates"


def get_csv_path_in_folder() -> Optional[Path]:
    """
    Devuelve la ruta del CSV a usar: el ?nico .csv en cal_monitoring_backend.
    Si hay varios, usa el m?s recientemente modificado (el ?ltimo generado).
    Si no hay ninguno, devuelve None.
    """
    csvs = list(_THIS_DIR.glob("*.csv"))
    if not csvs:
        return None
    return max(csvs, key=lambda p: p.stat().st_mtime)
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


# --- Inicializaci?n de la Aplicaci?n y Estado Global ---

app = FastAPI(
    title="Sistema de Monitoreo de Cal Lechada",
    description="API para la supervisi?n y an?lisis operacional del sistema de preparaci?n de lechada de cal.",
    version="0.2.0",
)

# Estado global de la aplicaci?n (para una PoC, en producci?n se usar?a un sistema de estado m?s robusto)
simulator = PlantSimulator()
reactivity_monitor = ReactivityMonitor()
alarm_config = load_alarm_config_from_json(str(ALARM_CONFIG_PATH))
setpoints = {} # Diccionario para futuros setpoints din?micos

if not alarm_config:
    raise RuntimeError("No se pudo cargar la configuraci?n de alarmas. La API no puede iniciar.")


# Mapeo de sensores por fase (La Historia de la Cal) para la API de datos
# Coincide con columnas de plant_simulator_output.csv generado por data_generator.py
PHASE_SENSORS: Dict[str, List[str]] = {
    "1": ["2270-LIT-11825", "2270-LSHH-11826", "2270-LSLL-11829", "2270-PDAH-11827"],  # Silo
    "2": ["2280-WI-01769", "2270-SAL-11817", "2270-SAL-11818"],                        # Dosificaci?n
    "3": ["2270-FIT-11801", "2270-TT-11824B", "2270-ZM-009-06"],                       # Hidrataci?n
    "4": ["2270-LIT-11850", "2270-ZM-009-31"],                                          # Separaci?n
    "5": ["DT-2270-HDR", "pHT-2270-RGH", "2270-PIT-11895"],                            # Distribuci?n
}

app.include_router(frontend.router)
app.include_router(visualization.router)
app.include_router(monitoring.router)
app.include_router(simulator.router)

def get_csv_visualization_data() -> Dict[str, Any]:
    """
    Lee el ?nico CSV de la carpeta y devuelve los datos para la visualizaci?n
    (timestamps + columnas: Nivel Silo, Flujo Cal, Temperatura Slaker).
    """
    csv_path = get_csv_path_in_folder()
    if csv_path is None:
        return {"timestamps": [], "2270-LIT-11825": [], "2280-WI-01769": [], "2270-TT-11824B": []}
    df = pd.read_csv(csv_path)
    cols = ["timestamp", "2270-LIT-11825", "2280-WI-01769", "2270-TT-11824B"]
    existing = [c for c in cols if c in df.columns]
    if not existing or "timestamp" not in df.columns:
        return {"timestamps": [], "2270-LIT-11825": [], "2280-WI-01769": [], "2270-TT-11824B": []}
    out = {"timestamps": df["timestamp"].astype(str).tolist()}
    for c in ["2270-LIT-11825", "2280-WI-01769", "2270-TT-11824B"]:
        out[c] = df[c].tolist() if c in df.columns else []
    return out


def get_phase_data(phase_id: str) -> Dict[str, Any]:
    """
    Lee el ?nico CSV de la carpeta y devuelve timestamps y columnas de la fase dada.
    Retorna listas vac?as si no hay CSV o la fase no es v?lida.
    """
    if phase_id not in PHASE_SENSORS:
        return {"timestamps": [], **{tag: [] for tag in PHASE_SENSORS.get("1", [])}}
    csv_path = get_csv_path_in_folder()
    if csv_path is None:
        return {"timestamps": [], **{tag: [] for tag in PHASE_SENSORS[phase_id]}}
    df = pd.read_csv(csv_path)
    if "timestamp" not in df.columns:
        return {"timestamps": [], **{tag: [] for tag in PHASE_SENSORS[phase_id]}}
    out: Dict[str, Any] = {"timestamps": df["timestamp"].astype(str).tolist()}
    for tag in PHASE_SENSORS[phase_id]:
        out[tag] = df[tag].tolist() if tag in df.columns else []
    return out


# --- Modelos de Datos (Pydantic) ---

class ReactivityCurve(BaseModel):
    timestamp_inicio: datetime
    timestamp_fin: datetime
    temp_inicio: float
    temp_fin: float
    tipo: str
    minutos: int
    segundos: int

class PlantStatusResponse(BaseModel):
    timestamp: datetime = Field(..., description="El timestamp de los datos de sensores.")
    mode: str = Field(..., description="El modo de operaci?n actual de la planta (ej: 'produciendo', 'inactivo').")
    active_alarms: List[str] = Field(..., description="Una lista de las descripciones de las alarmas actualmente activas.")
    new_reactivity_curves: List[ReactivityCurve] = Field(..., description="Una lista de las curvas de reactividad completadas en este ciclo.")
    sensor_data: Dict[str, Any] = Field(..., description="Los valores crudos de los sensores para este ciclo.")

class ScenarioControlResponse(BaseModel):
    message: str
    scenario_started: str

# --- Endpoints de la API ---

@app.get("/api", tags=["General"])
async def api_info():
    """Informaci?n de la API (ra?z de servicios REST)."""
    return {"message": "API de Monitoreo de Cal Lechada en funcionamiento!", "version": app.version}


@app.get("/api/data/{phase_id}", tags=["Visualizaci?n"])
async def get_data_by_phase(phase_id: str):
    """
    Devuelve los datos del CSV filtrados por fase (1-5).
    Formato: { timestamps: [...], tag1: [...], tag2: [...] }.
    """
    if phase_id not in PHASE_SENSORS:
        raise HTTPException(status_code=404, detail=f"Fase '{phase_id}' no v?lida. Use 1, 2, 3, 4 o 5.")
    return get_phase_data(phase_id)


# --- Vistas HTML (La Historia de la Cal - 5 fases) ---

@app.get("/", tags=["Frontend"])
async def index(request: Request):
    """Dashboard general / Visi?n General de Planta."""
    return templates.TemplateResponse("index.html", {"request": request, "current_phase": "index"})


@app.get("/phase/1", tags=["Frontend"])
async def phase1_silo(request: Request):
    """Fase 1: Almacenamiento de Cal Viva."""
    return templates.TemplateResponse("phase1_silo.html", {"request": request, "current_phase": "1"})


@app.get("/phase/2", tags=["Frontend"])
async def phase2_dosing(request: Request):
    """Fase 2: Dosificaci?n y Alimentaci?n."""
    return templates.TemplateResponse("phase2_dosing.html", {"request": request, "current_phase": "2"})


@app.get("/phase/3", tags=["Frontend"])
async def phase3_slaker(request: Request):
    """Fase 3: Hidrataci?n (Apagado) - Fase cr?tica."""
    return templates.TemplateResponse("phase3_slaker.html", {"request": request, "current_phase": "3"})


@app.get("/phase/4", tags=["Frontend"])
async def phase4_separation(request: Request):
    """Fase 4: Clasificaci?n y Limpieza."""
    return templates.TemplateResponse("phase4_separation.html", {"request": request, "current_phase": "4"})


@app.get("/phase/5", tags=["Frontend"])
async def phase5_dist(request: Request):
    """Fase 5: Distribuci?n de Lechada."""
    return templates.TemplateResponse("phase5_dist.html", {"request": request, "current_phase": "5"})


@app.get("/api/visualization/data", tags=["Visualizaci?n"])
async def get_visualization_data():
    """Devuelve los datos del CSV de simulaci?n en JSON para los gr?ficos."""
    return get_csv_visualization_data()


@app.get("/visualization", response_class=HTMLResponse, tags=["Visualizaci?n"])
async def visualization_page():
    """P?gina HTML con gr?ficos Chart.js para Nivel Silo, Flujo de Cal y Temperatura Slaker."""
    html_content = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualizaci?n de Sensores - Cal Lechada</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <style>
        :root { --bg: #0f1419; --card: #1a2332; --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff; --border: #30363d; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text); }
        .subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
        .chart-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
        .chart-card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--accent); }
        .chart-container { position: relative; height: 220px; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Visualizaci?n de sensores</h1>
    <p class="subtitle">Datos desde el CSV en la carpeta del backend (escenario generado)</p>
    <div class="chart-card">
        <h2>Nivel del Silo (2270-LIT-11825)</h2>
        <div class="chart-container"><canvas id="chartSilo"></canvas></div>
    </div>
    <div class="chart-card">
        <h2>Flujo de Cal (2280-WI-01769)</h2>
        <div class="chart-container"><canvas id="chartFlujo"></canvas></div>
    </div>
    <div class="chart-card">
        <h2>Temperatura del Slaker (2270-TT-11824B)</h2>
        <div class="chart-container"><canvas id="chartSlaker"></canvas></div>
    </div>
    <p class="subtitle"><a href="/">Volver a la API</a></p>
    <script>
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(48,54,61,0.5)' }, ticks: { color: '#8b949e', maxTicksLimit: 8 } },
                y: { grid: { color: 'rgba(48,54,61,0.5)' }, ticks: { color: '#8b949e' } }
            }
        };
        async function init() {
            const res = await fetch('/api/visualization/data');
            const data = await res.json();
            const labels = data.timestamps || [];
            const buildConfig = (label, values, color) => ({
                type: 'line',
                data: { labels, datasets: [{ label, data: values, borderColor: color, backgroundColor: color + '20', fill: true, tension: 0.3 }] },
                options: commonOptions
            });
            new Chart(document.getElementById('chartSilo'), buildConfig('Nivel Silo', data['2270-LIT-11825'] || [], '#58a6ff'));
            new Chart(document.getElementById('chartFlujo'), buildConfig('Flujo Cal', data['2280-WI-01769'] || [], '#3fb950'));
            new Chart(document.getElementById('chartSlaker'), buildConfig('Temp Slaker', data['2270-TT-11824B'] || [], '#d29922'));
        }
        init();
    </script>
</body>
</html>
"""
    return HTMLResponse(html_content)


@app.get("/api/v1/status", response_model=PlantStatusResponse, tags=["Monitoreo"])
async def get_plant_status():
    """
    Ejecuta un ciclo de simulaci?n y devuelve el estado completo y actual de la planta.
    """
    # 1. Obtener los datos m?s recientes del simulador
    sensor_data = simulator.tick()

    # 2. Determinar el modo de operaci?n
    # Mapeo de valores a los argumentos de la funci?n
    screw_val = sensor_data.get("2270-SAL-11817", 0.0)
    rotary_val = sensor_data.get("2270-SAL-11818", 0.0)
    agua_val = sensor_data.get("2270-FIT-11801", 0.0)
    
    # Asumimos que 'cal' est? relacionado con la operaci?n del tornillo
    cal_val = screw_val 
    
    current_mode = determinar_modo_actual(cal=cal_val, agua=agua_val, rotary_val=rotary_val, screw_val=screw_val)
    simulator.mode = current_mode # Sincronizar el modo del simulador si la l?gica lo cambia

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
    
    Escenarios v?lidos:
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
            detail=f"Escenario '{scenario_name}' no reconocido. Escenarios v?lidos: reactividad_alta, reactividad_media, reactividad_baja, lavado, inactivo."
        )
    
    return ScenarioControlResponse(
        message=f"Comando recibido. Iniciando escenario: {scenario_name}",
        scenario_started=scenario_name
    )

# Para ejecutar la app localmente:
# uvicorn cal_monitoring_backend.main:app --reload
