# Nuvem

Guarda, organiza e partilha ficheiros, com contas de utilizador. Tem versão web e app Android (APK).

## Funcionalidades

- Contas: registo, início de sessão, mudar nome e palavra-passe (palavras-passe com scrypt, sessões em cookie HttpOnly)
- Pastas encadeadas, carregar ficheiros e pastas inteiras (botão ou arrastar e largar), barra de progresso
- Pré-visualização de imagens, PDF, vídeo, áudio e texto
- Mudar o nome, mover (diálogo ou arrastar para uma pasta), fazer cópia, favoritos
- Partilha com outras contas (Leitor ou Editor), incluindo tudo o que está dentro das pastas partilhadas
- Link público para ficheiros e pastas
- Reciclagem com restauro e eliminação definitiva
- Pesquisa, vistas Recentes, Favoritos e Partilhados comigo
- Quota de 15 GB por conta, modo claro/escuro automático, adaptado a telemóvel

## Servidor

Precisa de Node.js 22.5 ou mais recente (usa o SQLite incluído no Node).

```bash
cd drive
npm install
npm start            # http://localhost:3000
npm test             # testes da API
```

Variáveis opcionais: `PORT`, `DATA_DIR` (base de dados e ficheiros, por omissão `./data`),
`QUOTA_BYTES`, `MAX_UPLOAD_BYTES`, `NODE_ENV=production` (cookie `Secure`, usar com HTTPS).

## App Android

A APK pronta a instalar está em `dist/Nuvem.apk` (Android 8 ou superior).
No primeiro arranque pede o endereço do servidor, por exemplo `http://192.168.1.10:3000`
na rede de casa, ou `https://nuvem.oteudominio.pt` se o servidor estiver na internet.
O endereço pode ser mudado depois em Conta → Mudar servidor.

Para compilar de novo (precisa de JDK 17+ e Android SDK):

```bash
cd drive/android
./gradlew assembleRelease
# opcional: endereço sugerido no primeiro arranque
./gradlew assembleRelease -PnuvemServer=https://nuvem.oteudominio.pt
```

A APK em `dist/` está assinada com uma chave de desenvolvimento. Para publicar na Play Store,
cria a tua chave e um ficheiro `android/keystore.properties` com `storeFile`, `storePassword`,
`keyAlias` e `keyPassword` (este ficheiro e a chave não vão para o git).
