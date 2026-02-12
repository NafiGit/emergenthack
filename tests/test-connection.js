// Test server connection
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 55916,
  username: 'TestBot',
  version: '1.19.4'
});

bot.on('spawn', () => {
  console.log('✅ Successfully connected to server!');
  console.log('Version:', bot.version);
  bot.quit();
  process.exit(0);
});

bot.on('error', (err) => {
  console.log('❌ Connection error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏱️ Connection timeout');
  process.exit(1);
}, 10000);
