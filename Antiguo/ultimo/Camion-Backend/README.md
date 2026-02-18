# 🚛 Backend - Sistema de Inspección y Pesaje de Camiones

Backend API desarrollado con FastAPI para el sistema de inspección y pesaje de camiones.

## 🚀 Características

- **FastAPI** - Framework moderno y rápido
- **Supabase** - Base de datos y autenticación
- **CORS** - Configurado para frontend
- **Autenticación JWT** - Con Supabase Auth
- **Documentación automática** - Swagger UI en `/docs`
- **Logs de actividad** - Registro de todas las operaciones
- **Alertas por email** - Notificaciones automáticas

## 📋 Endpoints Principales

### 🔐 Autenticación
- `GET /health` - Verificar estado del servidor
- `GET /api/health` - Verificar estado del API

### 🚛 Camiones y Procesos
- `GET /api/camiones` - Obtener lista de camiones
- `GET /api/procesos/{id}` - Obtener proceso específico
- `POST /api/inspecciones` - Guardar inspección inicial
- `POST /api/inspeccionB` - Guardar inspección B

### ⚖️ Pesajes
- `POST /api/pesajes` - Guardar pesaje inicial
- `POST /api/pesaje_final_con_estado` - Guardar pesaje final
- `POST /api/evacuaciones` - Registrar evacuación

### 🔧 Mangueras
- `GET /api/mangueras/{id}` - Obtener manguera específica
- `GET /api/mangueras/camion/{proceso_id}` - Mangueras por proceso
- `PUT /api/mangueras/{id}/horas` - Actualizar horas de uso
- `POST /api/mangueras/registro-uso` - Registrar uso

### 👨‍💼 Administración
- `GET /api/admin/mangueras` - Todas las mangueras
- `POST /api/admin/mangueras` - Crear manguera
- `PUT /api/admin/mangueras/{id}` - Actualizar manguera
- `POST /api/admin/limpiar-procesos-abandonados` - Limpiar procesos

### 📊 Logs y Actividad
- `GET /api/logs` - Obtener logs de actividad
- `POST /api/actividad` - Registrar actividad

## 🛠️ Instalación

### Prerrequisitos
- Python 3.8+
- pip
- Cuenta de Supabase

### Configuración

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd camion_backend
```

2. **Crear entorno virtual**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate     # Windows
```

3. **Instalar dependencias**
```bash
pip install -r requirements.txt
```

4. **Configurar variables de entorno**
Crear archivo `.env`:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_service_role_key
TOLERANCIA_PESO=150
```

5. **Ejecutar en desarrollo**
```bash
uvicorn main:app --reload --port 8000
```

## 🌐 Deployment

### Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Script automático
```bash
chmod +x deploy.sh
./deploy.sh
```

## 📚 Documentación

- **Swagger UI**: `https://tu-dominio.vercel.app/docs`
- **ReDoc**: `https://tu-dominio.vercel.app/redoc`

## 🔧 Configuración de Base de Datos

### Tablas Requeridas en Supabase:

1. **procesos** - Información de procesos de camiones
2. **inspecciones** - Datos de inspecciones iniciales
3. **inspecciones_b** - Datos de inspecciones B
4. **pesajes** - Registros de pesajes
5. **evacuaciones** - Registros de evacuación
6. **mangueras** - Gestión de mangueras
7. **tipos_mangueras** - Tipos de mangueras
8. **logs_actividad** - Logs de actividad

### Funciones RPC Requeridas:
- `registrar_y_actualizar_uso` - Para registro de uso de mangueras

## 🚨 Alertas y Notificaciones

El sistema incluye alertas automáticas por email para:
- Exceso de peso en camiones
- Faltantes en pesajes
- Discrepancias en tara

## 🔒 Seguridad

- **Autenticación JWT** con Supabase
- **CORS configurado** para el frontend
- **Validación de datos** con Pydantic
- **Manejo de errores** robusto

## 📊 Monitoreo

- **Health checks** automáticos
- **Logs de actividad** detallados
- **Métricas de rendimiento** (pendiente)

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 👥 Autores

- **D0U5M4N** - *Desarrollo inicial*

---

**Nota**: Asegúrate de configurar correctamente las variables de entorno antes del deployment. 