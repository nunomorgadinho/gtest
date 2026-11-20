#!/usr/bin/env bash
# Gera o Android App Bundle (.aab) para a Google Play.
# Precisa do bundletool (https://github.com/google/bundletool/releases), que já traz o aapt2,
# e do android.jar (sudo apt-get install android-sdk-platform-23).
#   BUNDLETOOL=/caminho/bundletool-all.jar ./build-aab.sh
# Produção: KEYSTORE=chave.jks KS_PASS=... KEY_ALIAS=... BUNDLETOOL=... ./build-aab.sh
set -euo pipefail
cd "$(dirname "$0")"

BT=${BUNDLETOOL:?Indica o caminho do bundletool: BUNDLETOOL=/caminho/bundletool-all.jar}
SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
SRC=app/src/main
OUT=build/aab
AAB=SalaDosEnigmas.aab
KEY=${KEYSTORE:-build/debug.keystore}
PASS=${KS_PASS:-android}
ALIAS=${KEY_ALIAS:-enigmas}

rm -rf "$OUT" && mkdir -p "$OUT"/{compiled,classes,module/manifest,module/dex}

# aapt2 vem dentro do bundletool
AAPT2=build/aapt2
if [ ! -x "$AAPT2" ]; then mkdir -p build; unzip -p "$BT" linux/aapt2 > "$AAPT2" && chmod +x "$AAPT2"; fi

echo "1/6 Compilar recursos (aapt2)"
"$AAPT2" compile --dir "$SRC/res" -o "$OUT/compiled/res.zip"

echo "2/6 Ligar em formato proto (aapt2)"
"$AAPT2" link --proto-format -o "$OUT/proto.apk" -I "$SDK" \
  --manifest "$SRC/AndroidManifest.xml" -A "$SRC/assets" \
  --java "$OUT/gen" "$OUT/compiled/res.zip"

echo "3/6 Java e dex"
javac -nowarn --release 8 -classpath "$SDK" -d "$OUT/classes" \
  $(find "$SRC/java" "$OUT/gen" -name '*.java') 2>&1 | grep -v -e warning -e JAVA_TOOL_OPTIONS || true
dalvik-exchange --dex --min-sdk-version=24 --output="$OUT/module/dex/classes.dex" "$OUT/classes"

echo "4/6 Montar o módulo base"
(cd "$OUT/module" && unzip -q ../proto.apk && mv AndroidManifest.xml manifest/ && zip -q -r ../base.zip .)

echo "5/6 Criar o bundle (bundletool)"
rm -f "$AAB"
java -jar "$BT" build-bundle --modules="$OUT/base.zip" --output="$AAB"

echo "6/6 Assinar (jarsigner)"
if [ ! -f "$KEY" ]; then
  keytool -genkeypair -keystore "$KEY" -storepass android -keypass android -alias enigmas \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Sala dos Enigmas" >/dev/null 2>&1
fi
jarsigner -keystore "$KEY" -storepass "$PASS" -keypass "$PASS" -sigalg SHA256withRSA -digestalg SHA-256 "$AAB" "$ALIAS" >/dev/null
jarsigner -verify "$AAB" | grep -q "jar verified" && echo "Pronto: $(pwd)/$AAB"
