// Spawn zombie horse
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'HorseSpawner',
  version: '1.19.4'
});

bot.on('spawn', () => {
  console.log('🐴 Spawning zombie horse...');

  setTimeout(() => {
    // Spawn zombie horse at player's location
    bot.chat('/execute at mcrafter3420 run summon minecraft:zombie_horse ~ ~1 ~3');

    console.log('✅ Zombie horse spawned near mcrafter3420!');

    setTimeout(() => {
      bot.quit();
      process.exit(0);
    }, 2000);
  }, 2000);
});

bot.on('error', (err) => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
