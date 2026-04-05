import io
import os
import zipfile
import openpyxl
from copy import copy

class StarkReportGenerator:
    """Motor de Generación de Reportes Técnicos Nivel Stark (TEC-02 / TEC-02A) basado en Excel."""

    def __init__(self, templates_dir="static/templates"):
        self.templates_dir = templates_dir
        self.tec02_path = os.path.join(templates_dir, "tec02_template.xlsx")
        self.tec02a_path = os.path.join(templates_dir, "tec02-A_template.xlsx")

    def _fill_experience_table(self, sheet, start_row, exp_text):
        """Inyecta la experiencia parseada en el Excel."""
        if not exp_text: return
        
        lines = exp_text.split('\n')
        current_row = start_row
        for line in lines:
            if not line.strip(): continue
            
            # Formato: 2010-2012 CARGO - EMPRESA - FAENA
            parts = line.split('-', 3)
            
            # TEC-02 standard columns: C=Periodo, D=Cargo, G=Empresa, J=Faena/Proyecto (approx from ref errors)
            # En TEC-02 template, vimos C36, J36, etc.
            if len(parts) >= 1: sheet.cell(row=current_row, column=3).value = parts[0].strip() # C
            if len(parts) >= 2: sheet.cell(row=current_row, column=4).value = parts[1].strip() # D
            if len(parts) >= 3: sheet.cell(row=current_row, column=7).value = parts[2].strip() # G (guessing)
            if len(parts) >= 4: sheet.cell(row=current_row, column=10).value = parts[3].strip() # J
            current_row += 1

    def generate_tec02(self, candidate):
        """Genera el Anexo TEC-02 (Experiencia General) usando la plantilla Excel."""
        wb = openpyxl.load_workbook(self.tec02_path)
        sheet = wb.active
        
        # Mapeo Stark detectado para TEC-02
        # C16: Nombre, J16: Cargo, O16: Título
        sheet["C16"] = str(candidate.get("nombre_completo", "")).upper()
        sheet["J16"] = str(candidate.get("cargo_a_desempenar", "")).upper()
        sheet["O16"] = str(candidate.get("profesion", "")).upper()
        
        # Inyectar Experiencia General (C36 en adelante)
        self._fill_experience_table(sheet, 36, candidate.get("experiencia_general", ""))

        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target

    def generate_tec02a(self, candidate):
        """Genera el Anexo TEC-02A (Experiencia Específica) usando la plantilla Excel."""
        wb = openpyxl.load_workbook(self.tec02a_path)
        sheet = wb.active
        
        # Mapeo Stark detectado para TEC-02A
        # B18: Nombre, B22: Cargo
        sheet["B18"] = str(candidate.get("nombre_completo", "")).upper()
        sheet["B22"] = str(candidate.get("cargo_a_desempenar", "")).upper()
        
        # Inyectar Experiencia Específica (B42 en adelante)
        # En TEC-02A la experiencia suele estar en una sola columna B con saltos de línea o filas
        exp_text = candidate.get("experiencia_especifica", "")
        if exp_text:
            lines = exp_text.split('\n')
            for i, line in enumerate(lines):
                if line.strip():
                    sheet.cell(row=42 + i, column=2).value = line.strip()

        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target

    def create_bulk_zip(self, candidates, report_type):
        """Crea un ZIP con las planillas de múltiples candidatos."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for cand in candidates:
                if report_type == 'tec02':
                    file_data = self.generate_tec02(cand)
                    filename = f"TEC-02_{cand['nombre_completo'].replace(' ', '_')}.xlsx"
                else:
                    file_data = self.generate_tec02a(cand)
                    filename = f"TEC-02A_{cand['nombre_completo'].replace(' ', '_')}.xlsx"
                
                zip_file.writestr(filename, file_data.getvalue())
        
        zip_buffer.seek(0)
        return zip_buffer
