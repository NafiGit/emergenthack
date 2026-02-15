// MineForge Arena — 8 Independent AI Bots (2 per arena) that fight each other
// Each bot is its own mineflayer connection with arena-specific combat AI
// Bots find opponents via cross-referenced bot.entity (mineflayer offline mode
// doesn't populate entity.type/username for other players)

import mineflayer from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pkg;
import minecraftData from 'minecraft-data';
import { Rcon } from 'rcon-client';

const RCON_CFG = { host: 'localhost', port: 25575, password: 'minecraft123' };

// ─── Bot pair definitions ──────────────────────────────────

const BOT_DEFS = [
  { name: 'Pvp1',    arena: 'pvp',     spawn: { x: 5, y: 4, z: 50 },    opponent: 'Pvp2' },
  { name: 'Pvp2',    arena: 'pvp',     spawn: { x: -5, y: 4, z: 60 },   opponent: 'Pvp1' },
  { name: 'Sumo1',   arena: 'sumo',    spawn: { x: 50, y: 11, z: 5 },   opponent: 'Sumo2' },
  { name: 'Sumo2',   arena: 'sumo',    spawn: { x: 60, y: 11, z: -5 },  opponent: 'Sumo1' },
  { name: 'Spleef1', arena: 'spleef',  spawn: { x: -50, y: 16, z: 5 },  opponent: 'Spleef2' },
  { name: 'Spleef2', arena: 'spleef',  spawn: { x: -60, y: 16, z: -5 }, opponent: 'Spleef1' },
  { name: 'Archer1', arena: 'archery', spawn: { x: 5, y: 4, z: -52 },   opponent: 'Archer2' },
  { name: 'Archer2', arena: 'archery', spawn: { x: -5, y: 4, z: -58 },  opponent: 'Archer1' },
];

const SUMO_CENTER = { x: 55, y: 11, z: 0 };
const SUMO_PLATFORM_RADIUS = 10;
const SUMO_FALL_Y = 5; // below this = fell off

const ARCHERY_BOUNDS = { x1: -12, x2: 12, z1: -60, z2: -50 };

const HUB_POS = { x: 0, y: 4, z: -8 };

// ─── Shared state ──────────────────────────────────────────

let rcon = null;
const botInstances = {};  // name → mineflayer bot
const botStats = {};      // name → { attacks, blocks_dug, arrows_shot, deaths, tickCount, staleTicks, active }
const isEating = {};      // name → boolean (prevents golden apple spam)
const isReturning = {};   // name → boolean (prevents double match-end triggers)
const isReconnecting = {}; // name → boolean (prevents duplicate reconnect loops)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toISOString().slice(11, 19); }
function log(name, msg) { console.log(`[${ts()}] [${name}] ${msg}`); }

// ─── Get opponent entity from cross-referenced bot ─────────

function getOpponentEntity(myName, opponentName) {
  const myBot = botInstances[myName];
  const oppBot = botInstances[opponentName];
  if (!myBot?.entity || !oppBot?.entity) return null;

  const oppPos = oppBot.entity.position;

  // Find the matching entity in MY entity list by position proximity
  let best = null;
  let bestDist = Infinity;
  for (const entity of Object.values(myBot.entities)) {
    if (entity === myBot.entity) continue;
    if (!entity.position) continue;
    const d = entity.position.distanceTo(oppPos);
    if (d < bestDist) {
      bestDist = d;
      best = entity;
    }
  }

  // Within 3 blocks = same entity (position updates may lag slightly)
  if (best && bestDist < 3) return best;

  // Fallback: return opponent's entity ref directly (lookAt/position works, attack may fail)
  return oppBot.entity;
}

// ─── Item giving via RCON ──────────────────────────────────

