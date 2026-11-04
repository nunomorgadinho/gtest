# Monitor de recursos

Dashboard em tempo real dos recursos de um servidor Cloudways com vários sites
WordPress, com a parte de cada site e (nas próximas fases) as oportunidades de
melhoria para gastar menos recursos.

## Como funciona

```
crontab do master ──► bin/collect.php ──► data/metrics.sqlite ──► dashboard (public/)
   (1 vez/minuto)     6 amostras de 10 s     só dados agregados      só leitura + /proc ao vivo
```

- **Coletor** (`bin/collect.php`): corre como `master`, lê `/proc` (CPU, memória,
  carga, disco, rede e processos) e atribui o consumo de cada pool PHP-FPM ao
  respetivo site. Uma vez a cada 6 horas descobre as apps e o URL de cada
  WordPress (as credenciais da base de dados são lidas do `wp-config.php` no
  momento e nunca são guardadas).
- **Dados**: SQLite fora da pasta pública. Amostras de 10 s durante 48 h e
  agregados de 5 minutos durante 90 dias.
- **Dashboard** (`public/`): PHP sem dependências. Lê o SQLite e também `/proc`
  diretamente para os valores ao vivo (atualiza a cada 3 s). Não tem acesso de
  escrita a nada partilhado.

Perfis: **admin** vê também os identificadores internos das apps; **cliente** vê
os sites pelo domínio.

## Instalação

1. Na Cloudways, cria uma aplicação **PHP Stack** no servidor (já existe:
   `phpstack-953116-6769063.cloudwaysapps.com`) e anota o nome da pasta da app
   (em *Application Settings*, ou `ls /home/master/applications`).
2. Põe esta pasta `monitor/` no servidor, por exemplo em `/home/master/monitor`
   (git clone ou upload por SFTP do ZIP do repositório).
3. Corre, como `master`:
   ```bash
   cd /home/master/monitor
   bash install.sh <pasta-da-app>
   ```
4. Em *Application Settings > General > Webroot*, define `public_html/public`.
   Enquanto isto não estiver feito, o dashboard recusa abrir (para não expor
   `config/` e `data/`).
5. Cria os utilizadores:
   ```bash
   php /home/master/applications/<app>/public_html/bin/user.php add nuno@widgilabs.com admin "Nuno"
   php /home/master/applications/<app>/public_html/bin/user.php add cliente@exemplo.pt cliente "Nome"
   ```

Para atualizar, volta a correr `bash install.sh <pasta-da-app>`: o código é
substituído e `config/` e `data/` mantêm-se.

## Configuração

`config/config.php` (criado pelo instalador):

| Opção | Para quê |
|---|---|
| `server_name` | Nome no topo do dashboard |
| `labels` | Nomes amigáveis por app, por exemplo `['bxkffgxjyc' => 'Pumpkin']` |
| `hidden_apps` | Apps a esconder (staging, por exemplo) |
| `retention_raw_hours`, `retention_rollup_days` | Retenção dos dados |

## Utilizadores

```bash
php bin/user.php list
php bin/user.php add <email> <admin|cliente> [nome]
php bin/user.php passwd <email>
php bin/user.php del <email>
```

Passwords com hash (`password_hash`), sessões com cookie `HttpOnly`/`SameSite`,
CSRF no login e logout e bloqueio de 15 minutos após 5 tentativas falhadas.

## Notas de medição

- A CPU de cada site é a soma dos processos PHP-FPM do seu pool, em percentagem
  do servidor inteiro (100% = todos os CPUs ocupados).
- A memória de cada site soma o RSS dos processos FPM; inclui memória partilhada
  (OPcache), por isso é um valor por excesso.
- Processos PHP de linha de comandos (cron, wp-cli) aparecem em "PHP CLI".

## Diagnóstico

`diagnostico.sh`, `diagnostico-2.sh` e `urls.sh` são scripts só de leitura usados
para validar o servidor antes da construção.

## Fases

1. **Feito:** recolha, histórico, ecrã do servidor em tempo real, sites e serviços.
2. Logs: taxa de cache do Varnish, URLs mais caros, bots, `admin-ajax`, erros.
3. Base de dados e WordPress: autoload, cron, tabelas, plugins.
4. Motor de recomendações.
