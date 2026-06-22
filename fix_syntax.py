import os

def fix_file(file_path):
    print(f"Fixing file: {file_path}")
    with open(file_path, 'r') as f:
        content = f.read()

    # Replacements for common constructor parameter syntax errors
    replacements = {
        'fontSize =': 'fontSize:',
        'fontWeight =': 'fontWeight:',
        'letterSpacing =': 'letterSpacing:',
        'strokeWidth =': 'strokeWidth:',
        'RoundedCornerShape(10)': 'RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))',
        'RoundedCornerShape(8)': 'RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))',
    }

    modified = content
    for target, replacement in replacements.items():
        modified = modified.replace(target, replacement)

    if modified != content:
        with open(file_path, 'w') as f:
            f.write(modified)
        print(f"SUCCESS: Fixed errors in {file_path}")
    else:
        print(f"No changes made to {file_path}")

def run():
    screens_dir = "/Volumes/Macintosh HD - Data/Users/macair/hris-sistem/hris-android/lib/screens"
    for filename in os.listdir(screens_dir):
        if filename.endswith(".dart"):
            fix_file(os.path.join(screens_dir, filename))

if __name__ == "__main__":
    run()
