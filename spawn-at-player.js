// Spawn zombie horse at exact player location
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'Spawner',
  version: '1.19.4'
});

bot.on('spawn', () => {
  console.log('🔧 Connected, spawning...');

  setTimeout(() => {
    // Get player position first
    const player = bot.players['mcrafter3420'];
    if (player) {
      console.log('Found player mcrafter3420');
    }

    // Spawn right at your feet
    bot.chat('/summon minecraft:zombie_horse -137 74 163');
    console.log('Command sent: /summon minecraft:zombie_horse -137 74 163');

    setTimeout(() => {
      bot.quit();
      process.exit(0);
    }, 2000);
  }, 2000);
});

bot.on('message', (msg) => {
  console.log('Server message:', msg.toString());
});

bot.on('error', (err) => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
