import os
import threading
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
from supabase import create_client

app = FastAPI(title="AFK RRHH")

FRONTEND_DIR = Path(__file__).resolve().parent

# --- Security Dependencies ---

def get_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Missing Supabase configuration")
    return create_client(url, key)

async def get_current_user(request: Request):
    """Verifica el JWT de Supabase desde la cookie segura."""
    token = request.cookies.get("sb-access-token")
    if not token:
        raise HTTPException(status_code=401, detail="No session found")
    try:
        supabase = get_supabase_client()
        user_res = supabase.auth.get_user(token)
        if not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid session")
        return user_res.user
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")

# --- Middleware: HTML Route Protection (Stark-Gatekeeper) ---

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    
    # Public routes
    PUBLIC_PATHS = ["/login.html", "/landing.html", "/static", "/favicon.ico", "/api/auth/session"]
    
    # Check if it's a private HTML node or the root
    is_private_html = (path.endswith(".html") or path == "/") and not any(path.startswith(p) for p in PUBLIC_PATHS)

    if is_private_html:
        token = request.cookies.get("sb-access-token")
        if not token:
            return RedirectResponse(url="/login.html")
            
        try:
            supabase = get_supabase_client()
            user_res = supabase.auth.get_user(token)
            if not user_res.user:
                raise Exception("Invalid Session")
        except Exception:
            return RedirectResponse(url="/login.html")

    response = await call_next(request)
    return response

# --- HTML Routes ---

@app.get("/", response_class=FileResponse)
def index():
    file_path = FRONTEND_DIR / "index.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(file_path)

@app.get("/{page}.html", response_class=FileResponse)
def get_html_page(page: str):
    """Serves HTML files directly (e.g., /candidates.html)."""
    file_path = FRONTEND_DIR / f"{page}.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Page not found")
    return FileResponse(file_path)

@app.get("/candidates", response_class=FileResponse)
def candidates():
    file_path = FRONTEND_DIR / "candidates.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="candidates.html not found")
    return FileResponse(file_path)

@app.get("/comparison", response_class=FileResponse)
def comparison():
    file_path = FRONTEND_DIR / "comparison.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="comparison.html not found")
    return FileResponse(file_path)

@app.get("/workers", response_class=FileResponse)
def workers():
    file_path = FRONTEND_DIR / "workers.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="workers.html not found")
    return FileResponse(file_path)

@app.get("/tenders", response_class=FileResponse)
def tenders():
    file_path = FRONTEND_DIR / "tenders.html"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="tenders.html not found")
    return FileResponse(file_path)

# --- Session Support: Secure Cookie Bridge (HttpOnly) ---

class SessionRequest(BaseModel):
    access_token: str

@app.post("/api/auth/session")
async def set_session(req: SessionRequest):
    """Sella la sesión en una cookie HttpOnly."""
    try:
        supabase = get_supabase_client()
        user_res = supabase.auth.get_user(req.access_token)
        if not user_res.user: raise Exception("Invalid Token")
        
        response = JSONResponse({"ok": True})
        response.set_cookie(
            key="sb-access-token",
            value=req.access_token,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/"
        )
        return response
    except Exception:
        raise HTTPException(status_code=401, detail="Session Rejected")

@app.delete("/api/auth/session")
async def clear_session():
    """Purga la cookie de sesión."""
    response = JSONResponse({"ok": True})
    response.delete_cookie(key="sb-access-token", path="/")
    return response

# --- AI Semantic Matchmaking Endpoint ---
class TenderMatchRequest(BaseModel):
    tender_id: str
    tender_name: str
    requirements: list[str]

