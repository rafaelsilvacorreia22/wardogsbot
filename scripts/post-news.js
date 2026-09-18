import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APPID = 1867240; // WARDOGS na Steam
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const STATE_PATH = fileURLToPath(new URL("./state.json", import.meta.url));

function loadState() {
  if (!existsSync(STATE_PATH)) return { postedGids: [] };
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { postedGids: [] };
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function stripHtml(str) {
  return str
    .replace(/\[[^\]]*\]/g, "") // remove tags tipo [b] [i] do BBCode da Steam
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

async function main() {
  if (!WEBHOOK_URL) {
    throw new Error("DISCORD_WEBHOOK_URL nao definido (configure como secret no GitHub Actions).");
  }

  const res = await fetch(
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${APPID}&count=5&maxlength=600&format=json`
  );
  if (!res.ok) {
    throw new Error(`Steam News API respondeu ${res.status}`);
  }
  const data = await res.json();
  const items = data?.appnews?.newsitems ?? [];

  // so posts oficiais do desenvolvedor (Bulkhead) na propria pagina Steam da comunidade,
  // sem misturar materia de imprensa (Rock Paper Shotgun, PCGamesN, SteamDB etc.)
  const officialItems = items.filter((item) => item.feedname === "steam_community_announcements");

  const state = loadState();
  const posted = new Set(state.postedGids ?? []);

  // posta do mais antigo pro mais novo, pra manter ordem cronologica no canal
  const newItems = officialItems.filter((item) => !posted.has(item.gid)).sort((a, b) => a.date - b.date);

  if (newItems.length === 0) {
    console.log("Nenhuma noticia nova.");
    return;
  }

  for (const item of newItems) {
    const summary = stripHtml(item.contents).slice(0, 500);
    const content = `📰 **WARDOGS — ${item.title}**\n${summary}${
      summary.length >= 500 ? "…" : ""
    }\n${item.url}`;

    const postRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!postRes.ok) {
      throw new Error(`Falha ao postar no Discord: ${postRes.status} ${await postRes.text()}`);
    }

    posted.add(item.gid);
    console.log("Postado:", item.title);
  }

  state.postedGids = Array.from(posted).slice(-50); // guarda só os ultimos 50 ids
  saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
