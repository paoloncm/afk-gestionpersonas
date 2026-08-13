import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
sheet = wb.active

for mr in sheet.merged_cells.ranges:
    if mr.min_row >= 56:
        print(f"Row >= 56 merge: {mr.coord}")
