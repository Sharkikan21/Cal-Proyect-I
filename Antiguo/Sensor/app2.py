from dash import Dash, html, dcc, Input, Output, State
import dash_bootstrap_components as dbc
import pandas as pd
import json
from datetime import datetime
import dash
import plotly.graph_objects as go


def expandir_claves_json(diccionario_original):
    nuevo_diccionario = {}

    for clave, valor in diccionario_original.items():
        if "/" in clave:
            partes = clave.split("-")
            prefijo = "-".join(partes[:-1])
            sufijos = partes[-1].split("/")
            for sufijo in sufijos:
                nueva_clave = f"{prefijo}-{sufijo}"
                nuevo_diccionario[nueva_clave] = valor
        else:
            nuevo_diccionario[clave] = valor

    return nuevo_diccionario

try:
    # === Leer archivos ===
    df = pd.read_excel("Tabla_Completa.xlsx", header=None)
    sensores = df.iloc[2]
    sensores_excel = df.iloc[5:].reset_index(drop=True)

    with open("salida_sensores.json", encoding="utf-8") as f:
        sensores_json = json.load(f)

    # === Obtener todos los TAGS del JSON (claves + internos) ===
    def extraer_tags_recursivamente(obj):
        tags = set()
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key == "tag" or key == "tag_controlador" or key == "actuador":
                    tags.add(value)
                elif key == "equipos" and isinstance(value, list):
                    tags.update(value)
                else:
                    tags.update(extraer_tags_recursivamente(value))
        elif isinstance(obj, list):
            for item in obj:
                tags.update(extraer_tags_recursivamente(item))
        return tags

    tags_json_claves = set(sensores_json.keys())
    tags_json_internos = extraer_tags_recursivamente(sensores_json)
    tags_json_total = tags_json_claves.union(tags_json_internos)

    # === Obtener los TAGS desde el Excel ===
    tags_excel = set(str(tag).strip() for tag in sensores if pd.notna(tag) and str(tag).strip() != "")

    # === Comparar ===
    tags_comunes = tags_json_total & tags_excel
    tags_solo_json = tags_json_total - tags_excel
    tags_solo_excel = tags_excel - tags_json_total

    # === Reporte en consola ===
    print(f"\n✅ Sensores en común entre JSON y Excel: {len(tags_comunes)} encontrados.\n")

    if tags_solo_json:
        print("⚠️ Sensores usados en el JSON pero que NO están presentes en el Excel:")
        for tag in sorted(tags_solo_json):
            print(f"  - {tag}")

    if tags_solo_excel:
        print("\n⚠️ Sensores presentes en el Excel pero que NO están referenciados en el JSON:")
        for tag in sorted(tags_solo_excel):
            print(f"  - {tag}")

except FileNotFoundError:
    print("❌ Error: El archivo 'Tabla.xlsx' no se encontró.")
# === Columnas clave ===
def buscar_col(tag_buscado, tags_de_columnas_excel):

    try:
        # Limpiar el tag buscado y los tags en la serie para mejorar la coincidencia
        tag_buscado_limpio = str(tag_buscado).strip()
        tags_limpios_excel = tags_de_columnas_excel.astype(str).str.strip()

        # Intenta primero una coincidencia exacta
        coincidencias_exactas = tags_limpios_excel[tags_limpios_excel == tag_buscado_limpio]
        if not coincidencias_exactas.empty:
            return coincidencias_exactas.index[0]

        # Si no hay exacta, intenta con 'contains' (puede ser menos preciso, úsalo con precaución)
        # print(f"Advertencia en buscar_col: No hubo coincidencia exacta para '{tag_buscado_limpio}'. Intentando con 'contains'.")
        # coincidencias_contains = tags_limpios_excel[tags_limpios_excel.str.contains(tag_buscado_limpio, case=False, na=False)] # case=False para ignorar may/min
        # if not coincidencias_contains.empty:
        #     if len(coincidencias_contains) > 1:
        #         print(f"Advertencia en buscar_col: Múltiples coincidencias con 'contains' para '{tag_buscado_limpio}': {coincidencias_contains.tolist()}. Se usará la primera.")
        #     return coincidencias_contains.index[0]
        
        print(f"Advertencia en buscar_col: El tag '{tag_buscado_limpio}' no se encontró en los nombres de columna del Excel.")
        return None
    except Exception as e:
        print(f"Error inesperado en buscar_col procesando tag '{tag_buscado}': {e}")
        return None
    
