import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APPID = 1867240; // WARDOGS na Steam
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const STATE_PATH = fileURLToPath(new URL("./player-count-state.json", import.meta.url));

function loadState() {
  if (!existsSync(STATE_PATH)) return { lastMessageId: null };
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { lastMessageId: null };
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

// icone da linha do ouro. Pra usar um emoji customizado do servidor, troque por
// "<:nome_do_emoji:ID_DO_EMOJI>" (no Discord: digite \:nome_do_emoji: pra ver o codigo)
const GOLD_ICON = "🪙";

// preco atual da barra de ouro (em cash do jogo), vindo do MetaForge. Se falhar
// por qualquer motivo, devolve null e o bot posta so a contagem de jogadores.
async function fetchGoldPrice() {
  try {
    const res = await fetch("https://metaforge.app/api/wardogs/market", {
      headers: {
        "User-Agent": "wardogs-discord-bot (+https://github.com/rafaelsilvacorreia22/wardogsbot)",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`MetaForge respondeu ${res.status}`);
    }
    const data = await res.json();
    const price = data?.stats?.current ?? data?.points?.at(-1)?.price;
    if (typeof price !== "number") {
      throw new Error("resposta do MetaForge sem preco valido");
    }
    return price;
  } catch (err) {
    console.log("Nao consegui buscar o valor do ouro:", err.message);
    return null;
  }
}

async function main() {
  if (!WEBHOOK_URL) {
    throw new Error("DISCORD_WEBHOOK_URL nao definido (configure como secret no GitHub Actions).");
  }

  const res = await fetch(
    `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${APPID}`
  );
  if (!res.ok) {
    throw new Error(`Steam API respondeu ${res.status}`);
  }
  const data = await res.json();
  const count = data?.response?.player_count;

  if (typeof count !== "number") {
    console.log("Sem numero de jogadores na resposta da Steam, abortando sem postar.");
    return;
  }

  const state = loadState();

  // apaga a mensagem de contagem anterior antes de postar a nova, pra nao acumular
  // varias mensagens de contagem no canal
  if (state.lastMessageId) {
    const deleteRes = await fetch(`${WEBHOOK_URL}/messages/${state.lastMessageId}`, {
      method: "DELETE",
    });
    if (!deleteRes.ok && deleteRes.status !== 404) {
      console.log(
        `Aviso: nao consegui apagar a mensagem anterior (status ${deleteRes.status}), seguindo mesmo assim.`
      );
    }
  }

  const formatted = count.toLocaleString("pt-BR");
  let content = `🐺 **WARDOGS** agora: **${formatted}** jogadores online na Steam`;

  const goldPrice = await fetchGoldPrice();
  if (goldPrice !== null) {
    content += `\n${GOLD_ICON} Valor do ouro hoje: **$${goldPrice.toLocaleString("pt-BR")}**`;
  }

  // ?wait=true faz o Discord devolver a mensagem criada (com o id dela), em vez de
  // uma resposta vazia
  const postRes = await fetch(`${WEBHOOK_URL}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!postRes.ok) {
    throw new Error(`Falha ao postar no Discord: ${postRes.status} ${await postRes.text()}`);
  }

  const posted = await postRes.json();
  state.lastMessageId = posted.id;
  saveState(state);

  console.log("Postado:", content, "- id:", posted.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
