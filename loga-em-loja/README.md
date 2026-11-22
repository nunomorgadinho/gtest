# Loga em Loja (Android)

App de loja online para Android com contas de cliente (criar conta / entrar), conta de Chefe e conta de Administrador:
carrinho com cupão (`BEMVINDO` = 10%), portes grátis acima de 50 €, checkout
(MB WAY, Multibanco, Cartão) e histórico de encomendas. Os dados ficam guardados no dispositivo.

A interface está em `app/src/main/assets/index.html`.

## Compilar
```
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```
APK: `app/build/outputs/apk/release/app-release.apk` (já compilado em `../LogaEmLoja.apk`).

## Contas
- **Cliente:** "Criar conta" e "Entrar". Vê as suas compras e, no separador "Vender", põe os seus produtos à venda e acompanha as vendas.
- **Chefe:** entra com o email do chefe. Painel com resumo de vendas, encomendas, produtos e clientes.
- **Administrador:** entra com o nome da empresa e o nome do chefe. Gere encomendas (estado) e produtos.

As credenciais da equipa estão guardadas no código apenas como hash SHA-256.
Nota: tudo funciona localmente no dispositivo (sem servidor).
