import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

hidden_rows = []
for row_idx, row_dim in ws.row_dimensions.items():
    if row_dim.hidden:
        hidden_rows.append(row_idx)

print("Hidden rows:", hidden_rows)
