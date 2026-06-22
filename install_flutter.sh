#!/bin/bash
set -e

echo "=== Memulai Instalasi SDK Flutter ==="

DEV_DIR="/Volumes/Macintosh HD - Data/Users/macair/development"
ZIP_PATH="$DEV_DIR/flutter.zip"
FLUTTER_BIN="$DEV_DIR/flutter/bin"

echo "1. Membuat direktori: $DEV_DIR"
mkdir -p "$DEV_DIR"

echo "2. Mengunduh Flutter SDK x64 (1.2 GB)..."
curl -L -o "$ZIP_PATH" https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_3.22.2-stable.zip

echo "3. Mengekstrak file zip..."
unzip -q "$ZIP_PATH" -d "$DEV_DIR"

echo "4. Menghapus file zip sementara..."
rm "$ZIP_PATH"

echo "5. Menambahkan Flutter ke .zshrc secara permanen..."
echo "export PATH=\"\$PATH:$FLUTTER_BIN\"" >> /Users/macbookargun/.zshrc

echo "=== Instalasi SDK Flutter Selesai dengan Sukses! ==="