@app.post("/api/match-tender-candidates")
async def match_tender_candidates(req: TenderMatchRequest):
    try:
        import json
        from openai import OpenAI
        from supabase import create_client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        
        if not all([url, key, openai_key]):
            return JSONResponse({"ok": False, "detail": "Missing API keys"}, status_code=500)
            
        supabase = create_client(url, key)
        openai = OpenAI(api_key=openai_key)
        
        # 1. Create embedding for the Tender
        req_text = f"Rol o Servicio: {req.tender_name}. Requisitos claves: " + ". ".join(req.requirements)
        res = openai.embeddings.create(input=req_text, model="text-embedding-3-small")
        query_emb = res.data[0].embedding
        
        # 2. Fetch all candidates with their vectors
        candidates = supabase.table("candidates").select("id, nombre_completo, rut, profesion, cargo_a_desempenar, evaluacion_general, status, cv_embedding").execute()
        
        # 3. Compute Cosine Similarity (OpenAI vectors are already normalized, so dot product == cosine similarity)
        matches = []
        for c in candidates.data:
            emb = c.get("cv_embedding")
            if not emb: continue
            
            if isinstance(emb, str):
                try:
                    emb = json.loads(emb)
                except:
                    continue
                    
            if len(emb) != len(query_emb): continue
            
            score = sum(a * b for a, b in zip(query_emb, emb))
            
            # Map score roughly to a realistic percentage. 
            # OpenAI cosine similarities usually range from 0.3 (unrelated) to 0.85 (identical)
            # We normalize this range to 0-100% for the HUD
            base_score = max(0, score - 0.25) / 0.6 
            pct = min(100.0, max(0.0, round(base_score * 100, 1)))
            
            if pct > 40.0: # Minimum affinity threshold
                c.pop("cv_embedding", None)
                c["ai_match_score"] = pct
                matches.append(c)
                
        # 4. Sort and return Top 15
        matches.sort(key=lambda x: x["ai_match_score"], reverse=True)
        return {"ok": True, "matches": matches[:15]}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"ok": False, "detail": str(e)}, status_code=500)


# --- JARVIS Tender Analysis Endpoint ---
class AnalyzeTenderRequest(BaseModel):
    text: str

@app.post("/api/analyze-tender")
async def analyze_tender(req: AnalyzeTenderRequest):
    """ACTÚA COMO JARVIS: Extrae la jerarquía operativa de una licitación."""
    try:
        import json
        from openai import OpenAI
        
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            return JSONResponse({"ok": False, "detail": "Missing OpenAI Key"}, status_code=500)
            
        openai = OpenAI(api_key=openai_key)
        
        prompt = (
            "ACTÚA COMO JARVIS (STARK INDUSTRIES). Eres un ANALISTA MASTER de licitaciones industriales (NIVEL NASA/TESLA/ZERO-COMPRESSION).\n"
            "Analiza el siguiente texto de licitación con una EXHAUSTIVIDAD TOTAL Y ABSOLUTA. No dejes pasar ni un solo cargo.\n"
            "INSTRUCCIONES CRÍTICAS (PROTOCOLO STARK-TOTAL-SCAN):\n"
            "1. PARSEO DE TABLAS Y TEXTO: Las licitaciones tienen tablas de personal y descripciones de cargos.\n"
            "   - Identifica columnas como 'CARGO', 'CANTIDAD' y 'TOTAL'.\n"
            "   - SIEMPRE utiliza el valor de la columna 'TOTAL' como la cantidad para el cargo.\n"
            "2. REQUISITOS GRANULARES: DEBES extraer requisitos DIFERENCIADOS por cada cargo.\n"
            "   - No te limites a los requisitos generales de la licitación.\n"
            "   - Busca específicamente certificaciones técnicas (ej: 'Mantenedor Clase B', 'Operador Grúa'), años de experiencia EN EL CARGO, y exámenes de salud específicos.\n"
            "3. NO RESUMIR NI AGRUPAR: Si hay 50 cargos diferentes, crea 50 objetos. No agrupes 'Operadores' en un solo item si tienen especialidades distintas.\n"
            "4. CRITICIDAD Y EXPERIENCIA: Detalla la 'experiencia_minima' específica para cada rol (ej: '5 años en gran minería').\n\n"
            "FORMATO DE SALIDA (JSON ESTRICTO DE ALTA FIDELIDAD):\n"
            "{\n"
            "  \"tender_summary\": \"...\",\n"
            "  \"global_risk\": \"Bajo/Medio/Alto\",\n"
            "  \"roles\": [\n"
            "    {\n"
            "      \"nombre\": \"...\",\n"
            "      \"cantidad\": 1,\n"
            "      \"criticidad\": \"Primario/Secundario\",\n"
            "      \"requisitos\": [\"requisito específico 1\", \"requisito específico 2\"],\n"
            "      \"certificaciones\": [\"certificación necesaria\"],\n"
            "      \"experiencia_minima\": \"ej: 3 años en el cargo\"\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            f"TEXTO ESTRATÉGICO A ESCANEAR (MÁXIMA COBERTURA):\n{req.text[:15000]}"
        )
        
        res = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are JARVIS, an elite industrial analyst. You output ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        analysis = json.loads(res.choices[0].message.content)
        return {"ok": True, "analysis": analysis}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"ok": False, "detail": str(e)}, status_code=500)


