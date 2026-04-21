import io
import os
import openpyxl
from openpyxl.utils.cell import get_column_letter

class StarkReportGenerator:
    """Motor de Generación de Reportes Técnicos Nivel Stark (Arquitectura Dual)."""

    def __init__(self, templates_dir="static/templates"):
        self.templates_dir = templates_dir
        # Buscamos primero en raíz, luego en templates_dir
        self.tec02_path = self._find_template("TEC-02_templates.xlsx")
        self.tec02a_path = self._find_template("tec02-A_template.xlsx")

    def _find_template(self, filename):
        """Busca en raíz y luego en static/templates."""
        if os.path.exists(filename):
            return filename
        return os.path.join(self.templates_dir, filename)

    def _get_master_cell_coord(self, sheet, cell_ref):
        for merged_range in sheet.merged_cells.ranges:
            if cell_ref in merged_range:
                return merged_range.coord.split(':')[0]
        return cell_ref

    def _safe_write(self, sheet, cell_ref, value):
        try:
            master_ref = self._get_master_cell_coord(sheet, cell_ref)
            sheet[master_ref] = value
        except Exception:
            pass

    def _safe_write_rc(self, sheet, row, col, value):
        coord = f"{get_column_letter(col)}{row}"
        self._safe_write(sheet, coord, value)

    def generate_tec02_summary(self, candidates):
        """Genera un RESUMEN TABULAR (TEC-02) con todos los candidatos como filas."""
        wb = openpyxl.load_workbook(self.tec02_path)
        sheet = wb.active
        
        # HEADER STARK (Razón Social / Representante / Fecha)
        self._safe_write(sheet, "C9", "AFK LIMITADA")
        self._safe_write(sheet, "C11", "PAOLO NAVARRO")
        
        # Fecha en formato Stark (D-M-YYYY)
        from datetime import datetime
        fecha_stark = datetime.now().strftime("%d-%m-%Y")
        self._safe_write(sheet, "V11", fecha_stark)

        # Comenzamos la inserción en la fila 17 (según inspección visual del encabezado)
        start_row = 17
        for i, cand in enumerate(candidates):
            current_row = start_row + i
            # Col B (Nº)
            self._safe_write_rc(sheet, current_row, 2, i + 1)
            # Col C (NOMBRE COMPLETO)
            self._safe_write_rc(sheet, current_row, 3, str(cand.get("nombre_completo", "")).upper())
            # Col J (CARGO A DESEMPEÑAR)
            self._safe_write_rc(sheet, current_row, 10, str(cand.get("cargo_a_desempenar", cand.get("cargo", ""))).upper())
            # Col O (TÍTULO PROFESIONAL)
            self._safe_write_rc(sheet, current_row, 15, str(cand.get("profesion", "")).upper())
            # Col T (AÑOS EXP TOTAL - A)
            self._safe_write_rc(sheet, current_row, 20, cand.get("experiencia_total", "0"))
            # Col V (EXP EN LA EMPRESA - B)
            self._safe_write_rc(sheet, current_row, 22, cand.get("experiencia_en_empresa_actual", "—"))
            # Col X (EXP EN EL CARGO - C)
            self._safe_write_rc(sheet, current_row, 24, cand.get("exp_cargo_actual", "—"))
             # Col Z (EXP PROYECTOS SIMILARES - D)
            self._safe_write_rc(sheet, current_row, 26, cand.get("exp_proy_similares", "—"))
        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target

    def generate_tec02a_workbook(self, candidates):
        """Genera un archivo con MÚLTIPLES HOJAS (TEC-02A), una por cada perfil de candidato."""
        wb = openpyxl.load_workbook(self.tec02a_path)
        template_sheet = wb.active
        original_title = template_sheet.title
        
        for cand in candidates:
            # Clonar la pestaña de perfil
            new_sheet = wb.copy_worksheet(template_sheet)
            
            # Nombrar la pestaña (máx 31 caracteres)
            nombre = str(cand.get("nombre_completo", "Candidato"))[:25].strip()
            new_sheet.title = f"{nombre}_{str(cand.get('id', ''))[:4]}"
            
            # Inyectar datos en la ficha individual (Anexo TEC-02A Stark)
            # ---------------------------------------------------------
            # B17: Nombre
            self._safe_write(new_sheet, "B17", str(cand.get("nombre_completo", "")).upper())
            # B19: Título Profesional
            self._safe_write(new_sheet, "B19", str(cand.get("profesion", "")).upper())
            # B21: Cargo Destino
            self._safe_write(new_sheet, "B21", str(cand.get("cargo_a_desempenar", "")).upper())
            
            # 1. BLOQUE EXPERIENCIA GENERAL (Header Row 23, Target B24)
            exp_gen = cand.get("experiencia_general", "")
            if exp_gen:
                self._safe_write(new_sheet, "B24", str(exp_gen).strip())

            # 2. BLOQUE EXPERIENCIA ESPECÍFICA (Header Row 31, Target B32)
            exp_esp = cand.get("experiencia_especifica", "")
            if exp_esp:
                self._safe_write(new_sheet, "B33", str(exp_esp).strip())
            
            # 3. BLOQUE OTRAS EXPERIENCIAS (Header Row 40, Target B41)
            exp_otras = cand.get("otras_experiencias", "")
            if exp_otras:
                self._safe_write(new_sheet, "B41", str(exp_otras).strip())
            
            # 4. BLOQUE ANTECEDENTES ACADÉMICOS (Header Row 48, Target B49)
            aca = cand.get("antecedentes_academicos", "")
            if aca:
                self._safe_write(new_sheet, "B49", str(aca).strip())
            
        # Borrar la hoja original de plantilla
        if len(wb.sheetnames) > 1:
            wb.remove(wb[original_title])
            
        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target
