import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
sheet = wb.active

for merged_range in sheet.merged_cells.ranges:
    coord = merged_range.coord
    if "B24" in coord or "B33" in coord or "B41" in coord or "B49" in coord:
        print(f"Found merged range: {coord}")
