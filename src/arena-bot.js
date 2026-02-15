// MineForge Arena Bot — AI competitor for 1v1 arena matches
// Detects players entering arenas, teleports to join, fights with arena-specific AI
// State machine: IDLE → ENTERING → FIGHTING → IDLE

import mineflayer from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pkg;
import minecraftData from 'minecraft-data';

const BOT_NAME = 'ArenaBot';

const HUB_SPAWN = { x: 0, y: 4, z: -8 };

const ARENA_SPAWNS = {
  pvp:     { x: 0,   y: 4,   z: 44 },
  sumo:    { x: 44,  y: 11,  z: 0 },
  spleef:  { x: -43, y: 16,  z: 0 },
  archery: { x: 0,   y: 4,   z: -44 },
};

const ARENA_BOUNDS = {
  pvp:     { x1: -12, x2: 12,  z1: 43, z2: 67 },
  sumo:    { x1: 43,  x2: 67,  z1: -12, z2: 12 },
  spleef:  { x1: -67, x2: -43, z1: -12, z2: 12 },
  archery: { x1: -14, x2: 14,  z1: -62, z2: -48 },
};

const SUMO_CENTER = { x: 55, y: 11, z: 0 };

const SCAN_INTERVAL = 1000;
const COMBAT_INTERVAL = 250;

// ─── State ────────────────────────────────────────────────

let currentState = 'idle';
let currentArena = null;
let combatLoopId = null;
let scanLoopId = null;
let lastBowShot = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Arena detection ──────────────────────────────────────

function getArenaAt(x, y, z) {
  for (const [name, b] of Object.entries(ARENA_BOUNDS)) {
    if (x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2 && y >= 0 && y <= 30) {
      return name;
    }
  }
  return null;
}

function findNearestPlayer(bot) {
  return bot.nearestEntity(e =>
    e.type === 'player' && e.username !== bot.username
  );
}

function isInArena(bot, arenaName) {
  const pos = bot.entity.position;
  return getArenaAt(pos.x, pos.y, pos.z) === arenaName;
}

// ─── Scanner loop ─────────────────────────────────────────

function scanForPlayers(bot) {
  if (currentState !== 'idle') return;

  for (const player of Object.values(bot.players)) {
    if (player.username === bot.username || !player.entity) continue;
    const pos = player.entity.position;
    const arena = getArenaAt(pos.x, pos.y, pos.z);
    if (arena) {
      console.log(`[ArenaBot] ${player.username} detected in ${arena} arena — joining!`);
      enterArena(bot, arena);
      return;
    }
  }
}

// ─── Arena entry ──────────────────────────────────────────

async function enterArena(bot, arenaName) {
  currentState = 'entering';
  currentArena = arenaName;

  const spawn = ARENA_SPAWNS[arenaName];
  console.log(`[ArenaBot] Teleporting to ${arenaName} (${spawn.x}, ${spawn.y}, ${spawn.z})`);

  bot.chat(`/clear @s`);
  await sleep(200);
  bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);

  // Wait for command blocks to auto-equip items (tick 3 = ~150ms after arrival)
  await sleep(3000);

  await equipForArena(bot, arenaName);

  console.log(`[ArenaBot] Fighting in ${arenaName}!`);
  currentState = 'fighting';
  startCombatLoop(bot, arenaName);
}

async function equipForArena(bot, arenaName) {
  const items = bot.inventory.items();

  switch (arenaName) {
    case 'pvp': {
      const sword = items.find(i => i.name === 'iron_sword');
      if (sword) await bot.equip(sword, 'hand');
      const shield = items.find(i => i.name === 'shield');
      if (shield) await bot.equip(shield, 'off-hand');
      break;
    }
    case 'sumo': {
      const stick = items.find(i => i.name === 'stick');
      if (stick) await bot.equip(stick, 'hand');
      break;
    }
    case 'spleef': {
      const shovel = items.find(i => i.name === 'iron_shovel');
      if (shovel) await bot.equip(shovel, 'hand');
      break;
    }
    case 'archery': {
      const bow = items.find(i => i.name === 'bow');
      if (bow) await bot.equip(bow, 'hand');
      break;
    }
  }
}

// ─── Combat loop ──────────────────────────────────────────

function startCombatLoop(bot, arenaName) {
  stopCombatLoop();
  const strategies = { pvp: pvpTick, sumo: sumoTick, spleef: spleefTick, archery: archeryTick };
  const fn = strategies[arenaName];
  if (fn) combatLoopId = setInterval(() => fn(bot), COMBAT_INTERVAL);
}

