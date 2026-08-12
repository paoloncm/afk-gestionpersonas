import re

with open('app.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Eliminar sections innecesarias
content = re.sub(r'<section class="critical-banner">.*?</section>', '', content, flags=re.DOTALL)
content = re.sub(r'<section class="hero">.*?</section>', '', content, flags=re.DOTALL)
content = re.sub(r'<section class="notice">.*?</section>', '', content, flags=re.DOTALL)
content = re.sub(r'<section class="chart-grid">.*?</section>', '', content, flags=re.DOTALL)
content = re.sub(r'<section class="two-col">.*?</section>', '', content, flags=re.DOTALL)

# 2. Simplificar estilos (eliminar neones y cambiar colores)
content = content.replace('var(--cyan)', '#f59e0b')
content = content.replace('var(--pink)', '#ef4444')
content = content.replace('var(--green)', '#10b981')
content = content.replace('var(--red)', '#ef4444')
content = content.replace('background: linear-gradient(180deg, rgba(7, 18, 37, 0.98), rgba(4, 12, 28, 0.98))', 'background: #111')
content = content.replace('background: linear-gradient(180deg, rgba(6, 22, 38, 0.98), rgba(4, 13, 28, 0.98))', 'background: #111')
content = content.replace('border: 1px solid var(--border)', 'border: 1px solid rgba(255, 255, 255, 0.1)')

# Limpiar las clases "green" y "red" de las cards que quedaran raras
content = re.sub(r'<article class="card \w+">', '<article class="card">', content)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Modificado exitosamente')
