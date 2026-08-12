import re

with open('static/styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

modal_css = """
/* Modal TEC */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.modal-content {
  width: 90%; max-width: 700px;
  background: var(--panel);
  padding: 24px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
}
.stark-input {
  background: rgba(255,255,255,0.03); border: 1px solid var(--border);
  color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px;
  outline: none; transition: 0.2s;
}
.stark-input:focus { border-color: var(--cyan); background: rgba(255,255,255,0.06); }
"""

if '.modal-overlay' not in css:
    css += '\n' + modal_css

with open('static/styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('styles.css actualizado')
