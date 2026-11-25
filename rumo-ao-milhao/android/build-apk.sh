#!/usr/bin/env bash
# Gera a APK do jogo: ./build-apk.sh  (precisa de JDK 17+, Gradle e do Android SDK em ANDROID_HOME)
set -euo pipefail
cd "$(dirname "$0")"
ASSETS=app/src/main/assets
rm -rf "$ASSETS"; mkdir -p "$ASSETS/fonts"

# Fontes locais, para o jogo funcionar sem internet
UA='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
CSS_URL='https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;700;800&display=swap'
curl -fsSL -A "$UA" "$CSS_URL" > "$ASSETS/fonts.css"
i=0
for url in $(grep -o 'https://fonts.gstatic.com[^)]*' "$ASSETS/fonts.css" | sort -u); do
  i=$((i+1)); f="fonts/f$i.woff2"
  curl -fsSL "$url" -o "$ASSETS/$f"
  sed -i "s#$url#$f#g" "$ASSETS/fonts.css"
done

# Jogo com as fontes locais em vez do Google Fonts
sed -e '/fonts.googleapis.com" *>$/d' -e '/rel="preconnect"/d' \
    -e 's#<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>#<link rel="stylesheet" href="fonts.css">#' \
    ../index.html > "$ASSETS/index.html"

echo "sdk.dir=${ANDROID_HOME:?defina ANDROID_HOME}" > local.properties
gradle --no-daemon -q assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../rumo-ao-milhao.apk
echo "APK pronta: rumo-ao-milhao/rumo-ao-milhao.apk"
