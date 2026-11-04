#!/usr/bin/env bash
# =============================================================================
# Diagnóstico só de leitura para o futuro monitor de recursos (Cloudways).
#
# - NÃO altera nada, NÃO instala nada, NÃO reinicia serviços.
# - NÃO imprime passwords nem o conteúdo de wp-config.php.
# - IPs e query strings nas amostras de logs são mascarados.
#
# Uso (como utilizador master, via SSH):
#   bash diagnostico.sh
#
# O resultado é mostrado no ecrã e guardado em ~/diagnostico-monitor-*.txt.
# Revê o ficheiro antes de o partilhar.
# =============================================================================
set -u
export LC_ALL=C

OUT="${HOME}/diagnostico-monitor-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$OUT") 2>&1

sec()  { printf '\n==================== %s ====================\n' "$1"; }
run()  { timeout "${TMO:-20}" "$@" 2>&1; }
have() { command -v "$1" >/dev/null 2>&1; }
yn()   { if "$@" >/dev/null 2>&1; then echo "sim"; else echo "não"; fi; }
mask() {
  sed -E \
    -e 's/([0-9]{1,3}\.){3}[0-9]{1,3}/x.x.x.x/g' \
    -e 's/(^|[ "])[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,7}([ ",]|$)/\1x:x::x\3/g' \
    -e 's/\?[^ "]*/?…/g' \
    | cut -c1-400
}

echo "Diagnóstico do monitor, $(date -Is)"
echo "Ficheiro: $OUT"

# -----------------------------------------------------------------------------
sec "1. Identidade"
echo "utilizador: $(whoami)"
echo "id: $(id)"
echo "HOME: $HOME"
echo -n "sudo sem password: "; run sudo -n true >/dev/null 2>&1 && echo "sim" || echo "não"

# -----------------------------------------------------------------------------
sec "2. Sistema"
grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null
echo "kernel: $(uname -r)"
echo "CPUs: $(nproc)"
have systemd-detect-virt && echo "virtualização: $(systemd-detect-virt 2>/dev/null)"
echo "uptime/load: $(uptime)"
free -m

# -----------------------------------------------------------------------------
sec "3. Leitura de /proc (base das métricas em tempo real)"
for f in stat meminfo loadavg vmstat diskstats net/dev pressure/cpu pressure/memory pressure/io; do
  printf '  %-18s legível: %s\n' "/proc/$f" "$(yn test -r "/proc/$f")"
done
echo
echo "montagem de /proc (hidepid esconde processos de outros utilizadores):"
grep -E '^proc ' /proc/mounts
echo "processos visíveis: $(ls -d /proc/[0-9]* 2>/dev/null | wc -l)"
echo
echo "processos por utilizador (top 30):"
ps -eo user= | sort | uniq -c | sort -rn | head -30

# -----------------------------------------------------------------------------
sec "4. Serviços (contagem, RAM total em MB, %CPU)"
ps -eo user=,rss=,pcpu=,comm= | awk '
  { n=$4; sub(/[0-9.]+$/, "", n) }
  n ~ /^(php-fpm|mysqld|mariadbd|varnishd|cache-main|nginx|apache2|httpd|redis-server|memcached|java|supervisord|cron|sshd)$/ {
    c[n]++; r[n]+=$2; p[n]+=$3; u[n]=(index(u[n], $1) ? u[n] : u[n] " " $1)
  }
  END { for (k in c) printf "  %-14s procs=%-4d ram=%-6d cpu=%-6.1f users:%s\n", k, c[k], r[k]/1024, p[k], u[k] }'
echo
echo "pools PHP-FPM (utilizador / pool / processos / RAM MB):"
ps -eo user=,rss=,args= | awk '
  /php-fpm: pool/ { k=$1 " / " $NF; c[k]++; r[k]+=$2 }
  END { for (k in c) printf "  %-40s %3d procs  %6d MB\n", k, c[k], r[k]/1024 }' | sort
