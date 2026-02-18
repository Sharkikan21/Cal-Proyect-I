import pandas as pd
import json
from datetime import datetime, timedelta

def load_sensor_data_from_excel(file_path: str) -> tuple[pd.DataFrame, pd.Series]:
    """
    Carga los datos de los sensores desde un archivo Excel.
    Asume que la fila con índice 2 (tercera fila, 0-basada) contiene los nombres de los sensores
    y los datos de los sensores comienzan desde la fila con índice 5 (sexta fila, 0-basada).
    Retorna una tupla con el DataFrame de los datos de sensores y una Serie de los nombres de los sensores
    con sus índices de columna originales como índice de la Serie.
    """
    try:
        df = pd.read_excel(file_path, header=None)
        # La fila 3 (índice 2 si es 0-basado) contiene los nombres de los sensores.
        # Creamos una Serie donde el valor es el nombre del sensor y el índice es el índice de la columna.
        sensor_names_with_cols = pd.Series(df.iloc[2].values, index=df.columns)
        # Los datos de los sensores comienzan desde la fila 6 (índice 5 si es 0-basado)
        sensor_data = df.iloc[5:].reset_index(drop=True)
        return sensor_data, sensor_names_with_cols
    except FileNotFoundError:
        print(f"Error: El archivo Excel '{file_path}' no se encontró.")
        return None, None
    except Exception as e:
        print(f"Error al cargar los datos del Excel '{file_path}': {e}")
        return None, None

def load_alarm_config_from_json(file_path: str) -> dict:
    """
    Carga la configuración de alarmas desde un archivo JSON.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            alarm_config = json.load(f)
        return alarm_config
    except FileNotFoundError:
        print(f"Error: El archivo JSON '{file_path}' no se encontró.")
        return None
    except json.JSONDecodeError as e:
        print(f"Error al decodificar JSON en '{file_path}': {e}")
        return None
    except Exception as e:
        print(f"Error al cargar la configuración JSON '{file_path}': {e}")
        return None

def buscar_col(tag_buscado: str, tags_de_columnas_excel: pd.Series) -> int | None:
    """
    Busca el índice de la columna para un tag dado en una Serie de tags de columnas de Excel.
    Realiza una búsqueda exacta y maneja tags con espacios.
    """
    try:
        tag_buscado_limpio = str(tag_buscado).strip()
        tags_limpios_excel = tags_de_columnas_excel.astype(str).str.strip()

        coincidencias_exactas = tags_limpios_excel[tags_limpios_excel == tag_buscado_limpio]
        if not coincidencias_exactas.empty:
            return coincidencias_exactas.index[0]
        
        return None
    except Exception as e:
        print(f"Error inesperado en buscar_col procesando tag '{tag_buscado}': {e}")
        return None

def extract_tags_recursively(obj, tags_set: set):
    """
    Función auxiliar para extraer todos los tags anidados de un objeto JSON.
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ["tag", "tag_controlador", "actuador"]:
                tags_set.add(value)
            elif key == "equipos" and isinstance(value, list):
                tags_set.update(value)
            else:
                extract_tags_recursively(value, tags_set)
    elif isinstance(obj, list):
        for item in obj:
            extract_tags_recursively(item, tags_set)

def build_tag_column_map(alarm_config: dict, excel_sensor_names: pd.Series, required_tags: list[str] = None) -> tuple[dict, set]:
    """
    Construye un mapa de TAGs a índices de columna en el DataFrame de Excel
    y un conjunto de TAGs que no fueron encontrados.
    Acepta una lista opcional de required_tags para asegurar que se mapeen.
    """
    mapa_col_idx = {}
    tags_no_encontrados = set()

    # Extraer todos los tags relevantes del JSON de configuración de alarmas
    all_tags_from_json = set()
    all_tags_from_json.update(alarm_config.keys()) # Añadir claves principales
    extract_tags_recursively(alarm_config, all_tags_from_json) # Añadir tags internos recursivamente

    # Añadir tags requeridos si se proporcionan
    if required_tags:
        all_tags_from_json.update(required_tags)

    # Limpiar y validar tags de Excel
    tags_excel_valid = set(str(tag).strip() for tag in excel_sensor_names if pd.notna(tag) and str(tag).strip() != "")

    for tag_json in all_tags_from_json:
        tag_limpio = str(tag_json).strip()
        if tag_limpio in tags_excel_valid:
            idx_col = buscar_col(tag_limpio, excel_sensor_names)
            if idx_col is not None:
                mapa_col_idx[tag_limpio] = idx_col
            else:
                # Este caso debería ser raro si tag_limpio in tags_excel_valid es verdadero
                tags_no_encontrados.add(tag_limpio)
        else:
            tags_no_encontrados.add(tag_limpio)
            
    return mapa_col_idx, tags_no_encontrados

