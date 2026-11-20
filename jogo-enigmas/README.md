# Sala dos Enigmas

Jogo Android em português de Portugal, português do Brasil, espanhol e inglês (botão de língua no topo): estás fechado numa sala com 12 portas e cada porta só abre quando resolves o problema que a guarda. Tens 3 vidas.

| Porta | Problema |
|---|---|
| 1 | Encontra o diferente (contra o tempo) |
| 2 | Padrões de formas e cores |
| 3 | Anagramas com pistas |
| 4 | Adivinhas |
| 5 | Cofre com código de 3 algarismos |
| 6 | Tubos (com botão para jogar o antigo Apaga as luzes) |
| 7 | Memória de cores |
| 8 | Labirinto (setas ou deslizar o dedo) |
| 9 | Pares escondidos |
| 10 | Puzzle deslizante |
| 11 | Copia o desenho de memória |
| 12 | Torre de Hanói |

No menu inicial, tocar num nível começa o jogo nessa porta. Só um jogo começado na porta 1 conta para o recorde e para as conquistas do jogo completo.

Há 23 conquistas em 6 raridades (Comum, Incomum, Rara, Épica, Especial e Lendária), algumas secretas, e um botão para as repor. Durante um jogo, o botão ↺ recomeça desde a porta 1. A música de fundo é gerada pelo próprio jogo; o botão ♪ liga e desliga.

## Compilar

O jogo é uma página HTML (`app/src/main/assets/index.html`) dentro de uma WebView.

```bash
sudo apt-get install aapt apksigner dalvik-exchange android-sdk-platform-23 zipalign
./build.sh                                              # APK
BUNDLETOOL=/caminho/bundletool-all.jar ./build-aab.sh   # bundle para a Google Play
```

Para assinar com uma chave própria: `KEYSTORE=chave.jks KS_PASS=... KEY_ALIAS=... ./build.sh` (o mesmo para o `build-aab.sh`). As chaves ficam na pasta `producao/`, que não vai para o Git.

## Arte

`arte/gerar_icone.py` gera o ícone (adaptativo, monocromático, clássico e o de 512 px para a Play) e `arte/gerar_destaque.py` gera o gráfico de funcionalidades da Play (1024×500) em cada língua. Precisam do Pillow.
