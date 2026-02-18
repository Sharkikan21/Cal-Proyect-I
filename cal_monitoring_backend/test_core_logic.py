import pandas as pd
from core_logic import (
    load_sensor_data_from_excel,
    load_alarm_config_from_json,
    build_tag_column_map,
    evaluar_sensores_json,
    determinar_modo_actual,
    ReactivityMonitor,
    es_cero,lee 
)
from datetime import datetime

# --- Rutas a tus archivos originales ---
EXCEL_FILE_PATH = r"D:\Cal\Antiguo\Sensor\Tabla_Completa.xlsx"
JSON_FILE_PATH = "cal_monitoring_backend/config/alarm_config.json" # Contiene el JSON de alarmas

def run_basic_test():
    print("--- Iniciando prueba básica de core_logic.py ---")

    # 1. Cargar datos de Excel
    sensor_data_df, excel_sensor_names = load_sensor_data_from_excel(EXCEL_FILE_PATH)
    if sensor_data_df is None or excel_sensor_names is None:
        print("Fallo al cargar datos de Excel. Terminando prueba.")
        return

    print(f"\nDatos de Excel cargados. Filas: {len(sensor_data_df)}, Columnas de nombres: {len(excel_sensor_names)}")

    # 2. Cargar configuración de alarmas JSON
    alarm_config = load_alarm_config_from_json(JSON_FILE_PATH)
    if alarm_config is None:
        print("Fallo al cargar configuración JSON. Terminando prueba.")
        return
    print(f"Configuración de alarmas JSON cargada. {len(alarm_config)} tags principales.")

    # 3. Definir tags de proceso críticos para asegurar su mapeo
    required_process_tags = [
        "2270-FIT-11801",  # Agua
        "2270-ZM-009-021", # Rotary (para cal y rotary_val)
        "2270-ZM-009-04",  # Screw
        "2270-TT-11824A",  # Temperatura
    ]

    # 4. Construir el mapa de TAGs a columnas, incluyendo los tags requeridos
    mapa_col_idx, tags_no_encontrados = build_tag_column_map(alarm_config, excel_sensor_names, required_process_tags)
    print(f"\nMapa de columnas construido. {len(mapa_col_idx)} tags mapeados.")
    if tags_no_encontrados:
        print(f"Advertencia: {len(tags_no_encontrados)} tags JSON no encontrados en Excel:", tags_no_encontrados)
    
    # 5. Definir setpoints de ejemplo (similares a los de app.py)
    setpoints_para_evaluacion = {
        "2270-TAHH-11801": {"valor": 75.0},
        "2270-TAH-11801":  {"valor": 70.0},
        "2270-TAL-11801":  {"valor": 70.0},
        "2270-TIC-11801":  {"valor": 70.0}, # Agregado para evaluar_condicion relativo_a_SP
    }

    # === Testeando evaluar_sensores_json ===
    print("\n--- Evaluando alarmas para las primeras 50 filas de datos ---")
    all_alerts = []
    rows_to_process = min(50, len(sensor_data_df))

    for i in range(rows_to_process):
        fila_actual = sensor_data_df.iloc[i]
        alertas_fila = evaluar_sensores_json(
            fila_datos=fila_actual,
            fila_index=i,
            mapa_columnas=mapa_col_idx,
            setpoints_dict=setpoints_para_evaluacion,
            config_json_sensores=alarm_config
        )
        if alertas_fila:
            # Descomentar si quieres ver todas las alertas
            # print(f"Alertas en Fila {i}:")
            # for alerta in alertas_fila:
            #     print(f"  - {alerta}")
            all_alerts.extend(alertas_fila)

    print(f"--- Prueba de evaluación de alarmas finalizada. Total de alertas encontradas: {len(all_alerts)} ---")

    # === Testeando determinar_modo_actual ===
    print("\n--- Evaluando el modo de operación para algunas filas ---")
    
    col_agua_tag = "2270-FIT-11801"
    col_rotary_tag = "2270-ZM-009-021"
    col_screw_tag = "2270-ZM-009-04"
    col_temp_tag = "2270-TT-11824A"

    col_agua_idx = mapa_col_idx.get(col_agua_tag)
    col_rotary_idx = mapa_col_idx.get(col_rotary_tag)
    col_screw_idx = mapa_col_idx.get(col_screw_tag)

    if None in [col_agua_idx, col_rotary_idx, col_screw_idx]:
        print(f"Advertencia: No se encontraron todos los tags necesarios para determinar el modo de operación.")
    else:
        for i in range(min(10, len(sensor_data_df))): # Revisar las primeras 10 filas
            fila = sensor_data_df.iloc[i]
            
            try:
                # Cal_val en app.py es float(valor_rotary) * 0.4691
                rotary_val_for_cal = float(fila.get(col_rotary_idx, 0))
                cal_val = rotary_val_for_cal * 0.4691 
                agua_val = float(fila.get(col_agua_idx, 0))
                rotary_val = float(fila.get(col_rotary_idx, 0))
                screw_val = float(fila.get(col_screw_idx, 0))
            except (ValueError, TypeError):
                print(f"Error de conversión en la fila {i} para determinar el modo. Saltando.")
                continue
            
            modo = determinar_modo_actual(cal_val, agua_val, rotary_val, screw_val)
            print(f"Fila {i}: Cal={cal_val:.2f}, Agua={agua_val:.2f}, Rotary={rotary_val:.2f}, Screw={screw_val:.2f} -> Modo: {modo}")
    print("--- Prueba de determinación de modo finalizada. ---")

    # === Testeando ReactivityMonitor ===
    print("\n--- Evaluando lógica de ReactivityMonitor ---")
    reactivity_monitor = ReactivityMonitor()
    
    col_temp_idx = mapa_col_idx.get(col_temp_tag) # Ya definido arriba
    col_screw_idx = mapa_col_idx.get(col_screw_tag) # Ya definido arriba

    if None in [col_temp_idx, col_screw_idx]:
        print(f"Advertencia: No se encontraron todos los tags necesarios para ReactivityMonitor.")
    else:
        # Usaremos las primeras 100 filas para ver si detecta alguna curva
        rows_for_reactivity = min(100, len(sensor_data_df))
        print(f"Procesando {rows_for_reactivity} filas para detectar reactividad...")
        for i in range(rows_for_reactivity):
            fila = sensor_data_df.iloc[i]
            
            try:
                timestamp_str = fila.get(2) 
                if pd.isna(timestamp_str):
                    timestamp_fila = datetime.now()
                else:
                    try:
                        timestamp_fila = datetime.strptime(str(timestamp_str), "%d/%m/%Y %H:%M:%S")
                    except ValueError:
                        timestamp_fila = pd.to_datetime(timestamp_str, errors='coerce')
                        if pd.isna(timestamp_fila):
                            timestamp_fila = datetime.now()
            except Exception:
                timestamp_fila = datetime.now()

            try:
                temp_val = float(fila.get(col_temp_idx, 0))
                screw_val = float(fila.get(col_screw_idx, 0))
            except (ValueError, TypeError):
                continue

            new_curves = reactivity_monitor.process_reactivity(timestamp_fila, temp_val, screw_val)
            if new_curves:
                for curve in new_curves:
                    print(f"  🔥 Curva de Reactividad detectada en Fila {i}: Tipo={curve['tipo']}, Duración={curve['minutos']}m {curve['segundos']}s, Temp Inicial={curve['temp_inicio']:.2f}°C, Temp Final={curve['temp_fin']:.2f}°C")
        
        print(f"Total de curvas de reactividad almacenadas: {len(reactivity_monitor.curvas_reactividad)}")

    print("--- Prueba básica finalizada por completo ---")


if __name__ == "__main__":
    run_basic_test()