# Quem Sou Eu Hoje? 😜

App Android que faz perguntas absurdas e cria um perfil de personalidade hilariante.

- 14 perguntas absurdas (8 sorteadas por jogo, com as respostas baralhadas)
- 6 personalidades: Preguiça Filosófica, Furacão de Caos, Batata Zen, Unicórnio Dramático, Robô Sobreorganizado e Cabra Aventureira
- Resultado com superpoder, ponto fraco, previsão para o dia, amigo ideal e "composição química" em percentagens
- Botão para partilhar o resultado (WhatsApp, Instagram, etc.)
- Funciona sem internet

## Instalar

Descarrega `dist/QuemSouEuHoje-v1.0.apk` para o telemóvel Android (7.0 ou superior) e abre-o.
Pode ser preciso permitir "instalar apps de origem desconhecida".

O APK está assinado com uma chave de debug. Para publicar na Play Store é preciso assiná-lo com uma chave própria.

## Compilar

Requer JDK 17+ e o Android SDK (plataforma 34).

```sh
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```

O APK fica em `app/build/outputs/apk/release/app-release.apk`.

O jogo está em `app/src/main/assets/index.html` (HTML/CSS/JS). Para testar rapidamente, basta abrir esse ficheiro num browser.
