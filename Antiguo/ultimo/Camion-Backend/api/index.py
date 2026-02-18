# main.py
from fastapi import FastAPI, HTTPException, Body, Request, BackgroundTasks, Depends, Header, Response, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Optional, Any, List
import smtplib
from email.mime.text import MIMEText
import os
from datetime import datetime, timedelta, timezone
from db import supabase_client
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import traceback
from starlette import status
from uuid import UUID
import time
import httpx
from postgrest import APIError



app = FastAPI(
    title="API Inspección Camiones",
    description="API para el sistema de inspección y pesaje de camiones",
    version="1.0.0",
    contact={
        "name": "D0U5M4N",
        "email": "support@camion-system.com"
    },
    docs_url="/docs",
    redoc_url="/redoc"
)

TOLERANCIA_TARA_KG = float(os.getenv("TOLERANCIA_TARA_KG", "150"))
TOLERANCIA_TARA_PCT = 1.5
LOCK_TTL_MIN = int(os.getenv("LOCK_TTL_MIN", "10"))
AUTO_UNLOCK_ON_PESAJE_INICIAL = os.getenv("AUTO_UNLOCK_ON_PESAJE_INICIAL", "1") == "1"
AUTO_UNLOCK_ON_EVACUACION     = os.getenv("AUTO_UNLOCK_ON_EVACUACION", "0") == "1"

def pg_safe_execute(req, *, retries: int = 2, backoff: float = 0.25):
    """
    Ejecuta req.execute() con reintentos si el backend de Supabase cierra la conexión (HTTP/2).
    Reintenta sólo en RemoteProtocolError / "Server disconnected".
    """
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return req.execute()
        except Exception as e:
            msg = str(e)
            # httpx RemoteProtocolError o mensaje equivalente
            if isinstance(e, httpx.RemoteProtocolError) or "Server disconnected" in msg:
                last_exc = e
                if attempt < retries:
                    # backoff lineal: 0.25s, 0.5s, ...
                    time.sleep(backoff * (attempt + 1))
                    continue
            # otros errores: propágalos tal cual
            raise
    # si agotamos reintentos, propagar el último
    raise last_exc


def _now_utc_iso():
    # ISO UTC, sin microsegundos, terminando en 'Z'
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _is_expired(locked_at_str: str | None) -> bool:
    if not locked_at_str:
        return True
    try:
        # Soporta "...Z" o con offset
        dt = datetime.fromisoformat(locked_at_str.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return dt < (now - timedelta(minutes=LOCK_TTL_MIN))
    except Exception:
        return True


def _get_user_role(current_user) -> str | None:
    """
    Fuente de verdad del rol:
      1) auth.user_metadata.rol (si existe en el JWT)
      2) fallback: public.usuarios.rol buscando por auth_user_id
    Retorna None si no hay rol; '__inactivo__' si está deshabilitado/expirado.
    """
    # 1) claim si existe
    try:
        meta = getattr(current_user, "user_metadata", None) or {}
        rol = meta.get("rol")
        if rol:
            return rol
    except Exception:
        pass
    # 2) fallback a la tabla de usuarios
    try:
        uid = getattr(current_user, "id", None)
        if not uid:
            return None
        res = supabase_client.table("usuarios") \
            .select("rol,estado,fecha_expiracion") \
            .eq("auth_user_id", str(uid)).single().execute()
        row = getattr(res, "data", None) or {}
        if not row:
            return None
        if row.get("estado") != "activo":
            return "__inactivo__"
        exp = row.get("fecha_expiracion")
        if exp:
            try:
                dt = datetime.fromisoformat(str(exp).replace('Z','+00:00'))
                if dt < datetime.now(timezone.utc):
                    return "__inactivo__"
            except Exception:
                pass
        return row.get("rol")
    except Exception:
        return None



app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

@app.options("/api/{path:path}")
async def options_handler(path: str):
    return Response(status_code=204)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Falta el encabezado de autorización")
    
    try:
        token = authorization.split(" ")[1]
        response = supabase_client.auth.get_user(token)
        user = response.user
        if not user:
             raise HTTPException(status_code=401, detail="Usuario no válido")
        return user
    except Exception as e:
        print(f"Error de autenticación: {e}")
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# ---------- Funciones de Verificación de Roles ---------- #
async def verificar_rol_pesaje(current_user=Depends(get_current_user)):
    rol = _get_user_role(current_user)
    if rol != 'pesaje':
        raise HTTPException(status_code=403, detail="Acceso restringido solo para rol 'pesaje'")
    return current_user

async def verificar_rol_recepcionista_cal(current_user=Depends(get_current_user)):
    rol = _get_user_role(current_user)
    if rol != 'recepcionista-cal':
        raise HTTPException(status_code=403, detail="Acceso restringido solo para rol 'recepcionista-cal'")
    return current_user

# Permitir tanto 'recepcionista-cal' como 'admin'
async def verificar_rol_recepcion_o_admin(current_user=Depends(get_current_user)):
    rol = _get_user_role(current_user)
    if rol not in ('recepcionista-cal', 'admin'):
        raise HTTPException(status_code=403, detail="Acceso restringido a roles 'recepcionista-cal' o 'admin'")
    return current_user

# ---------- Modelos Pydantic Clarificados ---------- #

class ParteInspeccion(BaseModel):
    info: Optional[str] = None
    estado: Optional[str] = None

class ChecklistData(BaseModel):
    patente: str
    patenteAcoplado: str
    nombreChofer: str
    pesoGuia: float
    pesoBruto: Optional[float] = None 
    pesoTara: Optional[float] = None 
    carnetConducir: bool
    carnetIdentidad: bool
    hojaSeguridad: bool
    protocoloDerrames: bool
    kilometraje: str
    anioFabricacion: str
    
class InspeccionPayload(BaseModel):
    patente: str
    checklistData: ChecklistData
    inspectionData: Dict[str, ParteInspeccion]

class PesajePayload(BaseModel):
    proceso_id: str
    peso_kg: float
    tipo: str
    diferencia: Optional[float] = None
    porcentaje_diferencia: Optional[float] = None
    usuario_id: Optional[str] = None
    
class PesajeFinalPayload(BaseModel):
    proceso_id: str
    tipo: str
    peso_kg: float
    diferencia: float
    porcentaje_diferencia: float
    usuario_id: Optional[str] = None

class EvacuacionPayload(BaseModel):
    proceso_id: str
    tiempo: Optional[int] = None
    observaciones: Optional[str] = None
    usuario_id: Optional[str] = None

class AlertaCalPayload(BaseModel):
    patente: str
    peso_real: float
    peso_bruto: float
    tara_esperada: float
    diferencia: float
    
class ParteInspeccionData(BaseModel):
    nombre_parte: str
    estado: str
    informacion: Optional[str] = ""

class InspeccionBPayload(BaseModel):
    proceso_id: str
    partes: List[ParteInspeccionData]
    usuario_id: Optional[str] = None
    
class ActividadPayload(BaseModel):
    tipo_actividad: str
    metadata: Dict[str, Any]

class MangueraUpdate(BaseModel):
    horas_uso_actual: Optional[int] = None
    fecha_ingreso: Optional[str] = None
    observaciones: Optional[str] = None
    proceso_id: Optional[str] = None  # Corregido de camion_id a proceso_id

# --- Modelos para Mangueras ---
class MangueraBase(BaseModel):
    codigo_manguera: str
    tipo_manguera_id: int
    proceso_id: Optional[str] = None # Corregido de camion_id a proceso_id
    horas_uso_actual: Optional[int] = 0
    fecha_instalacion: Optional[str] = None
    observaciones: Optional[str] = None

class ActualizarHorasPayload(BaseModel):
    horas_uso: int
    observaciones: Optional[str] = None

class MangueraRetiro(BaseModel):
    motivo: str
    
class RegistroUsoPayload(BaseModel):
    manguera_id: str
    proceso_id: str
    horas_operacion: float
    
class FinalizarProcesoPayload(BaseModel):
    peso_tara_kg: float
    peso_neto_real: float
    porcentaje_diferencia: float
    forzar: bool = False
    motivo_override: Optional[str] = None


def _assert_lock_owner_or_423(proceso_id: str, current_user):
    row = supabase_client.table("procesos").select("locked_by,locked_at").eq("id", proceso_id).single().execute()
    data = row.data or {}
    owner = data.get("locked_by")
    ts = data.get("locked_at")

    # 1) Libre o expirado -> forzar a tomar control
    if owner is None or _is_expired(ts):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "message": "Debes tomar el control antes de modificar.",
                "locked_at": None,
                "ttl_min": LOCK_TTL_MIN
            }
        )

    # 2) Lo tiene otro usuario -> informar quién y desde cuándo
    if owner != current_user.id:
        mail = None
        try:
            u = supabase_client.table("usuarios").select("email").eq("id", owner).single().execute()
            mail = (u.data or {}).get("email")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "message": "Proceso en uso",
                "locked_by": mail or owner,
                "locked_at": ts,
                "ttl_min": LOCK_TTL_MIN
            }
        )



