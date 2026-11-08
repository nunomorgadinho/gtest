# Pedra, Papel, Infinito ✊✋✌️

Um pedra-papel-tesoura sem fim, para Android. Começa com uma **Pedra**: escreve ou diz qualquer coisa que a vença. A seguir tens de vencer isso, e assim por diante. Um árbitro com IA (Claude, da Anthropic) decide se cada jogada vence e explica porquê, com humor.

## Modos

- **Corrente:** cada coisa tem de vencer a anterior. Quanto aguentas?
- **Duelo:** a IA contra-ataca sempre com algo que vence a tua jogada, e tens de vencer a resposta dela.

Não se pode repetir nada da corrente, e batotas genéricas ("o que vence tudo") perdem. Dá para jogar por voz (🎤, reconhecimento de voz do Android em português). Recordes guardados e partilha da corrente.

## Chave da API

O árbitro usa a API da Anthropic, por isso cada jogador precisa da sua chave:

1. Cria uma conta em console.anthropic.com e adiciona crédito.
2. Em **API Keys**, cria uma chave.
3. Na app, toca em ⚙️ e cola a chave.

A chave fica guardada só no telemóvel e é enviada apenas para a Anthropic. Cada jogada custa cerca de 1 a 2 cêntimos (modelo `claude-opus-5-5`, esforço baixo). Não distribuas a app com a tua chave configurada.

## Instalar

Descarrega `dist/PedraPapelInfinito-v1.0.apk` para o telemóvel Android (7.0 ou superior) e abre-o.
Pode ser preciso permitir "instalar apps de origem desconhecida". O APK está assinado com uma chave de debug.

## Estrutura

- `web/src/arbitro.js`: o árbitro, com o SDK oficial `@anthropic-ai/sdk` e saída estruturada (Zod). É empacotado para `app/src/main/assets/arbitro.js`.
- `app/src/main/assets/index.html` e `jogo.js`: interface e lógica do jogo.
- `app/src/main/java/.../MainActivity.java`: WebView, partilha e reconhecimento de voz.

## Compilar

Requer Node 18+, JDK 17+ e o Android SDK (plataforma 34).

```sh
cd web && npm install && npm run build && cd ..
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```
