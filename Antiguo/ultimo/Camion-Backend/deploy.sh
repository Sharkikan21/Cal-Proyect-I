#!/bin/bash

# Script de deployment para el backend de Camión Sistema

echo "🚀 Iniciando deployment del backend..."

# Verificar que estamos en el directorio correcto
if [ ! -f "main.py" ]; then
    echo "❌ Error: No se encontró main.py. Asegúrate de estar en el directorio del backend."
    exit 1
fi

# Verificar que Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Error: Vercel CLI no está instalado."
    echo "Instala con: npm install -g vercel"
    exit 1
fi

# Verificar variables de entorno
if [ ! -f ".env" ]; then
    echo "⚠️  Advertencia: No se encontró archivo .env"
    echo "Crea un archivo .env con las siguientes variables:"
    echo "SUPABASE_URL=tu_url_de_supabase"
    echo "SUPABASE_KEY=tu_clave_de_supabase"
    echo "TOLERANCIA_PESO=150"
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
pip install -r requirements.txt

# Verificar que el servidor funciona localmente
echo "🔍 Verificando servidor local..."
python -c "
import uvicorn
from main import app
import requests
import time

# Iniciar servidor en background
import threading
def run_server():
    uvicorn.run(app, host='0.0.0.0', port=8000)

thread = threading.Thread(target=run_server)
thread.daemon = True
thread.start()

# Esperar que el servidor esté listo
time.sleep(3)

# Probar endpoint de health
try:
    response = requests.get('http://localhost:8000/health')
    if response.status_code == 200:
        print('✅ Servidor funcionando correctamente')
    else:
        print('❌ Error en el servidor')
        exit(1)
except Exception as e:
    print(f'❌ Error al conectar al servidor: {e}')
    exit(1)
"

# Deploy a Vercel
echo "🌐 Desplegando a Vercel..."
vercel --prod

echo "✅ Deployment completado!"
echo "📋 URLs disponibles:"
echo "   - API: https://tu-proyecto.vercel.app"
echo "   - Health: https://tu-proyecto.vercel.app/health"
echo "   - Docs: https://tu-proyecto.vercel.app/docs" 