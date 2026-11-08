#!/usr/bin/env bash
# Compila o APK sem Gradle nem Android Studio.
# Requisitos (Debian/Ubuntu): sudo apt install aapt zipalign apksigner dalvik-exchange openjdk-17-jdk
# Precisa de um android.jar (API 33+): defina ANDROID_JAR, ou tem o do Android SDK em $ANDROID_HOME.
#
# Assinatura: por omissão cria/usa release.jks nesta pasta. Para publicar, use SEMPRE a mesma chave:
#   KEYSTORE=/caminho/minha.jks KS_ALIAS=escape KS_PASS=... ./build.sh
#
# Capítulos separados: CHAPTER=1 ./build.sh  ou  CHAPTER=2 ./build.sh  (antes: npm run build:all)
# Cada capítulo é uma app à parte (identificador e nome próprios). Sem CHAPTER sai a versão com os dois.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' android/AndroidManifest.xml)
CHAPTER=${CHAPTER:-0}
PKG=com.widgilabs.escapethelab
if [ "$CHAPTER" = 0 ]; then
  OUT="dist/EscapeTheLab-${VERSION}.apk"; GAME=web/game.js; LABEL="Escape the Lab"
else
  OUT="dist/EscapeTheLab-Cap${CHAPTER}-${VERSION}.apk"; GAME="build-web/game-c${CHAPTER}.js"; LABEL="Escape the Lab ${CHAPTER}"
fi
B=build

if [ -z "${ANDROID_JAR:-}" ]; then
  ANDROID_JAR=$(ls -d "${ANDROID_HOME:-/nonexistent}"/platforms/android-*/android.jar 2>/dev/null | sort -V | tail -1 || true)
fi
[ -f "${ANDROID_JAR:-}" ] || { echo "Defina ANDROID_JAR com o caminho para android.jar"; exit 1; }

KEYSTORE=${KEYSTORE:-release.jks}
KS_ALIAS=${KS_ALIAS:-escapethelab}
KS_PASS=${KS_PASS:-escapethelab}
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Escape the Lab" >/dev/null
fi

rm -rf "$B" && mkdir -p "$B"/{gen,classes,dex,assets} dist
[ -f "$GAME" ] || { echo "Corra primeiro: npm install && npm run build:all"; exit 1; }
cp web/* "$B/assets/"; cp "$GAME" "$B/assets/game.js"
cp -r android/res "$B/res"
sed -i "s|<string name=\"app_name\">[^<]*</string>|<string name=\"app_name\">${LABEL}</string>|" "$B/res/values/strings.xml"
RENAME=(); [ "$CHAPTER" = 0 ] || RENAME=(--rename-manifest-package "${PKG}.capitulo${CHAPTER}")

aapt package -f -m -J "$B/gen" -M android/AndroidManifest.xml -S android/res -I "$ANDROID_JAR"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" \
  -d "$B/classes" $(find android/src "$B/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=21 --output="$B/dex/classes.dex" "$B/classes"
aapt package -f -M android/AndroidManifest.xml -S "$B/res" -A "$B/assets" -I "$ANDROID_JAR" \
  "${RENAME[@]}" -F "$B/unsigned.apk" "$B/dex"
zipalign -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT" "$B/aligned.apk"
apksigner verify "$OUT"
echo "APK pronto: $OUT"
