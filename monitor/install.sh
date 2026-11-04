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
#   3. Pergunta se pode adicionar a linha do coletor ao crontab do master.
#   4. Corre o coletor uma vez para validar.
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

CRON="* * * * * /usr/bin/php $DEST/bin/collect.php >/dev/null 2>&1"
if crontab -l 2>/dev/null | grep -qF "$DEST/bin/collect.php"; then
  echo "O coletor já está no crontab."
else
  echo
  echo "Linha a adicionar ao crontab do master:"
  echo "  $CRON"
  read -r -p "Adicionar agora? [s/N] " ok
  if [ "$ok" = "s" ] || [ "$ok" = "S" ]; then
    ( crontab -l 2>/dev/null || true; echo "$CRON" ) | crontab -
    echo "Adicionada."
  else
    echo "Não adicionada. Sem ela não há histórico (os valores ao vivo funcionam na mesma)."
  fi
fi

echo
echo "A testar o coletor…"
/usr/bin/php "$DEST/bin/collect.php" --once --discover && echo "Coletor OK."
[ -s "$DEST/data/collect.log" ] && tail -5 "$DEST/data/collect.log"

echo
echo "Sites encontrados:"
/usr/bin/php -r '
  $db = new PDO("sqlite:'"$DEST"'/data/metrics.sqlite");
  foreach ($db->query("SELECT id, label, url, php, type FROM apps ORDER BY id") as $r)
    printf("  %-12s %-28s PHP %-4s %s\n", $r["id"], $r["label"], $r["php"] ?? "?", $r["url"] ?? "");'

cat <<EOF

Falta:
  1. No painel da Cloudways, em Application Settings > General > Webroot,
     define:  public_html/public
  2. Cria o primeiro utilizador:
       php $DEST/bin/user.php add o-teu-email@widgilabs.com admin "Nome"
       php $DEST/bin/user.php add email-do-cliente@exemplo.pt cliente "Nome"
EOF
