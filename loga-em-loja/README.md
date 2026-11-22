# Loga em Loja (Android)

App de loja online para Android: catálogo com categorias e pesquisa, favoritos,
carrinho com cupão (`BEMVINDO` = 10%), portes grátis acima de 50 €, checkout
(MB WAY, Multibanco, Cartão) e histórico de encomendas. Os dados ficam guardados no dispositivo.

A interface está em `app/src/main/assets/index.html`.

## Compilar
```
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```
APK: `app/build/outputs/apk/release/app-release.apk` (já compilado em `../LogaEmLoja.apk`).
