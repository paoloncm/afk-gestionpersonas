import openpyxl
from openpyxl.styles import Border, Side
from copy import copy

file_path = "static/templates/tec02-A_template.xlsx"
wb = openpyxl.load_workbook(file_path)
sheet = wb.active

# Define the thin bottom border
thin_bottom = Border(bottom=Side(style='dotted')) # dotted looks like lines 41-44 in screenshot, or maybe 'thin'
thin_border = Side(style='thin')

ranges_to_fix = [
    (24, 31),
    (33, 39),
    (41, 47),
    (49, 55)
]

for start_row, end_row in ranges_to_fix:
    for row in range(start_row, end_row + 1):
        for col in range(2, 28): # B is 2, AA is 27
            cell = sheet.cell(row=row, column=col)
            
            # preserve existing borders (like left on B, right on AA)
            current_border = cell.border
            if current_border:
                new_border = Border(
                    left=current_border.left,
                    right=current_border.right,
                    top=current_border.top,
                    bottom=Side(style='thin') # Apply solid thin bottom border to all
                )
            else:
                new_border = Border(bottom=Side(style='thin'))
            
            cell.border = new_border

wb.save(file_path)
print("Borders fixed.")
