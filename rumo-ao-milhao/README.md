# Rumo ao Milhão

Jogo 2D em que crias vídeos no teu quarto, segues as tendências e tentas chegar a 1 milhão de subscritores.

- **Browser:** abre `index.html`. Funciona na horizontal e na vertical (telemóvel em pé).
- **Android:** instala `rumo-ao-milhao.apk` (Android 7+). Ativa "Instalar apps desconhecidas" para o browser ou gestor de ficheiros que usares.

## Gerar a APK de novo

Depois de alterar `index.html`:

```sh
ANDROID_HOME=/caminho/para/android-sdk ./android/build-apk.sh
```

Precisa de JDK 17+, Gradle 8.9+ e do Android SDK (platform 34, build-tools 34). O script copia o jogo para a app,
descarrega as fontes para funcionar sem internet e gera `rumo-ao-milhao.apk`, assinada com a chave de debug
(serve para instalar diretamente, não para a Play Store).
