// MineForge Arena Bot-vs-Bot Test — 2 bots per arena, fight each other
// Spawns 8 bots total, each pair competes in their designated arena
// Logs actions every 250ms, health checks every 10s
//
// KEY FIX: mineflayer in offline mode / 1.16.2 doesn't populate entity.type
// or entity.username for other players. We pass opponent bot refs directly.

import mineflayer from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pkg;
import minecraftData from 'minecraft-data';
import { Rcon } from 'rcon-client';

const RCON = { host: 'localhost', port: 25575, password: 'minecraft123' };

const ARENA_CONFIG = {
  pvp: {
    spawn1: { x: -3, y: 4, z: 50 },
    spawn2: { x: 3, y: 4, z: 60 },
    items: ['iron_sword', 'shield', 'golden_apple'],
  },
  sumo: {
    spawn1: { x: 52, y: 11, z: -2 },
    spawn2: { x: 58, y: 11, z: 2 },
    items: ['stick'],
  },
  spleef: {
    spawn1: { x: -58, y: 16, z: -3 },
    spawn2: { x: -52, y: 16, z: 3 },
    items: ['iron_shovel'],
  },
  archery: {
    spawn1: { x: -5, y: 4, z: -55 },
    spawn2: { x: 5, y: 4, z: -55 },
    items: ['bow', 'arrow'],
  },
};

let rcon;
const bots = {};       // name → bot instance
const botStats = {};   // name → stats object
const opponents = {};  // name → opponent name
const MATCH_DURATION = 60000; // 60s per test match

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toISOString().slice(11, 19); }

function log(botName, msg) {
  console.log(`[${ts()}] [${botName}] ${msg}`);
}

// ─── Adventure-safe movements ─────────────────────────────

function adventureMovements(bot) {
  const mcData = minecraftData(bot.version);
  const m = new Movements(bot, mcData);
  m.canDig = false;
  m.allow1by1towers = false;
  m.canOpenDoors = false;
  return m;
}

// ─── Get opponent entity from attacking bot's entity list ──

function getOpponentEntity(myName) {
  const oppName = opponents[myName];
  if (!oppName || !bots[oppName]) return null;
  const oppBot = bots[oppName];
  if (!oppBot.entity) return null;

  const myBot = bots[myName];
  if (!myBot) return null;

  // The opponent's entity position (from their own bot)
  const oppPos = oppBot.entity.position;

  // Find the matching entity in MY bot's entity list by position proximity
  // (mineflayer doesn't set username/type for other players in offline mode)
  let bestEntity = null;
  let bestDist = Infinity;
  for (const entity of Object.values(myBot.entities)) {
    if (entity === myBot.entity) continue; // skip self
    if (!entity.position) continue;
    const d = entity.position.distanceTo(oppPos);
    if (d < bestDist) {
      bestDist = d;
      bestEntity = entity;
    }
  }

  // Must be within 2 blocks to be the same entity (position updates may lag)
  if (bestEntity && bestDist < 2) {
    bestEntity._oppName = oppName;
    return bestEntity;
  }

  // Fallback: return opponent's own entity ref (for position/lookAt only, attack may fail)
  oppBot.entity._oppName = oppName;
  oppBot.entity._isFallback = true;
  return oppBot.entity;
}

// ─── Bot creation ─────────────────────────────────────────

