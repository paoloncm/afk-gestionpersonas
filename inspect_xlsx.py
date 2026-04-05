import openpyxl

def find_all_text(file_path):
    print(f"\n--- Finding all text in: {file_path} ---")
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        for row in sheet.iter_rows(max_row=100, max_col=10):
            for cell in row:
                if cell.value:
                    print(f"{cell.coordinate}: {cell.value}")
    except Exception as e:
        print(f"Error: {e}")

find_all_text("static/templates/tec02_template.xlsx")
print("\n" + "="*40 + "\n")
find_all_text("static/templates/tec02-A_template.xlsx")
