import 'dotenv/config'
import { Bot } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN)
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID

bot.command('start', ctx => {
  ctx.reply('Бот запущен. Используйте /id чтобы узнать chat_id.')
})

bot.command('id', ctx => {
  ctx.reply(`Ваш chat_id: ${ctx.chat.id}`)
})

bot.on('message:web_app_data', ctx => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data)
    if (data.type === 'session_result') {
      const profile = data.profile
      const best = data.best
      const msg = `🎮 Результат игры\n\n👤 ${profile.lastName} ${profile.firstName} ${profile.middleName || ''}\n📞 ${profile.phone || '-'}\n📧 ${profile.email || '-'}\n\nОчки: ${best}`
      if (ADMIN_CHAT_ID) {
        bot.api.sendMessage(ADMIN_CHAT_ID, msg)
      }
    }
  } catch (e) {
    console.error('Ошибка парсинга web_app_data', e)
  }
})

bot.start()
