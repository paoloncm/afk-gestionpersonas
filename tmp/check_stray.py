import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

max_r = 0
for r in ws.iter_rows(min_row=1000, max_row=1048576):
    for c in r:
        if c.value is not None or c.has_style:
            max_r = max(max_r, c.row)

print(f"Template max row with style/content: {max_r}")
