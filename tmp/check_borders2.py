import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

for row in range(50, 65):
    has_border = False
    for col in range(2, 27):
        cell = ws.cell(row=row, column=col)
        b = cell.border
        if b and (b.bottom.style or b.top.style):
            print(f"Row {row}, Col {col}: top={b.top.style}, bottom={b.bottom.style}")
            has_border = True
    if has_border:
        print(f"--- End of Row {row} ---")