# === Construcción de sensores válidos y mapa de columnas ===

def extraer_tags_recursivamente(obj):
    tags = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ["tag", "tag_controlador", "actuador"]:
                tags.add(value)
            elif key == "equipos" and isinstance(value, list):
                tags.update(value)
            else:
                tags.update(extraer_tags_recursivamente(value))
    elif isinstance(obj, list):
        for item in obj:
            tags.update(extraer_tags_recursivamente(item))
    return tags

tags_internos_json = extraer_tags_recursivamente(sensores_json)
todos_los_tags_json = set(sensores_json.keys()).union(tags_internos_json)

tags_excel = set(str(tag).strip() for tag in sensores if pd.notna(tag) and str(tag).strip() != "")

mapa_col_idx = {}
tags_no_encontrados = set()
sensores_json_filtrados = {}
curvas_reactividad = []
lista_temperaturas_reactividad = []


for tag in todos_los_tags_json:
    tag_limpio = str(tag).strip()
    if tag_limpio in tags_excel:
        idx_col = buscar_col(tag_limpio, sensores)
        if idx_col is not None:
            mapa_col_idx[tag_limpio] = idx_col
    else:
        tags_no_encontrados.add(tag_limpio)

# Solo guardamos sensores válidos (claves del JSON)
for tag_principal in sensores_json.keys():
    if tag_principal in mapa_col_idx:
        sensores_json_filtrados[tag_principal] = sensores_json[tag_principal]

print(f"✅ Sensores válidos para evaluación: {len(sensores_json_filtrados)} encontrados.")
if tags_no_encontrados:
    print(f"⚠️ Algunos tags definidos en JSON no se encontraron en Excel ({len(tags_no_encontrados)}):")
    for tag in sorted(tags_no_encontrados):
        print(f"  - {tag}")


#col_cal = buscar_col("Consumo", sensores)
col_agua = buscar_col("2270-FIT-11801", sensores)
col_tk68 = buscar_col("2270-LI-11875", sensores)
col_tk69 = buscar_col("2270-LI-11885", sensores)
col_temp = buscar_col("2270-TT-11824A", sensores)
col_lic_11850 = buscar_col("2270-LIC-11850", sensores)
col_lic_11845 = buscar_col("2270-LIC-11845", sensores)
col_rotary = buscar_col("2270-ZM-009-021", sensores)
col_screw = buscar_col("2270-ZM-009-04", sensores)
col_fic_11870 = buscar_col("2270-FIC-11870", sensores)


# === Preparar sensores JSON filtrados según los disponibles en Excel ===

tags_excel = set(str(tag).strip() for tag in sensores if pd.notna(tag) and str(tag).strip() != "")

sensores_json_filtrados = {}
mapa_col_idx = {}
tags_no_encontrados = set()

for tag_json, definicion in sensores_json.items():
    tag_limpio = str(tag_json).strip()
    if tag_limpio in tags_excel:
        sensores_json_filtrados[tag_limpio] = definicion
        idx_col = buscar_col(tag_limpio, sensores)
        if idx_col is not None:
            mapa_col_idx[tag_limpio] = idx_col
        else:
            tags_no_encontrados.add(tag_limpio)
    else:
        tags_no_encontrados.add(tag_limpio)

print(f"✅ Sensores válidos para evaluación: {len(sensores_json_filtrados)} encontrados.")
if tags_no_encontrados:
    print(f"⚠️ Sensores ignorados porque no están en Excel ({len(tags_no_encontrados)}):")
    for tag in sorted(tags_no_encontrados):
        print(f"  - {tag}")
        
