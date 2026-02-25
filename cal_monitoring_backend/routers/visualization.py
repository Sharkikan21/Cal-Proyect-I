from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from ..services.csv_service import PHASE_SENSORS, get_csv_visualization_data, get_phase_data

router = APIRouter(tags=["Visualización"])


@router.get("/api/visualization/data")
async def get_visualization_data():
    """Devuelve los datos del CSV de simulación en JSON para los gráficos."""
    return get_csv_visualization_data()


@router.get("/api/data/{phase_id}")
async def get_data_by_phase(phase_id: str):
    """
    Devuelve los datos del CSV filtrados por fase (1-5).
    Formato: { timestamps: [...], tag1: [...], tag2: [...] }.
    """
    if phase_id not in PHASE_SENSORS:
        raise HTTPException(status_code=404, detail=f"Fase '{phase_id}' no válida. Use 1, 2, 3, 4 o 5.")
    return get_phase_data(phase_id)


@router.get("/visualization", response_class=HTMLResponse)
async def visualization_page():
    """Página HTML con gráficos Chart.js para Nivel Silo, Flujo de Cal y Temperatura Slaker."""
    html_content = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualización de Sensores - Cal Lechada</title>
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
    <h1>Visualización de sensores</h1>
    <p class="subtitle">Datos estáticos desde plant_simulator_output.csv</p>
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
