import os

lib_dir = "/Volumes/Macintosh HD - Data/Users/macair/hris-sistem/hris-android/lib"

replacements = [
    # Backgrounds: Alabaster -> Dark Navy
    ("Color(0xFFEDE8DC)", "Color(0xFF222831)"),
    ("Color(0xffede8dc)", "Color(0xFF222831)"),
    ("const Color(0xFFEDE8DC)", "const Color(0xFF222831)"),
    
    # Cards: White -> Charcoal Dark
    ("Color(0xFFFFFFFF)", "Color(0xFF393E46)"),
    ("Color(0xffffffff)", "Color(0xFF393E46)"),
    ("const Color(0xFFFFFFFF)", "const Color(0xFF393E46)"),

    # Secondary background/accent: Soft Sage -> Electric Cyan / Border
    ("Color(0xFFE7CCCC)", "Color(0xFF00ADB5)"),
    ("Color(0xffe7cccc)", "Color(0xFF00ADB5)"),
    ("const Color(0xFFE7CCCC)", "const Color(0xFF00ADB5)"),

    # Main Accent: Sage Green -> Electric Cyan
    ("Color(0xFFA5B68D)", "Color(0xFF00ADB5)"),
    ("Color(0xffa5b68d)", "Color(0xFF00ADB5)"),
    ("const Color(0xFFA5B68D)", "const Color(0xFF00ADB5)"),

    # Alt Accent: Matcha -> Electric Cyan
    ("Color(0xFFC1CFA1)", "Color(0xFF00ADB5)"),
    ("Color(0xffc1cfa1)", "Color(0xFF00ADB5)"),
    ("const Color(0xFFC1CFA1)", "const Color(0xFF00ADB5)"),

    # Texts: Slate Dark Grey -> Light Platinum
    ("Color(0xFF1E293B)", "Color(0xFFEEEEEE)"),
    ("Color(0xff1e293b)", "Color(0xFFEEEEEE)"),
    ("const Color(0xFF1E293B)", "const Color(0xFFEEEEEE)"),

    # Text opacity variations
    ("Color(0x8D1E293B)", "Color(0x8DEEEEEE)"),
    ("Color(0x8d1e293b)", "Color(0x8DEEEEEE)"),
    ("Color(0x1A1E293B)", "Color(0x1AEEEEEE)"),
    ("Color(0x1aa1e293b)", "Color(0x1AEEEEEE)"),
    ("Color(0x621E293B)", "Color(0x62EEEEEE)"),
    ("Color(0x621e293b)", "Color(0x62EEEEEE)"),
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

# Scan all dart files
for root, dirs, files in os.walk(lib_dir):
    for file in files:
        if file.endswith('.dart'):
            rebrand_file(os.path.join(root, file))

print("rebrand_cyber_android.py sweep completed.")