async function createBot(name, arena, spawnPos) {
  log(name, `Creating bot for ${arena} arena...`);

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: name,
    auth: 'offline',
    version: '1.16.2',
  });

  bot.loadPlugin(pathfinder);

  botStats[name] = {
    arena,
    attacks: 0,
    hits: 0,
    blocks_dug: 0,
    arrows_shot: 0,
    health: 20,
    deaths: 0,
    opponent: opponents[name] || null,
    active: false,
  };

  return new Promise((resolve) => {
    bot.once('spawn', async () => {
      log(name, 'Spawned! Waiting for OP...');
      await sleep(2000);

      try { await rcon.send(`op ${name}`); } catch {}

      // TP to arena spawn
      bot.chat(`/tp @s ${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`);
      log(name, `Teleported to ${arena} (${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z})`);

      await sleep(3000);

      // Give items directly via RCON
      bot.chat('/clear @s');
      await sleep(200);

      await giveArenaItems(name, arena);
      log(name, `Items given: ${ARENA_CONFIG[arena].items.join(', ')}`);

      await sleep(500);
      await equipForArena(bot, name, arena);

      botStats[name].active = true;
      bots[name] = bot;
      resolve(bot);
    });

    bot.on('health', () => {
      botStats[name].health = bot.health;
      if (bot.health < 10) {
        log(name, `LOW HEALTH: ${bot.health.toFixed(1)} HP`);
      }
    });

    bot.on('death', () => {
      botStats[name].deaths++;
      log(name, `DIED! (death #${botStats[name].deaths})`);
      botStats[name].active = false;

      // Award win to opponent
      const oppName = opponents[name];
      if (oppName) {
        try { rcon.send(`scoreboard players add ${oppName} wins 1`); } catch {}
        log(name, `Win awarded to ${oppName}`);
      }

      // Respawn and return
      setTimeout(async () => {
        try {
          bot.chat(`/tp @s ${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`);
          await sleep(1500);
          bot.chat('/clear @s');
          await sleep(200);
          await giveArenaItems(name, arena);
          await sleep(500);
          await equipForArena(bot, name, arena);
          botStats[name].active = true;
          log(name, 'Respawned and re-equipped!');
        } catch (e) {
          log(name, `Respawn error: ${e.message}`);
        }
      }, 2000);
    });

    bot.on('error', (err) => log(name, `ERROR: ${err.message}`));
    bot.on('kicked', (reason) => log(name, `KICKED: ${JSON.stringify(reason)}`));
    bot.on('end', () => log(name, 'DISCONNECTED'));
  });
}

async function giveArenaItems(name, arena) {
  for (const item of ARENA_CONFIG[arena].items) {
    if (item === 'iron_shovel') {
      await rcon.send(`give ${name} minecraft:iron_shovel{CanDestroy:["minecraft:snow_block"]}`);
    } else if (item === 'golden_apple') {
      await rcon.send(`give ${name} minecraft:${item} 3`);
    } else if (item === 'arrow') {
      await rcon.send(`give ${name} minecraft:${item} 64`);
    } else {
      await rcon.send(`give ${name} minecraft:${item}`);
    }
  }
}

async function equipForArena(bot, name, arena) {
  const items = bot.inventory.items();
  switch (arena) {
    case 'pvp': {
      const sword = items.find(i => i.name === 'iron_sword');
      if (sword) { await bot.equip(sword, 'hand'); log(name, 'Equipped iron_sword'); }
      else log(name, 'WARNING: No iron_sword in inventory!');
      const shield = items.find(i => i.name === 'shield');
      if (shield) { await bot.equip(shield, 'off-hand'); log(name, 'Equipped shield'); }
      break;
    }
    case 'sumo': {
      const stick = items.find(i => i.name === 'stick');
      if (stick) { await bot.equip(stick, 'hand'); log(name, 'Equipped stick'); }
      else log(name, 'WARNING: No stick in inventory!');
      break;
    }
    case 'spleef': {
      const shovel = items.find(i => i.name === 'iron_shovel');
      if (shovel) { await bot.equip(shovel, 'hand'); log(name, 'Equipped iron_shovel'); }
      else log(name, 'WARNING: No iron_shovel in inventory!');
      break;
    }
    case 'archery': {
      const bow = items.find(i => i.name === 'bow');
      if (bow) { await bot.equip(bow, 'hand'); log(name, 'Equipped bow'); }
      else log(name, 'WARNING: No bow in inventory!');
      break;
    }
  }
}