# === Umbrales de Alarma (Ejemplos) ===
TEMP_MAX_CRITICA = 80.0  # Temperatura máxima crítica en °C
TEMP_MIN_PRODUCCION = 65.0 # Temperatura mínima esperada en producción °C
NIVEL_MAX_TANQUE = 95.0   # Nivel máximo en % para tanques
NIVEL_MIN_TANQUE = 10.0   # Nivel mínimo en % para tanques
CONSUMO_CAL_MAX_PROD = 5.0 # Toneladas máximas esperadas para Consumo Cal en producción
CONSUMO_CAL_MIN_PROD = 0.1 # Toneladas mínimas esperadas para Consumo Cal en producción (si no es cero)
FLUJO_AGUA_MIN_PROD = 10.0 # m³/h mínimos esperados para Agua en producción
FLUJO_AGUA_MIN_LAVADO = 5.0 # m³/h mínimos esperados para Agua en lavado
RELACION_MIN = 3.0
RELACION_MAX = 4.0

# === Inicializar app ===
app = Dash(__name__, external_stylesheets=[dbc.themes.DARKLY])
app.title = "Sistema de Cal Lechada"


app.layout = html.Div([
    html.H2("🛠️ Sistema de Producción de Cal Lechada", style={"textAlign": "center", "marginTop": "20px"}),
    html.Hr(),
    dcc.Interval(id="interval", interval=2000, n_intervals=0),

    # Alerta de audio (se activa al abrir popup)
    html.Div(id="audio-container"),

    # Modal de alerta
    dbc.Modal([
        dbc.ModalHeader(dbc.ModalTitle(id="titulo-alerta", className="text-danger fw-bold")), # Título dinámico
        dbc.ModalBody(id="mensaje-alerta"),
        dbc.ModalFooter(dbc.Button("✅ Entendido", id="close-popup", className="btn btn-light", n_clicks=0))
    ],
    id="popup-alarma",
    is_open=False,
    backdrop="static", # Evita cerrar el modal al hacer clic fuera
    centered=True,
    size="lg", # Modal más grande
    style={"border": "2px solid red", "backgroundColor": "#2c2c2c"}), # Estilo mejorado

    dbc.Row([
        dbc.Col([
            html.Div("💠 Ingreso de Cal", style={"fontWeight": "bold", "fontSize": "16px"}),
            html.H3(id="output-cal", style={"marginBottom": "0"})
        ]),
        dbc.Col([
            html.Div("💧 Agua Vortex", style={"fontWeight": "bold", "fontSize": "16px"}),
            html.H3(id="output-agua", style={"marginBottom": "0"})
        ]),
        dbc.Col([
            html.Div("📏 Relación Agua/Cal", style={"fontWeight": "bold", "fontSize": "16px"}),
            html.H3(id="output-relacion", style={"marginBottom": "0"})
        ]),
        dbc.Col([
            html.Div("🌡️ Temperatura", style={"fontWeight": "bold", "fontSize": "16px"}),
            html.H3(id="output-temp", style={"marginBottom": "0"})
        ]),
    ], style={"marginBottom": "30px", "padding": "10px"}),

    dbc.Row([
        dbc.Col([
            html.Div("📦 Nivel TK68", style={"fontWeight": "bold", "fontSize": "15px"}),
            html.Div(id="output-tk68", style={"marginBottom": "5px"}),
            dbc.Progress(id="barra-tk68", value=0, striped=True, animated=True, style={"height": "25px"})
        ], width=6),
        dbc.Col([
            html.Div("📦 Nivel TK69", style={"fontWeight": "bold", "fontSize": "15px"}),
            html.Div(id="output-tk69", style={"marginBottom": "5px"}),
            dbc.Progress(id="barra-tk69", value=0, striped=True, animated=True, style={"height": "25px"})
        ], width=6)
    ], style={"marginBottom": "30px", "padding": "10px"}),

    html.Div(id="estado-sistema", style={
    "textAlign": "center", 
    "fontSize": "22px", 
    "marginTop": "15px", 
    "fontWeight": "bold", 
    "color": "#00ffff"
    }),
    
    dcc.Graph(id="grafico-reactividad", style={"height": "400px"})
], style={"padding": "20px", "backgroundColor": "#1a1a1a", "minHeight": "100vh", "color": "#f0f0f0"})

