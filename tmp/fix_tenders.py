import os

file_path = r'c:\Users\Paolo\diseño-afk\static\tenders.supabase.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "return { ...c, ai_match_score: finalScore, isVector: isVectorMatch };"
replacement = """          // Intelligence Matching Details
          const matchedByIA = rsClean.filter(r => pClean.includes(r) || evClean.includes(r));
          const missByIA = rsClean.filter(r => !matchedByIA.includes(r));

          return { ...c, ai_match_score: finalScore, isVector: isVectorMatch, matched: matchedByIA, miss: missByIA };"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: File updated.")
else:
    print("ERROR: Target string not found.")
    # Show a snippet around where we expect it
    idx = content.find("ai_match_score: finalScore")
    if idx != -1:
        print("FOUND PARTIAL MATCH AT:", idx)
        print("CONTEXT:", content[idx-50:idx+100])