echo
pid=$(ps -eo pid=,user=,args= | awk -v me="$(whoami)" '/php-fpm: pool/ && $2 != me {print $1; exit}')
if [ -n "${pid:-}" ]; then
  echo "processo FPM de outro utilizador (pid $pid):"
  for f in stat status io smaps_rollup cmdline; do
    printf '  /proc/%s/%-13s legível: %s\n' "$pid" "$f" "$(yn head -c1 "/proc/$pid/$f")"
  done
else
  echo "não foi encontrado nenhum processo FPM de outro utilizador"
fi

# -----------------------------------------------------------------------------
sec "5. cgroups (possível CPU/RAM por app)"
echo "tipo: $(stat -fc %T /sys/fs/cgroup 2>/dev/null)"
ls /sys/fs/cgroup 2>&1 | head -30 | tr '\n' ' '; echo
for d in /sys/fs/cgroup/system.slice /sys/fs/cgroup/user.slice; do
  [ -d "$d" ] && printf '  %s cpu.stat legível: %s\n' "$d" "$(yn test -r "$d/cpu.stat")"
done
ls /sys/fs/cgroup/system.slice 2>/dev/null | grep -iE 'php|fpm|mysql|maria|varnish|apache|nginx|redis' | head -20

# -----------------------------------------------------------------------------
sec "6. Disco"
df -hP -x tmpfs -x devtmpfs -x overlay 2>/dev/null
echo
df -iP -x tmpfs -x devtmpfs -x overlay 2>/dev/null

# -----------------------------------------------------------------------------
sec "7. Aplicações"
APPS_ROOT=""
for c in "$HOME/applications" /home/master/applications /home/*/applications; do
  [ -d "$c" ] && { APPS_ROOT="$c"; break; }
done
echo "pasta de aplicações: ${APPS_ROOT:-NÃO ENCONTRADA}"

SAMPLE_DONE_NGINX=0
SAMPLE_DONE_APACHE=0
if [ -n "$APPS_ROOT" ]; then
  for app in "$APPS_ROOT"/*/; do
    app=${app%/}; name=$(basename "$app")
    echo
    echo "--- app: $name ---"
    echo "  dono/grupo/permissões: $(stat -c '%U %G %a' "$app" 2>/dev/null)"
    ph="$app/public_html"
    if [ -d "$ph" ]; then
      echo "  public_html dono: $(stat -c '%U %G %a' "$ph" 2>/dev/null)"
      echo "  wp-config.php existe: $(yn test -e "$ph/wp-config.php")  legível: $(yn test -r "$ph/wp-config.php")"
      if [ -r "$ph/wp-includes/version.php" ]; then
        echo "  versão WP: $(grep -oE "wp_version = '[^']+'" "$ph/wp-includes/version.php" | cut -d"'" -f2)"
      fi
      echo "  plugins: $(ls -1 "$ph/wp-content/plugins" 2>/dev/null | grep -vc '^index.php$')"
      mu="$ph/wp-content/mu-plugins"
      echo "  mu-plugins existe: $(yn test -d "$mu")  escrevível pelo master: $(yn test -w "${mu}")  wp-content escrevível: $(yn test -w "$ph/wp-content")"
      echo "  object-cache.php: $(yn test -e "$ph/wp-content/object-cache.php")"
      echo "  DISABLE_WP_CRON definido: $(grep -qE "DISABLE_WP_CRON'?\s*,\s*true" "$ph/wp-config.php" 2>/dev/null && echo sim || echo 'não (ou ilegível)')"
      echo "  tamanho public_html: $(TMO=120 run nice -n 19 du -sh "$ph" | tail -1 | cut -f1)"
      [ -d "$ph/wp-content/uploads" ] && echo "  tamanho uploads:     $(TMO=120 run nice -n 19 du -sh "$ph/wp-content/uploads" | tail -1 | cut -f1)"
    else
      echo "  sem public_html"
    fi
    lg="$app/logs"
    if [ -d "$lg" ]; then
      echo "  logs/ dono: $(stat -c '%U %G %a' "$lg" 2>/dev/null)  listável: $(yn ls "$lg")"
      for f in "$lg"/*; do
        [ -f "$f" ] || continue
        printf '    %-45s %8s  legível: %s\n' "$(basename "$f")" "$(du -h "$f" 2>/dev/null | cut -f1)" "$(yn test -r "$f")"
      done
      for f in "$lg"/*access*.log; do
        [ -r "$f" ] || continue
        case "$(basename "$f")" in
          nginx*)  [ "$SAMPLE_DONE_NGINX"  = 1 ] && continue; SAMPLE_DONE_NGINX=1 ;;
          apache*) [ "$SAMPLE_DONE_APACHE" = 1 ] && continue; SAMPLE_DONE_APACHE=1 ;;
          *) continue ;;
        esac
        echo "  amostra de formato ($(basename "$f"), mascarada):"
        tail -n 2 "$f" | mask | sed 's/^/      /'
      done
    fi
  done
fi

# -----------------------------------------------------------------------------
sec "8. PHP"
if have php; then
  php -v 2>&1 | head -1
  echo "módulos relevantes: $(php -m 2>/dev/null | grep -iE '^(pdo_sqlite|sqlite3|zend opcache|apcu|redis|curl|mbstring|posix|pcntl)$' | sort -u | tr '\n' ' ')"
  echo "disable_functions (CLI): $(php -r 'echo ini_get("disable_functions") ?: "(nenhuma)";' 2>/dev/null)"
fi
ls -d /etc/php/*/fpm 2>/dev/null
echo "configs de pools FPM legíveis:"
find /etc/php* -path '*fpm*' -name '*.conf' -readable 2>/dev/null | head -20 | while read -r f; do
  echo "  $f"
  grep -hE '^\s*(pm|pm\.[a-z_]+|request_slowlog_timeout|request_terminate_timeout|php_admin_value\[memory_limit\]|php_admin_value\[open_basedir\])\s*=' "$f" 2>/dev/null | sed 's/^/      /'
