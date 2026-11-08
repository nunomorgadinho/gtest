# Controlador de Sonhos 🌜🎮

Jogo de arcada para Android. Controlas o sonho de alguém a dormir: guia o sonhador pela noite, das 23:00 às 07:00, apanha coisas boas e foge dos pesadelos.

## Como se joga

- **Arrasta o dedo** em qualquer parte do ecrã para mover o sonhador (o movimento é relativo, por isso o dedo não o tapa).
- ⭐ 🌙 e doces dão pontos. Apanhar vários seguidos faz combos até x5.
- 👻 🦇 🦈 🕷️ ☄️... são **pesadelos** (brilham a vermelho). Cada toque tira um 💤; perdes os três e acordas.
- ✨ **Fragmentos de lucidez** enchem a barra. Cheia, carrega em **Sonho Lúcido**: durante 6 segundos os pesadelos viram estrelas e as coisas boas são atraídas para ti.
- 🐑 **Ovelha:** abranda o tempo. 🧸 **Peluche:** devolve um 💤.
- Ao amanhecer chovem ⏰ despertadores.
- Chega às **07:00** para ganhares a noite (bónus de 150 pontos por cada 💤 que te resta). Cada noite seguinte é mais rápida.

Cada noite passa por 4 mundos: Nuvens de Algodão, Oceano de Chá, Cidade dos Relógios e Viagem Espacial.

Tem música ambiente original gerada em tempo real (Web Audio API), efeitos sonoros, vibração ao levar dano, recorde e noites desbloqueadas guardados no telemóvel. Funciona sem internet.

## Instalar

Descarrega `dist/ControladorDeSonhos-v1.0.apk` para o telemóvel Android (7.0 ou superior) e abre-o.
Pode ser preciso permitir "instalar apps de origem desconhecida".

O APK está assinado com uma chave de debug. Para publicar na Play Store é preciso assiná-lo com uma chave própria.

## Compilar

Requer JDK 17+ e o Android SDK (plataforma 34).

```sh
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```

O jogo está em `app/src/main/assets/` (`index.html` com o HUD e os menus, `jogo.js` com o motor do jogo). Para testar no computador, abre `index.html` num browser: dá para jogar com as setas e a barra de espaço.
