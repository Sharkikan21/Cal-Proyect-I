# server.py
import os, sys

# Fuerza UTF-8 para stdout/stderr ANTES de cualquier import que haga prints
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    # En Python 3.7+ reconfigura si existen
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import uvicorn
from api.index import app  # <-- recién aquí importamos tu FastAPI

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
