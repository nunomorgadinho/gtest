#!/usr/bin/env bash
# Compila o Mago dos Jogos sem Gradle:
#   1) o leitor de jogos (APK modelo que a app personaliza e assina sozinha)
#   2) a app Mago dos Jogos (APK) e a versão HTML de ficheiro único
# Requisitos (Debian/Ubuntu): sudo apt install aapt zipalign apksigner dalvik-exchange openjdk-17-jdk python3-pil python3-cryptography
# Precisa de um android.jar (API 33+): defina ANDROID_JAR, ou tenha o Android SDK em $ANDROID_HOME.
# Assinatura da app: por omissão cria/usa release.jks nesta pasta (KEYSTORE, KS_ALIAS, KS_PASS para usar outra).
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' android-app/AndroidManifest.xml)
B=build
if [ -z "${ANDROID_JAR:-}" ]; then
  ANDROID_JAR=$(ls -d "${ANDROID_HOME:-/nonexistent}"/platforms/android-*/android.jar 2>/dev/null | sort -V | tail -1 || true)
fi
[ -f "${ANDROID_JAR:-}" ] || { echo "Defina ANDROID_JAR com o caminho para android.jar"; exit 1; }
KEYSTORE=${KEYSTORE:-release.jks}; KS_ALIAS=${KS_ALIAS:-magodosjogos}; KS_PASS=${KS_PASS:-magodosjogos}
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Mago dos Jogos" >/dev/null
fi
[ -f app/key.js ] || python3 tools/make_key.py app/key.js
[ -f android-app/res/mipmap-hdpi/ic_launcher.png ] || python3 tools/make_icons.py android-app/res android-player/res app/icone-512.png

rm -rf "$B" && mkdir -p "$B"/player/{gen,classes,dex,assets} "$B"/app/{gen,classes,dex,assets} dist

# 1) leitor (modelo)
P=$B/player
cp engine/engine.js player/index.html "$P/assets/"
echo 'window.GAME = {"name":"Jogo","template":"bolhas","theme":{}};' > "$P/assets/game.js"
aapt package -f -m -J "$P/gen" -M android-player/AndroidManifest.xml -S android-player/res -I "$ANDROID_JAR"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" \
  -d "$P/classes" $(find android-player/src "$P/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=24 --output="$P/dex/classes.dex" "$P/classes"
aapt package -f -M android-player/AndroidManifest.xml -S android-player/res -A "$P/assets" -I "$ANDROID_JAR" \
  --rename-manifest-package com.magodosjogos.jogo.zzzzzzzzzzzzzzzz -F "$P/raw.apk" "$P/dex"
python3 tools/make_template.py "$P/raw.apk" "$P/template.apk"
{ printf '/* APK modelo do leitor de jogos (gerado pelo build.sh) */\nwindow.MDJ_PLAYER_APK = "'; base64 -w0 "$P/template.apk"; printf '";\n'; } > "$B/player-apk.js"
cp "$B/player-apk.js" app/player-apk.js

# 2) HTML de ficheiro único
python3 tools/make_html.py dist/MagoDosJogos.html

# 3) app Android
A=$B/app
cp dist/MagoDosJogos.html "$A/assets/index.html"
aapt package -f -m -J "$A/gen" -M android-app/AndroidManifest.xml -S android-app/res -I "$ANDROID_JAR"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" \
  -d "$A/classes" $(find android-app/src "$A/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=24 --output="$A/dex/classes.dex" "$A/classes"
aapt package -f -M android-app/AndroidManifest.xml -S android-app/res -A "$A/assets" -I "$ANDROID_JAR" \
  -F "$A/unsigned.apk" "$A/dex"
zipalign -f -p 4 "$A/unsigned.apk" "$A/aligned.apk"
OUT="dist/MagoDosJogos-${VERSION}.apk"
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT" "$A/aligned.apk"
rm -f "$OUT.idsig"
apksigner verify "$OUT"
echo "APK pronto: $OUT"
