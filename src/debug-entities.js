import mineflayer from 'mineflayer';
import { Rcon } from 'rcon-client';

const rcon = await Rcon.connect({ host: 'localhost', port: 25575, password: 'minecraft123' });

const bot1 = mineflayer.createBot({ host: 'localhost', port: 25565, username: 'TestA', auth: 'offline', version: '1.16.2' });

// Log all relevant events
bot1.on('playerJoined', (player) => console.log('[event] playerJoined:', player.username, player.entity ? 'has entity' : 'no entity'));
bot1.on('playerUpdated', (player) => console.log('[event] playerUpdated:', player.username));
bot1.on('entitySpawn', (entity) => console.log('[event] entitySpawn: id=' + entity.id, 'type=' + entity.type, 'username=' + entity.username, 'name=' + entity.name));
bot1._client.on('player_info', (data) => console.log('[packet] player_info:', JSON.stringify(data).slice(0, 200)));

bot1.once('spawn', async () => {
  console.log('TestA spawned');
  await rcon.send('op TestA');

  // Now spawn bot2 after bot1 is ready
  console.log('Spawning TestB...');
  const bot2 = mineflayer.createBot({ host: 'localhost', port: 25565, username: 'TestB', auth: 'offline', version: '1.16.2' });

  bot2.once('spawn', async () => {
    console.log('TestB spawned');
    await rcon.send('op TestB');

    // TP both to same location
    bot1.chat('/tp @s 0 4 50');
    bot2.chat('/tp @s 0 4 50');

    setTimeout(() => {
      console.log('\n--- TestA bot.players ---');
      for (const [name, player] of Object.entries(bot1.players)) {
        console.log('  ', name, '→ entity:', player.entity ? 'id=' + player.entity.id + ' pos=' + player.entity.position : 'null');
      }

      console.log('\n--- TestA entities ---');
      for (const [id, e] of Object.entries(bot1.entities)) {
        console.log('  id:', id, 'type:', e.type, 'username:', e.username, 'pos:', e.position?.toString());
      }

      bot1.quit(); bot2.quit();
      setTimeout(() => { rcon.end(); process.exit(0); }, 500);
    }, 5000);
  });
});

setTimeout(() => { console.log('Timeout'); process.exit(1); }, 30000);