# === Variables de estado ===
modo = "esperando" # Estados: esperando, produciendo, lavando, inactivo
modo_anterior = None
i = 0 # Índice para iterar sobre los sensores_excel del Excel
reactividad_en_proceso = False
tiempo_inicio_reactividad = None
temp_inicio_reactividad = None
tiempo_inicio_lavado = None
screw_anterior = 0
contador_lavados = 0


# === Función para interpretar ceros prácticos ===
def es_cero(valor, umbral=0.1): # Umbral un poco más grande para sensores_excel reales
    return abs(valor) < umbral

def evaluar_sensores_json(fila_datos, fila_index, mapa_columnas, setpoints_dict, config_json_sensores):
    alertas_json = []

    for tag_principal_json, info_sensor in config_json_sensores.items():
        for i, condicion_config in enumerate(info_sensor.get("condiciones", [])):
            tipo_condicion = condicion_config.get("tipo")
            nombre_equipo = condicion_config.get("nombre_equipo", info_sensor.get("nombre_equipo", tag_principal_json))
            descripcion_alerta_plantilla = condicion_config.get("descripcion", f"Condición {i+1} para {tag_principal_json}")

            if tipo_condicion in ["absoluto", "relativo_a_SP", None]:
                col_idx = mapa_columnas.get(tag_principal_json)
                if col_idx is None:
                    continue

                valor_sensor = fila_datos.get(col_idx)
                if valor_sensor is None:
                    continue

                try:
                    valor_sensor_num = pd.to_numeric(valor_sensor)
                except ValueError:
                    continue

                if tipo_condicion is None:
                    tipo_condicion = "absoluto"
                    condicion_config = {
                        "tipo": "absoluto",
                        "operador": condicion_config.get("operador"),
                        "valor": condicion_config.get("valor")
                    }

                if evaluar_condicion(valor_sensor_num, condicion_config, tag_principal_json, setpoints_dict):
                    alertas_json.append(f"ALERTA JSON (Fila {fila_index}): {descripcion_alerta_plantilla} [{nombre_equipo}] (Sensor: {tag_principal_json}, Valor: {valor_sensor_num:.2f})")

            elif tipo_condicion == "multiple_and":
                sub_condiciones_lista = condicion_config.get("condiciones", [])
                if not sub_condiciones_lista:
                    continue

                cumple_todas = True

                for sub in sub_condiciones_lista:
                    sub_c = sub.get("condicion", {})
                    tag = sub_c.get("tag")
                    operador = sub_c.get("operador")
                    valor_esperado = sub_c.get("valor_esperado")
                    col_idx = mapa_columnas.get(tag)

                    if col_idx is None or operador is None or valor_esperado is None:
                        cumple_todas = False
                        break

                    valor_sensor = fila_datos.get(col_idx)
                    if valor_sensor is None:
                        cumple_todas = False
                        break

                    try:
                        valor = pd.to_numeric(valor_sensor) if isinstance(valor_esperado, (int, float)) else valor_sensor
                    except ValueError:
                        cumple_todas = False
                        break

                    if operador == "==": ok = valor == valor_esperado
                    elif operador == "!=": ok = valor != valor_esperado
                    elif operador == "<": ok = valor < valor_esperado
                    elif operador == ">": ok = valor > valor_esperado
                    elif operador == "<=": ok = valor <= valor_esperado
                    elif operador == ">=": ok = valor >= valor_esperado
                    else: ok = False

                    if not ok:
                        cumple_todas = False
                        break

                if cumple_todas:
                    alertas_json.append(f"ALERTA JSON (Fila {fila_index}): {descripcion_alerta_plantilla} [{nombre_equipo}] (Condiciones 'multiple_and' cumplidas)")

    return alertas_json

