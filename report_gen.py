import io
import os
import zipfile
import openpyxl
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string, get_column_letter

class StarkReportGenerator:
    """Motor de Generación de Reportes Técnicos Nivel Stark (TEC-02 / TEC-02A) basado en Excel."""

    def __init__(self, templates_dir="static/templates"):
        self.templates_dir = templates_dir
        self.tec02_path = os.path.join(templates_dir, "tec02_template.xlsx")
        self.tec02a_path = os.path.join(templates_dir, "tec02-A_template.xlsx")

    def _get_master_cell_coord(self, sheet, cell_ref):
        """Busca si una celda es parte de un rango combinado y retorna la celda maestra (Top-Left)."""
        for merged_range in sheet.merged_cells.ranges:
            if cell_ref in merged_range:
                return merged_range.coord.split(':')[0]
        return cell_ref

    def _safe_write(self, sheet, cell_ref, value):
        """Escribe en una celda asegurando que si está combinada, se escriba en la maestra."""
        try:
            master_ref = self._get_master_cell_coord(sheet, cell_ref)
            sheet[master_ref] = value
        except Exception as e:
            print(f"[JARVIS] Warning: Failed to write to {cell_ref}: {e}")

    def _safe_write_rc(self, sheet, row, col, value):
        """Escribe usando fila/columna con protección de celdas combinadas."""
        coord = f"{get_column_letter(col)}{row}"
        self._safe_write(sheet, coord, value)

    def _fill_experience_table(self, sheet, start_row, exp_text, type='tec02'):
        """Inyecta la experiencia parseada en el Excel con protección absoluta."""
        if not exp_text: return
        
        lines = exp_text.split('\n')
        current_row = start_row
        for line in lines:
            if not line.strip(): continue
            
            parts = line.split('-', 3)
            # TEC-02: Col C=3, D=4, G=7, J=10
            # TEC-02A: Col B=2
            if type == 'tec02':
                if len(parts) >= 1: self._safe_write_rc(sheet, current_row, 3, parts[0].strip())
                if len(parts) >= 2: self._safe_write_rc(sheet, current_row, 4, parts[1].strip())
                if len(parts) >= 3: self._safe_write_rc(sheet, current_row, 7, parts[2].strip())
                if len(parts) >= 4: self._safe_write_rc(sheet, current_row, 10, parts[3].strip())
            else:
                self._safe_write_rc(sheet, current_row, 2, line.strip())
            
            current_row += 1

    def generate_tec02(self, candidate):
        """Anexo TEC-02 con Protección Absoluta Sharding."""
        wb = openpyxl.load_workbook(self.tec02_path)
        sheet = wb.active
        
        # Inyección Táctica en Celdas Maestras
        self._safe_write(sheet, "C15", str(candidate.get("nombre_completo", "")).upper())
        self._safe_write(sheet, "J15", str(candidate.get("cargo_a_desempenar", "")).upper())
        self._safe_write(sheet, "O15", str(candidate.get("profesion", "")).upper())
        
        # Tabla de Experiencia desde Row 36
        self._fill_experience_table(sheet, 36, candidate.get("experiencia_general", ""), 'tec02')

        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target

    def generate_tec02a(self, candidate):
        """Anexo TEC-02A con Protección Absoluta Sharding."""
        wb = openpyxl.load_workbook(self.tec02a_path)
        sheet = wb.active
        
        self._safe_write(sheet, "B17", str(candidate.get("nombre_completo", "")).upper())
        self._safe_write(sheet, "B21", str(candidate.get("cargo_a_desempenar", "")).upper())
        
        # Tabla de Experiencia desde Row 42
        self._fill_experience_table(sheet, 42, candidate.get("experiencia_especifica", ""), 'tec02a')

        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target

    def create_bulk_zip(self, candidates, report_type):
        """Crea un ZIP robusto."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for cand in candidates:
                try:
                    if report_type == 'tec02':
                        file_data = self.generate_tec02(cand)
                        filename = f"TEC-02_{cand['nombre_completo'].replace(' ', '_')}.xlsx"
                    else:
                        file_data = self.generate_tec02a(cand)
                        filename = f"TEC-02A_{cand['nombre_completo'].replace(' ', '_')}.xlsx"
                    
                    zip_file.writestr(filename, file_data.getvalue())
                except Exception as cand_err:
                    print(f"[JARVIS] Critical fail for candidate {cand.get('id')}: {cand_err}")
                    continue
        
        zip_buffer.seek(0)
        return zip_buffer
