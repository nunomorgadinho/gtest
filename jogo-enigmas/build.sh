#!/usr/bin/env bash
# Compila o APK sem Gradle, com as ferramentas Android do Ubuntu:
#   sudo apt-get install aapt apksigner dalvik-exchange android-sdk-platform-23 zipalign
set -euo pipefail
cd "$(dirname "$0")"

SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
SRC=app/src/main
OUT=build
APK=SalaDosEnigmas.apk
KEY=${KEYSTORE:-$OUT/debug.keystore}
PASS=${KS_PASS:-android}
ALIAS=${KEY_ALIAS:-enigmas}

rm -rf "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT"/*.apk
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "1/5 Recursos (aapt)"
aapt package -f -m -J "$OUT/gen" -M "$SRC/AndroidManifest.xml" -S "$SRC/res" -A "$SRC/assets" \
  -I "$SDK" -F "$OUT/unsigned.apk"

echo "2/5 Java (javac)"
javac -nowarn --release 8 -classpath "$SDK" -d "$OUT/classes" \
  $(find "$SRC/java" "$OUT/gen" -name '*.java') 2>&1 | grep -v -e warning -e JAVA_TOOL_OPTIONS || true

echo "3/5 Dex (dx)"
dalvik-exchange --dex --min-sdk-version=24 --output="$OUT/dex/classes.dex" "$OUT/classes"
(cd "$OUT/dex" && zip -q -u ../unsigned.apk classes.dex)

echo "4/5 Alinhar (zipalign)"
zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "5/5 Assinar (apksigner)"
if [ ! -f "$KEY" ]; then
  keytool -genkeypair -keystore "$KEY" -storepass android -keypass android -alias enigmas \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Sala dos Enigmas" >/dev/null 2>&1
fi
apksigner sign --ks "$KEY" --ks-pass pass:"$PASS" --key-pass pass:"$PASS" --ks-key-alias "$ALIAS" \
  --out "$APK" "$OUT/aligned.apk"
rm -f "$APK.idsig"
apksigner verify "$APK"
echo "Pronto: $(pwd)/$APK"
