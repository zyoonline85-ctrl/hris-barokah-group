#!/bin/bash
set -e

# =====================================================
# HRIS BAROKAH - Build Script (Updated)
# Build kedua APK: Mobile Karyawan + Tablet Operasional
# API URL: https://api.barokahgroupindonesia.tech/api
# =====================================================

WORKSPACE_DIR="/Volumes/Macintosh HD - Data/Users/macair/hris-sistem"
ANDROID_DIR="$WORKSPACE_DIR/hris-android"
DEPLOY_DIR="$WORKSPACE_DIR/deploy-artifacts"
ARTIFACT_DIR="/Users/macbookargun/.gemini/antigravity/brain/f24306c1-2e02-48bd-a9c4-d35f9a866597"
MOBILE_VER="v1.3"
TABLET_VER="v1.1"

# --- Environment Variables ---
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export JAVA_HOME="/Volumes/Macintosh HD - Data/Users/macair/development/jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/30.0.3:$PATH"

mkdir -p "$DEPLOY_DIR"
mkdir -p "$ARTIFACT_DIR"

cd "$ANDROID_DIR"

echo "=== [HRIS Barokah Build] API Target: https://api.barokahgroupindonesia.tech/api ==="
echo "=== Running Flutter Clean ==="
flutter clean
flutter pub get

# ==========================================
# 1. BUILD PHONE EDITION (Mobile Karyawan)
# ==========================================
echo ""
echo "=== [1/2] Building Mobile Karyawan (Phone Edition) ==="
sed -i '' 's/static bool isTabletEdition = true;/static bool isTabletEdition = false;/g' lib/config/api_client.dart 2>/dev/null || true
sed -i '' 's/android:label="HRIS Employee (Tablet)"/android:label="HRIS Employee"/g' android/app/src/main/AndroidManifest.xml 2>/dev/null || true
sed -i '' 's/android:label="HRIS Employee (Tablet Edition)"/android:label="HRIS Employee"/g' android/app/src/main/AndroidManifest.xml 2>/dev/null || true

flutter build apk --release --target-platform android-arm64

echo "=== Copying Phone Edition APK ==="
if [ -f build/app/outputs/flutter-apk/app-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-release.apk "$DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
  cp build/app/outputs/flutter-apk/app-release.apk "$ARTIFACT_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
  echo "✅ Mobile APK berhasil: $DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
elif [ -f build/app/outputs/flutter-apk/app-arm64-v8a-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$ARTIFACT_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
  echo "✅ Mobile APK berhasil: $DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
else
  echo "❌ ERROR: APK Mobile tidak ditemukan di build output!"
  exit 1
fi

# ==========================================
# 2. BUILD TABLET EDITION (Operasional)
# ==========================================
echo ""
echo "=== [2/2] Building Tablet Operasional (Landscape Edition) ==="
sed -i '' 's/static bool isTabletEdition = false;/static bool isTabletEdition = true;/g' lib/config/api_client.dart 2>/dev/null || true
sed -i '' 's/android:label="HRIS Employee"/android:label="HRIS Employee (Tablet)"/g' android/app/src/main/AndroidManifest.xml 2>/dev/null || true

flutter build apk --release --target-platform android-arm64

echo "=== Copying Tablet Edition APK ==="
if [ -f build/app/outputs/flutter-apk/app-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-release.apk "$DEPLOY_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
  cp build/app/outputs/flutter-apk/app-release.apk "$ARTIFACT_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
  echo "✅ Tablet APK berhasil: $DEPLOY_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
elif [ -f build/app/outputs/flutter-apk/app-arm64-v8a-release.apk ]; then
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$DEPLOY_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
  cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk "$ARTIFACT_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
  echo "✅ Tablet APK berhasil: $DEPLOY_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
else
  echo "❌ ERROR: APK Tablet tidak ditemukan di build output!"
  exit 1
fi

# ==========================================
# 3. RESTORE CONFIGS
# ==========================================
echo ""
echo "=== Restoring Default Configurations ==="
sed -i '' 's/static bool isTabletEdition = true;/static bool isTabletEdition = false;/g' lib/config/api_client.dart 2>/dev/null || true
sed -i '' 's/android:label="HRIS Employee (Tablet)"/android:label="HRIS Employee"/g' android/app/src/main/AndroidManifest.xml 2>/dev/null || true

echo ""
echo "============================================"
echo " ✅ HRIS Barokah APK Build Selesai!"
echo "============================================"
echo " Mobile Karyawan : $DEPLOY_DIR/BarokahGrup_Karyawan_Mobile_$MOBILE_VER.apk"
echo " Tablet Operasional: $DEPLOY_DIR/BarokahGrup_Operasional_Tablet_$TABLET_VER.apk"
echo " API URL          : https://api.barokahgroupindonesia.tech/api"
echo "============================================"
ls -lh "$DEPLOY_DIR/"