// ─── Combat AI per arena ──────────────────────────────────

async function pvpCombat(bot, name) {
  const target = getOpponentEntity(name);
  if (!target) { log(name, 'Opponent entity not available'); return; }

  const oppName = target._oppName;
  const dist = bot.entity.position.distanceTo(target.position);
  botStats[name].opponent = oppName;

  if (dist > 3.5) {
    // Chase: use direct controls (pathfinder unreliable in adventure mode)
    try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}
    bot.setControlState('forward', true);
    bot.setControlState('sprint', dist > 5);
    log(name, `Chasing ${oppName} (${dist.toFixed(1)}m)`);
  } else {
    bot.setControlState('forward', false);
    bot.setControlState('sprint', false);
    try {
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      bot.attack(target);
      botStats[name].attacks++;
      log(name, `ATTACK ${oppName}! (${dist.toFixed(1)}m, HP:${bot.health.toFixed(1)}, attacks:${botStats[name].attacks})`);

      // Strafe
      const dir = Math.random() > 0.5 ? 'left' : 'right';
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 200);

      // Sprint-jump for crits
      if (Math.random() < 0.3) {
        bot.setControlState('sprint', true);
        bot.setControlState('jump', true);
        setTimeout(() => { bot.setControlState('sprint', false); bot.setControlState('jump', false); }, 300);
      }

      // Eat golden apple if low health
      if (bot.health < 10) {
        const apple = bot.inventory.items().find(i => i.name === 'golden_apple');
        if (apple) {
          try {
            await bot.equip(apple, 'hand');
            bot.activateItem();
            await sleep(1500);
            bot.deactivateItem();
            const sword = bot.inventory.items().find(i => i.name === 'iron_sword');
            if (sword) await bot.equip(sword, 'hand');
            log(name, 'Ate golden apple!');
          } catch {}
        }
      }
    } catch (e) { log(name, `Attack error: ${e.message}`); }
  }
}

async function sumoCombat(bot, name) {
  const target = getOpponentEntity(name);
  if (!target) { log(name, 'Opponent entity not available'); return; }

  const oppName = target._oppName;
  const dist = bot.entity.position.distanceTo(target.position);
  botStats[name].opponent = oppName;

  try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}

  // Sprint toward and attack for knockback
  bot.setControlState('sprint', true);
  bot.setControlState('forward', true);

  if (dist <= 3.5) {
    try {
      bot.attack(target);
      botStats[name].attacks++;
      log(name, `KNOCKBACK ${oppName}! (${dist.toFixed(1)}m, attacks:${botStats[name].attacks})`);
    } catch {}
    setTimeout(() => { bot.setControlState('sprint', false); bot.setControlState('forward', false); }, 200);
  } else {
    log(name, `Sprint toward ${oppName} (${dist.toFixed(1)}m)`);
  }

  // Stay near center (55, 11, 0) — retreat if near edge
  const center = { x: 55, y: 11, z: 0 };
  const distFromCenter = Math.sqrt((bot.entity.position.x - center.x) ** 2 + (bot.entity.position.z - center.z) ** 2);
  if (distFromCenter > 8) {
    try { await bot.lookAt({ x: center.x, y: center.y + 1.6, z: center.z }); } catch {}
    bot.setControlState('forward', true);
    log(name, `Retreating to center (${distFromCenter.toFixed(1)}m from center)`);
  }
}

