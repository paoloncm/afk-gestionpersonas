import re

with open('static/analytics.supabase.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Fix null pointer for #headerInsightText
js = js.replace('$("#headerInsightText").textContent =', 'if ($("#headerInsightText")) $("#headerInsightText").textContent =')

with open('static/analytics.supabase.js', 'w', encoding='utf-8') as f:
    f.write(js)

with open('app.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove sidebar
html = re.sub(r'<aside class="sidebar">.*?</aside>', '', html, flags=re.DOTALL)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('static/styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Make .app 1 column
css = css.replace('grid-template-columns: 240px 1fr;', 'grid-template-columns: 1fr;')
# Eliminar el offset del bulk-bar
css = css.replace('transform: translateX(-50%) translateX(120px);', 'transform: translateX(-50%);')

with open('static/styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Arreglado exitosamente')