# --- NUEVO: Obtener una manguera específica por su ID ---
# CORRECCIÓN: Se elimina la dependencia de autenticación para seguir el patrón de otros endpoints GET públicos.
@app.get("/api/mangueras/{manguera_id}")
def obtener_manguera_por_id(manguera_id: str):
    """
    Obtiene los detalles de una manguera específica usando la vista completa.
    """
    try:
        response = supabase_client.from_("vista_mangueras_completa").select("*").eq('id', manguera_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Manguera no encontrada")
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NUEVO: Actualizar solo las horas de uso de una manguera ---
# Mantenemos la protección porque esta acción modifica datos importantes.
@app.put("/api/mangueras/{manguera_id}/horas")
def actualizar_horas_manguera(manguera_id: str, payload: ActualizarHorasPayload, current_user: dict = Depends(get_current_user)):
    """
    Actualiza específicamente las horas de uso y las observaciones de una manguera.
    """
    try:
        update_data = {
            "horas_uso_actual": payload.horas_uso,
            "observaciones": payload.observaciones
        }
        response = supabase_client.table('mangueras').update(update_data).eq('id', manguera_id).execute()
        return {"ok": True, "message": "Horas actualizadas correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NUEVO: Registrar uso diario de una manguera ---
# Mantenemos la protección porque esta acción modifica datos.
@app.post("/api/mangueras/registro-uso")
def registrar_uso_de_manguera(payload: RegistroUsoPayload, current_user: dict = Depends(get_current_user)):
    """
    Crea un nuevo registro en la tabla 'registro_uso_mangueras'
    y actualiza las horas totales en la tabla 'mangueras' usando una función RPC.
    """
    try:
        # La función RPC se encarga de las dos operaciones en la base de datos
        response = supabase_client.rpc('registrar_y_actualizar_uso', {
            'manguera_uuid': payload.manguera_id,
            'proceso_uuid': payload.proceso_id,
            'horas_a_sumar': payload.horas_operacion,
            'usuario_uuid': current_user.id
        }).execute()

        return {"ok": True, "message": "Uso registrado y horas actualizadas"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ENDPOINTS PARA CAMIONES ---------- #
# Este endpoint maneja las peticiones CORS preflight para la ruta de camiones.
@app.options("/api/camiones")
def options_camiones():
    """
    Endpoint para manejar las peticiones CORS preflight para la ruta de camiones.
    """
    return Response(status_code=200)


@app.get("/api/procesos")
def listar_procesos(
    estado: str | None = Query(
        None,
        description="pendiente-recepcion | pendiente-pesaje-final | finalizado",
    ),
    q: str | None = Query(None, description="buscar por patente o chofer"),
    limit: int = Query(30, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    # Selección base
    base = supabase_client.table("procesos").select(
        "id, patente, patente_acoplado, nombre_chofer, peso_guia, fecha_proceso, estado, locked_by, locked_at"
    )  # ← igual que antes :contentReference[oaicite:2]{index=2}

    # Prefiltro por estado (igual que antes)
    if estado == "finalizado":
        base = base.eq("estado", "finalizado")
    elif estado in ("pendiente-recepcion", "pendiente-pesaje-final"):
        base = base.neq("estado", "finalizado")
    # (estado None => todos) :contentReference[oaicite:3]{index=3}

    # -------- BÚSQUEDA EFICIENTE --------
    if q:
        q = (q or "").strip()
        if q:
            q_up = q.upper()

            if len(q) <= 1:
                # 0–1 caracteres: no filtramos (evita scans inútiles)
                pass

            elif len(q) == 2:
                # 2 caracteres: filtra SOLO por prefijo de patente(s) (índice-friendly)
                pat = supabase_client.table("procesos").select("id").ilike("patente", f"{q_up}%").execute().data or []
                acp = supabase_client.table("procesos").select("id").ilike("patente_acoplado", f"{q_up}%").execute().data or []
                ids = list({*(x["id"] for x in pat), *(x["id"] for x in acp)})
                if not ids:
                    return JSONResponse({"items": [], "total": 0, "has_more": False},
                                        headers={"Cache-Control": "private, max-age=5"})
                base = base.in_("id", ids)

            else:
                # 3+ caracteres: "contiene" en 3 columnas
                # Preferimos or_ si existe; si no, hacemos OR por ids (3 selects chicos)
                try:
                    # Si tu cliente soporta .or_ (versiones recientes de postgrest)
                    q_esc = q.replace(",", r"\,")  # or_ separa por comas; escapa posibles comas del usuario
                    base = base.or_(f"patente.ilike.*{q_esc}*,nombre_chofer.ilike.*{q_esc}*,patente_acoplado.ilike.*{q_esc}*")
                    # (mismo patrón que ya usabas) :contentReference[oaicite:4]{index=4}
                except AttributeError:
                    # Fallback para clientes sin .or_: OR manual por ids
                    pat = supabase_client.table("procesos").select("id").ilike("patente", f"%{q}%").execute().data or []
                    cho = supabase_client.table("procesos").select("id").ilike("nombre_chofer", f"%{q}%").execute().data or []
                    acp = supabase_client.table("procesos").select("id").ilike("patente_acoplado", f"%{q}%").execute().data or []
                    ids = list({*(x["id"] for x in pat), *(x["id"] for x in cho), *(x["id"] for x in acp)})
                    if not ids:
                        return JSONResponse({"items": [], "total": 0, "has_more": False},
                                            headers={"Cache-Control": "private, max-age=5"})
                    base = base.in_("id", ids)

    # Paginación: pedimos 1 extra para has_more (igual que tenías)
    grab = limit + 1
    res = pg_safe_execute(base.order("fecha_proceso", desc=True).range(offset, offset + grab - 1))
    procesos_raw = res.data or []
    has_more = len(procesos_raw) > limit
    procesos = procesos_raw[:limit]  # ← igual :contentReference[oaicite:5]{index=5}

    # Enriquecimiento de locks (tal cual)
    locks = _hydrate_locks(procesos)
    lock_map = {r["id"]: {"lock_state": r["lock_state"], "locked_by_name": r["locked_by_name"]} for r in locks}

    ids = [p["id"] for p in procesos]
    if not ids:
        return JSONResponse({"items": [], "total": 0, "has_more": has_more},
                            headers={"Cache-Control": "private, max-age=5"})  # ← igual :contentReference[oaicite:6]{index=6}

    # === Relaciones en bloque (todas igual que ya tenías) ===
    pesajes = supabase_client.table("pesajes").select("proceso_id,tipo,peso_kg,usuario_id").in_("proceso_id", ids).execute().data
    inspecciones = supabase_client.table("inspecciones").select("proceso_id,nombre_parte,informacion,usuario_id").in_("proceso_id", ids).execute().data
    evacuaciones = supabase_client.table("evacuaciones").select("proceso_id,tiempo_minutos,observaciones,fecha_evacuacion,usuario_id").in_("proceso_id", ids).order("fecha_evacuacion", desc=True).execute().data
    reg_mangueras = supabase_client.table("registro_uso_mangueras").select("proceso_id,manguera_id").in_("proceso_id", ids).execute().data

    # Mangueras -> código
    m_ids = list({r["manguera_id"] for r in reg_mangueras if r.get("manguera_id")})
    mangueras = []
    if m_ids:
        mangueras = supabase_client.table("mangueras") \
            .select("id,codigo_manguera") \
            .in_("id", m_ids).execute().data
    map_mcode = {m["id"]: m.get("codigo_manguera") for m in mangueras}

    # === Mapas por proceso ===
    from collections import defaultdict

    by_proc_pesajes = defaultdict(list)
    by_proc_insps   = defaultdict(list)
    by_proc_evac    = {}             # último (viene ordenado desc)
    by_proc_mang    = defaultdict(set)

    for pz in pesajes:
        by_proc_pesajes[pz["proceso_id"]].append(pz)

    for ins in inspecciones:
        by_proc_insps[ins["proceso_id"]].append(ins)

    for ev in evacuaciones:
        pid = ev["proceso_id"]
        if pid not in by_proc_evac:   # nos quedamos con el más reciente
            by_proc_evac[pid] = {
                "tiempo_minutos": ev.get("tiempo_minutos"),
                "observaciones": ev.get("observaciones"),
                "usuario_id": ev.get("usuario_id"),
            }

    for r in reg_mangueras:
        code = map_mcode.get(r.get("manguera_id"))
        if code:
            by_proc_mang[r["proceso_id"]].add(code)

    # === Usuarios (para mostrar email del operador) ===
    # juntamos ids de usuarios de: pesaje inicial/final + evacuación + (fallback) inspección B
    user_ids = set()
    for pid in ids:
        ps = by_proc_pesajes.get(pid, [])
        u_ini = next((x.get("usuario_id") for x in ps if x.get("tipo") == "inicial" and x.get("usuario_id")), None)
        u_fin = next((x.get("usuario_id") for x in ps if x.get("tipo") == "final" and x.get("usuario_id")), None)
        if u_ini: user_ids.add(u_ini)
        if u_fin: user_ids.add(u_fin)
        evu = by_proc_evac.get(pid, {}).get("usuario_id")
        if evu: user_ids.add(evu)
        else:
            # fallback recepcionista cal: alguna inspección B
            for ii in by_proc_insps.get(pid, []):
                np = (ii.get("nombre_parte") or "")
                if (np.startswith("B:") or " B " in np) and ii.get("usuario_id"):
                    user_ids.add(ii["usuario_id"])
                    break

    usuarios = []
    map_user_email = {}
    if user_ids:
        usuarios = supabase_client.table("usuarios") \
            .select("id,email,rol") \
            .in_("id", list(user_ids)).execute().data
        map_user_email = {u["id"]: u.get("email") for u in usuarios}

    # === Armar items ===
    items = []
    for p in procesos:
        pid = p["id"]
        ps  = by_proc_pesajes.get(pid, [])
        ins = by_proc_insps.get(pid, [])
        evd = by_proc_evac.get(pid, {}) or {}

        tiene_inicial = any(x.get("tipo") == "inicial" for x in ps)
        tiene_final   = any(x.get("tipo") == "final" for x in ps)
        tiene_b       = any(
            (i.get("nombre_parte") or "").startswith("B:")
            or " B " in (i.get("nombre_parte") or "")
            for i in ins
        )

        pes_ini = next((x for x in ps if x.get("tipo") == "inicial"), None)
        pes_fin = next((x for x in ps if x.get("tipo") == "final"), None)

        # operadores (emails)
        op_ini_email = map_user_email.get(pes_ini.get("usuario_id")) if pes_ini and pes_ini.get("usuario_id") else None
        op_fin_email = map_user_email.get(pes_fin.get("usuario_id")) if pes_fin and pes_fin.get("usuario_id") else None

        # recepcion cal: primero evacuación, si no hay, cae a alguna inspección B
        ev_user_id = evd.get("usuario_id")
        if ev_user_id:
            op_rc_email = map_user_email.get(ev_user_id)
        else:
            op_rc_email = None
            for ii in ins:
                np = (ii.get("nombre_parte") or "")
                if (np.startswith("B:") or " B " in np) and ii.get("usuario_id"):
                    op_rc_email = map_user_email.get(ii["usuario_id"])
                    if op_rc_email:
                        break
        
        lock = lock_map.get(pid, {"lock_state": "disponible", "locked_by_name": None})
        items.append({
            **p,
            "lock_state": lock["lock_state"],
            "locked_by_name": lock["locked_by_name"],
            "flags": {
                "tiene_pesaje_inicial": tiene_inicial,
                "tiene_inspeccion_b":   tiene_b,
                "tiene_evacuacion":     bool(evd),
                "tiene_pesaje_final":   tiene_final,
            },
            "extras": {
                "pesaje_inicial_kg":   pes_ini.get("peso_kg") if pes_ini else None,
                "pesaje_final_kg":     pes_fin.get("peso_kg") if pes_fin else None,
                "evac_tiempo_minutos": evd.get("tiempo_minutos"),
                "evac_observaciones":  evd.get("observaciones"),
                "mangueras_usadas":    sorted(list(by_proc_mang.get(pid, set()))),
                "operadores": {
                    "pesaje_inicial": {"email": op_ini_email} if op_ini_email else None,
                    "recepcion_cal":  {"email": op_rc_email}  if op_rc_email else None,
                    "pesaje_final":   {"email": op_fin_email} if op_fin_email else None,
                }
            }
        })

    # Post-filtro por flags
    if estado == "pendiente-recepcion":
        items = [i for i in items if i["flags"]["tiene_pesaje_inicial"] and not i["flags"]["tiene_evacuacion"] and not i["flags"]["tiene_pesaje_final"]]
    elif estado == "pendiente-pesaje-final":
        items = [i for i in items if i["flags"]["tiene_pesaje_inicial"] and i["flags"]["tiene_inspeccion_b"] and i["flags"]["tiene_evacuacion"] and not i["flags"]["tiene_pesaje_final"]]
    elif estado == "finalizado":
        items = [i for i in items if i["flags"]["tiene_pesaje_final"]]

    total = len(items)
    resp = JSONResponse({"items": items, "total": total, "has_more": has_more})
    resp.headers["Cache-Control"] = "private, max-age=5"
    return resp

# ---------- CONSULTAR TODOS LOS CAMIONES ---------- #
@app.get("/api/camiones")
def get_camiones():
    print("[Backend] get_camiones: Obteniendo lista de procesos con datos completos")
    procesos_response = (
        supabase_client.table("procesos")
        .select("*")
        .order("fecha_proceso", desc=True)
        .limit(50)
        .execute()
    )
    procesos = procesos_response.data
    proc_hydrated = _hydrate_locks(procesos or [])
    lock_map = {r["id"]: {"lock_state": r["lock_state"], "locked_by_name": r["locked_by_name"]} for r in proc_hydrated}

    procesos_completos = []
    for proceso in procesos:
        proceso_id = proceso["id"]
        if proceso_id in lock_map:
            proceso.update(lock_map[proceso_id])
        # Pesajes
        pesajes_response = supabase_client.table('pesajes').select('*').eq('proceso_id', proceso_id).execute()
        proceso['pesajes_registrados'] = pesajes_response.data
        # Inspecciones
        inspecciones_response = supabase_client.table('inspecciones').select('*').eq('proceso_id', proceso_id).execute()
        proceso['inspecciones_realizadas'] = inspecciones_response.data
        # Evacuación
        evacuacion_response = supabase_client.table('evacuaciones').select('*').eq('proceso_id', proceso_id).execute()
        if evacuacion_response.data:
            proceso['evacuacion_registrada'] = evacuacion_response.data[0]
        else:
            proceso['evacuacion_registrada'] = None
        procesos_completos.append(proceso)
    print(f"[Backend] get_camiones: Retornando {len(procesos_completos)} procesos con etapas")
    return procesos_completos


# ---------- ENDPOINT PARA GUARDAR INSPECCIÓN DE RECEPCIÓN (Checklist A) ----------
@app.post("/api/inspecciones")
def guardar_inspeccion(payload: InspeccionPayload, current_user: dict = Depends(get_current_user)):
    # Por ahora, no sabemos qué usuario realiza la acción. Lo añadiremos más adelante.
    # usuario_actual_id = "ID_DEL_USUARIO_LOGUEADO"
    usuario_id = current_user.id
    usuario_email = current_user.email
    print(f"Acción realizada por el usuario: {usuario_email} ({usuario_id})")
    
    try:
        # 1. Preparamos los datos para la tabla 'procesos'
        checklist = payload.checklistData
        proceso_data = {
            "patente": payload.patente.strip().upper(),
            "patente_acoplado": checklist.patenteAcoplado,
            "nombre_chofer": checklist.nombreChofer,
            "peso_guia": checklist.pesoGuia, # Se elimina float()
            "peso_guia_bruto": checklist.pesoBruto, # Se elimina float() y la validación
            "peso_guia_tara": checklist.pesoTara, # Se elimina float() y la validación
            "carnet_conducir": checklist.carnetConducir,
            "carnet_identidad": checklist.carnetIdentidad,
            "hoja_seguridad": checklist.hojaSeguridad,
            "protocolo_derrames": checklist.protocoloDerrames,
            "kilometraje": checklist.kilometraje, # Se elimina int()
            "anio_fabricacion": checklist.anioFabricacion, # Se elimina int()
            "estado": "en-pesaje",  # Estado inicial del proceso
            "usuario_id_recepcion": usuario_id
        }
        
        # 2. Insertamos el nuevo proceso y obtenemos su ID
        proceso_response = supabase_client.table('procesos').insert(proceso_data).execute()
        
        # El ID viene en el primer elemento de la lista 'data'
        nuevo_proceso_id = proceso_response.data[0]['id']

        # 3. Preparamos los datos para la tabla 'inspecciones'
        inspecciones_a_insertar = []
        for parte, detalles in payload.inspectionData.items():
            # Nos aseguramos de que haya un estado para guardar
            if detalles.estado:
                inspecciones_a_insertar.append({
                    "proceso_id": nuevo_proceso_id,
                    "nombre_parte": parte,
                    "estado": detalles.estado,
                    "informacion": detalles.info,
                    # "usuario_id": usuario_actual_id # Se añadirá en el futuro
                })
        
        # 4. Insertamos todas las partes de la inspección en un solo viaje a la BD
        if inspecciones_a_insertar:
            supabase_client.table('inspecciones').insert(inspecciones_a_insertar).execute()
            
        log_data = {
            "usuario_id": usuario_id,
            "usuario_email": usuario_email,
            "accion": "REGISTRO_RECEPCION",
            "detalles": {"proceso_id": nuevo_proceso_id, "patente": payload.patente}
        }
        supabase_client.table('logs_actividad').insert(log_data).execute()

        # 5. Devolvemos una respuesta exitosa
        return {"ok": True, "proceso_id": nuevo_proceso_id, "patente": payload.patente}

    except Exception as e:
        print(f"Error al guardar inspección: {e}")
        raise HTTPException(status_code=500, detail=f"Error de servidor al guardar la inspección: {e}")


 #---------- CONSULTAR UN PROCESO POR ID (VERSIÓN SUPABASE) ---------- #
@app.get("/api/procesos/{proceso_id}")
def get_proceso_by_id(proceso_id: str):
    """
    Obtiene los datos de un proceso específico y toda su información asociada
    de las tablas relacionadas (inspecciones, pesajes, evacuaciones).
    """
    try:
        # 1. Buscamos el proceso principal
        proceso_response = supabase_client.table('procesos').select('*').eq('id', proceso_id).single().execute()
        
        if not proceso_response.data:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")

        proceso_data = proceso_response.data

        # 2. Buscamos todas las inspecciones
        inspecciones_response = supabase_client.table('inspecciones').select('*').eq('proceso_id', proceso_id).execute()
        proceso_data['inspecciones_realizadas'] = inspecciones_response.data
        
        # 3. Buscamos los pesajes
        pesajes_response = supabase_client.table('pesajes').select('*').eq('proceso_id', proceso_id).execute()
        proceso_data['pesajes_registrados'] = pesajes_response.data

        # 4. Buscamos el registro de evacuación (AQUÍ ESTÁ LA CORRECCIÓN)
        # Se elimina .single() para que no falle si no encuentra nada.
        evacuacion_response = supabase_client.table('evacuaciones').select('*').eq('proceso_id', proceso_id).execute()
        
        # Verificamos si la consulta devolvió algún resultado.
        if evacuacion_response.data:
            # Si hay datos, tomamos el primer (y único) registro.
            proceso_data['evacuacion_registrada'] = evacuacion_response.data[0]
        else:
            # Si no hay datos, asignamos None para que el frontend no falle.
            proceso_data['evacuacion_registrada'] = None
        
        return proceso_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al obtener proceso por id: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# --- Endpoint para Pesaje Inicial/General (Versión Supabase) ---
@app.post("/api/pesajes")
def guardar_pesaje(payload: PesajePayload, current_user: dict = Depends(get_current_user)):
    _assert_lock_owner_or_423(payload.proceso_id, current_user)
    try:
        print(f"[Backend] guardar_pesaje: Recibido payload: {payload}")
        datos_a_guardar = {
            "proceso_id": payload.proceso_id,
            "tipo": payload.tipo,
            "peso_kg": payload.peso_kg,
            "diferencia": payload.diferencia,
            "porcentaje_diferencia": payload.porcentaje_diferencia,
            "usuario_id": current_user.id # <-- AÑADE ESTA LÍNEA
        }

        print(f"[Backend] guardar_pesaje: Datos a guardar: {datos_a_guardar}")

        response = supabase_client.table('pesajes').upsert(
            datos_a_guardar, 
            on_conflict='proceso_id,tipo'
        ).execute()
        
        if payload.tipo == "inicial":
            # 1) avanzar SIEMPRE a 'pendiente-recepcion'
            #    (condicionado al estado actual para evitar carreras)
            upd = (
                supabase_client
                .table("procesos")
                .update({"estado": "pendiente-recepcion"})
                .eq("id", payload.proceso_id)
                .eq("estado", "en-pesaje")
                .execute()
            )

            # 2) (opcional) auto-unlock según tu flag
            if AUTO_UNLOCK_ON_PESAJE_INICIAL:
                try:
                    supabase_client.table("procesos").update({
                        "locked_by": None,
                        "locked_at": None
                    }).eq("id", payload.proceso_id).execute()
                    _log_lock("LOCK_RELEASED", current_user, payload.proceso_id, {"auto": "pesaje_inicial"})
                except Exception:
                    # evitar que un fallo de unlock tumbe la petición principal
                    pass


        elif payload.tipo == "final":
                    supabase_client.table("procesos").update({"estado": "finalizado"}).eq("id", payload.proceso_id).execute()


        print(f"[Backend] guardar_pesaje: Respuesta de Supabase: {response.data}")

        # Opcional: Verificar si Supabase devolvió un error en la respuesta
        if hasattr(response, 'error') and response.error:
            raise Exception(response.error)

        print(f"[Backend] guardar_pesaje: Pesaje guardado exitosamente para proceso {payload.proceso_id}, tipo {payload.tipo}")
        return {"ok": True, "proceso_id": payload.proceso_id, "tipo": payload.tipo}

    except Exception as e:
        print(f"Error al guardar pesaje: {e}")
        raise HTTPException(status_code=500, detail=f"Error de servidor al guardar pesaje: {str(e)}")
    
# --- Endpoint para Pesaje Final y Actualización de Estado (Versión Supabase) ---
@app.post("/api/pesaje_final_con_estado")
def guardar_pesaje_final_y_actualizar_estado(payload: PesajeFinalPayload, current_user: dict = Depends(get_current_user)):
    _assert_lock_owner_or_423(payload.proceso_id, current_user)

    """
    Guarda el pesaje final, actualiza el estado del proceso a 'finalizado'
    y registra el usuario que completa la acción.
    """
    try:
        # 1. Guardar el registro del pesaje final en la tabla 'pesajes'
        datos_pesaje_final = {
            "proceso_id": payload.proceso_id,
            "tipo": "final",
            "peso_kg": payload.peso_kg, # <-- Corregido para leer de peso_kg
            "diferencia": payload.diferencia,
            "porcentaje_diferencia": payload.porcentaje_diferencia,
            "usuario_id": current_user.id # <-- Usamos el ID del usuario autenticado para seguridad
        }
        supabase_client.table('pesajes').upsert(datos_pesaje_final, on_conflict='proceso_id,tipo').execute()
        print(f"Pesaje final guardado para proceso ID: {payload.proceso_id}")

        # 2. Obtener el peso bruto del pesaje inicial (sin cambios)
        pesaje_inicial_response = supabase_client.table('pesajes').select('peso_kg').eq('proceso_id', payload.proceso_id).eq('tipo', 'inicial').single().execute()

        if not pesaje_inicial_response.data:
            raise HTTPException(status_code=404, detail="No se encontró el pesaje inicial para este proceso.")
        
        peso_bruto_registrado = pesaje_inicial_response.data['peso_kg']
        
        # 3. Lógica de alerta (sin cambios)
        # La constante TOLERANCIA_TARA_KG ya está definida globalmente
        if abs(payload.diferencia - (peso_bruto_registrado - payload.peso_kg)) > TOLERANCIA_TARA_KG:
            print(f"ALERTA: Desfase en peso neto para proceso ID {payload.proceso_id}")
            # Aquí iría la lógica para enviar el email de alerta

        # 4. Actualizar el estado en la tabla 'procesos' a 'finalizado'
        supabase_client.table('procesos').update({'estado': 'finalizado'}).eq('id', payload.proceso_id).execute()
        print(f"Proceso ID: {payload.proceso_id} marcado como 'finalizado'.")

        return {"ok": True, "message": "Proceso finalizado con éxito."}

    except Exception as e:
        print(f"Error al guardar pesaje final: {e}")
        raise HTTPException(status_code=500, detail=f"Error de servidor al finalizar el pesaje: {str(e)}")
    

@app.get("/api/tipos-mangueras")
def obtener_tipos_mangueras():
    try:
        response = supabase_client.table('tipos_mangueras').select('id, nombre, vida_util_horas').execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al obtener tipos de mangueras.")

@app.get("/api/mangueras/camion/{proceso_id}")
def obtener_mangueras_por_proceso(proceso_id: str):
    try:
        response = supabase_client.from_("vista_mangueras_completa").select("*").eq('proceso_id', proceso_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Endpoints de Administración (Protegidos) ---

@app.get("/api/admin/mangueras")
def obtener_todas_las_mangueras_admin(current_user: dict = Depends(get_current_user)):
    try:
        # Ordenamos por fecha de ingreso, de la más nueva a la más antigua.
        response = supabase_client.from_("vista_mangueras_completa").select("*").order('fecha_ingreso', desc=True).execute() # <-- Solucionado
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/mangueras")
def crear_manguera(manguera_data: MangueraBase, current_user: dict = Depends(get_current_user)):
    try:
        response = supabase_client.table('mangueras').insert(manguera_data.dict()).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/mangueras/{manguera_id}")
def actualizar_manguera(manguera_id: str, manguera_data: MangueraUpdate, current_user: dict = Depends(get_current_user)):
    try:
        # El resto del código funciona perfecto gracias a exclude_unset=True,
        # que solo actualiza los campos que el usuario realmente envió.
        response = supabase_client.table('mangueras').update(manguera_data.dict(exclude_unset=True)).eq('id', manguera_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/admin/mangueras/{manguera_id}/retirar")
def retirar_manguera(manguera_id: str, payload: MangueraRetiro, current_user: dict = Depends(get_current_user)):
    try:
        update_data = {"estado": "retirada", "observaciones": payload.motivo}
        response = supabase_client.table('mangueras').update(update_data).eq('id', manguera_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Endpoint para Guardar Inspección B (Versión Supabase) ---
@app.post("/api/inspeccionB")
def guardar_inspeccion_b(payload: InspeccionBPayload, current_user: dict = Depends(verificar_rol_recepcion_o_admin)):
    _assert_lock_owner_or_423(payload.proceso_id, current_user)

    """
    Recibe una lista de partes inspeccionadas y las guarda en la tabla 'inspecciones'.
    Solo permite inspección B si el estado del proceso es 'pendiente-recepcion'.
    """
    try:
        # Verificar que el proceso esté en estado 'pendiente-recepcion'
        proceso_response = supabase_client.table("procesos").select("estado").eq("id", payload.proceso_id).execute()
        
        if not proceso_response.data:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")
        
        estado_actual = proceso_response.data[0].get("estado")
        if estado_actual != "pendiente-recepcion":
            raise HTTPException(
                status_code=400, 
                detail=f"No se puede realizar inspección B. El proceso debe estar en estado 'pendiente-recepcion', actualmente está en '{estado_actual}'"
            )

        # Verificar que no exista ya una inspección B para este proceso
        inspecciones_existentes = supabase_client.table('inspecciones').select('*').eq('proceso_id', payload.proceso_id).execute()
        inspeccion_b_existente = any(
            'B' in inspeccion.get('nombre_parte', '') 
            for inspeccion in inspecciones_existentes.data
        )
        
        if inspeccion_b_existente:
            raise HTTPException(status_code=400, detail="Ya existe una inspección B para este proceso")

        # Preparamos la lista de diccionarios para la inserción masiva.
        datos_para_insertar = [
            {
                "proceso_id": payload.proceso_id,
                "nombre_parte": parte.nombre_parte,
                "estado": parte.estado,
                "informacion": parte.informacion,
                "usuario_id": current_user.id
            }
            for parte in payload.partes
        ]

        if not datos_para_insertar:
            return {"ok": True, "message": "No se recibieron partes para guardar."}

        # Ejecutamos una única operación de inserción para todas las filas.
        supabase_client.table('inspecciones').insert(datos_para_insertar).execute()

        # Registrar la actividad en logs_actividad
        log_data = {
            "usuario_id": current_user.id,
            "usuario_email": current_user.email,
            "accion": "REGISTRO_INSPECCION_B",
            "detalles": {
                "proceso_id": payload.proceso_id,
                "cantidad_partes_inspeccionadas": len(datos_para_insertar),
                "partes_inspeccionadas": [parte.nombre_parte for parte in payload.partes]
            }
        }
        supabase_client.table('logs_actividad').insert(log_data).execute()

        print(f"[Backend] guardar_inspeccion_b: Inspección B guardada exitosamente para proceso {payload.proceso_id}")
        return {"ok": True, "message": f"Se guardaron {len(datos_para_insertar)} registros de inspección B."}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al guardar Inspección B: {e}")
        raise HTTPException(status_code=500, detail=f"Error de servidor al guardar la Inspección B: {str(e)}")


# --- FUNCIÓN PARA ENVÍO DE ALERTAS POR CORREO --- #
# (Mantenida como estaba, asegúrate que tu lógica de llamado sea correcta)
def enviar_alerta_email_function(asunto, cuerpo):
    try:
        msg = MIMEText(cuerpo)
        msg['Subject'] = asunto
        msg['From'] = os.getenv("EMAIL_ORIGEN")
        msg['To'] = os.getenv("EMAIL_ALERTA")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(os.getenv("EMAIL_ORIGEN"), os.getenv("EMAIL_PASSWORD"))
            server.send_message(msg)
        print(f"Alerta por email enviada: {asunto}")
    except Exception as e:
        print(f"Error enviando alerta por correo: {e}")
        
@app.post("/api/admin/limpiar-procesos-abandonados")
def limpiar_procesos_abandonados(current_user: dict = Depends(get_current_user)):
    """
    Busca procesos que no han sido finalizados después de un tiempo (12 horas)
    y libera las mangueras asociadas a ellos.
    """
    try:
        # 1. Define el umbral de tiempo para un proceso "abandonado"
        umbral_fecha = datetime.now() - timedelta(hours=12)

        # 2. Busca los IDs de los procesos abandonados
        procesos_abandonados_res = supabase_client.table('procesos') \
            .select('id') \
            .neq('estado', 'finalizado') \
            .lt('fecha_proceso', umbral_fecha.isoformat()) \
            .execute()

        ids_abandonados = [p['id'] for p in procesos_abandonados_res.data]

        if not ids_abandonados:
            return {"ok": True, "message": "No se encontraron procesos abandonados para limpiar."}

        # 3. Libera todas las mangueras de esos procesos en una sola consulta
        update_res = supabase_client.table('mangueras') \
            .update({'proceso_id': None}) \
            .in_('proceso_id', ids_abandonados) \
            .execute()

        # 'count' puede no estar disponible en todas las versiones, len(data) es más seguro
        mangueras_liberadas = len(update_res.data)

        return {
            "ok": True, 
            "message": f"Limpieza completada. Se liberaron {mangueras_liberadas} mangueras de {len(ids_abandonados)} procesos abandonados."
        }

    except Exception as e:
        print(f"Error durante la limpieza de procesos abandonados: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        

@app.post("/api/procesos/{proceso_id}/finalizar")
def finalizar_proceso_completo(proceso_id: str, payload: FinalizarProcesoPayload, current_user: dict = Depends(get_current_user)):
    _assert_lock_owner_or_423(proceso_id, current_user)

    try:
        # 1) Traer datos del proceso y pesaje inicial para calcular tara esperada
        proc_row = supabase_client.table("procesos").select(
            "patente,peso_guia,peso_guia_bruto,peso_guia_tara"
        ).eq("id", proceso_id).single().execute()
        proc = proc_row.data or {}
        patente_camion = proc.get("patente", "N/A")

        tara_esperada = None
        if proc.get("peso_guia_tara") is not None:
            tara_esperada = float(proc["peso_guia_tara"])
        elif proc.get("peso_guia_bruto") is not None and proc.get("peso_guia") is not None:
            tara_esperada = float(proc["peso_guia_bruto"]) - float(proc["peso_guia"])
        else:
            ini = supabase_client.table("pesajes") \
                .select("peso_kg").eq("proceso_id", proceso_id).eq("tipo", "inicial") \
                .single().execute().data
            if ini and proc.get("peso_guia") is not None:
                tara_esperada = float(ini["peso_kg"]) - float(proc["peso_guia"])

        tara_esperada = float(tara_esperada or 0.0)

        tara_real = float(payload.peso_tara_kg)
        diff_kg = tara_real - tara_esperada
        diff_pct = (diff_kg / tara_esperada * 100.0) if tara_esperada > 0 else 0.0

        # 2) Si excede tolerancia y NO hay override, rechazamos con 422 (no guardamos)
        if abs(diff_kg) > TOLERANCIA_TARA_KG:
            supabase_client.table("logs_actividad").insert({
                "usuario_id": current_user.id,
                "usuario_email": current_user.email,
                "accion": "PESAJE_FINAL_RECHAZADO",
                "detalles": {
                    "proceso_id": proceso_id,
                    "patente": patente_camion,
                    "tara_esperada": tara_esperada,
                    "tara_real": tara_real,
                    "diff_kg": diff_kg,
                    "diff_pct": diff_pct,
                    "tolerancia_kg": TOLERANCIA_TARA_KG
                }
            }).execute()
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Tara fuera de tolerancia. Requiere revisión.",
                    "tara_esperada": tara_esperada,
                    "tara_real": tara_real,
                    "diff_kg": diff_kg,
                    "diff_pct": diff_pct
                }
            )

        # 3) Guardar pesaje final
        supabase_client.table("pesajes").upsert({
            "proceso_id": proceso_id,
            "tipo": "final",
            "peso_kg": tara_real,
            "diferencia": float(payload.peso_neto_real),
            "porcentaje_diferencia": float(payload.porcentaje_diferencia),
            "usuario_id": current_user.id
        }, on_conflict="proceso_id,tipo").execute()

        # 4) Liberar mangueras
        supabase_client.table("mangueras").update({"proceso_id": None}).eq("proceso_id", proceso_id).execute()

        # 5) Marcar proceso finalizado y liberar lock
        supabase_client.table("procesos").update({
            "estado": "finalizado",
            "locked_by": None,
            "locked_at": None
        }).eq("id", proceso_id).execute()

        # 6) Log de actividad
        supabase_client.table("logs_actividad").insert({
            "usuario_id": current_user.id,
            "usuario_email": current_user.email,
            "accion": "PROCESO_FINALIZADO",
            "detalles": {
                "proceso_id": proceso_id,
                "patente": patente_camion,
                "peso_tara": tara_real,
                "peso_neto_real": float(payload.peso_neto_real),
                "porcentaje_diferencia": float(payload.porcentaje_diferencia)
            }
        }).execute()

        return {"ok": True, "message": "Proceso finalizado con éxito."}

    except HTTPException:
        # reenviamos 4xx/422 tal cual
        raise
    except Exception as e:
        print(f"[FINALIZAR] ERROR proceso {proceso_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el servidor: {str(e)}")

# ---------- REGISTRAR EVACUACIÓN (Versión Supabase) ---------- #
@app.post("/api/evacuaciones")
def registrar_evacuacion(payload: EvacuacionPayload, current_user: dict = Depends(verificar_rol_recepcion_o_admin)):
    _assert_lock_owner_or_423(payload.proceso_id, current_user)

    """
    Guarda o actualiza el registro de evacuación para un proceso.
    Solo cambia el estado a 'pendiente-pesaje-final' si ya existe inspección B.
    """
    try:
        # Verificar que el proceso esté en estado 'pendiente-recepcion'
        proceso_response = supabase_client.table("procesos").select("estado").eq("id", payload.proceso_id).execute()
        
        if not proceso_response.data:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")
        
        estado_actual = proceso_response.data[0].get("estado")
        if estado_actual != "pendiente-recepcion":
            raise HTTPException(
                status_code=400, 
                detail=f"No se puede realizar evacuación. El proceso debe estar en estado 'pendiente-recepcion', actualmente está en '{estado_actual}'"
            )

        # Preparamos los datos con los nombres de columna de nuestra BD
        datos_para_guardar = {
            "proceso_id": payload.proceso_id,
            "tiempo_minutos": payload.tiempo,
            "observaciones": payload.observaciones,
            "usuario_id": current_user.id
        }

        # Upsert evacuación
        response = supabase_client.table('evacuaciones').upsert(
            datos_para_guardar, on_conflict='proceso_id'
        ).execute()
        
        # ¿Existe inspección B?
        inspecciones_response = supabase_client.table('inspecciones').select('*').eq('proceso_id', payload.proceso_id).execute()
        inspeccion_b_existente = any(
            'B' in inspeccion.get('nombre_parte', '') 
            for inspeccion in inspecciones_response.data
        )
        
        # Solo cambiar el estado si ya existe la inspección B
        if inspeccion_b_existente:
            supabase_client.table("procesos").update({"estado": "pendiente-pesaje-final"}).eq("id", payload.proceso_id).execute()
            print(f"[Backend] registrar_evacuacion: Evacuación registrada y estado actualizado a 'pendiente-pesaje-final' para proceso {payload.proceso_id}")
        else:
            print(f"[Backend] registrar_evacuacion: Evacuación registrada pero estado no cambiado (falta inspección B) para proceso {payload.proceso_id}")

        # Log de actividad
        log_data = {
            "usuario_id": current_user.id,
            "usuario_email": current_user.email,
            "accion": "REGISTRO_EVACUACION",
            "detalles": {
                "proceso_id": payload.proceso_id,
                "tiempo_minutos": payload.tiempo,
                "observaciones": payload.observaciones,
                "inspeccion_b_existente": inspeccion_b_existente,
                "estado_actualizado": inspeccion_b_existente
            }
        }
        supabase_client.table('logs_actividad').insert(log_data).execute()

        if AUTO_UNLOCK_ON_EVACUACION:
            supabase_client.table("procesos").update({
                "locked_by": None,
                "locked_at": None
            }).eq("id", payload.proceso_id).execute()

            
            try:
                supabase_client.table("logs_actividad").insert({
                    "usuario_id": current_user.id,
                    "usuario_email": current_user.email,
                    "accion": "LOCK_RELEASED",
                    "detalles": {"proceso_id": payload.proceso_id, "auto": "evacuacion"}
                }).execute()
            except Exception:
                pass
    

        return {"ok": True, "proceso_id": payload.proceso_id}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al registrar evacuación: {e}")
        raise HTTPException(status_code=500, detail=f"Error de servidor al registrar la evacuación: {e}")



# ---------- ALERTA-GMAIL ---------- #
# (Mantenida como estaba, asegúrate que tu lógica de llamado sea correcta)
@app.post("/alerta-cal")
async def alerta_cal(payload: AlertaCalPayload, background_tasks: BackgroundTasks):
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Lógica para determinar el tipo de alerta
    if payload.peso_real > payload.tara_esperada:
        # El camión salió con más peso del esperado (NO descargó todo)
        asunto = f"[ALERTA DE EXCESO] Patente {payload.patente} - {ahora}"
        mensaje_principal = "Se detectó que un camión se retiró con exceso de cal."
        observacion = "El peso tara final fue SUPERIOR al esperado. Es probable que no se haya descargado el producto por completo."
    else:
        # El camión salió con menos peso (posiblemente la guía era incorrecta)
        asunto = f"[ALERTA DE FALTANTE] Patente {payload.patente} - {ahora}"
        mensaje_principal = "Se detectó una discrepancia en el pesaje final (posible faltante)."
        observacion = "El peso tara final fue INFERIOR al esperado. Esto podría indicar un error en la guía de despacho o que el camión llegó con menos producto del declarado."

    cuerpo = f"""
    🚨 {mensaje_principal}
    
    Fecha y hora: {ahora}
    Patente: {payload.patente}

    DETALLES DEL PESAJE:
    - Peso Bruto: {payload.peso_bruto} kg
    - Tara Esperada (Cálculo): {payload.tara_esperada:.2f} kg
    - Tara Real (Báscula): {payload.peso_real} kg
    - Diferencia: {payload.diferencia:.2f} kg

    OBSERVACIÓN:
    {observacion}

    Por favor, revisar el proceso asociado a este camión.
    """
    background_tasks.add_task(enviar_alerta_email_function, asunto, cuerpo)
    return {"message": "Correo de alerta programado para envío"}

# ---------- OBTENER LOGS DE ACTIVIDAD (NUEVO) ---------- #
@app.get("/api/logs")
def get_activity_logs():
    """
    Obtiene todos los registros de actividad de la base de datos,
    ordenados del más reciente al más antiguo.
    """
    try:
        # Consultamos la tabla 'logs_actividad' y ordenamos por 'timestamp' descendente
        response = supabase_client.table('logs_actividad').select('*').order('timestamp', desc=True).execute()
        
        return response.data
    except Exception as e:
        print(f"Error al obtener logs de actividad: {e}")
        raise HTTPException(status_code=500, detail="Error interno al consultar logs.")
    
# ---------- LOGS ---------- # 
@app.post("/api/actividad")
def registrar_actividad(payload: ActividadPayload, current_user: dict = Depends(get_current_user)):
    """
    Recibe un registro de actividad genérico y lo guarda en la tabla de logs.
    """
    try:
        print(f"Actividad para registrar: '{payload.tipo_actividad}' por usuario {current_user.email}")

        # Preparamos el diccionario para insertar en la tabla 'logs_actividad'
        log_data = {
            "usuario_id": current_user.id,
            "usuario_email": current_user.email,
            "accion": payload.tipo_actividad,
            "detalles": payload.metadata
        }

        # Insertamos el log en Supabase
        supabase_client.table('logs_actividad').insert(log_data).execute()

        return {"ok": True, "message": "Actividad registrada"}
    
    except Exception as e:
        print(f"ALERTA: El registro de actividad falló, pero el proceso principal continúa. Error: {e}")
        # No detenemos el frontend si solo falla una tarea secundaria como el log
        return {"ok": False, "message": str(e)}


def _log_lock(action: str, current_user, proceso_id: str, extra: dict | None = None):
    try:
        payload = {
            "accion": action,  # "LOCK_ACQUIRED" | "LOCK_RELEASED" | "LOCK_HEARTBEAT"
            "usuario_id": getattr(current_user, "id", None),
            "usuario_email": getattr(current_user, "email", None),
            "detalles": {"proceso_id": proceso_id, **(extra or {})} if proceso_id else (extra or None),
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        supabase_client.table("logs_actividad").insert(payload).execute()
    except Exception:
        pass




@app.post("/api/procesos/{proceso_id}/lock")
def lock_proceso(proceso_id: str, current_user: dict = Depends(get_current_user)):

    # 1) Lee el estado actual de lock
    row = supabase_client.table("procesos").select("locked_by,locked_at").eq("id", proceso_id).single().execute()
    data = row.data or {}
    owner = data.get("locked_by")
    locked_at = data.get("locked_at")

    # 2) ¿libre, expirado o ya es mío? -> lo tomo
    if (owner is None) or _is_expired(locked_at) or (owner == current_user.id):
        supabase_client.table("procesos").update({
            "locked_by": current_user.id,
            "locked_at": _now_utc_iso()
        }).eq("id", proceso_id).execute()
        _log_lock("LOCK_ACQUIRED", current_user, proceso_id)
        return {"status": "locked", "by_me": True, "ttl_min": LOCK_TTL_MIN}


    # 3) Está tomado por otro: responde 423 con quién lo tiene
    mail = None
    try:
        u = supabase_client.table("usuarios").select("email").eq("id", owner).single().execute()
        mail = (u.data or {}).get("email")
    except Exception:
        pass

    raise HTTPException(
    status_code=status.HTTP_423_LOCKED,
    detail={
    "message": "Proceso en uso",
    "locked_by": mail or owner,
    "locked_at": locked_at,
    "ttl_min": LOCK_TTL_MIN
}
)



@app.post("/api/procesos/{proceso_id}/unlock")
def unlock_proceso(proceso_id: UUID, current_user: dict = Depends(get_current_user)):
    proceso_id = str(proceso_id)  # para usarlo en Supabase
    rol = _get_user_role(current_user)
    es_admin = (rol == "admin")

    filt = supabase_client.table("procesos").select("locked_by").eq("id", proceso_id).single().execute()
    owner = (filt.data or {}).get("locked_by")

    if owner in (None, current_user.id) or es_admin:
        pg_safe_execute(supabase_client.table("procesos").update({"locked_by": None, "locked_at": None}).eq("id", proceso_id))
        _log_lock("LOCK_RELEASED", current_user, proceso_id, {"by_admin": bool(es_admin)})
        return {"status": "unlocked"}

    raise HTTPException(status_code=403, detail="No puedes liberar este proceso.")

@app.post("/api/procesos/{proceso_id}/heartbeat")
def heartbeat_proceso(proceso_id: str, current_user: dict = Depends(get_current_user)):
    try:
        row = supabase_client.table("procesos").select("locked_by").eq("id", proceso_id).single().execute()
        if (row.data or {}).get("locked_by") == current_user.id:
            try:
                pg_safe_execute(
                    supabase_client.table("procesos").update({"locked_at": _now_utc_iso()}).eq("id", proceso_id)
                )
            except Exception:
                return {"ok": True, "skipped": True}
            _log_lock("LOCK_HEARTBEAT", current_user, proceso_id)
            return {"ok": True}
        # lock no es mío
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No posees el lock o expiró.")
    except Exception:
        return {"ok": True, "skipped": True}

def _hydrate_locks(rows):
    """rows: lista de procesos con locked_by/locked_at. Agrega lock_state/locked_by_name."""
    ids = list({r.get("locked_by") for r in rows if r.get("locked_by")})
    name_map = {}
    if ids:
        try:
            res = supabase_client.table("usuarios").select("id,nombre,email").in_("id", ids).execute()
            name_map = {u["id"]: (u.get("nombre") or u.get("email")) for u in (res.data or [])}
        except Exception:
            name_map = {}
    out = []
    for r in rows:
        owner = r.get("locked_by")
        ts = r.get("locked_at")
        expired = (owner is None) or _is_expired(ts)
        r2 = dict(r)
        r2["lock_state"] = "disponible" if expired else "tomado"
        r2["locked_by_name"] = None if expired else name_map.get(owner)
        out.append(r2)
    return out


# ---------- VERIFICACIÓN ---------- #
@app.get("/")
def read_root():
    return {"message": "API de Inspección de Camiones funcionando correctamente"}

@app.get("/health")
def health_check():
    """
    Endpoint de salud básico para verificar que la API está funcionando.
    """
    try:
        # Verificar conexión a Supabase
        supabase_client.from_("procesos").select("count", count="exact").limit(1).execute()
        
        return {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "camion-backend",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "camion-backend",
            "database": "disconnected",
            "error": str(e),
            "message": "API funcionando pero sin conexión a base de datos"
        }

@app.get("/api/health")
def api_health_check():
    """
    Endpoint alternativo para verificar el estado de salud del API.
    """
    return health_check()

@app.post("/api/pesajes/inicial")
def registrar_pesaje_inicial(payload: PesajePayload, current_user: dict = Depends(verificar_rol_pesaje)):
    _assert_lock_owner_or_423(payload.proceso_id, current_user)
    """
    Registra el pesaje inicial de un camión, valida duplicados, actualiza estado y registra log.
    """
    try:
        # 1. Validar que no exista ya un pesaje inicial para este proceso
        pesaje_existente = supabase_client.table('pesajes').select('id').eq('proceso_id', payload.proceso_id).eq('tipo', 'inicial').single().execute()
        if pesaje_existente.data:
            raise HTTPException(status_code=400, detail="Ya existe un pesaje inicial para este proceso.")

        # 2. Registrar el pesaje inicial
        datos_a_guardar = {
            "proceso_id": payload.proceso_id,
            "tipo": "inicial",
            "peso_kg": payload.peso_kg,
            "usuario_id": current_user.id
        }
        supabase_client.table('pesajes').insert(datos_a_guardar).execute()

        # 3. Actualizar el estado del proceso a 'pendiente-recepcion'
        supabase_client.table("procesos").update({"estado": "pendiente-recepcion"}).eq("id", payload.proceso_id).execute()

        # 4. Registrar en logs_actividad
        log_data = {
            "usuario_id": current_user.id,
            "usuario_email": current_user.email,
            "accion": "PESAJE_INICIAL",
            "detalles": {"proceso_id": payload.proceso_id, "peso_kg": payload.peso_kg}
        }
        supabase_client.table('logs_actividad').insert(log_data).execute()

        return {"ok": True, "proceso_id": payload.proceso_id, "message": "Pesaje inicial registrado y proceso actualizado."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al registrar pesaje inicial: {e}")
        raise HTTPException(status_code=500, detail=f"Error de servidor al registrar pesaje inicial: {str(e)}")


@app.get("/healthz")
def healthz():
    return {"ok": True}

import traceback
