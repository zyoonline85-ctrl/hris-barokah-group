import os

src_dir = "/Volumes/Macintosh HD - Data/Users/macair/hris-sistem/hris-web/src"

replacements = [
    # Old colors to Cyber Tech CSS variables/hex
    ('#ede8dc', 'var(--bg-main)'),
    ('#EDE8DC', 'var(--bg-main)'),
    ('#ffffff', 'var(--bg-surface)'),
    ('#FFFFFF', 'var(--bg-surface)'),
    ('#a5b68d', 'var(--accent-primary)'),
    ('#A5B68D', 'var(--accent-primary)'),
    ('#c1cfa1', 'var(--accent-primary)'),
    ('#C1CFA1', 'var(--accent-primary)'),
    ('#e7cccc', 'var(--accent-primary)'),
    ('#E7CCCC', 'var(--accent-primary)'),
    ('#1e293b', 'var(--text-main)'),
    ('#1E293B', 'var(--text-main)'),
    
    # Muted slate text to light platinum text
    ('rgba(30, 41, 59,', 'rgba(238, 238, 238,'),
    ('rgba(30,41,59,', 'rgba(238, 238, 238,'),
    
    # Dark brown card backgrounds to transparent charcoal/dark navy cards
    ('rgba(31, 21, 12,', 'rgba(57, 62, 70,'),
    ('rgba(31,21,12,', 'rgba(57, 62, 70,'),
]

def rebrand_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Skipping {filepath} due to read error: {e}")
        return
    
    orig = content
    for src, dst in replacements:
        content = content.replace(src, dst)
        
    if content != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Rebranded: {filepath}")

# Scan all JS/JSX/CSS files in src/
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.jsx', '.js', '.css')):
            rebrand_file(os.path.join(root, file))

print("rebrand_cyber_web.py sweep completed.")
