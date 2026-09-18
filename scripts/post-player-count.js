const APPID = 1867240; // WARDOGS na Steam
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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

  const formatted = count.toLocaleString("pt-BR");
  const content = `🐺 **WARDOGS** agora: **${formatted}** jogadores online na Steam`;

  const postRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!postRes.ok) {
    throw new Error(`Falha ao postar no Discord: ${postRes.status} ${await postRes.text()}`);
  }

  console.log("Postado:", content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
