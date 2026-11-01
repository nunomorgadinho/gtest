# Histórias

App Android simples para escrever histórias.

**APK pronto a instalar:** [`historias.apk`](historias.apk)

## Funcionalidades

- Lista de histórias ordenada pela última edição, com pré-visualização, data e número de palavras
- Editor com título e texto em letra serifada, pensado para escrita longa
- Gravação automática ao sair do editor (sem botão "guardar")
- Contagem de palavras, caracteres e tempo estimado de leitura
- Pesquisa por título ou conteúdo
- Partilhar uma história (email, WhatsApp, notas, etc.)
- Apagar (menu do editor ou toque longo na lista)
- Tudo guardado localmente no telemóvel (SQLite), sem internet nem permissões

Requer Android 5.0 ou superior.

## Instalar

1. Copia `historias.apk` para o telemóvel.
2. Abre o ficheiro e autoriza "instalar apps de origem desconhecida" quando for pedido.

## Compilar

Não usa Gradle; compila com as ferramentas base do Android SDK. Em Ubuntu/Debian:

```bash
sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23
./build.sh
```

O APK fica em `build/historias.apk`. O `historias.keystore` incluído é uma chave de
desenvolvimento (password `historias`); mantém a mesma chave para poder atualizar a app
instalada. Para publicar na Play Store, usa uma chave própria (`KEYSTORE=... ./build.sh`).
