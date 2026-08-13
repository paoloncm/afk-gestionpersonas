import sys
import traceback
sys.path.append('c:\\Users\\Paolo\\diseño-afk')
from report_gen import StarkReportGenerator
import openpyxl

# We will patch _safe_write to print exactly what it writes
original_safe_write = StarkReportGenerator._safe_write

def patched_safe_write(self, sheet, coord, text, auto_height=False, align_center=False):
    if "YERSON" in str(text) or "ALBERTO" in str(text):
        print(f"DEBUG: Writing '{text}' to {coord} in sheet {sheet.title}")
    original_safe_write(self, sheet, coord, text, auto_height, align_center)

StarkReportGenerator._safe_write = patched_safe_write

candidates = [
    {
        "nombre_completo": "Yerson Erwin Arroyo Diaz",
        "experiencia_general": "Exp 1\nExp 2\nExp 3\nExp 4\nExp 5\nExp 6\nExp 7\nExp 8\nExp 9\nExp 10\nExp 11\nExp 12",
        "experiencia_especifica": "Esp 1",
        "otras_experiencias": "Otras 1",
        "antecedentes_academicos": "Acad 1"
    },
    {
        "nombre_completo": "Alberto Enrique Escudero Zamora",
        "experiencia_general": "Exp 1",
        "experiencia_especifica": "Esp 1",
        "otras_experiencias": "Otras 1",
        "antecedentes_academicos": "Técnico Mecánico Automotriz Diesel - Fuerza Aérea De Chile - Titulado\nTécnico En Enfermería - En Curso"
    }
]

gen = StarkReportGenerator()
wb_bytes = gen.generate_tec02a_workbook(candidates)
print("Generation successful")
