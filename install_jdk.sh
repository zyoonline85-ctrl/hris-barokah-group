#!/bin/bash
set -e

echo "=== Memulai Instalasi JDK 17 ==="

DEV_DIR="/Volumes/Macintosh HD - Data/Users/macair/development"
JDK_ZIP="$DEV_DIR/jdk.tar.gz"
JDK_DIR="$DEV_DIR/jdk"

mkdir -p "$DEV_DIR"
mkdir -p "$JDK_DIR"

echo "1. Mengunduh OpenJDK 17..."
curl -L -o "$JDK_ZIP" "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_mac_hotspot_17.0.11_9.tar.gz"

echo "2. Mengekstrak JDK..."
tar -xzf "$JDK_ZIP" -C "$JDK_DIR" --strip-components=1

echo "3. Menghapus file zip sementara..."
rm "$JDK_ZIP"

echo "4. Menambahkan JAVA_HOME ke .zshrc secara permanen..."
echo "export JAVA_HOME=\"$JDK_DIR/Contents/Home\"" >> /Users/macbookargun/.zshrc
echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\"" >> /Users/macbookargun/.zshrc

echo "=== Instalasi JDK Selesai dengan Sukses! ==="
