import fs from "fs";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";

/* ================= CONFIG ================= */

const BOT_TOKEN = "SEU_TOKEN_AQUI";
const GROUP_ID = -100609517172;

const GITHUB_TOKEN = "SEU_GITHUB_TOKEN";
const REPO = "SEU_USUARIO/queue-backend";
const FILE_PATH = "fila.json";
const BRANCH = "main";

/* ================= BOT ================= */

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================= GITHUB ================= */

async function loadFila() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
  );
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString();
  return { json: JSON.parse(content), sha: data.sha };
}

async function saveFila(json, sha, msg) {
  await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: msg,
        content: Buffer.from(JSON.stringify(json, null, 2)).toString("base64"),
        sha,
        branch: BRANCH
      })
    }
  );
}

/* ================= COMANDOS ================= */

bot.on("message", async (msg) => {
  if (msg.chat.id !== GROUP_ID) return;
  if (!msg.text) return;

  const text = msg.text.trim();
  const user = msg.from.username || "anon";
  const userId = msg.from.id;

  // /pedido Nome do app
  if (text.startsWith("/pedido")) {
    const app = text.replace("/pedido", "").trim();
    if (!app) return;

    const { json, sha } = await loadFila();

    if (json.pedidos.some(p => p.userId === userId && p.status !== "CONCLUIDO")) {
      bot.sendMessage(GROUP_ID, "❌ Você já tem um pedido ativo.");
      return;
    }

    json.pedidos.push({
      id: Date.now(),
      app,
      user,
      userId,
      status: "NA_FILA",
      timestamp: Date.now()
    });

    await saveFila(json, sha, `Novo pedido: ${app}`);
    bot.sendMessage(
      GROUP_ID,
      `📥 Pedido registrado: *${app}*\n@${user}`,
      { parse_mode: "Markdown" }
    );
  }

  // /fila
  if (text === "/fila") {
    const { json } = await loadFila();

    if (json.pedidos.length === 0) {
      bot.sendMessage(GROUP_ID, "Fila vazia.");
      return;
    }

    const fila = json.pedidos
      .filter(p => p.status === "NA_FILA")
      .map((p, i) => `${i + 1}. ${p.app} (@${p.user})`)
      .join("\n");

    bot.sendMessage(GROUP_ID, `📌 *Fila*\n\n${fila}`, {
      parse_mode: "Markdown"
    });
  }
});