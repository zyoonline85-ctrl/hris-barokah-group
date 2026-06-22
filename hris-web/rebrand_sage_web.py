import os
import re

src_dir = "/Volumes/Macintosh HD - Data/Users/macair/hris-sistem/hris-web/src"

# Define replacements
# 1. Hex codes
hex_replacements = [
    (r'#1F150C', 'var(--bg-card)'),
    (r'#1f150c', 'var(--bg-card)'),
    (r'#000000', 'var(--bg-surface)'),
    (r'#412D15', 'var(--border-color)'),
    (r'#412d15', 'var(--border-color)'),
    (r'#E1DCC9', 'var(--text-main)'),
    (r'#e1dcc9', 'var(--text-main)'),
]

# Regex for rgba(225, 220, 201, opacity)
rgba_pattern = re.compile(r'rgba\(\s*225\s*,\s*220\s*,\s*201\s*,\s*([\d.]+)\s*\)', re.IGNORECASE)

def replace_rgba(match):
    opacity_str = match.group(1)
    try:
        opacity = float(opacity_str)
        if opacity <= 0.25:
            return f"rgba(165, 182, 141, {opacity_str})"
        else:
            return f"rgba(30, 41, 59, {opacity_str})"
    except ValueError:
        return match.group(0)

def rebrand_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content
    
    # 1. Hex replacements
    for src, dst in hex_replacements:
        content = content.replace(src, dst)
    
    # 2. rgba replacements
    content = rgba_pattern.sub(replace_rgba, content)
    
    # 3. Handle #000 in styles specifically (e.g. background: '#000')
    content = re.sub(r'background:\s*["\']#000["\']', "background: 'var(--bg-surface)'", content)
    content = re.sub(r'backgroundColor:\s*["\']#000["\']', "backgroundColor: 'var(--bg-surface)'", content)
    
    if content != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Rebranded Web File: {filepath}")

# Scan all JS/JSX files
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            rebrand_file(os.path.join(root, file))

print("All web files rebranded successfully!")
