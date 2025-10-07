import 'dotenv/config'
import fs from 'fs'
import { Bot, InlineKeyboard } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN)
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
const LEADS_FILE = './bot/leads.csv'

if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, 'Дата,Фамилия,Имя,Отчество,Телефон,Email,Очки,Приз,Завершено\n', 'utf8')
}

bot.command('start', ctx => {
  const kb = new InlineKeyboard().webApp('Открыть игру', process.env.WEBAPP_URL)
  ctx.reply('Нажмите кнопку, чтобы открыть игру:', { reply_markup: kb })
})

bot.command('id', ctx => ctx.reply(`Ваш chat_id: ${ctx.chat.id}`))

bot.on('message:web_app_data', async ctx => {
  try {
    const raw = ctx.message.web_app_data.data || '{}'
    const data = JSON.parse(raw)
    const isLead = data.type === 'lead' || data.type === 'session_result'
    if (!isLead) {
      await ctx.reply('Пришли данные неизвестного типа, жду "lead" или "session_result".')
      return
    }

    const p = data.profile || {}
    const best = Number(data.best || 0)
    const prize = getPrize(best)
    const endedAt = data.endedAt || new Date().toISOString()

    const line = [
      new Date().toLocaleString('ru-RU'),
      p.lastName || '',
      p.firstName || '',
      p.middleName || '',
      p.phone || '',
      p.email || '',
      best,
      prize,
      endedAt
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'

    fs.appendFileSync(LEADS_FILE, line, 'utf8')

    const msg =
`📋 Новый участник
👤 ${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}
📞 ${p.phone || '-'}
📧 ${p.email || '-'}
🏆 Очки: ${best}
🎁 Приз: ${prize}
⏰ Завершено: ${new Date(endedAt).toLocaleString('ru-RU')}`

    if (ADMIN_CHAT_ID) await ctx.api.sendMessage(ADMIN_CHAT_ID, msg)
    await ctx.reply('Результат получен ✅')
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

bot.start()
