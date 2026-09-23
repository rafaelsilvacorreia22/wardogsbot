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

const MYMEMORY_MAX_CHARS = 490; // limite pratico da API gratuita do MyMemory por requisicao

async function translateWithMyMemory(text) {
  if (text.length > MYMEMORY_MAX_CHARS) {
    throw new Error(`texto longo demais para o MyMemory (${text.length} caracteres)`);
  }
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pt-BR`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MyMemory respondeu ${res.status}`);
  }
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || data.responseStatus !== 200) {
    throw new Error("MyMemory nao retornou uma traducao valida");
  }
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated)) {
    throw new Error(`MyMemory recusou a traducao: ${translated}`);
  }
  return translated;
}

async function translateWithGoogle(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(
    text
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Translate respondeu ${res.status}`);
  }
  const data = await res.json();
  return data[0].map((chunk) => chunk[0]).join("");
}

// traduz ingles -> portugues do Brasil. Usa o MyMemory como servico principal
// (traduz melhor esse tipo de texto curto e nao precisa de chave de API) e cai
// pro Google Translate como reserva se o MyMemory falhar ou recusar (ex: texto
// longo demais). Se os dois falharem, devolve o texto original em ingles em vez
// de quebrar o bot.
async function translateToPtBr(text) {
  if (!text) return text;
  try {
    return await translateWithMyMemory(text);
  } catch (err) {
    console.log("MyMemory falhou, tentando Google Translate:", err.message);
  }
  try {
    return await translateWithGoogle(text);
  } catch (err) {
    console.log("Google Translate tambem falhou, usando texto original:", err.message);
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

  // so posts oficiais do desenvolvedor (Bulkhead) na propria pagina Steam da comunidade,
  // sem misturar materia de imprensa (Rock Paper Shotgun, PCGamesN, SteamDB etc.)
  const officialItems = items.filter((item) => item.feedname === "steam_community_announcements");

  const state = loadState();
  const posted = new Set(state.postedGids ?? []);

  // quando roda manual (botao "Run workflow"), sempre manda a noticia oficial mais
  // recente, mesmo que ja tenha sido postada antes. Quando roda pelo agendamento,
  // so manda as que ainda nao foram postadas.
  const isManualRun = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

  let itemsToPost;
  if (isManualRun) {
    const latest = officialItems[0]; // API retorna a mais recente primeiro
    itemsToPost = latest ? [latest] : [];
    if (itemsToPost.length === 0) {
      console.log("Nenhuma noticia oficial encontrada.");
      return;
    }
  } else {
    // posta do mais antigo pro mais novo, pra manter ordem cronologica no canal
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

  state.postedGids = Array.from(posted).slice(-50); // guarda só os ultimos 50 ids
  saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
