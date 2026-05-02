import io
import os
import openpyxl
from openpyxl.utils.cell import get_column_letter
from openpyxl.styles import Alignment

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

    def _safe_write(self, sheet, cell_ref, value, auto_height=False, chars_per_line=130):
        try:
            master_ref = self._get_master_cell_coord(sheet, cell_ref)
            sheet[master_ref] = value
            if auto_height and value:
                sheet[master_ref].alignment = Alignment(wrap_text=True, vertical='top')
                lines = str(value).split('\n')
                total_lines = 0
                for line in lines:
                    wraps = len(line) // chars_per_line
                    total_lines += (1 + wraps)
                row_idx = openpyxl.utils.cell.coordinate_from_string(master_ref)[1]
                # Excel default row height is ~15. Adding padding.
                sheet.row_dimensions[row_idx].height = max(15, total_lines * 15 + 10)
        except Exception:
            pass

    def _write_multiline(self, sheet, start_row, col_letter, text, max_rows=8, auto_height=True):
        lines = [line.rstrip('\r') for line in str(text).split('\n') if line.strip()] if text else []
        added_rows = 0
        current_row = start_row
        
        from copy import copy
        total_rows = max(len(lines), max_rows)
        
        for i in range(total_rows):
            if i >= max_rows:
                insert_idx = current_row
                sheet.insert_rows(insert_idx, 1)
                added_rows += 1
                
                # Copy style from row above
                for col in range(2, 28):
                    source_cell = sheet.cell(row=insert_idx - 1, column=col)
                    target_cell = sheet.cell(row=insert_idx, column=col)
                    if source_cell.has_style:
                        target_cell.font = copy(source_cell.font)
                        target_cell.border = copy(source_cell.border)
                        target_cell.fill = copy(source_cell.fill)
                        target_cell.number_format = copy(source_cell.number_format)
                        target_cell.protection = copy(source_cell.protection)
                        target_cell.alignment = copy(source_cell.alignment)
            
            # Openpyxl insert_rows corrupts merged cells. We MUST re-merge B:AA manually for this row.
            # First remove any corrupted merges on this row
            ranges_to_remove = []
            for mr in sheet.merged_cells.ranges:
                # If the merge is exactly on this row, remove it so we can cleanly re-merge
                if mr.min_row == current_row and mr.max_row == current_row:
                    ranges_to_remove.append(mr)
            for mr in ranges_to_remove:
                sheet.merged_cells.ranges.remove(mr)
                
            # Now explicitly merge B to AA
            sheet.merge_cells(start_row=current_row, start_column=2, end_row=current_row, end_column=27)
            
            if i < len(lines):
                line = lines[i]
                cell_ref = f"{col_letter}{current_row}"
                self._safe_write(sheet, cell_ref, line, auto_height=auto_height)
                
            current_row += 1
            
        return added_rows

    def _safe_write_rc(self, sheet, row, col, value):
        coord = f"{get_column_letter(col)}{row}"
        self._safe_write(sheet, coord, value)

    def generate_tec02_summary(self, candidates):
        """Genera un RESUMEN TABULAR (TEC-02) con todos los candidatos como filas."""
        wb = openpyxl.load_workbook(self.tec02_path)
        sheet = wb.active
        
        # HEADER STARK (Razón Social / Representante / Fecha)
        self._safe_write(sheet, "H9", "SERCOING LTDA")
        self._safe_write(sheet, "H11", "GUIDO CORTES ORDENES")
        
        # Fecha en formato Stark (D-M-YYYY)
        from datetime import datetime
        fecha_stark = datetime.now().strftime("%d-%m-%Y")
        self._safe_write(sheet, "W11", fecha_stark)

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
            # H10: Razón Social
            self._safe_write(new_sheet, "H10", "SERCOING LTDA")
            # H12: Representante Legal
            self._safe_write(new_sheet, "H12", "GUIDO CORTES ORDENES")
            # W12: Fecha
            from datetime import datetime
            fecha_stark = datetime.now().strftime("%d-%m-%Y")
            self._safe_write(new_sheet, "W12", fecha_stark)

            # H17: Nombre
            self._safe_write(new_sheet, "H17", str(cand.get("nombre_completo", "")).upper())
            # H19: Título Profesional
            self._safe_write(new_sheet, "H19", str(cand.get("profesion", "")).upper())
            # H21: Cargo Destino
            self._safe_write(new_sheet, "H21", str(cand.get("cargo_a_desempenar", "")).upper())
            # B59: Nombre
            self._safe_write(new_sheet, "B59", str(cand.get("nombre_completo", "")).upper())
            # K59 : Fecha
            from datetime import datetime
            fecha_stark = datetime.now().strftime("%d-%m-%Y")
            self._safe_write(new_sheet, "K59", fecha_stark)


            
            offset = 0
            
            # 1. BLOQUE EXPERIENCIA GENERAL (Header Row 23, Target B24 to B31 -> max 8 rows)
            exp_gen = cand.get("experiencia_general", "")
            offset += self._write_multiline(new_sheet, 24 + offset, "B", exp_gen, max_rows=8, auto_height=True)

            # 2. BLOQUE EXPERIENCIA ESPECÍFICA (Header Row 31, Target B33 to B39 -> max 7 rows)
            exp_esp = cand.get("experiencia_especifica", "")
            offset += self._write_multiline(new_sheet, 33 + offset, "B", exp_esp, max_rows=7, auto_height=True)
            
            # 3. BLOQUE OTRAS EXPERIENCIAS (Header Row 40, Target B41 to B47 -> max 7 rows)
            exp_otras = cand.get("otras_experiencias", "")
            offset += self._write_multiline(new_sheet, 41 + offset, "B", exp_otras, max_rows=7, auto_height=True)
            
            # 4. BLOQUE ANTECEDENTES ACADÉMICOS (Header Row 48, Target B49 to B55 -> max 7 rows)
            aca = cand.get("antecedentes_academicos", "")
            offset += self._write_multiline(new_sheet, 49 + offset, "B", aca, max_rows=7, auto_height=True)
            
            # 5. Fix bottom merges that openpyxl insert_rows corrupted
            bottom_merges = [
                (59, 2, 59, 8),    # B:H for Name
                (59, 11, 59, 17),  # K:Q for Date
                (65, 3, 66, 26)    # C:Z for Notes
            ]
            for r_min, c_min, r_max, c_max in bottom_merges:
                t_r_min = r_min + offset
                t_r_max = r_max + offset
                
                # Remove corrupted merges
                ranges_to_remove = []
                for mr in new_sheet.merged_cells.ranges:
                    if (mr.min_row >= t_r_min and mr.max_row <= t_r_max) or \
                       (mr.min_row <= t_r_max and mr.max_row >= t_r_min):
                        ranges_to_remove.append(mr)
                for mr in ranges_to_remove:
                    new_sheet.merged_cells.ranges.remove(mr)
                    
                # Re-apply correct merge
                new_sheet.merge_cells(start_row=t_r_min, start_column=c_min, end_row=t_r_max, end_column=c_max)
            
        # Borrar la hoja original de plantilla
        if len(wb.sheetnames) > 1:
            wb.remove(wb[original_title])
            
        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target
