import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Bot, InlineKeyboard } from 'grammy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.on('unhandledRejection', (e) => {
  console.error('unhandledRejection:', e)
})
process.on('uncaughtException', (e) => {
  console.error('uncaughtException:', e)
})

const BOT_TOKEN = process.env.BOT_TOKEN || ''
const WEBAPP_URL = process.env.WEBAPP_URL || ''
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ''

console.log('ENV BOT_TOKEN:', BOT_TOKEN ? 'ok' : 'EMPTY')
console.log('ENV WEBAPP_URL:', WEBAPP_URL || '(empty)')
console.log('ENV ADMIN_CHAT_ID:', ADMIN_CHAT_ID || '(empty)')

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN отсутствует. Проверь .env')
  process.exit(1)
}

const bot = new Bot(BOT_TOKEN)

const LEADS_FILE = path.join(__dirname, 'leads.csv')
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, 'Дата,Фамилия,Имя,Отчество,Телефон,Email,Очки,Приз,Завершено\n', 'utf8')
  console.log('Создан файл:', LEADS_FILE)
} else {
  console.log('Файл существует:', LEADS_FILE)
}

bot.command('start', async (ctx) => {
  const kb = new InlineKeyboard().webApp('Открыть игру', WEBAPP_URL)
  await ctx.reply('Нажмите кнопку, чтобы открыть игру внутри Telegram:', { reply_markup: kb })
})

bot.command('id', (ctx) => ctx.reply(String(ctx.chat.id)))
bot.command('ping', (ctx) => ctx.reply('pong'))

bot.on('message:web_app_data', async (ctx) => {
  try {
    const raw = ctx.message.web_app_data?.data || '{}'
    console.log('web_app_data RAW:', raw)
    let data
    try { data = JSON.parse(raw) } catch { data = {} }

    const isLead = data.type === 'lead' || data.type === 'session_result'
    if (!isLead) {
      await ctx.reply('Пришли данные неизвестного типа. Жду type:"lead".')
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
    console.log('APPENDED to CSV:', line.trim())

    const msg =
`📋 Новый участник
👤 ${[p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ')}
📞 ${p.phone || '-'}
📧 ${p.email || '-'}
🏆 Очки: ${best}
🎁 Приз: ${prize}
⏰ Завершено: ${new Date(endedAt).toLocaleString('ru-RU')}`

    await ctx.reply('Результат получен ✅')
    if (ADMIN_CHAT_ID) {
      try { await ctx.api.sendMessage(ADMIN_CHAT_ID, msg) } catch (e) { console.error('ADMIN send fail', e) }
    }
  } catch (e) {
    console.error('web_app_data handler error:', e)
    try { await ctx.reply('Ошибка при обработке данных.') } catch {}
  }
})

function getPrize(p) {
  if (p >= 70) return 'Термос'
  if (p >= 50) return 'Шоппер'
  if (p >= 30) return 'Блокнот и ручка'
  if (p >= 20) return 'Брелок'
  return '—'
}

;(async () => {
  try {
    const me = await bot.api.getMe()
    console.log('Запускаю бота как:', `@${me.username}`, `(id ${me.id})`)
  } catch (e) {
    console.error('getMe error:', e)
  }
  await bot.start()
  console.log('Bot started. WEBAPP_URL =', WEBAPP_URL)
  console.log('CSV path =', LEADS_FILE)
  if (!ADMIN_CHAT_ID) console.warn('ADMIN_CHAT_ID не задан — админ-уведомления отключены')
})()
