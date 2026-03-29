import os
import threading
from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from pathlib import Path
from typing import Optional

app = FastAPI(title="AFK RRHH")

FRONTEND_DIR = Path(__file__).parent

# Los archivos estáticos se montarán al final para no interferir con las rutas principales

@app.get("/", response_class=HTMLResponse)
def index():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("index.html not found", status_code=404)
    return index_file.read_text(encoding="utf-8")

@app.get("/candidates", response_class=HTMLResponse)
def candidates():
    return (FRONTEND_DIR / "candidates.html").read_text(encoding="utf-8")

@app.get("/comparison", response_class=HTMLResponse)
def comparison():
    return (FRONTEND_DIR / "comparison.html").read_text(encoding="utf-8")

# Healthcheck / Direct access
@app.get("/candidates.html", response_class=HTMLResponse)
def candidates_html():
    return (FRONTEND_DIR / "candidates.html").read_text(encoding="utf-8")

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


# IMPORTANTE: Montar archivos estáticos al final para que las rutas relativas funcionen
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")
