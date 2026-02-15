// Quick build demo - builds a castle with towers, village, and more
// Connects to the Minecraft server, teleports to surface, and builds structures
import mineflayer from 'mineflayer';

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'Architect',
  auth: 'offline',
  version: '1.19.2',
});

bot.on('error', (err) => console.error('Error:', err.message));

bot.once('spawn', async () => {
  console.log('Architect spawned! Waiting for OP permissions...\n');
  await new Promise(r => setTimeout(r, 2000));

  // Teleport to a nice surface location first
  bot.chat('/tp @s 0 80 0');
  await new Promise(r => setTimeout(r, 1500));

  const x = 10;
  const y = 80;
  const z = 10;

  console.log(`Building at ${x}, ${y}, ${z}\n`);

  const cmds = [
    // === CLEAR & FLATTEN BUILD AREA ===
    `/fill ${x-5} ${y} ${z-5} ${x+55} ${y+30} ${z+55} air`,
    `/fill ${x-5} ${y-1} ${z-5} ${x+55} ${y-1} ${z+55} grass_block`,

    // === CASTLE BASE / FLOOR ===
    `/fill ${x} ${y} ${z} ${x+20} ${y} ${z+20} smooth_stone_slab`,

    // === OUTER WALLS (stone brick, 6 tall) ===
    `/fill ${x} ${y+1} ${z} ${x+20} ${y+6} ${z} blue_concrete`,
    `/fill ${x} ${y+1} ${z+20} ${x+20} ${y+6} ${z+20} blue_concrete`,
    `/fill ${x} ${y+1} ${z} ${x} ${y+6} ${z+20} blue_concrete`,
    `/fill ${x+20} ${y+1} ${z} ${x+20} ${y+6} ${z+20} blue_concrete`,

    // === HOLLOW INSIDE ===
    `/fill ${x+1} ${y+1} ${z+1} ${x+19} ${y+6} ${z+19} air`,

    // === GATE (south wall center) ===
    `/fill ${x+9} ${y+1} ${z+20} ${x+11} ${y+4} ${z+20} air`,

    // === CORNER TOWERS (white_concrete, 10 tall) ===
    `/fill ${x} ${y+1} ${z+18} ${x+2} ${y+10} ${z+20} white_concrete`,
    `/fill ${x+1} ${y+2} ${z+19} ${x+1} ${y+9} ${z+19} air`,
    `/fill ${x+18} ${y+1} ${z+18} ${x+20} ${y+10} ${z+20} white_concrete`,
    `/fill ${x+19} ${y+2} ${z+19} ${x+19} ${y+9} ${z+19} air`,
    `/fill ${x} ${y+1} ${z} ${x+2} ${y+10} ${z+2} white_concrete`,
    `/fill ${x+1} ${y+2} ${z+1} ${x+1} ${y+9} ${z+1} air`,
    `/fill ${x+18} ${y+1} ${z} ${x+20} ${y+10} ${z+2} white_concrete`,
    `/fill ${x+19} ${y+2} ${z+1} ${x+19} ${y+9} ${z+1} air`,

    // === TOWER TOPS ===
    `/fill ${x-1} ${y+11} ${z-1} ${x+3} ${y+11} ${z+3} blue_concrete`,
    `/fill ${x+17} ${y+11} ${z-1} ${x+21} ${y+11} ${z+3} blue_concrete`,
    `/fill ${x-1} ${y+11} ${z+17} ${x+3} ${y+11} ${z+21} blue_concrete`,
    `/fill ${x+17} ${y+11} ${z+17} ${x+21} ${y+11} ${z+21} blue_concrete`,

    // === BATTLEMENTS (top of walls) ===
    `/fill ${x} ${y+7} ${z} ${x+20} ${y+7} ${z} smooth_stone_slab`,
    `/fill ${x} ${y+7} ${z+20} ${x+20} ${y+7} ${z+20} smooth_stone_slab`,
    `/fill ${x} ${y+7} ${z} ${x} ${y+7} ${z+20} smooth_stone_slab`,
    `/fill ${x+20} ${y+7} ${z} ${x+20} ${y+7} ${z+20} smooth_stone_slab`,

    // === CENTRAL KEEP ===
    `/fill ${x+7} ${y+1} ${z+7} ${x+13} ${y+8} ${z+13} light_blue_concrete`,
    `/fill ${x+8} ${y+1} ${z+8} ${x+12} ${y+7} ${z+12} air`,
    `/fill ${x+6} ${y+9} ${z+6} ${x+14} ${y+9} ${z+14} blue_concrete`,
    `/fill ${x+10} ${y+1} ${z+13} ${x+10} ${y+3} ${z+13} air`,

    // === TORCHES ===
    `/setblock ${x+4} ${y+2} ${z+4} torch`,
    `/setblock ${x+16} ${y+2} ${z+4} torch`,
    `/setblock ${x+4} ${y+2} ${z+16} torch`,
    `/setblock ${x+16} ${y+2} ${z+16} torch`,
    `/setblock ${x+1} ${y+12} ${z+1} torch`,
    `/setblock ${x+19} ${y+12} ${z+1} torch`,
    `/setblock ${x+1} ${y+12} ${z+19} torch`,
    `/setblock ${x+19} ${y+12} ${z+19} torch`,

    // === FLAG POLE ===
    `/fill ${x+10} ${y+10} ${z+10} ${x+10} ${y+14} ${z+10} oak_fence`,
    `/setblock ${x+10} ${y+15} ${z+10} torch`,

    // ======= VILLAGE AREA (east of castle) =======

    // === HOUSE 1 - Blacksmith ===
    `/fill ${x+25} ${y} ${z+2} ${x+32} ${y} ${z+8} white_concrete`,
    `/fill ${x+25} ${y+1} ${z+2} ${x+32} ${y+4} ${z+8} light_blue_concrete`,
    `/fill ${x+26} ${y+1} ${z+3} ${x+31} ${y+3} ${z+7} air`,
    `/fill ${x+25} ${y+5} ${z+2} ${x+32} ${y+5} ${z+8} white_concrete`,
    `/fill ${x+28} ${y+1} ${z+8} ${x+29} ${y+3} ${z+8} air`,
    `/setblock ${x+27} ${y+2} ${z+3} torch`,
    `/setblock ${x+30} ${y+2} ${z+3} torch`,
    // Furnaces inside
    `/setblock ${x+26} ${y+1} ${z+3} furnace`,
    `/setblock ${x+27} ${y+1} ${z+3} furnace`,
    // Anvil
    `/setblock ${x+26} ${y+1} ${z+5} anvil`,

    // === HOUSE 2 - Library ===
    `/fill ${x+25} ${y} ${z+12} ${x+32} ${y} ${z+18} white_concrete`,
    `/fill ${x+25} ${y+1} ${z+12} ${x+32} ${y+4} ${z+18} white_concrete`,
    `/fill ${x+26} ${y+1} ${z+13} ${x+31} ${y+3} ${z+17} air`,
    `/fill ${x+25} ${y+5} ${z+12} ${x+32} ${y+5} ${z+18} light_blue_concrete`,
    `/fill ${x+28} ${y+1} ${z+18} ${x+29} ${y+3} ${z+18} air`,
    `/setblock ${x+27} ${y+2} ${z+13} torch`,
    `/setblock ${x+30} ${y+2} ${z+13} torch`,
    // Bookshelves
    `/fill ${x+26} ${y+1} ${z+13} ${x+26} ${y+3} ${z+13} bookshelf`,
    `/fill ${x+31} ${y+1} ${z+13} ${x+31} ${y+3} ${z+13} bookshelf`,
    // Crafting table + enchanting table
    `/setblock ${x+28} ${y+1} ${z+13} crafting_table`,
    `/setblock ${x+29} ${y+1} ${z+13} enchanting_table`,

    // === MARKET STALLS (between houses) ===
    `/fill ${x+26} ${y} ${z+10} ${x+31} ${y} ${z+10} white_concrete`,
    `/fill ${x+26} ${y+1} ${z+10} ${x+26} ${y+3} ${z+10} oak_fence`,
    `/fill ${x+31} ${y+1} ${z+10} ${x+31} ${y+3} ${z+10} oak_fence`,
    `/fill ${x+26} ${y+3} ${z+10} ${x+31} ${y+3} ${z+10} blue_wool`,

    // === WELL (center of village) ===
    `/fill ${x+35} ${y} ${z+9} ${x+38} ${y} ${z+12} white_concrete`,
    `/fill ${x+36} ${y} ${z+10} ${x+37} ${y} ${z+11} water`,
    `/fill ${x+35} ${y+1} ${z+9} ${x+35} ${y+3} ${z+9} oak_fence`,
    `/fill ${x+38} ${y+1} ${z+9} ${x+38} ${y+3} ${z+9} oak_fence`,
    `/fill ${x+35} ${y+1} ${z+12} ${x+35} ${y+3} ${z+12} oak_fence`,
    `/fill ${x+38} ${y+1} ${z+12} ${x+38} ${y+3} ${z+12} oak_fence`,
    `/fill ${x+35} ${y+3} ${z+9} ${x+38} ${y+3} ${z+12} spruce_slab`,

    // === FARM (south of castle) ===
    `/fill ${x+2} ${y} ${z+25} ${x+18} ${y} ${z+35} farmland`,
    `/fill ${x+10} ${y} ${z+25} ${x+10} ${y} ${z+35} water`,
    `/fill ${x+2} ${y+1} ${z+25} ${x+9} ${y+1} ${z+35} wheat[age=7]`,
    `/fill ${x+11} ${y+1} ${z+25} ${x+18} ${y+1} ${z+35} carrots[age=7]`,
    // Farm fence
    `/fill ${x+1} ${y+1} ${z+24} ${x+19} ${y+1} ${z+24} oak_fence`,
    `/fill ${x+1} ${y+1} ${z+36} ${x+19} ${y+1} ${z+36} oak_fence`,
    `/fill ${x+1} ${y+1} ${z+24} ${x+1} ${y+1} ${z+36} oak_fence`,
    `/fill ${x+19} ${y+1} ${z+24} ${x+19} ${y+1} ${z+36} oak_fence`,
    // Farm gate
    `/setblock ${x+10} ${y+1} ${z+24} oak_fence_gate[facing=north,open=true]`,

    // === WATCHTOWER (northwest) ===
    `/fill ${x-8} ${y} ${z-8} ${x-4} ${y+15} ${z-4} blue_concrete`,
    `/fill ${x-7} ${y+1} ${z-7} ${x-5} ${y+14} ${z-5} air`,
    // Ladder up
    `/fill ${x-5} ${y+1} ${z-7} ${x-5} ${y+14} ${z-7} ladder[facing=east]`,
    // Observation deck
    `/fill ${x-9} ${y+15} ${z-9} ${x-3} ${y+15} ${z-3} stone_brick_slab`,
    // Torches on top
    `/setblock ${x-8} ${y+16} ${z-8} torch`,
    `/setblock ${x-4} ${y+16} ${z-4} torch`,
    `/setblock ${x-8} ${y+16} ${z-4} torch`,
    `/setblock ${x-4} ${y+16} ${z-8} torch`,

    // === PATHS (gravel connecting everything) ===
    `/fill ${x+10} ${y-1} ${z+21} ${x+10} ${y-1} ${z+24} gravel`,
    `/fill ${x+21} ${y-1} ${z+5} ${x+24} ${y-1} ${z+5} gravel`,
    `/fill ${x+21} ${y-1} ${z+15} ${x+24} ${y-1} ${z+15} gravel`,

    // === STREET LAMPS ===
    `/fill ${x+22} ${y} ${z+10} ${x+22} ${y+3} ${z+10} oak_fence`,
    `/setblock ${x+22} ${y+4} ${z+10} sea_lantern`,
    `/fill ${x+33} ${y} ${z+5} ${x+33} ${y+3} ${z+5} oak_fence`,
    `/setblock ${x+33} ${y+4} ${z+5} sea_lantern`,
    `/fill ${x+33} ${y} ${z+15} ${x+33} ${y+3} ${z+15} oak_fence`,
    `/setblock ${x+33} ${y+4} ${z+15} sea_lantern`,

    // === ANIMAL PENS ===
    `/fill ${x+40} ${y} ${z+2} ${x+48} ${y} ${z+8} grass_block`,
    `/fill ${x+40} ${y+1} ${z+2} ${x+48} ${y+1} ${z+2} oak_fence`,
    `/fill ${x+40} ${y+1} ${z+8} ${x+48} ${y+1} ${z+8} oak_fence`,
    `/fill ${x+40} ${y+1} ${z+2} ${x+40} ${y+1} ${z+8} oak_fence`,
    `/fill ${x+48} ${y+1} ${z+2} ${x+48} ${y+1} ${z+8} oak_fence`,
    `/setblock ${x+44} ${y+1} ${z+8} oak_fence_gate[facing=south]`,

    // === SPAWN SOME ANIMALS & VILLAGERS ===
    `/summon cow ${x+44} ${y+1} ${z+5}`,
    `/summon cow ${x+42} ${y+1} ${z+4}`,
    `/summon sheep ${x+46} ${y+1} ${z+6}`,
    `/summon sheep ${x+43} ${y+1} ${z+6}`,
    `/summon chicken ${x+45} ${y+1} ${z+3}`,
    `/summon villager ${x+28} ${y+1} ${z+5}`,
    `/summon villager ${x+28} ${y+1} ${z+15}`,
    `/summon villager ${x+36} ${y+1} ${z+10}`,

    // === TREES around the area ===
    `/setblock ${x-3} ${y} ${z+15} oak_sapling`,
    `/setblock ${x-3} ${y} ${z+25} oak_sapling`,
    `/setblock ${x+40} ${y} ${z+15} birch_sapling`,
    `/setblock ${x+45} ${y} ${z+15} birch_sapling`,

    // === DAY + CLEAR WEATHER ===
    `/time set day`,
    `/weather clear`,
    `/gamemode creative @s`,
  ];

  console.log(`Executing ${cmds.length} build commands...\n`);

  for (let i = 0; i < cmds.length; i++) {
    bot.chat(cmds[i]);
    console.log(`[${i+1}/${cmds.length}] ${cmds[i]}`);
    await new Promise(r => setTimeout(r, 350));
  }

  console.log('\n=== WORLD BUILT! ===');
  console.log('Castle + Village + Farm + Watchtower + Animal Pens');
  bot.chat('The world is built! Castle, village, farm, and more! Come explore!');

  // Teleport all agents to the village
  await new Promise(r => setTimeout(r, 1000));
  bot.chat(`/tp Saumya ${x+28} ${y+1} ${z+5}`);
  await new Promise(r => setTimeout(r, 500));
  bot.chat(`/tp Sumedha ${x+36} ${y+1} ${z+10}`);
  await new Promise(r => setTimeout(r, 500));
  bot.chat(`/tp Ahaan ${x+10} ${y+1} ${z+10}`);

  console.log('\nAll agents teleported to the village!');
  console.log('Builder staying online. Ctrl+C to disconnect.');
});

process.on('SIGINT', () => {
  bot.quit();
  setTimeout(() => process.exit(0), 500);
});
