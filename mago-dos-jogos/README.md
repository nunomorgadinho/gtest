# Mago dos Jogos 🧙‍♂️🎮

App que cria jogos "satisfatórios" a partir de uma frase e os exporta como **APK Android** instalável, tudo dentro do telemóvel e sem internet.

1. Escreve a ideia ("um gato ninja que corta frutas muito depressa").
2. O mago escolhe o tipo de jogo, o mundo, o herói, a velocidade e a dificuldade, e dá-lhe um nome.
3. Joga logo na pré-visualização e personaliza (nome, tipo, mundo, herói, cores, velocidade, dificuldade, música).
4. Toca em **Descarregar APK**: a app monta e assina um APK verdadeiro com o teu jogo, ícone e nome.

## Tipos de jogo (7)
| Tipo | Como se joga |
|---|---|
| Plataformas | corre sozinho; toca para saltar (salto duplo), salta em cima dos inimigos |
| Corrida | 3 faixas; toca à esquerda/direita ou desliza |
| Nave | arrasta; dispara sozinha; power-up de tiro triplo |
| Labirinto | desliza para mudar de direção; apanha as gemas e foge pela porta |
| Torre | toca para largar o bloco; acertar em cheio faz crescer a torre |
| Cortar | desliza para cortar; combos de 3+; evita as bombas |
| Bolhas | 45 s para rebentar bolhas; combos, bolhas douradas dão tempo |

12 mundos (Fantasia, Espaço, Cidade, Floresta, Oceano, Doces, Mistério, Gelo, Deserto, Robôs, Quinta, Dinossauros). Partículas, tremor de ecrã, sons que sobem de tom nos combos e música gerada para cada jogo.

## Como funciona a exportação APK
- `android-player/` é um leitor mínimo (WebView, sem permissões, minSdk 24). O `build.sh` compila-o uma vez como **APK modelo**, com marcadores no nome do pacote e no nome da app, e embute-o na app (`app/player-apk.js`).
- `app/apk.js` abre o modelo (ZIP), troca o nome do pacote no manifesto binário, o nome da app no `resources.arsc`, os ícones (desenhados num canvas) e `assets/game.js`, volta a montar o ZIP alinhado e assina com o **APK Signature Scheme v2** (SHA-256 e RSA em JavaScript puro).
- Cada jogo recebe um pacote próprio (`com.magodosjogos.jogo.xxxxx`), por isso vários jogos podem estar instalados ao mesmo tempo.
- Verificado com `apksigner verify` (v2) e `aapt dump badging`.

## Ficheiros
- `engine/engine.js`: motor dos jogos (canvas 2D, sem dependências).
- `app/`: interface (`index.html`, `app.js`), gerador por palavras-chave (`generator.js`), exportação (`apk.js`), chave de assinatura dos jogos (`key.js`).
- `android-app/`: app anfitriã (guarda o APK em Transferências e abre o instalador).
- `dist/MagoDosJogos-1.0.apk`, `dist/MagoDosJogos.html` (versão web de ficheiro único: no browser, o APK é descarregado).

## Compilar
```
ANDROID_JAR=/caminho/android-34.jar ./build.sh
```

## Notas importantes
- **Chave partilhada:** os jogos exportados são todos assinados com a mesma chave, que vai dentro da app (portanto é pública). Chega para instalar e jogar; para publicar um jogo na Play Store, deve ser reassinado com uma chave própria.
- **Play Store:** a permissão `REQUEST_INSTALL_PACKAGES` está sujeita a uma política da Google e exige justificação na consola. A alternativa é distribuir a app fora da loja ou usar só a versão HTML.
- O Android 7.0 ou mais recente é necessário para instalar os jogos (assinatura v2).