done

# -----------------------------------------------------------------------------
sec "9. Ferramentas disponíveis"
for c in wp mysql mysqladmin varnishstat varnishadm redis-cli supervisorctl crontab sqlite3 ionice timeout curl git jq python3 iostat vmstat sar ss; do
  if have "$c"; then printf '  %-14s %s\n' "$c" "$(command -v "$c")"; else printf '  %-14s (não existe)\n' "$c"; fi
done
have wp && echo "  wp-cli: $(TMO=10 run wp --version --allow-root 2>/dev/null | head -1)"
have mysql && echo "  mysql: $(mysql --version 2>&1)"

# -----------------------------------------------------------------------------
sec "10. Cron do master"
if have crontab; then
  out=$(crontab -l 2>&1); rc=$?
  echo "crontab -l código de saída: $rc"
  echo "linhas ativas: $(printf '%s\n' "$out" | grep -cvE '^\s*(#|$)')"
  [ $rc -ne 0 ] && echo "mensagem: $(printf '%s\n' "$out" | head -2)"
fi
echo "/etc/cron.d legível: $(yn ls /etc/cron.d)"

# -----------------------------------------------------------------------------
sec "11. Varnish, Redis, MySQL"
have varnishstat && TMO=5 run varnishstat -1 -f MAIN.cache_hit -f MAIN.cache_miss -f MAIN.uptime | head -5
have redis-cli   && echo "redis ping: $(TMO=3 run redis-cli ping)"
echo "datadir MySQL legível: $(yn ls /var/lib/mysql)"
echo "slow query log MySQL (ficheiros legíveis):"
ls -l /var/log/mysql* 2>&1 | head -10

# -----------------------------------------------------------------------------
sec "12. Rede local (para o dashboard consultar os sites via localhost)"
have ss && { echo "portas em escuta:"; ss -ltnH 2>/dev/null | awk '{print "  " $4}' | sort -u; }
if have curl; then
  for p in 80 8080 8081 6081; do
    printf '  http://127.0.0.1:%-5s -> %s\n' "$p" "$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://127.0.0.1:$p/")"
  done
fi

sec "FIM"
echo "Resultado guardado em: $OUT"
echo "Revê o ficheiro antes de o partilhar."
