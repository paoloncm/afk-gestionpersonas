import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

for cell_ref in ['H17', 'H19', 'H21', 'B24', 'B33']:
    alignment = ws[cell_ref].alignment
    print(f"{cell_ref}: horizontal={alignment.horizontal}, vertical={alignment.vertical}, wrap_text={alignment.wrap_text}")
