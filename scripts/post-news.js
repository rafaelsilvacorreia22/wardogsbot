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
    .replace(/\[[^\]]*\]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

// traduz um texto (ingles) pra portugues do Brasil usando o endpoint publico e
// gratuito do Google Translate (sem precisar de chave de API). Se falhar por
// qualquer motivo, devolve o texto original em ingles em vez de quebrar o bot.
async function translateToPtBr(text) {
  if (!text) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(
      text
    )}`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    return data[0].map((chunk) => chunk[0]).join("");
  } catch (err) {
    console.log("Falha ao traduzir, usando texto original:", err.message);
    return text;
  }
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

  const officialItems = items.filter((item) => item.feedname === "steam_community_announcements");

  const state = loadState();
  const posted = new Set(state.postedGids ?? []);

  const isManualRun = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

  let itemsToPost;
  if (isManualRun) {
    const latest = officialItems[0];
    itemsToPost = latest ? [latest] : [];
    if (itemsToPost.length === 0) {
      console.log("Nenhuma noticia oficial encontrada.");
      return;
    }
  } else {
    itemsToPost = officialItems.filter((item) => !posted.has(item.gid)).sort((a, b) => a.date - b.date);
    if (itemsToPost.length === 0) {
      console.log("Nenhuma noticia nova.");
      return;
    }
  }

  for (const item of itemsToPost) {
    const rawSummary = stripHtml(item.contents);
    const [translatedTitle, translatedSummaryFull] = await Promise.all([
      translateToPtBr(item.title),
      translateToPtBr(rawSummary),
    ]);
    const summary = translatedSummaryFull.slice(0, 500);
    const content = `📰 **WARDOGS — ${translatedTitle}**\n${summary}${
      translatedSummaryFull.length > 500 ? "…" : ""
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

  state.postedGids = Array.from(posted).slice(-50);
  saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
