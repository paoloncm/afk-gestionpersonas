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
        
        # Comenzamos la inserción en la fila 19 (según inspección visual del encabezado)
        start_row = 19
        for i, cand in enumerate(candidates):
            current_row = start_row + i
            # Col B (Nº)
            self._safe_write_rc(sheet, current_row, 2, i + 1)
            # Col C (NOMBRE COMPLETO)
            self._safe_write_rc(sheet, current_row, 3, str(cand.get("nombre_completo", "")).upper())
            # Col D (PROFESION / ESPECIALIDAD)
            self._safe_write_rc(sheet, current_row, 4, str(cand.get("profesion", "")).upper())
            # Col E (AÑOS EXP TOTAL)
            self._safe_write_rc(sheet, current_row, 5, cand.get("experiencia_total", "0"))
            # Col F (NOTA AFK)
            self._safe_write_rc(sheet, current_row, 6, cand.get("nota", "—"))

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
            
            # Inyectar datos en la ficha individual (TEC-02A)
            # B17: Nombre, B21: Cargo
            self._safe_write(new_sheet, "B17", str(cand.get("nombre_completo", "")).upper())
            self._safe_write(new_sheet, "B21", str(cand.get("cargo_a_desempenar", "")).upper())
            
            # Tabla de Experiencia Específica (Row 42+)
            exp_text = cand.get("experiencia_especifica", "")
            if exp_text:
                lines = exp_text.split('\n')
                for i, line in enumerate(lines):
                    if line.strip():
                        self._safe_write_rc(new_sheet, 42 + i, 2, line.strip())
            
        # Borrar la hoja original de plantilla
        if len(wb.sheetnames) > 1:
            wb.remove(wb[original_title])
            
        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target
