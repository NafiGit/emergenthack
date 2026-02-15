// Quick script to spawn mobs for demo
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'MobSpawner',
  version: '1.19.2'
});

bot.on('spawn', () => {
  console.log('🎮 MobSpawner connected! Spawning mobs...');

  // Wait 2 seconds then spawn mobs
  setTimeout(() => {
    // Set to night
    bot.chat('/time set night');

    // Spawn various mobs
    setTimeout(() => {
      bot.chat('/summon zombie ~ ~ ~5');
      bot.chat('/summon zombie ~ ~ ~-5');
      bot.chat('/summon skeleton ~5 ~ ~');
      bot.chat('/summon skeleton ~-5 ~ ~');
      bot.chat('/summon creeper ~3 ~ ~3');
      bot.chat('/summon spider ~-3 ~ ~-3');

      console.log('✅ Mobs spawned! Setting to night time.');
      console.log('🌙 Night mode activated for continuous mob spawning.');

      // Disconnect after spawning
      setTimeout(() => {
        bot.quit();
        process.exit(0);
      }, 2000);
    }, 1000);
  }, 2000);
});

bot.on('error', (err) => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
