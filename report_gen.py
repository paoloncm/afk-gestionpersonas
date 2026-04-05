import io
import os
import zipfile
import docx
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

class StarkReportGenerator:
    """Motor de Generación de Reportes Técnicos Nivel Stark (TEC-02 / TEC-02A)."""

    def __init__(self):
        pass

    def _create_base_doc(self, title, candidate):
        doc = docx.Document()
        
        # Estilo Global
        style = doc.styles['Normal']
        font = style.font
        font.name = 'Arial'
        font.size = Pt(10)

        # Encabezado Tipo Stark / Codelco
        header = doc.add_paragraph()
        header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run = header.add_run(title)
        run.bold = True
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(0, 51, 102)

        doc.add_paragraph("-" * 80)

        # Datos Personales
        table = doc.add_table(rows=3, cols=2)
        table.style = 'Table Grid'
        
        cells_data = [
            ("NOMBRE COMPLETO:", candidate.get("nombre_completo", "N/A")),
            ("RUT:", candidate.get("rut", "N/A")),
            ("PROFESIÓN / TÍTULO:", candidate.get("profesion", "N/A"))
        ]

        for i, (label, val) in enumerate(cells_data):
            table.cell(i, 0).text = label
            table.cell(i, 1).text = str(val).upper()
            table.cell(i, 0).paragraphs[0].runs[0].bold = True

        doc.add_paragraph("\n")
        return doc

    def _add_experience_table(self, doc, exp_text):
        """Parsea el texto YYYY-YYYY CARGO - EMPRESA - FAENA e inyecta en tabla Word."""
        doc.add_paragraph("DETALLE DE EXPERIENCIA CALIFICADA:").runs[0].bold = True
        
        table = doc.add_table(rows=1, cols=4)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        hdrs = ["PERIODO", "CARGO", "EMPRESA", "FAENA / PROYECTO"]
        for i, h in enumerate(hdrs):
            hdr_cells[i].text = h
            hdr_cells[i].paragraphs[0].runs[0].bold = True

        lines = exp_text.split('\n') if exp_text else []
        for line in lines:
            if not line.strip(): continue
            
            # Intento de parsing básico: "2010-2012 CARGO - EMPRESA - FAENA"
            # O simplemente dividir por guiones/espacios si no cumple el estándar exacto
            parts = line.split('-', 3)
            row_cells = table.add_row().cells
            
            if len(parts) >= 1: row_cells[0].text = parts[0].strip()
            if len(parts) >= 2: row_cells[1].text = parts[1].strip()
            if len(parts) >= 3: row_cells[2].text = parts[2].strip()
            if len(parts) >= 4: row_cells[3].text = parts[3].strip()
            else:
                # Si falló el split por '-', intentamos por espacio para el periodo
                subparts = line.split(' ', 1)
                if len(subparts) == 2:
                    row_cells[0].text = subparts[0]
                    row_cells[1].text = subparts[1]

    def generate_tec02(self, candidate):
        doc = self._create_base_doc("ANEXO TEC-02: EXPERIENCIA GENERAL", candidate)
        self._add_experience_table(doc, candidate.get("experiencia_general", ""))
        
        # Pie de firma
        doc.add_paragraph("\n" * 3)
        p = doc.add_paragraph("_" * 40 + "\nFIRMA DEL CANDIDATO")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

        target = io.BytesIO()
        doc.save(target)
        target.seek(0)
        return target

    def generate_tec02a(self, candidate):
        doc = self._create_base_doc("ANEXO TEC-02A: EXPERIENCIA ESPECÍFICA", candidate)
        self._add_experience_table(doc, candidate.get("experiencia_especifica", ""))
        
        doc.add_paragraph("\n" * 3)
        p = doc.add_paragraph("_" * 40 + "\nFIRMA DEL CANDIDATO")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

        target = io.BytesIO()
        doc.save(target)
        target.seek(0)
        return target

    def create_bulk_zip(self, candidates, report_type):
        """Crea un ZIP con los reportes de múltiples candidatos."""
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for cand in candidates:
                if report_type == 'tec02':
                    file_data = self.generate_tec02(cand)
                    filename = f"TEC-02_{cand['nombre_completo'].replace(' ', '_')}.docx"
                else:
                    file_data = self.generate_tec02a(cand)
                    filename = f"TEC-02A_{cand['nombre_completo'].replace(' ', '_')}.docx"
                
                zip_file.writestr(filename, file_data.getvalue())
        
        zip_buffer.seek(0)
        return zip_buffer
