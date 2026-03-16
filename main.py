import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path

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

# IMPORTANTE: Montar archivos estáticos al final para que las rutas relativas funcionen
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")
