// Spawn peaceful animals
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'AnimalSpawner',
  version: '1.19.2'
});

bot.on('spawn', () => {
  console.log('🐷 Spawning animals...');

  setTimeout(() => {
    // Spawn pigs
    bot.chat('/summon minecraft:pig ~5 ~ ~5');
    bot.chat('/summon minecraft:pig ~-5 ~ ~5');
    bot.chat('/summon minecraft:pig ~5 ~ ~-5');
    bot.chat('/summon minecraft:pig ~-5 ~ ~-5');

    // Spawn cows
    bot.chat('/summon minecraft:cow ~8 ~ ~');
    bot.chat('/summon minecraft:cow ~-8 ~ ~');
    bot.chat('/summon minecraft:cow ~ ~ ~8');
    bot.chat('/summon minecraft:cow ~ ~ ~-8');

    // Spawn chickens
    bot.chat('/summon minecraft:chicken ~3 ~ ~3');
    bot.chat('/summon minecraft:chicken ~-3 ~ ~3');
    bot.chat('/summon minecraft:chicken ~3 ~ ~-3');
    bot.chat('/summon minecraft:chicken ~-3 ~ ~-3');

    // Spawn sheep
    bot.chat('/summon minecraft:sheep ~6 ~ ~6');
    bot.chat('/summon minecraft:sheep ~-6 ~ ~-6');
    bot.chat('/summon minecraft:sheep ~6 ~ ~-6');

    console.log('✅ Animals spawned! Look around you!');

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
