// Spawn multiple bot players
import mineflayer from 'mineflayer';

const BOT_NAMES = ['Agent1', 'Agent2', 'Agent3', 'Agent4', 'Agent5'];
const bots = [];

function createBot(username) {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: username,
    version: '1.19.4'
  });

  bot.on('spawn', () => {
    console.log(`✅ ${username} joined the game at (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.y.toFixed(1)}, ${bot.entity.position.z.toFixed(1)})`);
  });

  bot.on('chat', (username, message) => {
    if (message === 'wave') {
      bot.chat('👋 Hello!');
    }
  });

  bot.on('error', (err) => {
    console.log(`❌ ${username} error:`, err.message);
  });

  bot.on('end', () => {
    console.log(`🔌 ${username} disconnected`);
  });

  return bot;
}

// Spawn all bots
console.log('🤖 Spawning player bots...\n');
BOT_NAMES.forEach((name, index) => {
  setTimeout(() => {
    const bot = createBot(name);
    bots.push(bot);
  }, index * 1000); // Stagger spawns by 1 second
});

// Keep process alive
console.log('\nBots will stay connected. Press Ctrl+C to disconnect all.\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Disconnecting all bots...');
  bots.forEach(bot => bot.quit());
  setTimeout(() => process.exit(0), 1000);
});
