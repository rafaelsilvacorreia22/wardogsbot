# WARDOGS Bot — Gamepass Brasil

Posta automaticamente no canal `#estratégia-de-battle` do Discord:

- Todo dia às 19h (horário de Brasília): número de jogadores online do WARDOGS na Steam.
- A cada 30 minutos: novidades/patch notes **oficiais** do WARDOGS (postados pela própria Bulkhead na Steam — não pega matéria de imprensa tipo Rock Paper Shotgun, PCGamesN etc.).

Roda 100% no GitHub Actions — depois de configurado, funciona sozinho, sem precisar de nada ligado no seu computador.

## Passo a passo pra colocar no ar

### 1. Criar um repositório no GitHub

1. Entre em https://github.com/new (crie uma conta grátis se ainda não tiver).
2. Dê um nome, ex: `wardogs-bot`.
3. Marque como **Private** (não precisa ser público).
4. Clique em "Create repository".

### 2. Subir estes arquivos

Mais fácil sem usar linha de comando:

1. No repositório recém-criado, clique em "uploading an existing file" (ou "Add file" → "Upload files").
2. Arraste esta pasta inteira (`wardogs-bot`) — incluindo a subpasta `.github` e `scripts` — pra dentro da área de upload. Se o GitHub não aceitar pastas ocultas tipo `.github` no drag-and-drop, use o passo com Git abaixo.
3. Clique em "Commit changes".

**Ou, se preferir usar Git** (linha de comando, dentro desta pasta `wardogs-bot`):

```bash
git init
git add .
git commit -m "wardogs bot inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/wardogs-bot.git
git push -u origin main
```

### 3. Configurar o webhook do Discord como Secret

O link do webhook dá acesso pra postar no canal — trate como senha, nunca deixe direto no código.

1. No repositório, vá em **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret**.
3. Nome: `DISCORD_WEBHOOK_URL`
4. Valor: a URL do webhook "WARDOGS Stats" (a mesma que já está configurada no canal `#estratégia-de-battle`).
5. Salvar.

### 4. Testar

1. Vá na aba **Actions** do repositório.
2. Se aparecer um aviso pra habilitar Actions, habilite.
3. Clique no workflow **WARDOGS - Jogadores online** → **Run workflow** → **Run workflow** de novo pra confirmar.
4. Faça o mesmo para **WARDOGS - Noticias oficiais / patch notes**.
5. Confira no Discord se a mensagem de teste chegou.

Depois disso, os dois workflows rodam sozinhos pelos horários configurados (`.github/workflows/*.yml`), para sempre, sem depender do Claude nem do seu computador.

## Arquivos

- `scripts/post-player-count.js` — busca o número de jogadores online (Steam API) e posta no Discord.
- `scripts/post-news.js` — busca notícias oficiais do WARDOGS e posta as que ainda não foram postadas.
- `scripts/state.json` — guarda quais notícias já foram postadas (evita repetir). É atualizado e commitado automaticamente pelo workflow de notícias.
- `.github/workflows/` — os dois agendamentos (cron) do GitHub Actions.