# === Constantes de Umbrales de Alarma (Extraídas de app.py) ===
TEMP_MAX_CRITICA = 80.0
TEMP_MIN_PRODUCCION = 65.0
NIVEL_MAX_TANQUE = 95.0
NIVEL_MIN_TANQUE = 10.0
CONSUMO_CAL_MAX_PROD = 5.0
CONSUMO_CAL_MIN_PROD = 0.1
FLUJO_AGUA_MIN_PROD = 10.0
FLUJO_AGUA_MIN_LAVADO = 5.0
RELACION_MIN = 3.0
RELACION_MAX = 4.0

def es_cero(valor: float, umbral: float = 0.1) -> bool:
    """
    Función auxiliar para interpretar valores cercanos a cero.
    """
    try:
        return abs(float(valor)) < umbral
    except (ValueError, TypeError):
        return True # Si no es un número, lo tratamos como cero (o no significativo)

def evaluar_condicion(valor_sensor: float, condicion: dict, tag_sensor: str, setpoints: dict) -> bool:
    """
    Evalúa una condición individual para un sensor dado.
    """
    if valor_sensor is None:
        return False

    tipo = condicion.get("tipo", "absoluto")
    operador = condicion.get("operador")

    if tipo == "relativo_a_SP":
        setpoint_base = setpoints.get(tag_sensor)
        if setpoint_base is None or "valor" not in setpoint_base:
            # print(f"[ADVERTENCIA] No se encontró setpoint para {tag_sensor}")
            return False

        delta = condicion.get("delta", 0)

        if operador == "+":
            umbral = setpoint_base["valor"] + delta
            return valor_sensor > umbral
        elif operador == "-":
            umbral = setpoint_base["valor"] - delta
            return valor_sensor < umbral
        else:
            # print(f"[ERROR] Operador relativo no reconocido: {operador}")
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
            # print(f"[ERROR] Operador absoluto no reconocido: {operador}")
            return False

    else:
        # print(f"[ERROR] Tipo de condición no reconocido: {tipo}")
        return False

def evaluar_sensores_json(
    fila_datos: pd.Series,
    fila_index: int,
    mapa_columnas: dict,
    setpoints_dict: dict,
    config_json_sensores: dict
) -> list[str]:
    """
    Evalúa las condiciones definidas en el JSON de configuración para una fila de datos de sensores.
    Retorna una lista de mensajes de alerta.
    """
    alertas_json = []

    for tag_principal_json, info_sensor in config_json_sensores.items():
        # Los tags "custom_eval", "relacion_control" y "estado_logico" no se manejan en esta función
        # porque requieren lógica de sistema más avanzada o evaluación de múltiples tags que
        # no están directamente disponibles en la evaluación por fila de sensor individual.
        # Estos se manejarán en una capa superior de la lógica de negocio.

        for i, condicion_config in enumerate(info_sensor.get("condiciones", [])):
            tipo_condicion = condicion_config.get("tipo")
            # Ignoramos los tipos de condición complejos aquí
            if tipo_condicion in ["custom_eval", "relacion_control", "estado_logico"]:
                continue

            nombre_equipo = condicion_config.get("nombre_equipo", info_sensor.get("nombre_equipo", tag_principal_json))
            descripcion_alerta_plantilla = condicion_config.get("descripcion", f"Condición {i+1} para {tag_principal_json}")

            if tipo_condicion in ["absoluto", "relativo_a_SP", None]:
                col_idx = mapa_columnas.get(tag_principal_json)
                if col_idx is None:
                    continue

                # Aseguramos que el acceso a fila_datos sea seguro
                valor_sensor = fila_datos.get(col_idx)
                if valor_sensor is None:
                    continue

                try:
                    valor_sensor_num = pd.to_numeric(valor_sensor)
                except (ValueError, TypeError):
                    continue

                if tipo_condicion is None: # Si no se especifica, asumimos absoluto
                    tipo_condicion = "absoluto"
                    # Aseguramos que condicion_config tenga los campos necesarios para evaluar
                    condicion_config_para_eval = {
                        "tipo": "absoluto",
                        "operador": condicion_config.get("operador"),
                        "valor": condicion_config.get("valor")
                    }
                else:
                    condicion_config_para_eval = condicion_config


                if evaluar_condicion(valor_sensor_num, condicion_config_para_eval, tag_principal_json, setpoints_dict):
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
                    
                    if tag is None: # Si no hay tag, no podemos evaluar la sub-condición
                        cumple_todas = False
                        break

                    # Necesitamos el valor actual del sensor 'tag' en la fila_datos
                    col_idx_sub = mapa_columnas.get(tag)
                    if col_idx_sub is None:
                        cumple_todas = False
                        break
                    
                    valor_sensor_sub = fila_datos.get(col_idx_sub)
                    if valor_sensor_sub is None:
                        cumple_todas = False
                        break

                    try:
                        # Convertir a numérico solo si el valor esperado es numérico
                        valor_para_comparar = pd.to_numeric(valor_sensor_sub) if isinstance(valor_esperado, (int, float)) else valor_sensor_sub
                    except (ValueError, TypeError):
                        cumple_todas = False
                        break

                    # Evaluar la sub-condición (lógica similar a evaluar_condicion pero simplificada)
                    ok = False
                    if operador == "==": ok = (valor_para_comparar == valor_esperado)
                    elif operador == "!=": ok = (valor_para_comparar != valor_esperado)
                    elif operador == "<": ok = (valor_para_comparar < valor_esperado)
                    elif operador == ">": ok = (valor_para_comparar > valor_esperado)
                    elif operador == "<=": ok = (valor_para_comparar <= valor_esperado)
                    elif operador == ">=": ok = (valor_para_comparar >= valor_esperado)
                    
                    if not ok:
                        cumple_todas = False
                        break

                if cumple_todas:
                    alertas_json.append(f"ALERTA JSON (Fila {fila_index}): {descripcion_alerta_plantilla} [{nombre_equipo}] (Condiciones 'multiple_and' cumplidas)")

    return alertas_json