async function giveItems(name, arena) {
  const items = {
    pvp: [
      `give ${name} minecraft:iron_sword`,
      `give ${name} minecraft:shield`,
      `give ${name} minecraft:golden_apple 3`,
    ],
    sumo: [
      `give ${name} minecraft:stick`,
    ],
    spleef: [
      `give ${name} minecraft:iron_shovel{CanDestroy:["minecraft:snow_block"]}`,
    ],
    archery: [
      `give ${name} minecraft:bow`,
      `give ${name} minecraft:arrow 64`,
      `give ${name} minecraft:leather_chestplate`,
    ],
  };
  for (const cmd of items[arena] || []) {
    try { await rcon.send(cmd); } catch {}
  }
}

async function equipForArena(bot, name, arena) {
  const inv = bot.inventory.items();
  try {
    switch (arena) {
      case 'pvp': {
        const sword = inv.find(i => i.name === 'iron_sword');
        if (sword) await bot.equip(sword, 'hand');
        const shield = inv.find(i => i.name === 'shield');
        if (shield) await bot.equip(shield, 'off-hand');
        break;
      }
      case 'sumo': {
        const stick = inv.find(i => i.name === 'stick');
        if (stick) await bot.equip(stick, 'hand');
        break;
      }
      case 'spleef': {
        const shovel = inv.find(i => i.name === 'iron_shovel');
        if (shovel) await bot.equip(shovel, 'hand');
        break;
      }
      case 'archery': {
        const bow = inv.find(i => i.name === 'bow');
        if (bow) await bot.equip(bow, 'hand');
        const chest = inv.find(i => i.name === 'leather_chestplate');
        if (chest) await bot.equip(chest, 'torso');
        break;
      }
    }
  } catch (e) { log(name, `Equip error: ${e.message}`); }
}

// ─── Combat AI ─────────────────────────────────────────────

async function pvpTick(bot, name, target) {
  const dist = bot.entity.position.distanceTo(target.position);

  // Eat golden apple when low HP (with lock to prevent spam)
  if (bot.health < 10 && !isEating[name]) {
    const apple = bot.inventory.items().find(i => i.name === 'golden_apple');
    if (apple) {
      isEating[name] = true;
      try {
        await bot.equip(apple, 'hand');
        bot.activateItem();
        await sleep(1600);
        bot.deactivateItem();
        const sword = bot.inventory.items().find(i => i.name === 'iron_sword');
        if (sword) await bot.equip(sword, 'hand');
        log(name, 'Ate golden apple!');
      } catch {}
      isEating[name] = false;
      return;
    }
  }

  if (dist > 3.5) {
    try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}
    bot.setControlState('forward', true);
    bot.setControlState('sprint', dist > 5);
  } else {
    bot.setControlState('forward', false);
    bot.setControlState('sprint', false);
    try {
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      bot.attack(target);
      botStats[name].attacks++;

      // Strafe
      const dir = Math.random() > 0.5 ? 'left' : 'right';
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 200);

      // Sprint-jump crit (30%)
      if (Math.random() < 0.3) {
        bot.setControlState('sprint', true);
        bot.setControlState('jump', true);
        setTimeout(() => { bot.setControlState('sprint', false); bot.setControlState('jump', false); }, 300);
      }
    } catch (e) { log(name, `Attack err: ${e.message}`); }
  }
}

async function sumoTick(bot, name, target) {
  const dist = bot.entity.position.distanceTo(target.position);
  const pos = bot.entity.position;

  // Fall detection — re-TP if fell off platform
  if (pos.y < SUMO_FALL_Y) {
    log(name, `FELL OFF PLATFORM! (y=${pos.y.toFixed(1)}) Re-teleporting...`);
    const def = BOT_DEFS.find(d => d.name === name);
    bot.chat(`/tp @s ${def.spawn.x} ${def.spawn.y} ${def.spawn.z}`);
    return;
  }

  try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}

  // Edge detection — retreat to center if near edge
  const distToCenter = Math.sqrt((pos.x - SUMO_CENTER.x) ** 2 + (pos.z - SUMO_CENTER.z) ** 2);
  if (distToCenter > SUMO_PLATFORM_RADIUS - 2 && dist > 2) {
    try {
      await bot.lookAt({ x: SUMO_CENTER.x, y: SUMO_CENTER.y + 1.6, z: SUMO_CENTER.z });
    } catch {}
    bot.setControlState('forward', true);
    bot.setControlState('sprint', true);
    setTimeout(() => { bot.setControlState('forward', false); bot.setControlState('sprint', false); }, 400);
    return;
  }

  // Sprint toward and attack
  bot.setControlState('sprint', true);
  bot.setControlState('forward', true);

  if (dist <= 3.5) {
    try {
      bot.attack(target);
      botStats[name].attacks++;
    } catch {}
    setTimeout(() => { bot.setControlState('sprint', false); bot.setControlState('forward', false); }, 200);
  }
}

