# afk_charts.py
import os
import io
import math
import textwrap
import pandas as pd
import matplotlib.pyplot as plt

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────────────────
SHEET_ID = "1sK4-T7JS06mj-x2sZj6XqC431akvaS1CAaFXbpbHk0M"
GID = "1994687743"
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"

OUTDIR = "output"
os.makedirs(OUTDIR, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# LOAD & CLEAN
# ──────────────────────────────────────────────────────────────────────────────
def to_num(s):
    """
    Convierte strings a número (soporta comas y puntos, ignora vacíos).
    """
    if pd.isna(s): 
        return pd.NA
    if isinstance(s, (int, float)): 
        return s
    s = str(s).strip().replace(".", "").replace(",", ".")  # 13.416 -> 13416, 6,5 -> 6.5
    try:
        return float(s)
    except Exception:
        return pd.NA

def load_sheet(url: str) -> pd.DataFrame:
    df = pd.read_csv(url, dtype=str)  # leemos todo como texto para limpiar
    # Normaliza nombres de columnas a snake_case
    df.columns = (
        df.columns.str.strip()
                  .str.lower()
                  .str.replace(r"\s+", "_", regex=True)
                  .str.replace(r"[^\w]", "_", regex=True)
    )

    # Posibles columnas en tu sheet (según muestras)
    num_cols = [
        "experiencia", "experiencia_total", "experiencia_en_empresa_actual",
        "exp_cargo_actual", "exp_proy_similares", "nota", "ranking"
    ]
    for c in num_cols:
        if c in df.columns:
            df[c] = df[c].map(to_num)

    # Campos de texto que usaremos
    for c in ["nombre_completo", "profesion", "ultima_exp_laboral_empresa", "correo"]:
        if c in df.columns:
            df[c] = df[c].fillna("").astype(str).str.strip()

    return df

df = load_sheet(CSV_URL)

if df.empty:
    raise SystemExit("La hoja está vacía o no es accesible. Asegúrate de compartirla como 'Cualquiera con el enlace (lector)'.")

print(f"Filas cargadas: {len(df)} | Columnas: {list(df.columns)}")

# ──────────────────────────────────────────────────────────────────────────────
# HELPERS DE PLOTEO
# ──────────────────────────────────────────────────────────────────────────────
def savefig(path):
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()

def top_counts_barh(series: pd.Series, top=10, title="", fname="chart.png"):
    vc = series.dropna().replace("", pd.NA).dropna().value_counts().head(top)
    if vc.empty:
        print(f"[skip] {title}: sin datos")
        return
    plt.figure(figsize=(9, 5))
    vc.sort_values().plot(kind="barh")
    plt.title(title)
    plt.xlabel("Cantidad")
    savefig(os.path.join(OUTDIR, fname))

def histogram(series: pd.Series, bins=10, title="", xlabel="", fname="hist.png"):
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        print(f"[skip] {title}: sin datos")
        return
    plt.figure(figsize=(9, 5))
    plt.hist(s, bins=bins)
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel("Frecuencia")
    savefig(os.path.join(OUTDIR, fname))

def scatter(x: pd.Series, y: pd.Series, title="", xlabel="", ylabel="", annotate_names=None, fname="scatter.png"):
    X = pd.to_numeric(x, errors="coerce")
    Y = pd.to_numeric(y, errors="coerce")
    m = X.notna() & Y.notna()
    if m.sum() == 0:
        print(f"[skip] {title}: sin datos")
        return
    plt.figure(figsize=(7, 6))
    plt.scatter(X[m], Y[m], alpha=0.6, s=30)
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)

    if annotate_names is not None and "nombre_completo" in df.columns:
        # Anota algunos puntos (los más altos en Y, por ejemplo)
        sub = df[m].copy()
        sub["__x"] = X[m]
        sub["__y"] = Y[m]
        sub = sub.sort_values("__y", ascending=False).head(8)
        for _, r in sub.iterrows():
            name = str(r["nombre_completo"])[:20]
            plt.annotate(name, (r["__x"], r["__y"]), xytext=(5, 5), textcoords="offset points", fontsize=8)

    savefig(os.path.join(OUTDIR, fname))

def donut(value: float, title="", center_text="", fname="donut.png"):
    # value en porcentaje [0..100]
    v = max(0, min(100, float(value)))
    plt.figure(figsize=(5, 5))
    vals = [v, 100 - v]
    wedges, _ = plt.pie(vals, startangle=90, wedgeprops=dict(width=0.35))
    plt.title(title)
    plt.text(0, 0, center_text or f"{v:.0f}%", ha="center", va="center", fontsize=16)
    savefig(os.path.join(OUTDIR, fname))

# ──────────────────────────────────────────────────────────────────────────────
# GRÁFICOS
# ──────────────────────────────────────────────────────────────────────────────

# 1) Top profesiones
if "profesion" in df.columns:
    top_counts_barh(df["profesion"], top=10, title="Top profesiones", fname="top_profesiones.png")

# 2) Top últimas empresas (fuente)
if "ultima_exp_laboral_empresa" in df.columns:
    top_counts_barh(df["ultima_exp_laboral_empresa"], top=10, title="Top empresas (última experiencia)", fname="top_empresas.png")

# 3) Histograma de experiencia total / experiencia
if "experiencia_total" in df.columns:
    histogram(df["experiencia_total"], bins=12, title="Distribución de experiencia total (años)", xlabel="Años", fname="hist_experiencia_total.png")
elif "experiencia" in df.columns:
    histogram(df["experiencia"], bins=12, title="Distribución de experiencia (años)", xlabel="Años", fname="hist_experiencia.png")

# 4) Distribución de nota
if "nota" in df.columns:
    histogram(df["nota"], bins=10, title="Distribución de nota", xlabel="Nota", fname="hist_nota.png")

# 5) Distribución de ranking (barra)
if "ranking" in df.columns:
    r = pd.to_numeric(df["ranking"], errors="coerce").dropna()
    if not r.empty:
        counts = r.clip(lower=1, upper=10).round().astype(int).value_counts().sort_index()
        plt.figure(figsize=(8,4))
        counts.plot(kind="bar")
        plt.title("Distribución de ranking (1–10)")
        plt.xlabel("Ranking")
        plt.ylabel("Cantidad")
        savefig(os.path.join(OUTDIR, "ranking_dist.png"))

# 6) Scatter: experiencia vs ranking
if "experiencia_total" in df.columns and "ranking" in df.columns:
    scatter(
        x=df["experiencia_total"],
        y=df["ranking"],
        title="Experiencia vs Ranking",
        xlabel="Experiencia total (años)",
        ylabel="Ranking",
        annotate_names=True,
        fname="scatter_exp_vs_ranking.png"
    )

# 7) Donut de aceptación (regla simple: nota >= 6)
accept_rate = None
if "nota" in df.columns:
    s = pd.to_numeric(df["nota"], errors="coerce")
    accept_rate = (100 * (s >= 6).mean()) if len(s.dropna()) else 0
    donut(accept_rate, title="Tasa de aceptación (nota ≥ 6)", center_text=f"{accept_rate:.0f}%", fname="donut_aceptacion.png")

print("✅ Gráficos guardados en:", os.path.abspath(OUTDIR))
