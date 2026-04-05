import os
import threading
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
from supabase import create_client

app = FastAPI(title="AFK RRHH - STARK INDUSTRIES")

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

# --- STACK PRIORITARIO: Estáticos y Puentes ---

# Montar los estáticos al inicio absoluto para evitar sombreado de rutas
app.mount("/static", StaticFiles(directory=FRONTEND_DIR / "static"), name="static")

# --- HTML Routes ---

@app.get("/", response_class=FileResponse)
def root():
    return FileResponse(FRONTEND_DIR / "index.html")

@app.get("/login.html", response_class=FileResponse)
def login_page():
    return FileResponse(FRONTEND_DIR / "login.html")

@app.get("/{file_name}")
def get_html_page(file_name: str):
    """Sirve archivos HTML de la raíz (Analytics, Tenders, etc.)"""
    if not file_name.endswith(".html"):
        raise HTTPException(status_code=404)
        
    file_path = FRONTEND_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Nodo no encontrado.")
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
        
        # 3. Compute Cosine Similarity
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
            base_score = max(0, score - 0.25) / 0.6 
            pct = min(100.0, max(0.0, round(base_score * 100, 1)))
            
            if pct > 40.0:
                c.pop("cv_embedding", None)
                c["ai_match_score"] = pct
                matches.append(c)
                
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
            "Analiza el siguiente texto de licitación con una EXHAUSTIVIDAD TOTAL Y ABSOLUTA.\n"
            "FORMATO DE SALIDA (JSON ESTRICTO DE ALTA FIDELIDAD):\n"
            "{\n"
            "  \"tender_summary\": \"...\",\n"
            "  \"global_risk\": \"Bajo/Medio/Alto\",\n"
            "  \"roles\": [\n"
            "    {\n"
            "      \"nombre\": \"...\",\n"
            "      \"cantidad\": 1,\n"
            "      \"criticidad\": \"Primario/Secundario\",\n"
            "      \"requisitos\": [\"req1\", \"req2\"],\n"
            "      \"certificaciones\": [\"cert1\"],\n"
            "      \"experiencia_minima\": \"ej: 3 años en el cargo\"\n"
            "    }\n"
            "  ]\n"
            "}\n"
            f"TEXTO: {req.text[:15000]}"
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
    signed_url: Optional[str] = None

def run_afk_processor(candidate_id: str, signed_url: str):
    """Runs in a background thread."""
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

# --- Google Drive Sync Interaction ---
def run_drive_sync():
    print("[JARVIS] ⚙️ Background task START: run_drive_sync")
    try:
        from drive_sync import DriveSync
        FOLDER_ID = os.getenv("DRIVE_FOLDER_ID")
        ARCHIVE_ID = os.getenv("DRIVE_ARCHIVE_ID")
        
        if not FOLDER_ID:
            print("[JARVIS] ❌ No DRIVE_FOLDER_ID found.")
            return
        
        sync = DriveSync()
        sync.process_folder(FOLDER_ID, ARCHIVE_ID)
        print("[JARVIS] ✅ Background task FINISHED.")
    except Exception as e:
        print(f"[JARVIS] 💥 ERROR: {e}")

@app.post("/api/sync-drive")
async def sync_drive(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_drive_sync)
    return {"ok": True, "message": "Google Drive sync started in background."}

# --- STARK REPORTABILITY ENGINE (TEC-02 / TEC-02A) ---

class BulkReportRequest(BaseModel):
    ids: list[str]
    report_type: str # 'tec02' or 'tec02a'

@app.post("/api/reports/bulk-generate")
async def bulk_generate_reports(req: BulkReportRequest):
    """JARVIS: Genera un lote de reportes técnicos industriales."""
    try:
        from report_gen import StarkReportGenerator
        from fastapi.responses import StreamingResponse
        
        supabase = get_supabase_client()
        
        # 1. Fetch Candidates
        res = supabase.table("candidates").select("*").in_("id", req.ids).execute()
        candidates = res.data
        
        if not candidates:
            raise HTTPException(status_code=404, detail="No se encontraron candidatos seleccionados.")
            
        # 2. Generate ZIP
        gen = StarkReportGenerator()
        zip_buffer = gen.create_bulk_zip(candidates, req.report_type)
        
        # 3. Stream Response
        return StreamingResponse(
            zip_buffer,
            media_type="application/x-zip-compressed",
            headers={"Content-Disposition": f"attachment; filename=Stark_Reports_{req.report_type}.zip"}
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Falla del motor de reportabilidad: {str(e)}")
