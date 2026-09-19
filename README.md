# WARDOGS Bot — Gamepass Brasil

Posta automaticamente no canal `#estratégia-de-battle` do Discord, via webhook (`WARDOGS Stats`):

- **Contagem de jogadores online** do WARDOGS na Steam
  - Todo dia às **19h05** (horário de Brasília)
  - Também aos **sábados e domingos às 14h20** (horário de Brasília)
  - Sempre apaga a mensagem de contagem anterior antes de postar a nova, pra não acumular várias no canal
- **Notícias/patch notes oficiais** do WARDOGS (só posts reais da Bulkhead na Steam — não pega matéria de imprensa tipo Rock Paper Shotgun, PCGamesN, SteamDB etc.)
  - Verifica a cada 30 minutos e posta só as que ainda não foram postadas
  - Traduzidas automaticamente para português do Brasil
  - Rodando manualmente ("Run workflow" no GitHub), sempre traz a notícia oficial mais recente, mesmo que já tenha sido postada antes — útil pra testar ou forçar um post

Roda 100% no GitHub Actions — depois de configurado, funciona sozinho, sem precisar de nada ligado no computador de ninguém.

## Como funciona por baixo dos panos

- **Steam Web API** (pública, sem chave): número de jogadores online (`ISteamUserStats/GetNumberOfCurrentPlayers`) e notícias (`ISteamNews/GetNewsForApp`), App ID do WARDOGS: `1867240`.
- **Tradução**: endpoint público e gratuito do Google Translate (sem chave de API). Se ele falhar por qualquer motivo, o bot manda o texto original em inglês em vez de quebrar.
- **Webhook do Discord**: cada script posta direto no canal via `DISCORD_WEBHOOK_URL` (guardado como Secret do repositório, nunca aparece no código).
- **Estado entre execuções**: como cada execução do GitHub Actions começa "do zero", os scripts guardam informação em arquivos JSON (`scripts/state.json` e `scripts/player-count-state.json`) que são commitados de volta no repositório automaticamente pelo próprio workflow.

### Sobre o horário dos agendamentos (cron)

Os horários evitam cair exatamente em hora cheia (ex: `22:00`), porque o GitHub avisa que agendamentos assim são os mais sujeitos a atraso ou até serem descartados (é quando mais workflows do mundo inteiro tentam rodar ao mesmo tempo). Por isso usamos `22:05` em vez de `22:00`, por exemplo.

## Arquivos

- `scripts/post-player-count.js` — busca o número de jogadores online e posta no Discord, apagando a mensagem de contagem anterior antes.
- `scripts/player-count-state.json` — guarda o ID da última mensagem de contagem postada (pra saber qual apagar). Atualizado automaticamente.
- `scripts/post-news.js` — busca notícias oficiais do WARDOGS, traduz pra português e posta as que ainda não foram postadas (ou a mais recente, se rodado manualmente).
- `scripts/state.json` — guarda quais notícias já foram postadas (evita repetir). Atualizado automaticamente.
- `.github/workflows/wardogs-player-count.yml` — agendamento da contagem de jogadores (diário + fim de semana).
- `.github/workflows/wardogs-news.yml` — agendamento da checagem de notícias (a cada 30 min).

## Configuração (caso precise refazer do zero)

### 1. Repositório no GitHub

Pode ser público ou privado — o Secret do webhook fica protegido de qualquer forma (esse repositório está **público**, visível no perfil do GitHub).

### 2. Subir os arquivos

Pelo site do GitHub:
- Pastas/arquivos comuns → **Add file → Upload files** (arrastar).
- A pasta `.github/workflows` não sobe direito arrastando — para cada arquivo `.yml`, use **Add file → Create new file** e digite o caminho completo no nome (ex: `.github/workflows/wardogs-player-count.yml`), o GitHub cria as pastas sozinho.

### 3. Configurar o Secret do webhook

**Settings → Secrets and variables → Actions → New repository secret**
- Nome: `DISCORD_WEBHOOK_URL`
- Valor: a URL do webhook "WARDOGS Stats" (Discord → Editar canal → Integrações → Webhooks)

Trate essa URL como senha — quem tiver ela consegue postar no canal.

### 4. Testar

Aba **Actions** → escolhe o workflow → **Run workflow**. Confere no Discord se a mensagem chegou. Rodar duas vezes seguidas no de contagem de jogadores é uma boa forma de confirmar que a mensagem antiga está sendo apagada certinho.

## Personalização

- **Avatar do bot**: Discord → canal → Editar canal → Integrações → Webhooks → clique no avatar do "WARDOGS Stats" → escolher imagem.
- **Horários**: edite os valores de `cron:` nos arquivos `.yml` (formato `minuto hora diaDoMes mes diaDaSemana`, sempre em UTC — Brasília é UTC-3 o ano todo).
- **Frequência da checagem de notícias**: hoje a cada 30 min (`*/30 * * * *`), pode deixar mais ou menos frequente mudando esse valor.
