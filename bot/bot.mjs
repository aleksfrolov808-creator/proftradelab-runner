import 'dotenv/config'
import fs from 'fs'
import { Bot, InlineKeyboard } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN)
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
const LEADS_FILE = './bot/leads.csv'

if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, 'Дата,Фамилия,Имя,Отчество,Телефон,Email,Очки,Приз\n', 'utf8')
}

bot.command('start', ctx => {
  const kb = new InlineKeyboard().webApp('Открыть игру', process.env.WEBAPP_URL)
  ctx.reply('Нажмите кнопку, чтобы открыть игру:', { reply_markup: kb })
})

bot.command('id', ctx => ctx.reply(`Ваш chat_id: ${ctx.chat.id}`))

bot.on('message:web_app_data', async ctx => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data)
    if (data.type === 'lead') {
      const p = data.profile || {}
      const best = data.best || 0
      const prize = getPrize(best)
      const line = [
        new Date().toLocaleString('ru-RU'),
        p.lastName || '',
        p.firstName || '',
        p.middleName || '',
        p.phone || '',
        p.email || '',
        best,
        prize
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
      fs.appendFileSync(LEADS_FILE, line, 'utf8')

      const msg =
`📋 Новый участник
👤 ${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}
📞 ${p.phone || '-'}
📧 ${p.email || '-'}
🏆 Очки: ${best}
🎁 Приз: ${prize}`

      if (ADMIN_CHAT_ID) await ctx.api.sendMessage(ADMIN_CHAT_ID, msg)
      else await ctx.reply('Результат записан.')
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

bot.start()