def determinar_modo_actual(cal: float, agua: float, rotary_val: float, screw_val: float) -> str:
    """
    Determina el modo de operación actual del sistema de cal lechada
    basado en los valores de los sensores.
    """
    if not es_cero(rotary_val) or not es_cero(screw_val):
        return "produciendo"
    elif es_cero(rotary_val) and es_cero(screw_val) and not es_cero(agua):
        return "lavando"
    elif es_cero(rotary_val) and es_cero(screw_val) and es_cero(agua):
        return "inactivo"
    else:
        return "esperando"  # Caso de respaldo


class ReactivityMonitor:
    def __init__(self):
        self.reactividad_en_proceso = False
        self.tiempo_inicio_reactividad: datetime | None = None
        self.temp_inicio_reactividad: float | None = None
        self.lista_temperaturas_reactividad: list[tuple[datetime, float]] = []
        self.curvas_reactividad: list[dict] = [] # Para almacenar curvas completadas
        self.screw_anterior: float = 0.0 # Valor del tornillo de la iteración anterior

    def process_reactivity(self, timestamp_fila: datetime, temp: float, screw_val: float) -> list[dict]:
        """
        Procesa la lógica de la curva de reactividad con los datos actuales del sensor.
        Retorna una lista de nuevas curvas de reactividad completadas en este paso.
        """
        nuevas_curvas_completadas = []

        # Detección de inicio de reactividad
        if es_cero(self.screw_anterior) and not es_cero(screw_val) and not self.reactividad_en_proceso:
            self.tiempo_inicio_reactividad = timestamp_fila
            self.temp_inicio_reactividad = temp
            self.reactividad_en_proceso = True
            self.lista_temperaturas_reactividad = []  # Reiniciar la lista para la nueva curva
            # print(f"[{self.tiempo_inicio_reactividad.strftime('%Y-%m-%d %H:%M:%S')}] 🌡️ Inicio curva reactividad. Temp inicial: {self.temp_inicio_reactividad:.2f}°C")

        if self.reactividad_en_proceso:
            # Acumular puntos de temperatura
            self.lista_temperaturas_reactividad.append((timestamp_fila, temp))

            # Si ya tenemos una temperatura inicial
            if self.temp_inicio_reactividad is not None:
                aumento = temp - self.temp_inicio_reactividad

                # Detección de aumento de 40°C
                if aumento >= 40:
                    tiempo_final = timestamp_fila
                    duracion_seg = int((tiempo_final - self.tiempo_inicio_reactividad).total_seconds())
                    minutos = duracion_seg // 60
                    segundos = duracion_seg % 60

                    tipo = "BAJA"
                    if duracion_seg <= 180: # 3 minutos
                        tipo = "ALTA"
                    elif duracion_seg <= 360: # 6 minutos
                        tipo = "MEDIANA"
                    
                    # print(f"[{tiempo_final.strftime('%Y-%m-%d %H:%M:%S')}] ✅ Reactividad de cal: {tipo} – Aumento de 40°C en {minutos} min {segundos} s (de {self.temp_inicio_reactividad:.2f}°C a {temp:.2f}°C)")

                    curva_completa = {
                        "timestamp_inicio": self.tiempo_inicio_reactividad,
                        "timestamp_fin": tiempo_final,
                        "temp_inicio": self.temp_inicio_reactividad,
                        "temp_fin": temp,
                        "tipo": tipo,
                        "minutos": minutos,
                        "segundos": segundos,
                        "datos": self.lista_temperaturas_reactividad.copy()
                    }
                    self.curvas_reactividad.append(curva_completa)
                    nuevas_curvas_completadas.append(curva_completa) # Retornar la nueva curva

                    # Resetear el estado para la próxima detección
                    self.reactividad_en_proceso = False
                    self.tiempo_inicio_reactividad = None
                    self.temp_inicio_reactividad = None
                    self.lista_temperaturas_reactividad = []

        # Actualizar screw_anterior para la próxima iteración
        self.screw_anterior = screw_val
        
        return nuevas_curvas_completadas


