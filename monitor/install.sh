#!/usr/bin/env bash
# =============================================================================
# Instala ou atualiza o Monitor de recursos numa aplicação Cloudways.
#
# Uso (como master, via SSH, a partir da pasta monitor/ deste repositório):
#   bash install.sh <pasta-da-app>
#
# Exemplo:  bash install.sh abcdefghij
#
# O que faz:
#   1. Copia o código para /home/master/applications/<app>/public_html
#      (config/ e data/ existentes são mantidos nas atualizações).
#   2. Cria config/config.php a partir do exemplo, se não existir.
#   3. Pergunta se pode adicionar ao crontab do master o coletor (cada minuto)
#      e a leitura dos logs (cada 5 minutos).
#   4. Corre os dois uma vez para validar.
# =============================================================================
set -euo pipefail

ROOT=${MON_APPS_ROOT:-/home/master/applications}
APP=${1:-}
SRC="$(cd "$(dirname "$0")" && pwd)/app"

if [ -z "$APP" ] || [ ! -d "$ROOT/$APP/public_html" ]; then
  echo "Uso: bash install.sh <pasta-da-app>"
  echo "Aplicações disponíveis:"
  ls -1 "$ROOT"
  exit 1
fi
DEST="$ROOT/$APP/public_html"

if [ -e "$DEST/wp-config.php" ]; then
  echo "ERRO: $DEST tem um WordPress. Instala o monitor numa app própria (PHP Stack)."
  exit 1
fi

# Ficheiros que não são do monitor (por exemplo o index.php de boas-vindas da Cloudways).
if [ ! -e "$DEST/.wlmon" ]; then
  extra=$(find "$DEST" -mindepth 1 -maxdepth 1 ! -name '.wlmon' | head -20)
  if [ -n "$extra" ]; then
    echo "A pasta $DEST já tem ficheiros:"
    echo "$extra" | sed 's/^/  /'
    BK="$ROOT/$APP/private_html/antes-do-monitor-$(date +%Y%m%d-%H%M%S)"
    read -r -p "Mover estes ficheiros para $BK? [s/N] " ok
    [ "$ok" = "s" ] || [ "$ok" = "S" ] || { echo "Cancelado."; exit 1; }
    mkdir -p "$BK"
    find "$DEST" -mindepth 1 -maxdepth 1 -exec mv {} "$BK/" \;
  fi
fi

echo "A copiar o código para $DEST…"
umask 0002
mkdir -p "$DEST/config" "$DEST/data"
rm -rf "$DEST/public" "$DEST/src" "$DEST/bin"
cp -R "$SRC/public" "$SRC/src" "$SRC/bin" "$DEST/"
cp "$SRC/config/config.sample.php" "$DEST/config/"
touch "$DEST/.wlmon"
chmod 2775 "$DEST/data"
chmod -R u+rwX,g+rwX,o+rX "$DEST/public" "$DEST/src" "$DEST/bin" "$DEST/config"

if [ ! -e "$DEST/config/config.php" ]; then
  cp "$DEST/config/config.sample.php" "$DEST/config/config.php"
  echo "Criado config/config.php (podes ajustar o nome do servidor e os nomes dos sites)."
fi

add_cron() {
  local script="$1" line="$2" what="$3"
  if crontab -l 2>/dev/null | grep -qF "$DEST/bin/$script"; then
    echo "$what: já está no crontab."
    return
  fi
  echo
  echo "$what. Linha a adicionar ao crontab do master:"
  echo "  $line"
  read -r -p "Adicionar agora? [s/N] " ok
  if [ "$ok" = "s" ] || [ "$ok" = "S" ]; then
    ( crontab -l 2>/dev/null || true; echo "$line" ) | crontab -
    echo "Adicionada."
  else
    echo "Não adicionada."
  fi
}
add_cron collect.php "* * * * * /usr/bin/php $DEST/bin/collect.php >/dev/null 2>&1" "Recolha de métricas (a cada minuto)"
add_cron logs.php "*/5 * * * * nice -n 10 /usr/bin/php $DEST/bin/logs.php >/dev/null 2>&1" "Leitura dos logs (a cada 5 minutos)"
add_cron wpscan.php "17 * * * * nice -n 15 ionice -c3 /usr/bin/php $DEST/bin/wpscan.php >/dev/null 2>&1" "Análise do WordPress (verifica de hora a hora; base de dados 1x/dia, uploads 1x/semana)"

echo
START=$(date -u +%Y-%m-%dT%H:%M:%S)
echo "A testar o coletor…"
/usr/bin/php "$DEST/bin/collect.php" --once --discover && echo "Coletor OK."
echo "A ler os logs pela primeira vez…"
nice -n 10 /usr/bin/php "$DEST/bin/logs.php" --verbose | tail -3
echo "A analisar a base de dados e os ficheiros de cada WordPress…"
nice -n 15 ionice -c3 /usr/bin/php "$DEST/bin/wpscan.php" --verbose --no-uploads || true
echo "(a composição dos uploads é analisada na próxima hora, em segundo plano)"
# Só os erros desta instalação (o collect.log pode ter registos antigos).
if [ -s "$DEST/data/collect.log" ]; then
  awk -v s="$START" 'substr($1, 1, 19) >= s' "$DEST/data/collect.log" | tail -5
fi

echo
echo "Sites encontrados:"
/usr/bin/php -r '
  $db = new PDO("sqlite:'"$DEST"'/data/metrics.sqlite");
  foreach ($db->query("SELECT id, label, url, php, type FROM apps ORDER BY id") as $r)
    printf("  %-12s %-28s PHP %-4s %s\n", $r["id"], $r["label"], $r["php"] ?? "?", $r["url"] ?? "");'

cat <<EOF

Falta (no painel da Cloudways, nesta aplicação):
  1. Application Settings > General > Webroot:  public_html/public
  2. Application Settings > Varnish: desativado. O Varnish retira o cookie de
     sessão deste painel e impede o login.
  3. Cria os utilizadores. Cada um entra com um PIN de 6 dígitos (--gerar cria
     um PIN aleatório e mostra-o uma vez; sem --gerar, o PIN é pedido):
       php $DEST/bin/user.php add nuno admin "Nuno" --gerar
       php $DEST/bin/user.php add cliente cliente "Nome do cliente" --gerar
     Contas de versões anteriores (email e password) precisam de um PIN:
       php $DEST/bin/user.php list
       php $DEST/bin/user.php pin <utilizador> --gerar
EOF
