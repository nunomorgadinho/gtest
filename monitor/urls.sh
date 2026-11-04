#!/usr/bin/env bash
# Mostra o URL de cada aplicação Cloudways (só leitura).
# Uso (como master): bash urls.sh
set -u
ROOT=/home/master/applications
[ -d "$ROOT" ] || ROOT="$HOME/applications"

printf '%-12s %-40s %s\n' "APP" "URL (WordPress home)" "DOMÍNIO CLOUDWAYS"
for a in "$ROOT"/*/; do
  a=${a%/}; app=$(basename "$a"); ph="$a/public_html"

  # Domínio *.cloudwaysapps.com, tirado do nome dos logs
  cw=$(ls "$a"/logs/backend_*.access.log 2>/dev/null | head -1 | sed -E 's#.*/backend_(.*)\.access\.log#\1#')

  # 1) wp-cli a partir da pasta do site (o wp-config.php usa require relativo)
  url=$(cd "$ph" 2>/dev/null && timeout 30 wp option get home --skip-plugins --skip-themes 2>/dev/null | tail -1)

  # 2) Alternativa: consulta direta à BD com as credenciais do wp-config.php
  if [ -z "$url" ] && [ -r "$ph/wp-config.php" ]; then
    get() { grep -oE "define\(\s*['\"]$1['\"]\s*,\s*['\"][^'\"]*['\"]" "$ph/wp-config.php" | head -1 | sed -E "s/.*,\s*['\"]([^'\"]*)['\"]$/\1/"; }
    prefix=$(grep -oE "table_prefix\s*=\s*['\"][^'\"]+['\"]" "$ph/wp-config.php" | sed -E "s/.*['\"]([^'\"]+)['\"]$/\1/")
    url=$(MYSQL_PWD="$(get DB_PASSWORD)" timeout 10 mysql -N -B -h "$(get DB_HOST)" -u "$(get DB_USER)" "$(get DB_NAME)" \
          -e "SELECT option_value FROM ${prefix:-wp_}options WHERE option_name='home'" 2>/dev/null)
  fi

  printf '%-12s %-40s %s\n' "$app" "${url:-?}" "${cw:-?}"
done