def determinar_modo_actual(cal, agua, rotary_val, screw_val):
    if not es_cero(rotary_val) or not es_cero(screw_val):
        return "produciendo"
    elif es_cero(rotary_val) and es_cero(screw_val) and not es_cero(agua):
        return "lavando"
    elif es_cero(rotary_val) and es_cero(screw_val) and es_cero(agua):
        return "inactivo"
    else:
        return "esperando"  # Este caso es de respaldo, casi nunca debería ocurrir


def evaluar_condicion(valor_sensor, condicion, tag_sensor, setpoints):
    if valor_sensor is None:
        return False  # No se puede evaluar

    tipo = condicion.get("tipo", "absoluto")
    operador = condicion.get("operador")

    if tipo == "relativo_a_SP":
        setpoint_base = setpoints.get(tag_sensor)
        if setpoint_base is None or "valor" not in setpoint_base:
            print(f"[ADVERTENCIA] No se encontró setpoint para {tag_sensor}")
            return False

        delta = condicion.get("delta", 0)
        unidad = condicion.get("unidad", "")

        if operador == "+":
            umbral = setpoint_base["valor"] + delta
            return valor_sensor > umbral
        elif operador == "-":
            umbral = setpoint_base["valor"] - delta
            return valor_sensor < umbral
        else:
            print(f"[ERROR] Operador relativo no reconocido: {operador}")
            return False

    elif tipo == "absoluto":
        valor = condicion.get("valor")
        if operador == ">":
            return valor_sensor > valor
        elif operador == "<":
            return valor_sensor < valor
        elif operador == "==":
            return valor_sensor == valor
        elif operador == ">=":
            return valor_sensor >= valor
        elif operador == "<=":
            return valor_sensor <= valor
        elif operador == "between":
            rango = condicion.get("rango", [0, 0])
            return rango[0] <= valor_sensor <= rango[1]
        else:
            print(f"[ERROR] Operador absoluto no reconocido: {operador}")
            return False

    else:
        print(f"[ERROR] Tipo de condición no reconocido: {tipo}")
        return False

