import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set in .env');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // ваш chat_id администратора
const WEBAPP_URL = process.env.WEBAPP_URL || '';

const bot = new Bot(token);

// На всякий случай отключаем вебхук, чтобы polling работал
(async () => {
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log('Webhook deleted (if was set). Switching to polling...');
  } catch (e) {
    console.warn('deleteWebhook failed:', e.message || e);
  }
})();

// /start с кнопкой "Открыть игру"
bot.command('start', async (ctx) => {
  const kb = new InlineKeyboard().webApp('Открыть игру', WEBAPP_URL);
  await ctx.reply('Привет! Запускай мини-игру 👇', { reply_markup: kb });
});

// Вспомогательные команды
bot.command('ping', (ctx) => ctx.reply('pong ✅'));
bot.command('id', (ctx) => ctx.reply(`Ваш chat_id: ${ctx.chat?.id}`));

// Эхо на обычные сообщения (для проверки, что бот жив)
bot.on('message:text', async (ctx) => {
  // Если это не web_app_data, просто ответим коротко
  await ctx.reply(`Принято: "${ctx.message.text}"`);
});

// Обработка данных из мини-аппа (WebAppData)
bot.on('message', async (ctx) => {
  const data = ctx.message?.web_app_data?.data;
  if (!data) return;

  let payload;
  try {
    payload = JSON.parse(data);
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

    // Админу
    if (ADMIN_CHAT_ID) {
      try {
        await bot.api.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Send to admin failed:', e);
      }
    }

    // Игроку — подтверждение
    try {
      await ctx.reply('Результат зафиксирован! Спасибо за игру 🙌');
    } catch {}
  }
});

bot.start().then(() => console.log('Bot is running (polling)...'));
