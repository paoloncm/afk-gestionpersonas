import re

with open('app.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Delete .top-actions
html = re.sub(r'<div class="top-actions">.*?</div>', '', html, flags=re.DOTALL)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Botones eliminados')
