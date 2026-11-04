# Monitor de recursos

Dashboard em tempo real dos recursos de um servidor Cloudways com vários sites
WordPress, com a parte de cada site e (nas próximas fases) as oportunidades de
melhoria para gastar menos recursos.

## Como funciona

```
crontab do master ──► bin/collect.php ──┐
   (cada minuto)      CPU, memória, …   ├──► data/metrics.sqlite ──► dashboard (public/)
                 ──► bin/logs.php ──────┘    só dados agregados      só leitura + /proc ao vivo
   (cada 5 min)       logs de cada site
```

- **Coletor** (`bin/collect.php`): corre como `master`, lê `/proc` (CPU, memória,
  carga, disco, rede e processos) e atribui o consumo de cada pool PHP-FPM ao
  respetivo site. Uma vez a cada 6 horas descobre as apps e o URL de cada
  WordPress (as credenciais da base de dados são lidas do `wp-config.php` no
  momento e nunca são guardadas).
- **Leitura dos logs** (`bin/logs.php`): a cada 5 minutos lê só as linhas novas
  dos logs de cada site (Nginx da frente, servidor de trás, PHP-FPM, erros e
  slow log), acompanhando a rotação dos ficheiros. Calcula a taxa de cache do
  Varnish (pedidos que chegaram ao servidor de trás face aos recebidos), a CPU
  gasta por URL, os robôs, os tipos de pedido WordPress, os erros PHP e o plugin
  ou tema responsável pelos pedidos lentos.
- **Dados**: SQLite fora da pasta pública. Amostras de 10 s durante 48 h e
  agregados de 5 minutos durante 90 dias.
- **Dashboard** (`public/`): PHP sem dependências. Lê o SQLite e também `/proc`
  diretamente para os valores ao vivo (atualiza a cada 3 s). Não tem acesso de
  escrita a nada partilhado.

Perfis: **admin** vê também os identificadores internos das apps e o detalhe
técnico dos erros PHP e do slow log (ficheiros e linhas); **cliente** vê os sites
pelo domínio e os totais.

No topo de cada página há dois botões, lembrados em cada browser:
- **Básica / Avançada**: a vista básica mostra o essencial (CPU, memória, disco,
  pedidos, cache, robôs e erros); a avançada acrescenta carga, disco e rede,
  serviços, URLs mais caros, tipos de pedido e pedidos lentos. Por omissão o
  cliente começa na básica e o admin na avançada.
- **Claro / Escuro**: tema da página (por omissão segue o sistema).

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
   Na mesma página, **desativa o Varnish** para esta aplicação. O Varnish da
   Cloudways retira cookies que não conhece, incluindo o da sessão do painel
   (`wlmon`), e o login falha. Em alternativa, acrescenta `wlmon` às exclusões de
   cookies do Varnish. O painel nunca é guardado em cache, por isso o Varnish não
   traz vantagens aqui.
5. Cria os utilizadores:
   ```bash
   php /home/master/applications/<app>/public_html/bin/user.php add nuno@widgilabs.com admin "Nuno"
   php /home/master/applications/<app>/public_html/bin/user.php add cliente@exemplo.pt cliente "Nome"
   ```

Para atualizar, volta a correr `bash install.sh <pasta-da-app>`: o código é
substituído e `config/` e `data/` mantêm-se. Ao atualizar da fase 1, o instalador
pergunta se pode acrescentar a linha da leitura dos logs ao crontab:

```
*/5 * * * * nice -n 10 /usr/bin/php <public_html>/bin/logs.php >/dev/null 2>&1
```

Para ver o que a leitura dos logs está a fazer: `php bin/logs.php --verbose`.

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
- A taxa de cache compara os pedidos do log da frente com os do servidor de
  trás no mesmo período. Inclui pedidos que nunca podem vir da cache (POST,
  `admin-ajax`, utilizadores com sessão iniciada).
- A CPU por URL vem do log do PHP-FPM (duração × %CPU de cada pedido). Os URLs
  são agrupados sem parâmetros e com a paginação normalizada (`/page/N`).
- Na primeira leitura, cada log é lido desde o início do ficheiro atual (até
  64 MB); os ficheiros já comprimidos (`.gz`) não são lidos.

## Diagnóstico

`diagnostico.sh`, `diagnostico-2.sh` e `urls.sh` são scripts só de leitura usados
para validar o servidor antes da construção.

## Fases

1. **Feito:** recolha, histórico, ecrã do servidor em tempo real, sites e serviços.
2. **Feito:** logs (taxa de cache, URLs mais caros, robôs, tipos de pedido, erros
   PHP e pedidos lentos), página de detalhe por site, vistas básica/avançada e
   tema claro/escuro.
3. Base de dados e WordPress: autoload, cron, tabelas, plugins.
4. Motor de recomendações.