# --- JARVIS CV Processing Endpoint ---
class CVProcessRequest(BaseModel):
    candidate_id: str
    document_id: Optional[str] = None
    file_name: Optional[str] = None
    signed_url: Optional[str] = None
    storage_path: Optional[str] = None

def run_afk_processor(candidate_id: str, signed_url: str):
    """Runs in a background thread so the HTTP response is instant."""
    import subprocess, sys
    try:
        subprocess.run(
            [sys.executable, str(Path(__file__).parent / "afk_processor.py"),
             signed_url, "--id", candidate_id],
            capture_output=True, text=True
        )
    except Exception as e:
        print(f"[JARVIS] Pipeline error: {e}")

@app.post("/api/process-cv")
async def process_cv(req: CVProcessRequest, background_tasks: BackgroundTasks):
    if not req.signed_url:
        return JSONResponse({"ok": False, "detail": "No signed_url provided"}, status_code=400)
    background_tasks.add_task(run_afk_processor, req.candidate_id, req.signed_url)
    return {"ok": True, "message": f"JARVIS pipeline triggered for candidate {req.candidate_id}"}


# --- JARVIS Candidate AI Summary Endpoint ---
class CandidateSummaryRequest(BaseModel):
    candidate_id: str

@app.post("/api/generate-candidate-summary")
async def generate_candidate_summary(req: CandidateSummaryRequest):
    """Generates a tactical AI summary for a specific candidate."""
    try:
        import json
        from openai import OpenAI
        from supabase import create_client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        
        if not all([url, key, openai_key]):
            return JSONResponse({"ok": False, "detail": "Missing configuration (API Keys)"}, status_code=500)
            
        supabase = create_client(url, key)
        openai = OpenAI(api_key=openai_key)
        
        # 1. Fetch Candidate Data
        c_res = supabase.table("candidates").select("*").eq("id", req.candidate_id).single().execute()
        candidate = c_res.data
        if not candidate:
            return JSONResponse({"ok": False, "detail": "Candidate not found"}, status_code=404)
            
        # 2. Build AI Context (Prioritizing 'experiencia_general' for chronological audit)
        historial = candidate.get("experiencia_general") or candidate.get("cv_full_text") or "Sin datos de historial disponibles."
        profesion = candidate.get("profesion", "Perfil no definido")
        nombre = candidate.get("nombre_completo", "Candidato")
        
        prompt = (
            f"ACTÚA COMO JARVIS (STARK INDUSTRIES). Genera un RESUMEN EJECUTIVO TÁCTICO y realiza una AUDITORÍA CRONOLÓGICA para {nombre}.\n"
            f"PROFESIÓN: {profesion}\n"
            f"DATOS DE HISTORIAL RECOLECTADOS:\n{historial[:5000]}\n\n"
            "INSTRUCCIONES CRÍTICAS STARK:\n"
            "1. AUDITORÍA DE EXPERIENCIA: Calcula la SUMA TOTAL de años de experiencia basándote en los periodos del historial.\n"
            "   - Si un periodo dice 'Actualidad', 'Presente' o similar, usa 2024 como año de fin.\n"
            "   - Suma todos los años (ej: 2011-2016 = 5 años, 2021-2024 = 3 años => Total 8 años).\n"
            "   - Devuelve un número decimal aproximado (float).\n"
            "2. SCORES TÁCTICOS (0-100):\n"
            "   - 'estabilidad': Basado en la duración promedio en empleos previos (mayor duración = mayor score).\n"
            "   - 'fit_tecnico': Qué tan experto es para su Profesión/Cargo específico.\n"
            "   - 'certificaciones': Relevancia de cursos y exámenes mencionados.\n"
            "3. RESUMEN TÁCTICO: Genera 3 párrafos de alto impacto sobre su valor, dominio técnico y fit operativo.\n"
            "4. FORMATO DE SALIDA: Responde EXCLUSIVAMENTE con un objeto JSON válido (sin markdown) con estas llaves:\n"
            "   {\"resumen\": \"texto_aqui\", \"anios_calculados\": 12.5, \"score_estabilidad\": 85, \"score_fit_tecnico\": 90, \"score_certificaciones\": 75}"
        )
        
        # 3. Request LLM Analysis
        ai_res = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are JARVIS, an elite AI auditor. You output ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        try:
            raw_data = json.loads(ai_res.choices[0].message.content)
            resumen = raw_data.get("resumen", "Análisis completado.")
            anios = float(raw_data.get("anios_calculados", 0.0))
            score_est = int(raw_data.get("score_estabilidad", 80))
            score_fit = int(raw_data.get("score_fit_tecnico", 80))
            score_cert = int(raw_data.get("score_certificaciones", 80))
        except:
            resumen = ai_res.choices[0].message.content
            anios, score_est, score_fit, score_cert = 0.0, 80, 80, 80
        
        # 4. Persistence: Update summary and base experience
        update_payload = {"resumen_ia": resumen}
        if anios > 0:
            update_payload["experiencia_total"] = anios
            
        supabase.table("candidates").update(update_payload).eq("id", req.candidate_id).execute()
        
        return {
            "ok": True, 
            "resumen_ia": resumen, 
            "experiencia_total": anios,
            "score_estabilidad": score_est,
            "score_fit_tecnico": score_fit,
            "score_certificaciones": score_cert
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"ok": False, "detail": str(e)}, status_code=500)


