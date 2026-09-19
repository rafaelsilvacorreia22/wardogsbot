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
  const content = `🐺 **WARDOGS** agora: **${formatted}** jogadores online na Steam`;

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
