// Spawn as mcrafter3420 (who has ops)
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'SpawnBot',
  version: '1.19.4'
});

bot.on('spawn', () => {
  console.log('🔧 SpawnBot spawned in game');

  setTimeout(() => {
    console.log('📝 Sending command: /summon zombie_horse ~ ~1 ~5');
    bot.chat('/summon zombie_horse ~ ~1 ~5');

    setTimeout(() => {
      console.log('✅ Command sent, disconnecting');
      bot.quit();
      process.exit(0);
    }, 1000);
  }, 2000);
});

bot.on('message', (msg) => {
  console.log('💬 Server:', msg.toString());
});

bot.on('error', (err) => {
  console.log('❌ Error:', err.message);
});
