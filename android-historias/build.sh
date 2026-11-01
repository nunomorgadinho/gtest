#!/usr/bin/env bash
# Compila o APK sem Gradle, usando as ferramentas do Android SDK
# (no Ubuntu/Debian: apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23).
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_SDK:-/usr/lib/android-sdk}"
BT="${BUILD_TOOLS:-$SDK/build-tools/debian}"
JAR="${ANDROID_JAR:-$SDK/platforms/android-23/android.jar}"
OUT=build
APK_NAME=historias.apk
KEYSTORE="${KEYSTORE:-historias.keystore}"

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes"

echo "> aapt: recursos"
"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$JAR" \
    -F "$OUT/unsigned.apk"

echo "> javac"
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -classpath "$JAR" \
    -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')

echo "> dx"
"$BT/dx" --dex --min-sdk-version=21 --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && "$BT/aapt" add unsigned.apk classes.dex >/dev/null)

echo "> zipalign"
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "> a criar keystore $KEYSTORE"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass historias -keypass historias \
      -alias historias -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Historias, O=Historias, C=PT" >/dev/null 2>&1
fi

echo "> apksigner"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:historias --key-pass pass:historias \
    --ks-key-alias historias --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
"$BT/apksigner" verify "$OUT/$APK_NAME"

echo "APK pronto: $(pwd)/$OUT/$APK_NAME"
