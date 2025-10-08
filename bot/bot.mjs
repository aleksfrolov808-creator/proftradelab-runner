import 'dotenv/config'
import fs from 'fs'
import { Bot, InlineKeyboard } from 'grammy'

const token = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
const LEADS_FILE = new URL('./leads.csv', import.meta.url).pathname

if (!token) {
  console.error('Нет BOT_TOKEN в .env')
  process.exit(1)
}

const bot = new Bot(token)

await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(()=>{})

const me = await bot.api.getMe()
console.log(`Bot: @${me.username} (${me.id})`)
console.log(`WEBAPP_URL: ${WEBAPP_URL}`)
console.log(`ADMIN_CHAT_ID: ${ADMIN_CHAT_ID || '-'}`)
console.log(`CSV: ${LEADS_FILE}`)

if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, 'Дата,Фамилия,Имя,Отчество,Телефон,Email,Очки,Приз\n', 'utf8')
  console.log('CSV создан')
}

bot.command('start', async (ctx) => {
  const kb = new InlineKeyboard().webApp('Открыть игру', WEBAPP_URL)
  await ctx.reply('Нажмите, чтобы открыть игру:', { reply_markup: kb })
})

bot.command('id', (ctx) => ctx.reply(`Ваш chat_id: ${ctx.chat.id}`))
bot.command('ping', (ctx) => ctx.reply('pong'))

bot.on('message:web_app_data', async (ctx) => {
  try {
    const raw = ctx.message.web_app_data.data || '{}'
    console.log('web_app_data RAW:', raw)
    const data = JSON.parse(raw)

    if (data.type !== 'lead') {
      await ctx.reply('Ок 👍')
      return
    }

    const p = data.profile || {}
    const best = Number(data.best || 0)
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
    console.log('APPENDED to CSV')

    const msg = [
      '📋 Новый участник',
      `👤 ${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}`.trim(),
      `📞 ${p.phone || '-'}`,
      `📧 ${p.email || '-'}`,
      `🏆 Очки: ${best}`,
      `🎁 Приз: ${prize}`
    ].join('\n')

    if (ADMIN_CHAT_ID) {
      await ctx.api.sendMessage(ADMIN_CHAT_ID, msg)
    }
    await ctx.reply('Результат получен ✅')
  } catch (e) {
    console.error('web_app_data error:', e)
    await ctx.reply('Ошибка обработки данных.')
  }
})

function getPrize(p) {
  if (p >= 70) return 'Термос'
  if (p >= 50) return 'Шоппер'
  if (p >= 30) return 'Блокнот и ручка'
  if (p >= 20) return 'Брелок'
  return '—'
}

bot.on('message', (ctx) => {
  console.log('message:', ctx.message?.text || ctx.message?.caption || ctx.message?.message_id)
})

bot.start()
console.log('Bot started. Жду web_app_data…')
