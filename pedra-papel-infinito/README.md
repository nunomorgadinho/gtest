# Pedra, Papel, Infinito ✊✋✌️

Um pedra-papel-tesoura sem fim, para Android. Começa com uma **Pedra**: escreve ou diz algo que a vença. A seguir tens de vencer isso, e assim por diante.

## Árbitros

- **📚 Clássico (grátis, por defeito):** funciona sem internet. Conhece 213 coisas (natureza, animais, ferramentas, pessoas, comida, emoções...) e mais de 800 relações de quem vence quem, cada uma com a sua frase. Percebe erros de escrita, plurais, artigos e sinónimos. Se não conhecer a jogada, não perdes: tentas outra. Tem um botão 💡 de dica.
- **🤖 IA (opcional, paga):** o Claude, da Anthropic, aceita qualquer coisa e explica com humor. Precisa de internet e de uma chave da API (ver abaixo).

O dicionário do árbitro clássico está em `app/src/main/assets/arbitro-classico.js` e é fácil de aumentar: cada coisa tem nome, emoji, etiquetas e sinónimos, e há regras por etiqueta (ex.: "água apaga fogo") e pares específicos (ex.: "o papel embrulha a pedra").

## Modos

- **Corrente:** cada coisa tem de vencer a anterior. Quanto aguentas?
- **Duelo:** a IA contra-ataca sempre com algo que vence a tua jogada, e tens de vencer a resposta dela.

Não se pode repetir nada da corrente, e batotas genéricas ("o que vence tudo") perdem. Dá para jogar por voz (🎤, reconhecimento de voz do Android em português). Recordes guardados e partilha da corrente.

## Chave da API (só para o árbitro IA)

O árbitro IA usa a API da Anthropic, por isso quem o quiser usar precisa da sua chave:

1. Cria uma conta em console.anthropic.com e adiciona crédito.
2. Em **API Keys**, cria uma chave.
3. Na app, toca em ⚙️, escolhe **IA** e cola a chave.

A chave fica guardada só no telemóvel e é enviada apenas para a Anthropic. Cada jogada custa cerca de 1 a 2 cêntimos (modelo `claude-opus-5-5`, esforço baixo). Não distribuas a app com a tua chave configurada.

## Instalar

Descarrega `dist/PedraPapelInfinito-v1.1.apk` para o telemóvel Android (7.0 ou superior) e abre-o.
Pode ser preciso permitir "instalar apps de origem desconhecida". O APK está assinado com uma chave de debug.

## Estrutura

- `app/src/main/assets/arbitro-classico.js`: o árbitro clássico (dicionário e regras).
- `web/src/arbitro.js`: o árbitro IA, com o SDK oficial `@anthropic-ai/sdk` e saída estruturada (Zod). É empacotado para `app/src/main/assets/arbitro.js`.
- `app/src/main/assets/index.html` e `jogo.js`: interface e lógica do jogo.
- `app/src/main/java/.../MainActivity.java`: WebView, partilha e reconhecimento de voz.

## Compilar

Requer Node 18+, JDK 17+ e o Android SDK (plataforma 34).

```sh
cd web && npm install && npm run build && cd ..
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```
