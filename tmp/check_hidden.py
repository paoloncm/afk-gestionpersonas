import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

for row_idx, row_dim in ws.row_dimensions.items():
    if row_dim.hidden:
        print(f"Row {row_idx} is hidden!")
