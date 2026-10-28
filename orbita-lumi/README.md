# Órbita Lumi

Jogo arcade original para Android. Controlas a Lumi, uma pequena luz que gira à volta de uma estrela.
Toca no ecrã para saltar para a órbita seguinte, apanha faíscas (combos dão até 5 pontos) e foge
dos asteroides. O círculo vermelho tracejado avisa onde vai aparecer um asteroide. De vez em quando
surge um escudo azul que aguenta um choque. A velocidade sobe com a pontuação.

![ícone](dist/icon-512.png)

## Instalar

O APK está em [`dist/OrbitaLumi-1.0.apk`](dist/OrbitaLumi-1.0.apk). Copia-o para o telemóvel e abre-o
(é preciso permitir "instalar apps de fontes desconhecidas"). Android 5.0 ou superior.

Para jogar no computador basta abrir `web/index.html` num browser (Espaço salta, P pausa, M som).

## Originalidade (pronto a publicar)

- Código, nome, mecânica, gráficos e sons criados de raiz para este projeto.
- Sem imagens, fontes, músicas ou bibliotecas de terceiros: os gráficos são desenhados em canvas,
  os sons são sintetizados com Web Audio e o ícone é gerado por `tools/make_icon.py`.
- Sem permissões, sem Internet, sem anúncios, sem recolha de dados (ver [PRIVACY.md](PRIVACY.md)).
- Sem violência gráfica: adequado para todas as idades (PEGI 3 / "Everyone").
- Licença: ver [LICENSE](LICENSE).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `web/index.html` | O jogo completo (HTML5 + JavaScript) |
| `android/` | Manifesto, `MainActivity` (WebView em ecrã inteiro) e recursos |
| `tools/make_icon.py` | Gera os ícones (`python3 tools/make_icon.py android/res`) |
| `build.sh` | Compila e assina o APK sem Gradle |

## Compilar

```bash
sudo apt install aapt zipalign apksigner dalvik-exchange default-jdk
ANDROID_JAR=/caminho/android-34/android.jar ./build.sh
```

Para publicar, assina sempre com a **tua** chave e guarda-a bem (sem ela não podes lançar atualizações):

```bash
keytool -genkeypair -keystore ~/orbita.jks -alias orbita -keyalg RSA -keysize 2048 -validity 10000
KEYSTORE=~/orbita.jks KS_ALIAS=orbita KS_PASS='a-tua-password' ./build.sh
```

Em cada nova versão, aumenta `versionCode` e `versionName` em `android/AndroidManifest.xml`.

## Notas para a publicação

- **Google Play** exige o formato AAB (Android App Bundle) para apps novas; este APK serve para
  instalação direta, itch.io, F-Droid, Amazon Appstore, Samsung Galaxy Store, Huawei AppGallery, etc.
  Para o Play, abre a pasta `android/` num projeto Android Studio (Empty Views Activity), copia
  `MainActivity.java`, `res/` e `web/index.html` para `assets/`, e usa "Generate Signed Bundle".
- O ID da app é `com.widgilabs.orbitalumi`; muda-o no manifesto (e na pasta/`package` do Java) se
  quiseres outro. Não pode ser alterado depois de publicado.
- Antes de publicar, confirma que o nome "Órbita Lumi" não colide com uma marca registada na tua loja.