function stopCombatLoop() {
  if (combatLoopId) { clearInterval(combatLoopId); combatLoopId = null; }
}

function returnToIdle(bot) {
  stopCombatLoop();
  bot.pathfinder.setGoal(null);
  bot.clearControlStates();
  currentState = 'idle';
  currentArena = null;
}

// ─── PvP AI ───────────────────────────────────────────────

async function pvpTick(bot) {
  if (currentState !== 'fighting') return;

  const target = findNearestPlayer(bot);
  if (!target) {
    if (!isInArena(bot, 'pvp')) returnToIdle(bot);
    return;
  }

  const dist = bot.entity.position.distanceTo(target.position);

  // Heal with golden apple when low
  if (bot.health < 10) {
    const apple = bot.inventory.items().find(i => i.name === 'golden_apple');
    if (apple) {
      try {
        await bot.equip(apple, 'hand');
        bot.activateItem();
        await sleep(1600);
        bot.deactivateItem();
        const sword = bot.inventory.items().find(i => i.name === 'iron_sword');
        if (sword) await bot.equip(sword, 'hand');
      } catch {}
      return;
    }
  }

  if (dist > 3.5) {
    // Chase
    try {
      const mcData = minecraftData(bot.version);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    } catch {}
  } else {
    // Melee attack
    try {
      bot.pathfinder.setGoal(null);
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      bot.attack(target);

      // Random strafe
      const dir = Math.random() > 0.5 ? 'left' : 'right';
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 200);

      // Sprint-jump crit (30% chance)
      if (Math.random() < 0.3) {
        bot.setControlState('sprint', true);
        bot.setControlState('jump', true);
        setTimeout(() => {
          bot.setControlState('sprint', false);
          bot.setControlState('jump', false);
        }, 300);
      }
    } catch {}
  }
}

// ─── Sumo AI ──────────────────────────────────────────────

async function sumoTick(bot) {
  if (currentState !== 'fighting') return;

  const target = findNearestPlayer(bot);
  if (!target) {
    if (!isInArena(bot, 'sumo')) returnToIdle(bot);
    return;
  }

  const dist = bot.entity.position.distanceTo(target.position);

  // Self-preservation: stay near center
  const distToCenter = Math.sqrt(
    (bot.entity.position.x - SUMO_CENTER.x) ** 2 +
    (bot.entity.position.z - SUMO_CENTER.z) ** 2
  );

  if (distToCenter > 5 && dist > 3) {
    // Retreat to center first
    try {
      const mcData = minecraftData(bot.version);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);
      bot.pathfinder.setGoal(new goals.GoalNear(SUMO_CENTER.x, SUMO_CENTER.y, SUMO_CENTER.z, 2));
    } catch {}
    return;
  }

  try {
    await bot.lookAt(target.position.offset(0, 1.6, 0));
  } catch {}

  if (dist > 3) {
    // Sprint toward
    bot.setControlState('sprint', true);
    bot.setControlState('forward', true);
  } else {
    // Sprint-hit for max knockback
    bot.setControlState('sprint', true);
    bot.setControlState('forward', true);
    try { bot.attack(target); } catch {}
    setTimeout(() => {
      bot.setControlState('sprint', false);
      bot.setControlState('forward', false);
    }, 200);
  }
}

// ─── Spleef AI ────────────────────────────────────────────

async function spleefTick(bot) {
  if (currentState !== 'fighting') return;

  const target = findNearestPlayer(bot);
  if (!target) {
    if (!isInArena(bot, 'spleef')) returnToIdle(bot);
    return;
  }

  // Make sure shovel is equipped
  const shovel = bot.inventory.items().find(i => i.name === 'iron_shovel');
  if (shovel && bot.heldItem?.name !== 'iron_shovel') {
    try { await bot.equip(shovel, 'hand'); } catch {}
  }

  const targetPos = target.position;
  const dist = bot.entity.position.distanceTo(targetPos);

  if (dist > 5) {
    // Move closer to target
    try {
      const mcData = minecraftData(bot.version);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);
      bot.pathfinder.setGoal(new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 3), true);
    } catch {}
    return;
  }

  // Dig snow blocks under/near the target
  bot.pathfinder.setGoal(null);
  for (let dy = 0; dy >= -2; dy--) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        try {
          const block = bot.blockAt(targetPos.offset(dx, dy, dz));
          if (block && block.name === 'snow_block') {
            await bot.dig(block, true);
            return; // One block per tick
          }
        } catch {}
      }
    }
  }
}