async function spleefTick(bot, name, target) {
  // Ensure shovel equipped
  const shovel = bot.inventory.items().find(i => i.name === 'iron_shovel');
  if (shovel && bot.heldItem?.name !== 'iron_shovel') {
    try { await bot.equip(shovel, 'hand'); } catch {}
  }

  const dist = bot.entity.position.distanceTo(target.position);
  try { await bot.lookAt(target.position); } catch {}

  if (dist > 4) {
    bot.setControlState('forward', true);
    bot.setControlState('sprint', dist > 7);
    return;
  }

  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);

  // Dig snow under/near opponent — search wider area
  const tp = target.position;
  for (let dy = 0; dy >= -3; dy--) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        try {
          const block = bot.blockAt(tp.offset(dx, dy, dz));
          if (block && block.name === 'snow_block') {
            await bot.dig(block, true);
            botStats[name].blocks_dug++;
            return;
          }
        } catch {}
      }
    }
  }

  // No snow near opponent — dig snow under self to create holes
  const sp = bot.entity.position;
  for (let dy = 0; dy >= -2; dy--) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        try {
          const block = bot.blockAt(sp.offset(dx, dy, dz));
          if (block && block.name === 'snow_block') {
            await bot.dig(block, true);
            botStats[name].blocks_dug++;
            return;
          }
        } catch {}
      }
    }
  }

  // Move toward opponent if no snow anywhere
  bot.setControlState('forward', true);
}

const lastBowShot = {};
async function archeryTick(bot, name, target) {
  // Equip bow
  const bow = bot.inventory.items().find(i => i.name === 'bow');
  if (bow && bot.heldItem?.name !== 'bow') {
    try { await bot.equip(bow, 'hand'); } catch {}
  }

  const dist = bot.entity.position.distanceTo(target.position);
  const now = Date.now();

  // Gravity compensation
  const yOffset = 1.6 + (dist * 0.04);
  try { await bot.lookAt(target.position.offset(0, yOffset, 0)); } catch {}

  if (!lastBowShot[name]) lastBowShot[name] = 0;

  // Shoot with cooldown
  if (now - lastBowShot[name] > 1500) {
    bot.activateItem();
    const chargeTime = Math.min(1000, 300 + dist * 20);
    setTimeout(async () => {
      try { await bot.lookAt(target.position.offset(0, yOffset, 0)); } catch {}
      bot.deactivateItem();
      lastBowShot[name] = Date.now();
      botStats[name].arrows_shot++;
    }, chargeTime);
  }

  // MOVING TARGET — constant strafing between shots
  if (Math.random() < 0.4) {
    const dir = Math.random() > 0.5 ? 'left' : 'right';
    bot.setControlState(dir, true);
    setTimeout(() => bot.setControlState(dir, false), 400);
  }
  if (Math.random() < 0.15) {
    bot.setControlState('forward', true);
    setTimeout(() => bot.setControlState('forward', false), 300);
  }
  if (Math.random() < 0.15) {
    bot.setControlState('back', true);
    setTimeout(() => bot.setControlState('back', false), 300);
  }

  // Stay in bounds — if drifting out, walk back toward center
  const pos = bot.entity.position;
  if (pos.x < ARCHERY_BOUNDS.x1 + 2 || pos.x > ARCHERY_BOUNDS.x2 - 2 ||
      pos.z < ARCHERY_BOUNDS.z1 + 2 || pos.z > ARCHERY_BOUNDS.z2 - 2) {
    try { await bot.lookAt({ x: 0, y: 4 + 1.6, z: -55 }); } catch {}
    bot.setControlState('forward', true);
    setTimeout(() => bot.setControlState('forward', false), 500);
  }
}

