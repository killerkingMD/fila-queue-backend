
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import { Octokit } from "@octokit/rest";

const BOT_TOKEN = "8231605933:AAEez15jvh0JWA94TflelS9RU-oelwJT-Rg";
const ADMIN_IDS = [565855757];

const octokit = new Octokit({ auth: "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" });

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const OWNER = "killerkingMD";
const REPO = "queue-backend";
const PATH = "fila.json";
const BRANCH = "main";

async function loadFila() {
  const { data } = await octokit.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: PATH
  });

  const json = Buffer.from(data.content, "base64").toString();
  return { fila: JSON.parse(json), sha: data.sha };
}

async function saveFila(fila, sha) {
  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: PATH,
    message: "update fila",
    content: Buffer.from(JSON.stringify(fila, null, 2)).toString("base64"),
    sha,
    branch: BRANCH
  });
}

/* ===== COMANDOS ===== */

bot.onText(/\/pedido (.+)/, async (msg, match) => {
  const nome = match[1];
  const user = msg.from.username || "anon";

  const { fila, sha } = await loadFila();

  fila.pedidos.push({
    id: Date.now(),
    app: nome,
    user,
    status: "NA_FILA"
  });

  await saveFila(fila, sha);
  bot.sendMessage(msg.chat.id, `✅ Pedido registrado: ${nome}`);
});

bot.onText(/\/atender/, async (msg) => {
  if (!ADMIN_IDS.includes(msg.from.id)) return;

  const { fila, sha } = await loadFila();

  if (fila.pedidos.some(p => p.status === "EM_ATENDIMENTO")) return;

  const next = fila.pedidos.find(p => p.status === "NA_FILA");
  if (!next) return;

  next.status = "EM_ATENDIMENTO";
  await saveFila(fila, sha);

  bot.sendMessage(msg.chat.id, `▶️ Em atendimento: ${next.app}`);
});

bot.onText(/\/finalizar/, async (msg) => {
  if (!ADMIN_IDS.includes(msg.from.id)) return;

  const { fila, sha } = await loadFila();

  const atual = fila.pedidos.find(p => p.status === "EM_ATENDIMENTO");
  if (!atual) return;

  atual.status = "CONCLUIDO";
  await saveFila(fila, sha);

  bot.sendMessage(msg.chat.id, `✅ Concluído: ${atual.app}`);
});
