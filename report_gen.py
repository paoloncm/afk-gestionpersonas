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
                from copy import copy
                old_align = sheet[master_ref].alignment
                new_align = copy(old_align) if old_align else Alignment()
                new_align.wrap_text = True
                new_align.vertical = 'center'
                sheet[master_ref].alignment = new_align
                
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
            
            # Openpyxl insert_rows corrupts merged cells and creates duplicates. 
            # We MUST cleanly rebuild the merged_cells.ranges list without any overlapping ranges for this row.
            new_ranges = []
            for mr in sheet.merged_cells.ranges:
                row_overlap = (mr.min_row == current_row and mr.max_row == current_row)
                col_overlap = not (mr.max_col < 2 or mr.min_col > 27)
                if not (row_overlap and col_overlap):
                    new_ranges.append(mr)
            sheet.merged_cells.ranges = new_ranges
                
            # Now explicitly merge B to AA
            try:
                sheet.merge_cells(start_row=current_row, start_column=2, end_row=current_row, end_column=27)
            except Exception:
                pass
            
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



            
            # 1. BLOQUE EXPERIENCIA GENERAL (Header Row 23, Target B24 to B31 -> max 8 rows)
            exp_gen = cand.get("experiencia_general", "")
            added1 = self._write_multiline(new_sheet, 24, "B", exp_gen, max_rows=8, auto_height=True)
            offset1 = added1

            # 2. BLOQUE EXPERIENCIA ESPECÍFICA (Header Row 31, Target B33 to B39 -> max 7 rows)
            exp_esp = cand.get("experiencia_especifica", "")
            added2 = self._write_multiline(new_sheet, 33 + offset1, "B", exp_esp, max_rows=7, auto_height=True)
            offset2 = offset1 + added2
            
            # 3. BLOQUE OTRAS EXPERIENCIAS (Header Row 40, Target B41 to B47 -> max 7 rows)
            exp_otras = cand.get("otras_experiencias", "")
            added3 = self._write_multiline(new_sheet, 41 + offset2, "B", exp_otras, max_rows=7, auto_height=True)
            offset3 = offset2 + added3
            
            # 4. BLOQUE ANTECEDENTES ACADÉMICOS (Header Row 48, Target B49 to B55 -> max 7 rows)
            aca = cand.get("antecedentes_academicos", "")
            added4 = self._write_multiline(new_sheet, 49 + offset3, "B", aca, max_rows=7, auto_height=True)
            offset4 = offset3 + added4
            
            # 5. Fix ALL merges that openpyxl insert_rows corrupted (Headers + Bottom Block)
            merges_to_enforce = [
                # Headers
                (23, 2, 23, 27), # Exp General
                (32 + offset1, 2, 32 + offset1, 27), # Exp Especifica
                (40 + offset2, 2, 40 + offset2, 27), # Otras Exp
                (48 + offset3, 2, 48 + offset3, 27), # Antecedentes Acad
                
                # Notes
                (65 + offset4, 3, 66 + offset4, 26)   # C:Z Notes
            ]
            
            # Dinámicamente detectar las celdas combinadas de la fila 59 en la plantilla original
            for mr in template_sheet.merged_cells.ranges:
                if mr.min_row == 59 and mr.max_row == 59:
                    merges_to_enforce.append((59 + offset4, mr.min_col, 59 + offset4, mr.max_col))
            
            for r_min, c_min, r_max, c_max in merges_to_enforce:
                # Completely rebuild ranges list to aggressively purge ANY overlaps and duplicates
                new_ranges = []
                for mr in new_sheet.merged_cells.ranges:
                    row_overlap = not (mr.max_row < r_min or mr.min_row > r_max)
                    col_overlap = not (mr.max_col < c_min or mr.min_col > c_max)
                    if not (row_overlap and col_overlap):
                        new_ranges.append(mr)
                new_sheet.merged_cells.ranges = new_ranges
                
                # Re-apply correct merge
                coord = f"{get_column_letter(c_min)}{r_min}:{get_column_letter(c_max)}{r_max}"
                try:
                    new_sheet.merge_cells(coord)
                except Exception:
                    pass
                
                # Re-center headers and signature labels
                if r_min in [23, 32 + offset1, 40 + offset2, 48 + offset3]:
                    master = new_sheet.cell(row=r_min, column=c_min)
                    master.alignment = Alignment(horizontal='center', vertical='center')
            
            # 6. Escribir Nombre y Fecha en la posición final correcta (después de todo el offset y fixes)
            from datetime import datetime
            fecha_stark = datetime.now().strftime("%d-%m-%Y")
            self._safe_write(new_sheet, f"E{59 + offset4}", str(cand.get("nombre_completo", "")).upper())
            self._safe_write(new_sheet, f"Q{59 + offset4}", fecha_stark)
            
            # 7. Redibujar la línea de la firma unificada (openpyxl borra las formas insertadas)
            from openpyxl.styles import Border, Side
            line_border = Border(bottom=Side(style='thin', color='000000'))
            for c_idx in range(5, 25): # Columnas E(5) hasta X(24)
                new_sheet.cell(row=59 + offset4, column=c_idx).border = line_border
            
        # Borrar la hoja original de plantilla
        if len(wb.sheetnames) > 1:
            wb.remove(wb[original_title])
            
        target = io.BytesIO()
        wb.save(target)
        target.seek(0)
        return target
