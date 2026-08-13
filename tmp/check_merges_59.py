import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

for mr in ws.merged_cells.ranges:
    if mr.min_row == 59 or mr.max_row == 59:
        print(mr.coord)
