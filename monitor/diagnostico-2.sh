#!/usr/bin/env bash
# =============================================================================
# Diagnóstico 2 (só de leitura): formatos de logs, Varnish, open_basedir e
# dados básicos de cada WordPress via wp-cli.
#
# - NÃO altera nada. Os comandos wp-cli usados são todos de leitura e correm
#   com --skip-plugins --skip-themes.
# - IPs e query strings nas amostras são mascarados.
#
# Uso (como master, via SSH):  bash diagnostico-2.sh
# Resultado em ~/diagnostico-monitor-2-*.txt
# =============================================================================
set -u
export LC_ALL=C

OUT="${HOME}/diagnostico-monitor-2-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$OUT") 2>&1

sec() { printf '\n==================== %s ====================\n' "$1"; }
run() { timeout "${TMO:-20}" "$@" 2>&1; }
mask() {
  sed -E \
    -e 's/([0-9]{1,3}\.){3}[0-9]{1,3}/x.x.x.x/g' \
    -e 's/(^|[ "])[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,7}([ ",]|$)/\1x:x::x\3/g' \
    -e 's/\?[^ "]*/?…/g' \
    | cut -c1-500
}

APPS_ROOT=/home/master/applications
[ -d "$APPS_ROOT" ] || APPS_ROOT="$HOME/applications"

echo "Diagnóstico 2, $(date -Is)"

# -----------------------------------------------------------------------------
sec "1. Formato dos logs (1 app, 2 linhas por tipo, mascaradas)"
# Usa a app com mais tráfego (maior access log de backend).
app=$(ls -S "$APPS_ROOT"/*/logs/backend_*.access.log 2>/dev/null | head -1 | sed 's#/logs/.*##')
echo "app de amostra: $(basename "${app:-?}")"
for pat in 'backend_*.access.log' 'static_*.access.log' 'nginx-app.status.log' 'php-app.access.log' 'backend_*.error.log'; do
  f=$(ls "$app"/logs/$pat 2>/dev/null | head -1)
  [ -r "${f:-}" ] || { echo; echo "--- $pat: não encontrado"; continue; }
  echo; echo "--- $pat"
  tail -n 2 "$f" | mask | sed 's/^/    /'
done
f="$app/logs/php-app.slow.log"
if [ -r "$f" ]; then
  echo; echo "--- php-app.slow.log (último bloco, máx. 25 linhas)"
  tac "$f" | awk 'NF==0 && n>0 {exit} {print; n++}' | tac | head -25 | mask | sed 's/^/    /'
fi

# -----------------------------------------------------------------------------
sec "2. Volume de pedidos nas últimas 24h por app (linhas nos logs atuais)"
for a in "$APPS_ROOT"/*/; do
  a=${a%/}
  b=$(cat "$a"/logs/backend_*.access.log 2>/dev/null | wc -l)
  s=$(cat "$a"/logs/nginx-app.status.log 2>/dev/null | wc -l)
  p=$(cat "$a"/logs/php-app.access.log 2>/dev/null | wc -l)
  printf '  %-12s nginx-status=%-8s backend(apache)=%-8s php=%s\n' "$(basename "$a")" "$s" "$b" "$p"
done

# -----------------------------------------------------------------------------
sec "3. Varnish"
echo "varnishstat:"
TMO=8 run varnishstat -1 -n /var/lib/varnish 2>&1 | grep -E 'MAIN\.(uptime|cache_hit|cache_miss|cache_hitpass|n_object|s_req)' | head -10
echo "código de saída/erro sem filtro:"
TMO=8 run varnishstat -1 >/dev/null; echo "  rc=$?"
ls -ld /var/lib/varnish /var/lib/varnish/* 2>&1 | head -5

# -----------------------------------------------------------------------------
sec "4. Restrições do PHP-FPM (open_basedir, disable_functions)"
grep -rhsE 'open_basedir|disable_functions' /etc/php/*/fpm/pool.d/ /etc/php.confs/ 2>/dev/null | sort -u | cut -c1-300
grep -rlsE 'open_basedir' /etc/php/*/fpm/ /etc/php.confs/ 2>/dev/null | head

# -----------------------------------------------------------------------------
sec "5. WordPress por app (wp-cli, só leitura)"
WP="wp --skip-plugins --skip-themes --quiet"
for a in "$APPS_ROOT"/*/; do
  a=${a%/}; ph="$a/public_html"
  [ -f "$ph/wp-config.php" ] || continue
  echo; echo "--- app: $(basename "$a")"
  echo "  home:            $(TMO=30 run $WP --path="$ph" option get home | tail -1)"
  echo "  DISABLE_WP_CRON: $(grep -qiE "DISABLE_WP_CRON['\"]?\s*,\s*true" "$ph/wp-config.php" && echo sim || echo não)"
  echo "  WP_CACHE:        $(grep -qiE "WP_CACHE['\"]?\s*,\s*true" "$ph/wp-config.php" && echo sim || echo não)"
  echo "  plugins ativos:  $(TMO=30 run $WP --path="$ph" plugin list --status=active --format=count | tail -1)"
  echo "  autoload (bytes): $(TMO=30 run $WP --path="$ph" option list --autoload=on --format=total_bytes | tail -1)"
  echo "  eventos cron:    $(TMO=30 run $WP --path="$ph" cron event list --format=count | tail -1)"
  echo "  tamanho BD:      $(TMO=60 run $WP --path="$ph" db size --size_format=mb | tail -1)"
  echo "  maiores tabelas:"
  TMO=60 run $WP --path="$ph" db query "SELECT table_name, ROUND((data_length+index_length)/1048576) AS mb, table_rows FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY (data_length+index_length) DESC LIMIT 6" --skip-column-names \
    | sed 's/^/      /'
done

# -----------------------------------------------------------------------------
sec "6. Disco: o que ocupa mais (fora de public_html)"
for d in /home/master/applications/*/local_backups /home/master/applications/*/private_html /home/master/applications/*/tmp /var/cw_backups /home/master/backups; do
  [ -e "$d" ] && printf '  %-60s %s\n' "$d" "$(TMO=60 run nice -n 19 du -sh "$d" | tail -1 | cut -f1)"
done
echo "  logs por app:"
for a in "$APPS_ROOT"/*/; do
  printf '    %-12s %s\n' "$(basename "$a")" "$(du -sh "$a/logs" 2>/dev/null | cut -f1)"
done
echo "  datadir MySQL: $(TMO=60 run du -sh /var/lib/mysql | tail -1 | cut -f1)"

sec "FIM"
echo "Resultado guardado em: $OUT"
echo "Revê o ficheiro antes de o partilhar."
