# Raízes de Luz

Puzzle relaxante e original para Android. No centro do tabuleiro há uma semente de luz. Toca nas
peças para as rodar e liga os ramos de forma a que a luz chegue a todas as flores. Quando todas
florescem, passas de nível. Os níveis são gerados por algoritmo (sempre com solução), crescem de
4×4 até 8×8 e não têm fim. O progresso e o melhor número de jogadas por nível ficam guardados.

![ícone](dist/icon-512.png)

## Instalar

O APK está em [`dist/RaizesDeLuz-1.0.apk`](dist/RaizesDeLuz-1.0.apk). Android 5.0 ou superior.
Para jogar no computador, abre `web/index.html` num browser.

## Originalidade (pronto a publicar)

- Código, nome, gráficos e sons criados de raiz; sem imagens, fontes, músicas ou bibliotecas de terceiros.
- Sem permissões, sem Internet, sem anúncios, sem recolha de dados (ver [PRIVACY.md](PRIVACY.md)).
- Sem violência: adequado para todas as idades (PEGI 3 / "Everyone").

## Compilar

Igual à Órbita Lumi:

```bash
sudo apt install aapt zipalign apksigner dalvik-exchange default-jdk
ANDROID_JAR=/caminho/android-34/android.jar ./build.sh
# para publicar, com a tua chave:
KEYSTORE=~/raizes.jks KS_ALIAS=raizes KS_PASS='a-tua-password' ./build.sh
```

O ícone é gerado por `python3 tools/make_icon.py android/res`. ID da app: `com.widgilabs.raizesdeluz`.
As notas sobre Google Play (formato AAB), chave de assinatura e nome estão no
[README da Órbita Lumi](../orbita-lumi/README.md#notas-para-a-publicação) e aplicam-se aqui também.
