import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Bot } from 'grammy'

const token = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID

if (!token) {
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LEADS_DIR = __dirname
const LEADS_FILE = path.join(LEADS_DIR, 'leads.csv')

if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true })
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, '\uFEFFДата,Фамилия,Имя,Отчество,Телефон,Email,Очки,Приз\n', 'utf8')
  console.log('CSV создан:', LEADS_FILE)
} else {
  try {
    const fd = fs.openSync(LEADS_FILE, 'r+')
    const buf = Buffer.alloc(3)
    const read = fs.readSync(fd, buf, 0, 3, 0)
    const hasBOM = read === 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    if (!hasBOM) {
      const content = fs.readFileSync(LEADS_FILE, { encoding: 'utf8' })
      fs.writeFileSync(LEADS_FILE, '\uFEFF' + content, { encoding: 'utf8' })
      console.log('Добавлен BOM в существующий CSV')
    }
    fs.closeSync(fd)
  } catch {}
}

const bot = new Bot(token)

await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {})

const me = await bot.api.getMe()
console.log(`Bot: @${me.username} (${me.id})`)
console.log(`WEBAPP_URL: ${WEBAPP_URL}`)
console.log(`ADMIN_CHAT_ID: ${ADMIN_CHAT_ID || '-'}`)
console.log(`CSV: ${LEADS_FILE}`)

bot.use(async (ctx, next) => {
  try { console.log('UPDATE:', JSON.stringify(ctx.update)) } catch {}
  return next()
})

bot.command('start', async (ctx) => {
  const replyMarkup = {
    keyboard: [[{ text: 'Открыть игру', web_app: { url: WEBAPP_URL } }]],
    is_persistent: true,
    resize_keyboard: true,
    one_time_keyboard: false
  }
  await ctx.reply('Нажмите кнопку ниже, чтобы открыть игру:', { reply_markup: replyMarkup })
})

bot.hears('Открыть игру', async (ctx) => {
  const replyMarkup = {
    keyboard: [[{ text: 'Открыть игру', web_app: { url: WEBAPP_URL } }]],
    is_persistent: true,
    resize_keyboard: true,
    one_time_keyboard: false
  }
  await ctx.reply('Если кнопка не появилась, введите /start', { reply_markup: replyMarkup })
})

bot.command('id', (ctx) => ctx.reply(`Ваш chat_id: ${ctx.chat.id}`))
bot.command('ping', (ctx) => ctx.reply('pong'))

bot.on('message:web_app_data', async (ctx) => {
  try {
    const raw = ctx.message.web_app_data?.data || '{}'
    console.log('web_app_data RAW:', raw)
    const data = JSON.parse(raw)
    if (data.type !== 'lead') {
      await ctx.reply('Ок 👍')
      return
    }
    const p = data.profile || {}
    const best = Number(data.best || 0)
    const prize = getPrize(best)
    const line =
      [
        new Date().toLocaleString('ru-RU'),
        p.lastName || '',
        p.firstName || '',
        p.middleName || '',
        p.phone || '',
        p.email || '',
        best,
        prize
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    fs.appendFileSync(LEADS_FILE, line, 'utf8')
    console.log('APPENDED to CSV')
    const msg = [
      '📋 Новый участник',
      `👤 ${[p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ')}`,
      `📞 ${p.phone || '-'}`,
      `📧 ${p.email || '-'}`,
      `🏆 Очки: ${best}`,
      `🎁 Приз: ${prize}`
    ].join('\n')
    if (ADMIN_CHAT_ID) await ctx.api.sendMessage(ADMIN_CHAT_ID, msg)
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
  console.log('message:', ctx.message?.text || ctx.message?.message_id)
})

bot.start()
console.log('Bot started. Жду web_app_data…')
