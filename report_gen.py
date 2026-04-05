import io
import os
import openpyxl
from openpyxl.utils.cell import get_column_letter

class StarkReportGenerator:
    """Motor de Generación de Reportes Técnicos Nivel Stark (Consolidado Excel Multi-Hoja)."""

    def __init__(self, templates_dir="static/templates"):
        self.templates_dir = templates_dir
        self.tec02_path = os.path.join(templates_dir, "tec02_template.xlsx")
        self.tec02a_path = os.path.join(templates_dir, "tec02-A_template.xlsx")

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

    def _fill_candidate_data(self, sheet, candidate, report_type):
        """Inyecta los datos en la hoja activa/clonada."""
        if report_type == 'tec02':
            self._safe_write(sheet, "C15", str(candidate.get("nombre_completo", "")).upper())
            self._safe_write(sheet, "J15", str(candidate.get("cargo_a_desempenar", "")).upper())
            self._safe_write(sheet, "O15", str(candidate.get("profesion", "")).upper())
            
            exp_text = candidate.get("experiencia_general", "")
            if exp_text:
                lines = exp_text.split('\n')
                for i, line in enumerate(lines):
                    if not line.strip(): continue
                    parts = line.split('-', 3)
                    # Col C=3, D=4, G=7, J=10
                    if len(parts) >= 1: self._safe_write_rc(sheet, 36+i, 3, parts[0].strip())
                    if len(parts) >= 2: self._safe_write_rc(sheet, 36+i, 4, parts[1].strip())
                    if len(parts) >= 3: self._safe_write_rc(sheet, 36+i, 7, parts[2].strip())
                    if len(parts) >= 4: self._safe_write_rc(sheet, 36+i, 10, parts[3].strip())
        else:
            self._safe_write(sheet, "B17", str(candidate.get("nombre_completo", "")).upper())
            self._safe_write(sheet, "B21", str(candidate.get("cargo_a_desempenar", "")).upper())
            
            exp_text = candidate.get("experiencia_especifica", "")
            if exp_text:
                lines = exp_text.split('\n')
                for i, line in enumerate(lines):
                    if line.strip():
                        self._safe_write_rc(sheet, 42 + i, 2, line.strip())

    def create_consolidated_workbook(self, candidates, report_type):
        """Genera un único Workbook con una hoja por cada candidato clonada de la plantilla."""
        template_path = self.tec02_path if report_type == 'tec02' else self.tec02a_path
        wb = openpyxl.load_workbook(template_path)
        template_sheet = wb.active
        
        # Guardamos el nombre original de la plantilla para borrarla al final
        original_title = template_sheet.title
        
        for cand in candidates:
            # Clonar la plantilla
            new_sheet = wb.copy_worksheet(template_sheet)
            
            # Nombrar la nueva pestaña (máx 31 caracteres en Excel)
            nombre = cand.get("nombre_completo", "Candidato")[:25].replace(':', '').replace('*', '').replace('?', '').replace('/', '').replace('\\', '').replace('[', '').replace(']', '')
            new_sheet.title = f"{nombre}_{str(cand.get('id', ''))[:4]}"
            
            # Rellenar con info
            self._fill_candidate_data(new_sheet, cand, report_type)
            
        # Eliminar la hoja de plantilla vacía inicial
        if len(wb.sheetnames) > 1:
            wb.remove(wb[original_title])
            
        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target