def evaluar_alarmas_directo(
    datos_sensores: dict[str, float],
    timestamp: datetime,
    setpoints_dict: dict,
    config_json_sensores: dict
) -> list[str]:
    """
    Evalúa las condiciones definidas en el JSON para un diccionario de datos de sensores (tag: valor).
    Retorna una lista de mensajes de alerta.
    Esta versión es ideal para datos en tiempo real o de simuladores.
    """
    alertas_json = []

    for tag_principal_json, info_sensor in config_json_sensores.items():
        # Ignorar tipos de condición complejos que requieren lógica externa
        if info_sensor.get("condiciones") and any(c.get("tipo") in ["custom_eval", "relacion_control", "estado_logico"] for c in info_sensor["condiciones"]):
            continue

        for i, condicion_config in enumerate(info_sensor.get("condiciones", [])):
            tipo_condicion = condicion_config.get("tipo")
            if tipo_condicion in ["custom_eval", "relacion_control", "estado_logico"]:
                continue

            nombre_equipo = condicion_config.get("nombre_equipo", info_sensor.get("nombre_equipo", tag_principal_json))
            descripcion_alerta_plantilla = condicion_config.get("descripcion", f"Condición {i+1} para {tag_principal_json}")

            if tipo_condicion in ["absoluto", "relativo_a_SP", None]:
                valor_sensor = datos_sensores.get(tag_principal_json)
                if valor_sensor is None:
                    continue

                try:
                    valor_sensor_num = pd.to_numeric(valor_sensor)
                except (ValueError, TypeError):
                    continue
                
                condicion_para_eval = condicion_config.copy()
                if tipo_condicion is None:
                    condicion_para_eval["tipo"] = "absoluto"

                if evaluar_condicion(valor_sensor_num, condicion_para_eval, tag_principal_json, setpoints_dict):
                    alertas_json.append(f"ALERTA ({timestamp.strftime('%H:%M:%S')}): {descripcion_alerta_plantilla} [{nombre_equipo}] (Sensor: {tag_principal_json}, Valor: {valor_sensor_num:.2f})")

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
                    
                    if tag is None:
                        cumple_todas = False
                        break

                    valor_sensor_sub = datos_sensores.get(tag)
                    if valor_sensor_sub is None:
                        cumple_todas = False
                        break

                    try:
                        valor_para_comparar = pd.to_numeric(valor_sensor_sub) if isinstance(valor_esperado, (int, float)) else valor_sensor_sub
                    except (ValueError, TypeError):
                        cumple_todas = False
                        break
                    
                    ok = False
                    if operador == "==": ok = (valor_para_comparar == valor_esperado)
                    elif operador == "!=": ok = (valor_para_comparar != valor_esperado)
                    elif operador == "<": ok = (valor_para_comparar < valor_esperado)
                    elif operador == ">": ok = (valor_para_comparar > valor_esperado)
                    elif operador == "<=": ok = (valor_para_comparar <= valor_esperado)
                    elif operador == ">=": ok = (valor_para_comparar >= valor_esperado)
                    
                    if not ok:
                        cumple_todas = False
                        break

                if cumple_todas:
                    alertas_json.append(f"ALERTA ({timestamp.strftime('%H:%M:%S')}): {descripcion_alerta_plantilla} [{nombre_equipo}] (Condiciones 'multiple_and' cumplidas)")

    return alertas_json