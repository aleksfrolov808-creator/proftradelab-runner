import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN)
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID

bot.command('start', ctx => {
  const kb = new InlineKeyboard().webApp('Открыть игру', process.env.WEBAPP_URL)
  ctx.reply('Добро пожаловать! Нажмите кнопку, чтобы открыть игру:', { reply_markup: kb })
})

bot.command('id', ctx => ctx.reply(`Ваш chat_id: ${ctx.chat.id}`))

bot.on('message:web_app_data', async ctx => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data)
    if (data.type === 'lead') {
      const p = data.profile || {}
      const text =
`📋 Новый участник из игры ПрофТрейдЛаб

👤 ${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}
📞 ${p.phone || '-'}
📧 ${p.email || '-'}
🏆 Очки: ${data.best}
🎁 Приз: ${getPrize(data.best)}
⏰ Завершено: ${formatTime(data.endedAt)}`

      if (ADMIN_CHAT_ID) await ctx.api.sendMessage(ADMIN_CHAT_ID, text)
      else await ctx.reply('Результат получен, но ADMIN_CHAT_ID не указан в .env')
    }
  } catch (e) {
    console.error('Ошибка обработки данных:', e)
    await ctx.reply('Произошла ошибка при обработке данных.')
  }
})

function getPrize(p) {
  if (p >= 70) return 'Термос'
  if (p >= 50) return 'Шоппер'
  if (p >= 30) return 'Блокнот и ручка'
  if (p >= 20) return 'Брелок'
  return '—'
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = d.toLocaleDateString('ru-RU')
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

bot.start()
