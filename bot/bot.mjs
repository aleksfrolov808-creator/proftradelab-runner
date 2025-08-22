@'
import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import express from "express";
import Database from "better-sqlite3";
import cors from "cors";

// --- Telegram Bot ---
const bot = new Bot(process.env.BOT_TOKEN);
const webAppUrl = process.env.WEBAPP_URL;

// Кнопка запуска мини‑приложения
bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎮 Играть", webAppUrl);
  await ctx.reply("ПрофТрейдЛаб — запусти мини‑приложение:", { reply_markup: kb });
});

// --- База данных (SQLite) ---
const db = new Database("data.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id INTEGER,
    fio TEXT,
    phone TEXT,
    email TEXT,
    points INTEGER,
    ts DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scores_points ON scores(points DESC);
`);

// Принимаем результат из WebApp (sendData)
bot.on("message:web_app_data", async (ctx) => {
  try {
    const payload = JSON.parse(ctx.message.web_app_data.data || "{}");
    // ожидаем { type: 'session_result', profile: {fio, phone, email}, best }
    if (payload?.type === "session_result") {
      const { profile, best } = payload;
      const fio = String(profile?.fio || "").slice(0, 200);
      const phone = String(profile?.phone || "").slice(0, 60);
      const email = String(profile?.email || "").slice(0, 120);
      const points = Math.max(0, Number(best) || 0);

      const tg_user_id = ctx.from?.id || null;

      const ins = db.prepare(`
        INSERT INTO scores (tg_user_id, fio, phone, email, points)
        VALUES (@tg_user_id, @fio, @phone, @email, @points)
      `);
      ins.run({ tg_user_id, fio, phone, email, points });

      await ctx.reply(`Результат сохранён ✅  (очки: ${points})`);
    } else {
      await ctx.reply("Получены данные, но тип неизвестен.");
    }
  } catch (e) {
    await ctx.reply("Ошибка при разборе данных из WebApp.");
  }
});

// На любое сообщение — повтор кнопки
bot.on("message", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🎮 Играть", webAppUrl);
  await ctx.reply("Открыть игру:", { reply_markup: kb });
});

// --- HTTP API (для WebApp) ---
const app = express();
app.use(express.json());

// Разрешаем CORS с вашего GitHub Pages
const allowedOrigin = process.env.API_ORIGIN;
app.use(cors({
  origin: allowedOrigin ? [allowedOrigin] : false
}));

// Топ‑10 по очкам (последние лучшие)
app.get("/api/top10", (req, res) => {
  const top = db.prepare(`
    SELECT fio, points, ts FROM scores
    ORDER BY points DESC, ts DESC
    LIMIT 10
  `).all();
  res.json({ top });
});

// Запуск бота (long polling) и API
const port = process.env.PORT || 3000;

bot.start();
console.log("Bot is running");

app.listen(port, () => {
  console.log("HTTP API on port", port);
});
'@ | Set-Content -Encoding UTF8 bot\bot.mjs