async function spleefCombat(bot, name) {
  const target = getOpponentEntity(name);
  if (!target) { log(name, 'Opponent entity not available'); return; }

  const oppName = target._oppName;
  const shovel = bot.inventory.items().find(i => i.name === 'iron_shovel');
  if (shovel && bot.heldItem?.name !== 'iron_shovel') {
    try { await bot.equip(shovel, 'hand'); } catch {}
  }

  const dist = bot.entity.position.distanceTo(target.position);
  botStats[name].opponent = oppName;

  try { await bot.lookAt(target.position); } catch {}

  if (dist > 4) {
    bot.setControlState('forward', true);
    bot.setControlState('sprint', dist > 6);
    log(name, `Moving toward ${oppName} (${dist.toFixed(1)}m)`);
    return;
  }

  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);

  // Dig snow under/near opponent
  const targetPos = target.position;
  for (let dy = 0; dy >= -2; dy--) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        try {
          const block = bot.blockAt(targetPos.offset(dx, dy, dz));
          if (block && block.name === 'snow_block') {
            await bot.dig(block, true);
            botStats[name].blocks_dug++;
            log(name, `DIG snow at (${block.position.x},${block.position.y},${block.position.z}) [total:${botStats[name].blocks_dug}]`);
            return;
          }
        } catch {}
      }
    }
  }
  log(name, 'No snow to dig near opponent');
}

let lastBowShots = {};
async function archeryCombat(bot, name) {
  const target = getOpponentEntity(name);
  if (!target) { log(name, 'Opponent entity not available'); return; }

  const oppName = target._oppName;
  const bow = bot.inventory.items().find(i => i.name === 'bow');
  if (bow && bot.heldItem?.name !== 'bow') {
    try { await bot.equip(bow, 'hand'); } catch {}
  }

  const dist = bot.entity.position.distanceTo(target.position);
  const now = Date.now();
  botStats[name].opponent = oppName;

  // Aim with gravity compensation
  const yOffset = 1.6 + (dist * 0.04);
  try { await bot.lookAt(target.position.offset(0, yOffset, 0)); } catch {}

  if (!lastBowShots[name]) lastBowShots[name] = 0;

  if (now - lastBowShots[name] > 1500) {
    bot.activateItem();
    const chargeTime = Math.min(1000, 300 + dist * 20);
    setTimeout(async () => {
      try { await bot.lookAt(target.position.offset(0, yOffset, 0)); } catch {}
      bot.deactivateItem();
      lastBowShots[name] = Date.now();
      botStats[name].arrows_shot++;
      log(name, `SHOT arrow at ${oppName}! (${dist.toFixed(1)}m, arrows:${botStats[name].arrows_shot})`);
    }, chargeTime);
  }

  // Strafe between shots (moving target)
  if (Math.random() < 0.3) {
    const dir = Math.random() > 0.5 ? 'left' : 'right';
    bot.setControlState(dir, true);
    setTimeout(() => bot.setControlState(dir, false), 400);
  }
  // Occasionally move forward/back
  if (Math.random() < 0.15) {
    bot.setControlState('forward', true);
    setTimeout(() => bot.setControlState('forward', false), 300);
  }
  if (Math.random() < 0.15) {
    bot.setControlState('back', true);
    setTimeout(() => bot.setControlState('back', false), 300);
  }
}

// ─── Status check every 10s ──────────────────────────────

