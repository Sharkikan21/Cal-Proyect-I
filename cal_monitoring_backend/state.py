from pathlib import Path

from .simulation.plant_simulator import PlantSimulator
from .core_logic import load_alarm_config_from_json, ReactivityMonitor

_THIS_DIR = Path(__file__).resolve().parent
ALARM_CONFIG_PATH = _THIS_DIR / "config" / "alarm_config.json"
CSV_VISUALIZATION_PATH = _THIS_DIR / "plant_simulator_output.csv"
TEMPLATES_DIR = _THIS_DIR / "templates"

simulator = PlantSimulator()
reactivity_monitor = ReactivityMonitor()
alarm_config = load_alarm_config_from_json(str(ALARM_CONFIG_PATH))
setpoints: dict = {}