@app.callback(
    Output("output-cal", "children"),
    Output("output-agua", "children"),
    Output("output-relacion", "children"),
    Output("output-temp", "children"),
    Output("output-tk68", "children"),
    Output("output-tk69", "children"),
    Output("barra-tk68", "value"),
    Output("barra-tk68", "color"),
    Output("barra-tk69", "value"),
    Output("barra-tk69", "color"),
    Output("popup-alarma", "is_open"),
    Output("audio-container", "children"),
    Output("mensaje-alerta", "children"),
    Output("titulo-alerta", "children"),
    Output("estado-sistema", "children"),
    Output("grafico-reactividad", "figure"),
    Input("interval", "n_intervals"),
)
def actualizar(n_intervals):
    global modo, i, modo_anterior
    global tiempo_inicio_lavado, contador_lavados
    global reactividad_en_proceso, temp_inicio_reactividad, tiempo_inicio_reactividad, screw_anterior
    global lista_temperaturas_reactividad

    
    fig = go.Figure()

    if curvas_reactividad:
        for curva in curvas_reactividad:
            x = [(t - curva["timestamp_inicio"]).total_seconds() / 60 for t, _ in curva["datos"]]
            y = [temp for _, temp in curva["datos"]]

            color_curva = (
                "lime" if curva["tipo"] == "ALTA"
                else "gold" if curva["tipo"] == "MEDIANA"
                else "deepskyblue"
            )

            fig.add_trace(go.Scatter(
                x=x,
                y=y,
                mode='lines+markers',
                name=f"{curva['tipo']} ({curva['minutos']}m {curva['segundos']}s)",
                line=dict(width=3, color=color_curva),
                marker=dict(size=6, color='white')
            ))

        ultima = curvas_reactividad[-1]
        titulo_grafico = f"🧪 Curvas de Reactividad (última: {ultima['tipo']} – {ultima['minutos']}m {ultima['segundos']}s)"

    else:
        titulo_grafico = "🧪 Esperando evento de reactividad..."

    # layout final común a ambos casos
    fig.update_layout(
        title=titulo_grafico,
        title_font=dict(size=20, color="white"),
        xaxis=dict(
            title=dict(text="Minutos desde inicio", font=dict(size=16, color="lightgray")),
            tickfont=dict(size=14, color="white"),
            gridcolor="#444"
        ),
        yaxis=dict(
            title=dict(text="Temperatura (°C)", font=dict(size=16, color="lightgray")),
            tickfont=dict(size=14, color="white"),
            gridcolor="#444"
        ),
        margin=dict(l=40, r=40, t=60, b=40),
        plot_bgcolor="#1a1a1a",
        paper_bgcolor="#1a1a1a",
        template="plotly_dark",
        height=420
    )



    if sensores_excel.empty:
        return ("- TON", "- m³/h", "-", "- °C", "-%", "-%", "🔴 Sin sensores_excel", 0, "secondary", 0, "secondary", False, None, "No hay sensores_excel para procesar.", "Error de sensores_excel", go.Figure)

    fila_actual = i % len(sensores_excel)
    fila = sensores_excel.iloc[fila_actual]
    timestamp_fila = pd.to_datetime(fila.get(2), dayfirst=True, errors="coerce")
    
    alerta_mensajes_list = []
    alerta_disparada_local = False
    #comentar para que funcione con normalidad
    titulo_popup = "✅ Sin Novedad"
    mensaje_final_alerta_display = html.Div("Visualizando curva de reactividad...", style={
        "textAlign": "center", "color": "deepskyblue", "fontWeight": "bold", "fontSize": "16px"
    })
    abrir_popup = False
    audio_component = None
    #hasta acá

    
    if fila.isnull().all():
        print(f"[DEBUG] Fila {i} vacía. Avanzando sin procesar.")
        i += 1
        return dash.no_update

    # === datos principales ===
    valor_rotary = fila.get(col_rotary, 0)
    try:
        cal = float(valor_rotary) * 0.4691
    except:
        cal = 0

    agua = fila.get(col_agua, 0)
    temp = fila.get(col_temp, 0)
    tk68 = fila.get(col_tk68, 0)
    tk69 = fila.get(col_tk69, 0)
    nivel_sep = fila.get(col_lic_11850, 0)
    nivel_pumpbox = fila.get(col_lic_11845, 0)
    rotary_val = fila.get(col_rotary, 0)
    screw_val = fila.get(col_screw, 0)
    flujo_adicional = fila.get(col_fic_11870, 0)
    
# === Lógica de Reactividad basada en subida de corriente del tornillo ===

