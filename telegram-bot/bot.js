/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Simple Telegram Bot for Trading Notifications
 * 
 * This bot helps users get their Chat ID for notification subscriptions.
 * 
 * Setup Instructions:
 * 1. Create a new bot with @BotFather on Telegram
 * 2. Get the bot token and add it to .env.local as TELEGRAM_BOT_TOKEN
 * 3. Install node-telegram-bot-api: npm install node-telegram-bot-api
 * 4. Run this script: node telegram-bot/bot.js
 * 
 * Bot Commands:
 * /start - Welcome message with instructions
 * /mychatid - Get your Chat ID for notifications
 * /help - Show available commands
 */

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local');
  console.log('Please add your bot token to .env.local file:');
  console.log('TELEGRAM_BOT_TOKEN=your_token_here');
  process.exit(1);
}

// Create a bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram bot started successfully!');
console.log('📱 Users can now interact with your bot to get their Chat ID');

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'User';
  
  const welcomeMessage = `
🎯 <b>Welcome to Trading Notifications Bot!</b>

Hello ${firstName}! 👋

This bot will send you real-time notifications for:
• 📈 Trailing Stop Order Executions
• 🎲 New Prediction Markets
• 🏆 Market Resolutions & Payouts

<b>📋 To get started:</b>
1. Send /mychatid to get your Chat ID
2. Copy the Chat ID number
3. Go to the trading dashboard
4. Paste your Chat ID in the Telegram Notifications section
5. Click "Subscribe to Notifications"

<b>Available Commands:</b>
/mychatid - Get your Chat ID
/help - Show this help message

🔗 <b>Your Chat ID:</b> <code>${chatId}</code>

Happy trading! 🚀
  `.trim();

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

// Command: /mychatid
bot.onText(/\/mychatid/, (msg) => {
  const chatId = msg.chat.id;
  
  const message = `
🆔 <b>Your Chat ID</b>

Your Chat ID is: <code>${chatId}</code>

📋 <b>How to use:</b>
1. Copy the number above (click to select)
2. Go to the trading dashboard
3. Find the "Telegram Notifications" section
4. Paste this number in the Chat ID field
5. Click "Subscribe to Notifications"

✅ You're all set! You'll start receiving trading notifications.
  `.trim();

  bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
🤖 <b>Trading Notifications Bot - Help</b>

<b>Available Commands:</b>

/start - Welcome message and setup instructions
/mychatid - Get your Chat ID for notifications
/help - Show this help message

<b>🔔 Notification Types:</b>

📈 <b>Trailing Stop Orders:</b>
• Order execution alerts
• Profit/Loss information
• Asset and price details

🎲 <b>Prediction Markets:</b>
• New market creation alerts
• Market resolution notifications
• Winner announcements

<b>🛠 Setup Process:</b>
1. Get your Chat ID with /mychatid
2. Copy the Chat ID number
3. Go to the trading dashboard
4. Enter Chat ID in Telegram Notifications
5. Subscribe to start receiving alerts

Need help? Contact support on the trading platform.
  `.trim();

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

// Handle any other text messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Skip if it's a command (starts with /)
  if (text && text.startsWith('/')) {
    return;
  }
  
  // Skip if it's not a text message
  if (!text) {
    return;
  }
  
  const responseMessage = `
👋 Hello! I'm your Trading Notifications Bot.

To get started, use these commands:
• /start - Setup instructions
• /mychatid - Get your Chat ID
• /help - Show all commands

Your Chat ID is: <code>${chatId}</code>
  `.trim();

  bot.sendMessage(chatId, responseMessage, { parse_mode: 'HTML' });
});

// Error handling
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});
