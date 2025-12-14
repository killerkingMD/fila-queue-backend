
import TelegramBot from "node-telegram-bot-api";
import { Octokit } from "@octokit/rest";

/* ================= CONFIG ================= */

const BOT_TOKEN = "NOVO_BOT_TOKEN_AQUI";
const GROUP_ID = -100609517172; // grupo correto
const ADMIN_IDS = [565855757];

const GITHUB_TOKEN = "NOVO_GITHUB_TOKEN_AQUI";
const OWNER = "killerkingMD";
const REPO = "queue-backend";
const FILE_PATH = "fila.json";
const BRANCH = "main";

/* ================= INIT ================= */

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/* ================= GITHUB ================= */

async function loadFila() {
  const { data } = await octokit.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: FILE_PATH
  });

  const content = Buffer.from(data.content, "base64").toString();
  return { fila: JSON.parse(content), sha: data.sha };
}

async function saveFila(fila, sha, msg) {
  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: FILE_PATH,
    message: msg,
    content: Buffer.from(JSON.stringify(fila, null, 2)).toString("base64"),
    sha,
    branch: BRANCH
  });
}

/* ================= HELPERS ================= */

function mention(user, id) {
  return user ? `@${user}` : `<a href="tg://user?id=${id}">usuário</a>`;
}

/* ================= COMMANDS ================= */

bot.on("message", async (msg) => {
  if (!msg.text) return;
  if (msg.chat.id !== GROUP_ID) return;

  const text = msg.text.trim();
  const user = msg.from.username || null;
  const userId = msg.from.id;
  const isAdmin = ADMIN_IDS.includes(userId);

  /* ===== /pedido ===== */
  if (text.startsWith("/pedido")) {
    const nome = text.replace("/pedido", "").trim();
    if (!nome) return;

    const { fila, sha } = await loadFila();

    fila.pedidos.push({
      id: Date.now(),
      app: nome,
      user: user || "anon",
      userId,
      status: "NA_FILA"
    });

    await saveFila(fila, sha, `Novo pedido: ${nome}`);

    bot.sendMessage(
      GROUP_ID,
      `📥 Pedido registrado:\n<b>${nome}</b>\n${mention(user, userId)}`,
      { parse_mode: "HTML" }
    );
  }

  /* ===== /fila ===== */
  if (text === "/fila") {
    const { fila } = await loadFila();

    if (fila.pedidos.length === 0) {
      bot.sendMessage(GROUP_ID, "Fila vazia.");
      return;
    }

    const lista = fila.pedidos
      .filter(p => p.status === "NA_FILA")
      .map((p, i) => `${i + 1}. ${p.app} (${mention(p.user, p.userId)})`)
      .join("\n");

    bot.sendMessage(GROUP_ID, `📌 <b>Fila</b>\n\n${lista}`, {
      parse_mode: "HTML"
    });
  }

  /* ===== ADMIN ===== */
  if (isAdmin && text === "/atender") {
    const { fila, sha } = await loadFila();

    if (fila.pedidos.some(p => p.status === "EM_ATENDIMENTO")) return;

    const next = fila.pedidos.find(p => p.status === "NA_FILA");
    if (!next) return;

    next.status = "EM_ATENDIMENTO";
    await saveFila(fila, sha, `Atendendo ${next.app}`);

    bot.sendMessage(GROUP_ID, `▶️ Em atendimento: ${next.app}`);
  }

  if (isAdmin && text === "/finalizar") {
    const { fila, sha } = await loadFila();

    const atual = fila.pedidos.find(p => p.status === "EM_ATENDIMENTO");
    if (!atual) return;

    atual.status = "CONCLUIDO";
    await saveFila(fila, sha, `Concluído ${atual.app}`);

    bot.sendMessage(GROUP_ID, `✅ Concluído: ${atual.app}`);
  }
});
