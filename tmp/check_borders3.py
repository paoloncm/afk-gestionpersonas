import openpyxl

wb = openpyxl.load_workbook("static/templates/tec02-A_template.xlsx")
ws = wb.active

for col in range(2, 27):
    cell = ws.cell(row=59, column=col)
    b = cell.border
    if b and (b.bottom.style or b.top.style or b.left.style or b.right.style):
        print(f"Col {col}: top={b.top.style}, bottom={b.bottom.style}, left={b.left.style}, right={b.right.style}")