// ─── Archery AI ───────────────────────────────────────────

async function archeryTick(bot) {
  if (currentState !== 'fighting') return;

  const target = findNearestPlayer(bot);
  if (!target) {
    if (!isInArena(bot, 'archery')) returnToIdle(bot);
    return;
  }

  // Equip bow
  const bow = bot.inventory.items().find(i => i.name === 'bow');
  if (bow && bot.heldItem?.name !== 'bow') {
    try { await bot.equip(bow, 'hand'); } catch {}
  }

  const dist = bot.entity.position.distanceTo(target.position);
  const now = Date.now();

  // Aim (height offset for arrow arc)
  const yOffset = 1.6 + (dist * 0.04);
  try {
    await bot.lookAt(target.position.offset(0, yOffset, 0));
  } catch {}

  // Shoot with cooldown
  if (now - lastBowShot > 1500) {
    bot.activateItem(); // Draw bow
    const chargeTime = Math.min(1000, 300 + dist * 20);

    setTimeout(async () => {
      try {
        await bot.lookAt(target.position.offset(0, yOffset, 0));
      } catch {}
      bot.deactivateItem(); // Release
      lastBowShot = Date.now();
    }, chargeTime);
  }

  // Strafe between shots
  if (now - lastBowShot > 800 && now - lastBowShot < 1200) {
    const dir = Math.random() > 0.5 ? 'left' : 'right';
    bot.setControlState(dir, true);
    setTimeout(() => bot.setControlState(dir, false), 300);
  }
}

// ─── Bot creation ─────────────────────────────────────────

function createArenaBot() {
  console.log('[ArenaBot] Connecting to server...');

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: BOT_NAME,
    auth: 'offline',
    version: '1.16.2',
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('[ArenaBot] Spawned! Waiting for OP...');

    setTimeout(() => {
      bot.chat(`/tp @s ${HUB_SPAWN.x} ${HUB_SPAWN.y} ${HUB_SPAWN.z}`);
      console.log('[ArenaBot] Ready at hub. Scanning for players...');
      currentState = 'idle';
      scanLoopId = setInterval(() => scanForPlayers(bot), SCAN_INTERVAL);
    }, 3000);
  });

  // Death: respawn and return to hub
  bot.on('death', () => {
    console.log('[ArenaBot] Died!');
    const wasArena = currentArena;
    stopCombatLoop();
    currentState = 'idle';
    currentArena = null;

    // Award win to opponent
    if (wasArena) {
      setTimeout(() => {
        const opponent = findNearestPlayer(bot);
        if (opponent) {
          bot.chat(`/scoreboard players add ${opponent.username} wins 1`);
          console.log(`[ArenaBot] Awarded win to ${opponent.username}`);
        }
      }, 2000);
    }

    // Return to hub after respawn
    setTimeout(() => {
      bot.chat(`/tp @s ${HUB_SPAWN.x} ${HUB_SPAWN.y} ${HUB_SPAWN.z}`);
    }, 1500);
  });

  // Forced move (timer TP'd us back to hub)
  bot.on('forcedMove', () => {
    if (currentState === 'fighting') {
      console.log('[ArenaBot] Match ended (timer). Returning to idle.');
      returnToIdle(bot);
    }
  });

  // Track opponent deaths for win scoring
  bot.on('entityDead', (entity) => {
    if (currentState !== 'fighting' || !currentArena) return;
    if (entity.type === 'player' && entity.username !== bot.username) {
      console.log(`[ArenaBot] Opponent ${entity.username} eliminated!`);
      bot.chat(`/scoreboard players add ${BOT_NAME} wins 1`);
    }
  });

  bot.on('error', (err) => console.error('[ArenaBot] Error:', err.message));

  bot.on('kicked', (reason) => {
    console.log('[ArenaBot] Kicked:', reason);
    stopCombatLoop();
    if (scanLoopId) clearInterval(scanLoopId);
  });

  bot.on('end', () => {
    console.log('[ArenaBot] Disconnected.');
    stopCombatLoop();
    if (scanLoopId) clearInterval(scanLoopId);
  });

  return bot;
}

// ─── Startup ──────────────────────────────────────────────

console.log('[ArenaBot] Starting AI Arena Competitor...');
const bot = createArenaBot();

process.on('SIGINT', () => {
  console.log('[ArenaBot] Shutting down...');
  stopCombatLoop();
  if (scanLoopId) clearInterval(scanLoopId);
  bot.quit();
  setTimeout(() => process.exit(0), 1000);
});