# --- Google Drive Sync Interaction ---

def run_drive_sync():
    """Triggers the DriveSync class logic."""
    print("[JARVIS] ⚙️ Background task START: run_drive_sync")
    try:
        from drive_sync import DriveSync
        FOLDER_ID = os.getenv("DRIVE_FOLDER_ID")
        ARCHIVE_ID = os.getenv("DRIVE_ARCHIVE_ID")
        
        print(f"[JARVIS] 📁 Folder ID to sync: {FOLDER_ID}")
        if not FOLDER_ID:
            print("[JARVIS] ❌ Aborting: No DRIVE_FOLDER_ID found.")
            return
        
        print("[JARVIS] 🔌 Initializing DriveSync...")
        sync = DriveSync()
        print("[JARVIS] 🚀 Starting process_folder...")
        sync.process_folder(FOLDER_ID, ARCHIVE_ID)
        print("[JARVIS] ✅ Background task FINISHED.")
    except Exception as e:
        print(f"[JARVIS] 💥 CRITICAL ERROR in run_drive_sync: {e}")
        import traceback
        traceback.print_exc()

@app.post("/api/sync-drive")
async def sync_drive(background_tasks: BackgroundTasks):
    folder_id = os.getenv("DRIVE_FOLDER_ID")
    if not folder_id:
        return JSONResponse({"ok": False, "detail": "DRIVE_FOLDER_ID not set in Railway variables"}, status_code=400)
    
    print(f"[JARVIS] Manual sync requested for folder: {folder_id}")
    background_tasks.add_task(run_drive_sync)
    return {"ok": True, "message": "Google Drive sync started in background."}


# Servir archivos estáticos y rutas dinámicas
@app.get("/{file_name}")
def get_static_or_html(file_name: str):
    file_path = FRONTEND_DIR / file_name
    
    # 1. HTML Nodes: Protegidos por el Middleware
    if file_name.endswith(".html"):
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Página no encontrada.")
        return FileResponse(file_path)
    
    # 2. Static Nodes: Acceso directo (CSS, JS, Imágenes)
    authorized_extensions = [".css", ".js", ".png", ".jpg", ".svg", ".ico", ".json", ".webp", ".txt", ".mp4"]
    if any(file_name.endswith(ext) for ext in authorized_extensions):
        if file_path.exists():
            return FileResponse(file_path)
    
    raise HTTPException(status_code=404)

# Compatibilidad con /static para rutas heredadas
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static_dir")
