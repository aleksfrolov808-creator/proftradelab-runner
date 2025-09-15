import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set in .env');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ''; // заполни в .env после /id
const WEBAPP_URL = process.env.WEBAPP_URL || '';

const bot = new Bot(token);

// Отключаем вебхук, чтобы точно работал long polling
(async () => {
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log('Webhook deleted (if was set). Switching to polling...');
  } catch (e) {
    console.warn('deleteWebhook failed:', e?.message || e);
  }
})();

// /start — кнопка для открытия мини-аппа
bot.command('start', async (ctx) => {
  const kb = new InlineKeyboard().webApp('Открыть игру', WEBAPP_URL);
  await ctx.reply(`Привет! Запускай мини-игру 👇\nВаш chat_id: ${ctx.chat?.id}`, { reply_markup: kb });
});

// /id — подсказка chat_id
bot.command('id', (ctx) => ctx.reply(`Ваш chat_id: ${ctx.chat?.id}`));

// /ping — быстрый тест
bot.command('ping', (ctx) => ctx.reply('pong ✅'));

// Эхо для обычных сообщений — удобно проверить, что бот жив
bot.on('message:text', async (ctx) => {
  // Не перехватываем web_app_data, обрабатывается ниже
  if (!ctx.message.web_app_data) {
    await ctx.reply(`Эхо: ${ctx.message.text}`);
  }
});

// Приём данных из мини-аппа (WebAppData)
bot.on('message', async (ctx) => {
  const raw = ctx.message?.web_app_data?.data;
  if (!raw) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  if (payload.type === 'session_result') {
    const p = payload.profile || {};
    const best = payload.best ?? 0;
    const prize = best >= 70 ? 'Термос'
                : best >= 50 ? 'Шоппер'
                : best >= 30 ? 'Блокнот и ручка'
                : best >= 20 ? 'Брелок'
                : '—';
    const when = new Date(payload.ts || Date.now()).toLocaleString('ru-RU');

    const text =
`🎮 *Итог сессии*
• Дата/время: ${when}
• Игрок: ${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}
• Телефон: ${p.phone || '-'}
• Email: ${p.email || '-'}
• Лучший счёт: *${best}*
• Приз: *${prize}*`;

    // Сообщение админу
    if (ADMIN_CHAT_ID) {
      try {
        await bot.api.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Send to admin failed:', e);
      }
    }

    // Подтверждение игроку
    try {
      await ctx.reply('Результат зафиксирован! Спасибо за игру 🙌');
    } catch {}
  }
});

bot.catch((err) => console.error('BOT ERROR:', err));
bot.start().then(() => console.log('Bot is running (polling)...'));