function printStatus() {
  console.log('\n' + '='.repeat(80));
  console.log(`[${ts()}] STATUS CHECK`);
  console.log('='.repeat(80));

  for (const [name, stats] of Object.entries(botStats)) {
    const fighting = stats.active && (stats.attacks > 0 || stats.blocks_dug > 0 || stats.arrows_shot > 0);
    const status = stats.active ? (fighting ? 'FIGHTING' : 'IDLE') : 'DEAD/INACTIVE';
    const icon = fighting ? 'X' : stats.active ? '?' : '!';

    console.log(`  [${icon}] ${name.padEnd(12)} | ${stats.arena.padEnd(8)} | HP:${stats.health.toFixed(0).padStart(3)} | ` +
      `ATK:${String(stats.attacks).padStart(3)} | DIG:${String(stats.blocks_dug).padStart(3)} | ` +
      `ARW:${String(stats.arrows_shot).padStart(3)} | DEATHS:${stats.deaths} | ` +
      `vs ${(stats.opponent || 'none').padEnd(12)} | ${status}`);
  }
  console.log('='.repeat(80) + '\n');
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  MINEFORGE ARENA BOT-VS-BOT TEST');
  console.log('  8 bots, 4 arenas, 60s per match');
  console.log('='.repeat(80) + '\n');

  rcon = await Rcon.connect(RCON);
  console.log('RCON connected\n');

  // Regen spleef snow layers
  await rcon.send('fill -66 7 -11 -44 7 11 snow_block');
  await rcon.send('fill -66 11 -11 -44 11 11 snow_block');
  await rcon.send('fill -66 15 -11 -44 15 11 snow_block');
  console.log('Spleef snow regenerated\n');

  // Set up opponent pairs
  opponents['Pvp1'] = 'Pvp2';     opponents['Pvp2'] = 'Pvp1';
  opponents['Sumo1'] = 'Sumo2';   opponents['Sumo2'] = 'Sumo1';
  opponents['Spleef1'] = 'Spleef2'; opponents['Spleef2'] = 'Spleef1';
  opponents['Archer1'] = 'Archer2'; opponents['Archer2'] = 'Archer1';

  // OP all bots
  const botNames = Object.keys(opponents);
  for (const name of botNames) {
    await rcon.send(`op ${name}`);
  }
  console.log('All bots OP\'d\n');

  // Spawn bots SEQUENTIALLY per arena pair (so they can see each other)
  console.log('Spawning bots...\n');

  // Spawn first bot in each pair
  const firstBots = await Promise.all([
    createBot('Pvp1',    'pvp',     ARENA_CONFIG.pvp.spawn1),
    createBot('Sumo1',   'sumo',    ARENA_CONFIG.sumo.spawn1),
    createBot('Spleef1', 'spleef',  ARENA_CONFIG.spleef.spawn1),
    createBot('Archer1', 'archery', ARENA_CONFIG.archery.spawn1),
  ]);
  console.log('First 4 bots spawned\n');

  // Small delay then spawn second bot in each pair
  await sleep(1000);
  const secondBots = await Promise.all([
    createBot('Pvp2',    'pvp',     ARENA_CONFIG.pvp.spawn2),
    createBot('Sumo2',   'sumo',    ARENA_CONFIG.sumo.spawn2),
    createBot('Spleef2', 'spleef',  ARENA_CONFIG.spleef.spawn2),
    createBot('Archer2', 'archery', ARENA_CONFIG.archery.spawn2),
  ]);
  console.log('\nAll 8 bots spawned and equipped!\n');

  // Combat strategies per arena
  const combatFns = {
    pvp: pvpCombat,
    sumo: sumoCombat,
    spleef: spleefCombat,
    archery: archeryCombat,
  };

  // Start combat loops (250ms interval)
  const combatIntervals = [];
  for (const [name, bot] of Object.entries(bots)) {
    const stats = botStats[name];
    const fn = combatFns[stats.arena];
    const interval = setInterval(async () => {
      if (!stats.active) return;
      try { await fn(bot, name); } catch (e) { log(name, `Combat error: ${e.message}`); }
    }, 250);
    combatIntervals.push(interval);
  }

  // Status check every 10s
  const statusInterval = setInterval(printStatus, 10000);

  // Print initial status
  await sleep(1000);
  printStatus();

  // Run for MATCH_DURATION
  console.log(`\nMatch running for ${MATCH_DURATION / 1000}s...\n`);
  await sleep(MATCH_DURATION);

  // Stop combat
  for (const interval of combatIntervals) clearInterval(interval);
  clearInterval(statusInterval);

  // Final status
  console.log('\n' + '='.repeat(80));
  console.log('  FINAL RESULTS');
  console.log('='.repeat(80));
  printStatus();

  // Disconnect all bots
  for (const [name, bot] of Object.entries(bots)) {
    try { bot.quit(); } catch {}
    log(name, 'Disconnected');
  }

  rcon.end();
  console.log('\nTest complete!');
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