# === Lógica de Reactividad basada en subida de corriente del tornillo ===
    if i > 0 and es_cero(screw_anterior) and not es_cero(screw_val) and not reactividad_en_proceso:
        tiempo_inicio_reactividad = timestamp_fila
        temp_inicio_reactividad = temp
        reactividad_en_proceso = True
        lista_temperaturas_reactividad = []  # Reiniciamos aquí
        print(f"[{tiempo_inicio_reactividad.strftime('%Y-%m-%d %H:%M:%S')}] 🌡️ Inicio curva reactividad. Temp inicial: {temp_inicio_reactividad:.2f}°C")

    if reactividad_en_proceso:
        aumento = temp - temp_inicio_reactividad
        lista_temperaturas_reactividad.append((timestamp_fila, temp))  # Guardar cada punto

        if aumento >= 40:
            tiempo_final = timestamp_fila
            duracion_seg = int((tiempo_final - tiempo_inicio_reactividad).total_seconds())
            minutos = duracion_seg // 60
            segundos = duracion_seg % 60

            if duracion_seg <= 180:
                tipo = "ALTA"
            elif duracion_seg <= 360:
                tipo = "MEDIANA"
            else:
                tipo = "BAJA"

            print(f"[{tiempo_final.strftime('%Y-%m-%d %H:%M:%S')}] ✅ Reactividad de cal: {tipo} – Aumento de 40°C en {minutos} min {segundos} s (de {temp_inicio_reactividad:.2f}°C a {temp:.2f}°C)")

            alerta_mensajes_list.append(
                f"🧪 Reactividad de cal: {tipo} – Subida de 40°C en {minutos} min {segundos} s (de {temp_inicio_reactividad:.2f}°C a {temp:.2f}°C)"
            )

            curvas_reactividad.append({
                "timestamp_inicio": tiempo_inicio_reactividad,
                "timestamp_fin": tiempo_final,
                "temp_inicio": temp_inicio_reactividad,
                "temp_fin": temp,
                "tipo": tipo,
                "minutos": minutos,
                "segundos": segundos,
                "datos": lista_temperaturas_reactividad.copy()
            })

            reactividad_en_proceso = False
            tiempo_inicio_reactividad = None
            temp_inicio_reactividad = None
            lista_temperaturas_reactividad = []

    
    # === Título popup ===
    if any("CRÍTICA" in msg.upper() or "🔥" in msg for msg in alerta_mensajes_list):
        titulo_popup = "🚨 Alarma Crítica"
    elif any("⚠️" in msg or "❄️" in msg or "📉" in msg or "📈" in msg for msg in alerta_mensajes_list): # Ajusta los íconos si es necesario
        titulo_popup = "⚠️ Alarma Importante"
    elif alerta_disparada_local: # Si hay cualquier otra alerta (incluyendo las de JSON sin íconos específicos)
        titulo_popup = "🔔 Alerta General"
    else:
        titulo_popup = "✅ Sin Novedad" # O "Info" si prefieres
    
   # === Componente HTML para mostrar alertas ===
    mensaje_final_alerta_display = html.Div([
        html.Div([
            # Puedes diferenciar el estilo o ícono para alertas JSON si quieres
            html.Span("🔔 ", style={"color": "#ffc107", "fontWeight": "bold"}), 
            html.Span(msg)
        ], style={
            "marginBottom": "8px", "padding": "8px", "borderLeft": "5px solid #ff8800",
            "backgroundColor": "#333", "borderRadius": "5px"
        }) for msg in alerta_mensajes_list
    ]) if alerta_mensajes_list else html.Div("Todo en orden.", style={"textAlign": "center", "color": "green"})

    abrir_popup = alerta_disparada_local
    audio_component = html.Audio(src="/assets/alerta2.mp3", autoPlay=True) if abrir_popup else None

    
# Evaluamos avance según valores reales, no según modo
    i += 1
    screw_anterior = screw_val

    estados_display = {
        "esperando": ("🔵 Esperando Inicio", "primary"),
        "produciendo": ("🟢 Produciendo Cal Lechada", "success"),
        "lavando": ("💧 Lavando Sistema", "info"),
        "inactivo": ("🔴 Sistema Inactivo", "danger")
    }
    estado_texto, estado_color_texto = estados_display.get(modo, ("⚪ Estado Desconocido", "light"))
    
    if alerta_disparada_local: # Modifica el texto si hay alerta
        if "ALERTA CRÍTICA" in titulo_popup or "Alarma Crítica" in titulo_popup :
             estado_texto = f"🔥 {estado_texto} (ALARMA CRÍTICA)"
             estado_color_texto = "danger" # O un color más fuerte
        else:
             estado_texto = f"⚠️ {estado_texto} (ALERTA ACTIVA)"
             estado_color_texto = "orange" # O 'warning'

    def color_porcentaje(v):
        if v < NIVEL_MIN_TANQUE + 5: return "danger"
        elif v > NIVEL_MAX_TANQUE - 5: return "danger"
        elif v < 30: return "warning"
        # elif v < 70: return "info" # Original
        # Podrías querer 'info' para rangos más amplios o solo success/warning/danger
        return "success" # Por defecto, si no es bajo/alto/crítico

    return (
        f"{cal:.3f} TON",
        f"{agua:.2f} m³/h",
        #f"{masa_liquida:.2f}" if not es_cero(cal) else "-",
        f"{temp:.1f} °C",
        f"{tk68:.1f}%",
        f"{tk69:.1f}%",
        estado_texto,
        tk68, "info",
        tk69, "info",
        abrir_popup,
        audio_component,
        mensaje_final_alerta_display,
        titulo_popup,
        "Gráfico Reactividad de Cal",
        fig
    )

if __name__ == '__main__':
    app.run(debug=True)