#!/bin/bash
set -e

WORKSPACE_DIR="/Volumes/Macintosh HD - Data/Users/macair/hris-sistem"
ANDROID_DIR="$WORKSPACE_DIR/hris-android"
DEPLOY_DIR="$WORKSPACE_DIR/deploy-artifacts"
ARTIFACT_DIR="/Users/macbookargun/.gemini/antigravity/brain/0e41943c-cca6-423f-9386-8fa58626ea2b"

mkdir -p "$DEPLOY_DIR"
mkdir -p "$ARTIFACT_DIR"

cd "$ANDROID_DIR"

echo "=== Running Flutter Clean ==="
flutter clean

# ==========================================
# 1. BUILD PHONE EDITION
# ==========================================
echo "=== Configuring Phone Edition ==="
# Ensure isTabletEdition = false in lib/config/api_client.dart
sed -i '' 's/static bool isTabletEdition = true;/static bool isTabletEdition = false;/g' lib/config/api_client.dart || true
# Ensure android:label="HRIS Employee" in AndroidManifest.xml
sed -i '' 's/android:label="HRIS Employee (Tablet)"/android:label="HRIS Employee"/g' android/app/src/main/AndroidManifest.xml || true
sed -i '' 's/android:label="HRIS Employee (Tablet Edition)"/android:label="HRIS Employee"/g' android/app/src/main/AndroidManifest.xml || true

echo "=== Compiling Phone Edition APK ==="
flutter build apk --release --target-platform android-arm64

echo "=== Copying Phone Edition APK ==="
if [ -f build/app/outputs/flutter-apk/app-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-release.apk "$DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_v1.0.apk"
  cp build/app/outputs/flutter-apk/app-release.apk "$ARTIFACT_DIR/BarokahGrup_Karyawan_Mobile_v1.0.apk"
elif [ -f build/app/outputs/flutter-apk/app-arm64-v8a-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_v1.0.apk"
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$ARTIFACT_DIR/BarokahGrup_Karyawan_Mobile_v1.0.apk"
fi

# ==========================================
# 2. BUILD TABLET EDITION
# ==========================================
echo "=== Configuring Tablet Edition ==="
# Set isTabletEdition = true in lib/config/api_client.dart
sed -i '' 's/static bool isTabletEdition = false;/static bool isTabletEdition = true;/g' lib/config/api_client.dart || true
# Set android:label="HRIS Employee (Tablet)" in AndroidManifest.xml
sed -i '' 's/android:label="HRIS Employee"/android:label="HRIS Employee (Tablet)"/g' android/app/src/main/AndroidManifest.xml || true

echo "=== Compiling Tablet Edition APK ==="
flutter build apk --release --target-platform android-arm64

echo "=== Copying Tablet Edition APK ==="
if [ -f build/app/outputs/flutter-apk/app-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-release.apk "$DEPLOY_DIR/BarokahGrup_Operasional_Tablet_v1.0.apk"
  cp build/app/outputs/flutter-apk/app-release.apk "$ARTIFACT_DIR/BarokahGrup_Operasional_Tablet_v1.0.apk"
elif [ -f build/app/outputs/flutter-apk/app-arm64-v8a-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$DEPLOY_DIR/BarokahGrup_Operasional_Tablet_v1.0.apk"
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$ARTIFACT_DIR/BarokahGrup_Operasional_Tablet_v1.0.apk"
fi

# ==========================================
# 3. RESTORE CONFIGS
# ==========================================
echo "=== Restoring Configurations ==="
sed -i '' 's/static bool isTabletEdition = true;/static bool isTabletEdition = false;/g' lib/config/api_client.dart || true
sed -i '' 's/android:label="HRIS Employee (Tablet)"/android:label="HRIS Employee"/g' android/app/src/main/AndroidManifest.xml || true

echo "=== Build Completed Successfully ==="