const combatFns = { pvp: pvpTick, sumo: sumoTick, spleef: spleefTick, archery: archeryTick };

// ─── Return to arena after match end ───────────────────────

async function returnToArena(bot, name, arena, spawn, stats) {
  if (isReturning[name]) return; // prevent double triggers
  isReturning[name] = true;
  stats.active = false;
  log(name, '[MATCH-END] Returning to arena in 5s...');

  await sleep(5000);
  try {
    bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
    await sleep(2000);
    bot.chat('/clear @s');
    await sleep(200);
    await giveItems(name, arena);
    await sleep(500);
    await equipForArena(bot, name, arena);
    stats.active = true;
    log(name, '[MATCH-END] Back in arena!');
  } catch (e) {
    log(name, `Return error: ${e.message}`);
  }
  isReturning[name] = false;
}

// ─── Entity cleanup (arrows, items) every 2 min ───────────

async function entityCleanup() {
  if (!rcon) return;
  try {
    const r1 = await rcon.send('kill @e[type=item]');
    const r2 = await rcon.send('kill @e[type=arrow]');
    console.log(`[CLEANUP] Items: ${r1} | Arrows: ${r2}`);
  } catch {}
}

// ─── Create one arena bot ──────────────────────────────────

function createArenaBot(def) {
  const { name, arena, spawn, opponent } = def;
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
    arena, attacks: 0, blocks_dug: 0, arrows_shot: 0,
    deaths: 0, tickCount: 0, staleTicks: 0, active: false,
  };

  let combatInterval = null;
  let healthCheckInterval = null;

  bot.once('spawn', async () => {
    log(name, 'Spawned! Waiting for OP...');
    await sleep(2000);

    try { await rcon.send(`op ${name}`); } catch {}

    // Teleport to arena
    bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
    log(name, `Teleported to ${arena} (${spawn.x}, ${spawn.y}, ${spawn.z})`);
    await sleep(3000);

    // Give items via RCON
    bot.chat('/clear @s');
    await sleep(200);
    await giveItems(name, arena);
    await sleep(500);
    await equipForArena(bot, name, arena);
    log(name, `Equipped for ${arena}`);

    botStats[name].active = true;
    botInstances[name] = bot;

    // Start combat loop (250ms)
    const combatFn = combatFns[arena];
    combatInterval = setInterval(async () => {
      if (!botStats[name].active) return;
      const target = getOpponentEntity(name, opponent);
      if (!target) return;
      botStats[name].tickCount++;
      try { await combatFn(bot, name, target); } catch (e) {
        log(name, `Combat error: ${e.message}`);
      }
    }, 250);

    // Health check every 10s
    healthCheckInterval = setInterval(() => {
      if (!bot.entity) return;
      const stats = botStats[name];
      const pos = bot.entity.position;
      const target = getOpponentEntity(name, opponent);
      const dist = target ? bot.entity.position.distanceTo(target.position).toFixed(1) : 'N/A';

      console.log(`[HEALTH-CHECK][${name}] HP:${bot.health?.toFixed(1) || '?'}/20 | ` +
        `Pos:(${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}) | ` +
        `Opponent:${opponent} dist:${dist} | Arena:${arena} | ` +
        `ATK:${stats.attacks} DIG:${stats.blocks_dug} ARW:${stats.arrows_shot} | ` +
        `Deaths:${stats.deaths} | Tick:${stats.tickCount}`);

      // Stale detection
      if (!target) {
        stats.staleTicks++;
        console.log(`[STALE-WARNING][${name}] Cannot find ${opponent} for ${stats.staleTicks * 10}s`);
        if (stats.staleTicks >= 3) {
          console.log(`[STALE-RECOVERY][${name}] Re-teleporting to spawn...`);
          bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
          stats.staleTicks = 0;
        }
      } else {
        stats.staleTicks = 0;
      }

      // Hub detection — if at hub, re-teleport to arena (with flag to prevent double)
      if (!isReturning[name] && Math.abs(pos.x - HUB_POS.x) < 3 && Math.abs(pos.z - HUB_POS.z) < 3 && Math.abs(pos.y - HUB_POS.y) < 3) {
        returnToArena(bot, name, arena, spawn, stats);
      }
    }, 10000);
  });

  // Death handler
  bot.on('death', () => {
    botStats[name].deaths++;
    log(name, `[DEATH] Killed! (death #${botStats[name].deaths}) Respawning in 3s...`);
    botStats[name].active = false;

    // Award win to opponent
    try { rcon.send(`scoreboard players add ${opponent} wins 1`); } catch {}

    // Kill dropped items nearby to reduce entity spam
    try { rcon.send('kill @e[type=item]'); } catch {}
    try { rcon.send('kill @e[type=arrow]'); } catch {}
    try { rcon.send('kill @e[type=experience_orb]'); } catch {}

    setTimeout(async () => {
      try {
        bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
        await sleep(2000);
        bot.chat('/clear @s');
        await sleep(200);
        await giveItems(name, arena);
        await sleep(500);
        await equipForArena(bot, name, arena);
        botStats[name].active = true;
        log(name, `[RESPAWN] Back in action! HP:${bot.health}`);
      } catch (e) {
        log(name, `Respawn error: ${e.message}`);
      }
    }, 3000);
  });

  // Forced move (timer TP'd to hub)
  bot.on('forcedMove', () => {
    const pos = bot.entity?.position;
    if (pos && !isReturning[name] && Math.abs(pos.x - HUB_POS.x) < 5 && Math.abs(pos.z - HUB_POS.z) < 5) {
      returnToArena(bot, name, arena, spawn, botStats[name]);
    }
  });

  bot.on('error', (err) => log(name, `ERROR: ${err.message}`));

  bot.on('kicked', (reason) => {
    log(name, `KICKED: ${JSON.stringify(reason)}`);
    cleanup();
    reconnect();
  });

  bot.on('end', () => {
    log(name, 'DISCONNECTED');
    cleanup();
    reconnect();
  });

  function cleanup() {
    if (combatInterval) { clearInterval(combatInterval); combatInterval = null; }
    if (healthCheckInterval) { clearInterval(healthCheckInterval); healthCheckInterval = null; }
    botStats[name].active = false;
    delete botInstances[name];
  }

  function reconnect() {
    if (isReconnecting[name]) return; // prevent duplicate reconnect
    isReconnecting[name] = true;
    log(name, 'Reconnecting in 5s...');
    setTimeout(() => {
      isReconnecting[name] = false;
      createArenaBot(def);
    }, 5000);
  }

  return bot;
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  MINEFORGE ARENA — 8 AI BOTS (2 per arena)');
  console.log('  PvP | Sumo | Spleef | Archery');
  console.log('='.repeat(70) + '\n');

  rcon = await Rcon.connect(RCON_CFG);
  console.log('RCON connected\n');

  // Keep inventory on death (prevents item drops / entity spam)
  await rcon.send('gamerule keepInventory true');
  // Kill existing entities
  await rcon.send('kill @e[type=item]');
  await rcon.send('kill @e[type=arrow]');
  await rcon.send('kill @e[type=experience_orb]');
  console.log('keepInventory enabled, entities cleaned\n');

  // Regenerate spleef snow layers
  await rcon.send('fill -66 7 -11 -44 7 11 snow_block');
  await rcon.send('fill -66 11 -11 -44 11 11 snow_block');
  await rcon.send('fill -66 15 -11 -44 15 11 snow_block');
  console.log('Spleef snow regenerated\n');

  // OP all bots
  for (const def of BOT_DEFS) {
    try { await rcon.send(`op ${def.name}`); } catch {}
  }
  console.log('All bots OP\'d\n');

  // Spawn first bot of each pair
  console.log('Spawning first wave (4 bots)...\n');
  const firstWave = BOT_DEFS.filter((_, i) => i % 2 === 0);
  for (const def of firstWave) {
    createArenaBot(def);
  }

  // Wait for first wave to be ready, then spawn second wave
  await sleep(8000);
  console.log('\nSpawning second wave (4 bots)...\n');
  const secondWave = BOT_DEFS.filter((_, i) => i % 2 === 1);
  for (const def of secondWave) {
    createArenaBot(def);
  }

  console.log('\nAll 8 bots launched! Monitoring...\n');

  // Entity cleanup every 2 minutes (arrows, dropped items)
  setInterval(entityCleanup, 120000);

  // Spleef snow regen every 3 minutes
  setInterval(async () => {
    if (!rcon) return;
    try {
      await rcon.send('fill -66 7 -11 -44 7 11 snow_block');
      await rcon.send('fill -66 11 -11 -44 11 11 snow_block');
      await rcon.send('fill -66 15 -11 -44 15 11 snow_block');
      console.log('[REGEN] Spleef snow regenerated');
    } catch {}
  }, 180000);

  // Scoreboard sidebar updater — update live stats every 5s
  setInterval(async () => {
    if (!rcon) return;
    try {
      // Sum up total kills and wins across all bots
      let totalKills = 0;
      let totalWins = 0;
      let totalDeaths = 0;
      let activeFights = 0;
      for (const stats of Object.values(botStats)) {
        totalKills += stats.attacks;
        totalDeaths += stats.deaths;
        if (stats.active) activeFights++;
      }

      // Read actual wins from scoreboard
      const winsResult = await rcon.send('scoreboard players list');

      // Update sidebar team prefixes with live data
      // Line 3: Mode + active fighters
      await rcon.send(`team modify sb03 prefix [{"text":"Fighters: ","color":"gray"},{"text":"${activeFights}/8","color":"aqua"}]`);

      // Line 6: Total kills (attacks landed)
      await rcon.send(`team modify sb06 prefix [{"text":"Kills: ","color":"gray"},{"text":"${totalKills}","color":"yellow"}]`);

      // Line 7: Total deaths
      await rcon.send(`team modify sb07 prefix [{"text":"Deaths: ","color":"gray"},{"text":"${totalDeaths}","color":"red"}]`);

      // Also update kills scoreboard objective per bot
      for (const [name, stats] of Object.entries(botStats)) {
        await rcon.send(`scoreboard players set ${name} kills ${stats.attacks}`);
      }
    } catch {}
  }, 5000);

  // Global status report every 30s
  setInterval(() => {
    console.log('\n' + '='.repeat(80));
    console.log(`[${ts()}] GLOBAL STATUS`);
    console.log('='.repeat(80));
    for (const [name, stats] of Object.entries(botStats)) {
      const fighting = stats.active && (stats.attacks > 0 || stats.blocks_dug > 0 || stats.arrows_shot > 0);
      const status = stats.active ? (fighting ? 'FIGHTING' : 'IDLE') : 'INACTIVE';
      console.log(`  ${name.padEnd(10)} | ${stats.arena.padEnd(8)} | ATK:${String(stats.attacks).padStart(4)} | ` +
        `DIG:${String(stats.blocks_dug).padStart(4)} | ARW:${String(stats.arrows_shot).padStart(4)} | ` +
        `DEATHS:${stats.deaths} | TICKS:${stats.tickCount} | ${status}`);
    }
    console.log('='.repeat(80) + '\n');
  }, 30000);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

process.on('SIGINT', () => {
  console.log('\nShutting down all bots...');
  for (const [name, bot] of Object.entries(botInstances)) {
    try { bot.quit(); } catch {}
  }
  if (rcon) rcon.end();
  process.exit(0);
});
