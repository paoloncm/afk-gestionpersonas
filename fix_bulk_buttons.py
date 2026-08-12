import re

with open('static/dashboard-v2.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Make the bulk buttons open the modal
js = js.replace("$('#btn-bulk-tec02')?.addEventListener('click', () => generateReport('tec02'));", "$('#btn-bulk-tec02')?.addEventListener('click', () => openTecModal('tec02', true));")
js = js.replace("$('#btn-bulk-tec02a')?.addEventListener('click', () => generateReport('tec02a'));", "$('#btn-bulk-tec02a')?.addEventListener('click', () => openTecModal('tec02a', true));")

# Update openTecModal to accept fromBulk
js = js.replace("window.openTecModal = async function(type) {", "window.openTecModal = async function(type, fromBulk = false) {")

# If fromBulk is true, copy the selectedCandidateIds (which is a Set) to selectedTecIds
injection = """
    selectedTecIds.clear();
    if (fromBulk && typeof selectedCandidateIds !== 'undefined') {
        selectedCandidateIds.forEach(id => selectedTecIds.add(id));
    }
"""
js = js.replace("selectedTecIds.clear();", injection)

with open('static/dashboard-v2.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('Arreglado los botones bulk')
