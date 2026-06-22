import os
import re

lib_dir = "/Volumes/Macintosh HD - Data/Users/macair/hris-sistem/hris-android/lib"

# Define the replacements preserving opacity
replacements = [
    (re.compile(r'0x([0-9a-fA-F]{2})F8FAFC', re.IGNORECASE), r'0x\g<1>EDE8DC'),
    (re.compile(r'0x([0-9a-fA-F]{2})0F172A', re.IGNORECASE), r'0x\g<1>1E293B'),
    (re.compile(r'0x([0-9a-fA-F]{2})2563EB', re.IGNORECASE), r'0x\g<1>A5B68D'),
    (re.compile(r'0x([0-9a-fA-F]{2})E2E8F0', re.IGNORECASE), r'0x\g<1>E7CCCC'),
]

def rebrand_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content
    
    # Apply regex replacements
    for pattern, replacement in replacements:
        content = pattern.sub(replacement, content)
        
    if content != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Rebranded: {filepath}")

# Scan all dart files
for root, dirs, files in os.walk(lib_dir):
    for file in files:
        if file.endswith('.dart'):
            rebrand_file(os.path.join(root, file))

print("All Dart files rebranded successfully!")
