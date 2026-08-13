import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

print(f"Print Area: {ws.print_area}")
print(f"Max Row: {ws.max_row}")
