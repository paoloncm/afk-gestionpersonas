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

# Aquí después conectas RAG / Supabase helpers
# @app.post("/api/chat")
# def chat(...):
#     pass

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
    from drive_sync import DriveSync
    FOLDER_ID = os.getenv("DRIVE_FOLDER_ID")
    ARCHIVE_ID = os.getenv("DRIVE_ARCHIVE_ID")
    if not FOLDER_ID:
        print("[JARVIS] No DRIVE_FOLDER_ID found in environment.")
        return
    
    sync = DriveSync()
    sync.process_folder(FOLDER_ID, ARCHIVE_ID)

@app.post("/api/sync-drive")
async def sync_drive(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_drive_sync)
    return {"ok": True, "message": "Google Drive sync started in background."}


# IMPORTANTE: Montar archivos estáticos al final para que las rutas relativas funcionen
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")
