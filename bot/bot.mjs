import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set in .env');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // например: 123456789
const WEBAPP_URL = process.env.WEBAPP_URL || '';

const bot = new Bot(token);

// /start с кнопкой "Открыть игру"
bot.command('start', ctx => {
  const kb = new InlineKeyboard().webApp('Открыть игру', WEBAPP_URL);
  return ctx.reply('Привет! Запускай мини-игру 👇', { reply_markup: kb });
});

// Команда /id — чтобы узнать id чата (удобно для ADMIN_CHAT_ID)
bot.command('id', ctx => ctx.reply(`Ваш chat_id: ${ctx.chat?.id}`));

// Приходит от WebApp: ctx.message.web_app_data.data
bot.on('message', async ctx => {
  const data = ctx.message?.web_app_data?.data;
  if (!data) return; // обычные сообщения игнорим

  let payload;
  try { payload = JSON.parse(data); } catch (e) { return; }

  if (payload.type === 'session_result') {
    const p = payload.profile || {};
    const best = payload.best ?? 0;
    const prize = (best>=70?'Термос':best>=50?'Шоппер':best>=30?'Блокнот и ручка':best>=20?'Брелок':'—');
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

    // Короткий ответ игроку
    try {
      await ctx.reply('Результат зафиксирован! Спасибо за игру 🙌');
    } catch (e) {}
  }
});

bot.start();
console.log('Bot is running');
