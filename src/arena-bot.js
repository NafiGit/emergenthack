// MineForge Arena — 20 Independent AI Bots (5 per arena) in FFA combat
// Each bot is its own mineflayer connection with arena-specific combat AI
// Bots find opponents via cross-referenced bot.entity (mineflayer offline mode
// doesn't populate entity.type/username for other players)

import mineflayer from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pkg;
import minecraftData from 'minecraft-data';
import { Rcon } from 'rcon-client';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RCON_CFG = { host: 'localhost', port: 25575, password: 'minecraft123' };

// ─── Strategy file loading ──────────────────────────────────

const STRAT_DIR = path.join(__dirname, '..', 'strategies');
const botStrategies = {}; // name → parsed strategy object

function loadStrategy(name) {
  try {
    const raw = fs.readFileSync(path.join(STRAT_DIR, name + '.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

// ─── Per-bot file logging ───────────────────────────────────

const LOG_DIR = '/tmp/arena-logs';
fs.mkdirSync(LOG_DIR, { recursive: true });

function logToFile(name, msg) {
  const line = `[${ts()}] [${name}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(path.join(LOG_DIR, name + '.log'), line);
}

// ─── Bot definitions (5 per arena, FFA) ──────────────────────

const BOT_DEFS = [
  // PvP Arena (south, center 0,55)
  { name: 'Fury',     arena: 'pvp',     spawn: { x: 0, y: 4, z: 46 } },    // Aggressive
  { name: 'Bastion',  arena: 'pvp',     spawn: { x: 0, y: 4, z: 64 } },    // Defensive
  { name: 'Shadow',   arena: 'pvp',     spawn: { x: -8, y: 4, z: 55 } },   // Evasive
  { name: 'Knight',   arena: 'pvp',     spawn: { x: 8, y: 4, z: 55 } },    // Balanced
  { name: 'Reaper',   arena: 'pvp',     spawn: { x: 0, y: 4, z: 52 } },    // Glass cannon

  // Sumo Arena (east, center 55,0)
  { name: 'Rhino',    arena: 'sumo',    spawn: { x: 50, y: 11, z: 5 } },   // Rusher
  { name: 'Boulder',  arena: 'sumo',    spawn: { x: 60, y: 11, z: -5 } },  // Center control
  { name: 'Viper',    arena: 'sumo',    spawn: { x: 55, y: 11, z: 6 } },   // Edge fighter
  { name: 'IronFist', arena: 'sumo',    spawn: { x: 55, y: 11, z: -6 } },  // Combo hitter
  { name: 'Fortress', arena: 'sumo',    spawn: { x: 48, y: 11, z: 0 } },   // Retreater

  // Spleef Arena (west, center -55,0)
  { name: 'Mole',     arena: 'spleef',  spawn: { x: -50, y: 16, z: 5 } },  // Aggressive digger
  { name: 'Scout',    arena: 'spleef',  spawn: { x: -60, y: 16, z: -5 } }, // Cautious
  { name: 'Dash',     arena: 'spleef',  spawn: { x: -50, y: 16, z: -5 } }, // Runner
  { name: 'Quake',    arena: 'spleef',  spawn: { x: -60, y: 16, z: 5 } },  // Wide digger
  { name: 'Lurker',   arena: 'spleef',  spawn: { x: -55, y: 16, z: 0 } },  // Stalker

  // Archery Arena (north, center 0,-55)
  { name: 'Hawkeye',  arena: 'archery', spawn: { x: 5, y: 4, z: -52 } },   // Sniper
  { name: 'Ranger',   arena: 'archery', spawn: { x: -5, y: 4, z: -58 } },  // Run-and-gun
  { name: 'Sentinel', arena: 'archery', spawn: { x: -10, y: 4, z: -55 } }, // Camper
  { name: 'Mirage',   arena: 'archery', spawn: { x: 10, y: 4, z: -55 } },  // Dodger
  { name: 'Robin',    arena: 'archery', spawn: { x: 0, y: 4, z: -55 } },   // Balanced
];

const BOTS_PER_ARENA = 5;

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
const isReconnecting = {}; // name → boolean (prevents duplicate reconnect loops)

// ─── FFA alive tracking ────────────────────────────────────
const aliveBots = { pvp: new Set(), sumo: new Set(), spleef: new Set(), archery: new Set() };

// ─── Betting System ──────────────────────────────────────────
const STARTING_COINS = 100;
const DEFAULT_BET = 10;
const playerCoins = {};   // playerName → coin balance
const activeBets = { pvp: {}, sumo: {}, spleef: {}, archery: {} };
const bettingOpen = { pvp: false, sumo: false, spleef: false, archery: false };
const chatDedup = new Set(); // prevent duplicate chat processing across bots
const BETTING_DURATION = 15; // configurable betting period in seconds

// Gallery bounding box RCON selectors (outer bounds of spectator corridors)
const GALLERY_SELECTORS = {
  pvp:     'x=-15,y=3,z=40,dx=30,dy=5,dz=30',
  sumo:    'x=40,y=10,z=-15,dx=30,dy=5,dz=30',
  spleef:  'x=-70,y=15,z=-15,dx=30,dy=6,dz=30',
  archery: 'x=-17,y=3,z=-65,dx=34,dy=5,dz=20',
};

// Gallery TP-back positions (for bettor lock enforcement)
const GALLERY_TP = {
  pvp:     '14 4 41',
  sumo:    '41 11 -14',
  spleef:  '-41 16 -14',
  archery: '16 4 -46',
};

// ─── Match Lifecycle — one self-driving game loop per arena ─────
// States: WAITING → COUNTDOWN → BETTING → ACTIVE → ENDING → RESETTING → WAITING
const arenaMatches = {
  pvp:     { state: 'WAITING', startTime: 0, winner: null, matchNum: 0 },
  sumo:    { state: 'WAITING', startTime: 0, winner: null, matchNum: 0 },
  spleef:  { state: 'WAITING', startTime: 0, winner: null, matchNum: 0 },
  archery: { state: 'WAITING', startTime: 0, winner: null, matchNum: 0 },
};

// Signal channel: death/fall/forcedMove resolves the promise to end active match
const matchEndResolvers = {}; // arena → { resolve }

function signalMatchEnd(arena, reason, winner = null) {
  const r = matchEndResolvers[arena];
  if (r) {
    delete matchEndResolvers[arena];
    r.resolve({ reason, winner });
  }
}

const AREA_SELECTORS = {
  pvp:     'x=-12,y=0,z=43,dx=24,dy=30,dz=24',
  sumo:    'x=43,y=0,z=-12,dx=24,dy=30,dz=24',
  spleef:  'x=-67,y=0,z=-12,dx=24,dy=30,dz=24',
  archery: 'x=-14,y=0,z=-62,dx=28,dy=30,dz=14',
};

// Arena bounding boxes for position checks (prevents fighting at hub after death respawn)
const ARENA_BOXES = {
  pvp:     { x1: -12, z1: 43, x2: 12, z2: 67 },
  sumo:    { x1: 43,  z1: -12, x2: 67, z2: 12 },
  spleef:  { x1: -67, z1: -12, x2: -43, z2: 12 },
  archery: { x1: -14, z1: -62, x2: 14, z2: -48 },
};

function isInArena(pos, arena) {
  const b = ARENA_BOXES[arena];
  return pos.x >= b.x1 && pos.x <= b.x2 && pos.z >= b.z1 && pos.z <= b.z2;
}

const MATCH_DURATION = 120000; // 2 minutes

// ─── FFA elimination handler ────────────────────────────────
function eliminateBot(arena, deadName) {
  aliveBots[arena].delete(deadName);
  if (botStats[deadName]) botStats[deadName].active = false;

  const remaining = [...aliveBots[arena]];
  console.log(`[${ts()}] [${arena.toUpperCase()}] ${deadName} eliminated! ${remaining.length} alive: ${remaining.join(', ')}`);

  if (remaining.length <= 1) {
    const winner = remaining[0] || null;
    signalMatchEnd(arena, `${deadName} eliminated (last standing)`, winner);
  }
}

// ─── The Game Loop (one per arena, runs forever) ──────
async function arenaGameLoop(arena) {
  const match = arenaMatches[arena];
  const bots = BOT_DEFS.filter(d => d.arena === arena);

  while (true) {
    // ── WAITING: poll until all bots are connected ──
    match.state = 'WAITING';
    match.winner = null;
    while (true) {
      const connected = bots.filter(d => botInstances[d.name]).length;
      if (connected >= bots.length) break;
      await sleep(2000);
    }
    await sleep(1000); // brief settle

    // ── COUNTDOWN: 3-2-1-FIGHT ──
    match.state = 'COUNTDOWN';
    match.matchNum++;
    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — COUNTDOWN (${bots.length}-bot FFA)`);

    // Reset command block timer to prevent conflict with game loop lifecycle
    try { await rcon.send(`scoreboard players set ${arena}_t timer 0`); } catch {}

    // Clean up stale bettor tags from previous match
    try { await rcon.send(`tag @a[tag=bettor_${arena}] remove bettor_${arena}`); } catch {}

    // Initialize alive set
    aliveBots[arena] = new Set(bots.map(d => d.name));

    // Freeze bots at spawn
    for (const def of bots) {
      if (botStats[def.name]) botStats[def.name].active = false;
      const bot = botInstances[def.name];
      if (bot) {
        bot.clearControlStates();
        bot.chat(`/tp @s ${def.spawn.x} ${def.spawn.y} ${def.spawn.z}`);
      }
    }
    await sleep(1000);

    const countColors = { 3: 'yellow', 2: 'gold', 1: 'red' };
    for (let i = 3; i >= 1; i--) {
      for (const def of bots) {
        try { await rcon.send(`title ${def.name} title {"text":"${i}","color":"${countColors[i]}","bold":true}`); } catch {}
      }
      console.log(`[${ts()}] [${arena.toUpperCase()}] ${i}...`);
      await sleep(1000);
    }

    // ── BETTING: open betting for gallery spectators ──
    match.state = 'BETTING';
    bettingOpen[arena] = true;
    const galSel = `@a[tag=!bot,${GALLERY_SELECTORS[arena]}]`;

    try {
      await rcon.send(`title ${galSel} title {"text":"BETTING OPEN","color":"gold","bold":true}`);
      const names = bots.map(d => d.name).join(' vs ');
      await rcon.send(`title ${galSel} subtitle {"text":"${names}","color":"white"}`);

      // Build clickable tellraw with all 5 bot options
      const colors = ['green', 'red', 'aqua', 'yellow', 'light_purple'];
      const tellrawParts = [
        {"text":"\n"},
        {"text":"═══ PLACE YOUR BET ═══","color":"gold","bold":true},
        {"text":"\n\n"},
      ];
      for (let i = 0; i < bots.length; i++) {
        if (i > 0) tellrawParts.push({"text":" | ","color":"gray"});
        tellrawParts.push({
          "text":`[${bots[i].name}]`,"color":colors[i % colors.length],"bold":true,
          "clickEvent":{"action":"run_command","value":`/msg ${bots[0].name} BET:${arena}:${i+1}`},
          "hoverEvent":{"action":"show_text","value":`Bet ${DEFAULT_BET} coins on ${bots[i].name}`}
        });
      }
      tellrawParts.push({"text":"\n"});
      tellrawParts.push({"text":`${DEFAULT_BET} coins per bet · Click to place`,"color":"gray","italic":true});
      tellrawParts.push({"text":"\n"});
      await rcon.send(`tellraw ${galSel} ${JSON.stringify(tellrawParts)}`);
    } catch {}

    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — BETTING (${BETTING_DURATION}s)`);

    for (let i = BETTING_DURATION; i > 0; i--) {
      const color = i <= 5 ? 'red' : i <= 10 ? 'gold' : 'yellow';
      try { await rcon.send(`title ${galSel} actionbar {"text":"Betting closes in ${i}s","color":"${color}"}`); } catch {}
      await sleep(1000);
    }

    bettingOpen[arena] = false;
    try { await rcon.send(`title ${galSel} actionbar {"text":"BETS LOCKED!","color":"red","bold":true}`); } catch {}

    // Tag bettors for lock enforcement during match
    for (const playerName of Object.keys(activeBets[arena])) {
      try { await rcon.send(`tag ${playerName} add bettor_${arena}`); } catch {}
    }

    // ── FIGHT! ──
    for (const def of bots) {
      try {
        await rcon.send(`title ${def.name} title {"text":"FIGHT!","color":"green","bold":true}`);
        await rcon.send(`title ${def.name} subtitle {"text":"FFA Match #${match.matchNum}","color":"gray"}`);
      } catch {}
    }
    // Also announce to gallery spectators
    try { await rcon.send(`title ${galSel} title {"text":"FIGHT!","color":"green","bold":true}`); } catch {}

    // ── ACTIVE: enable combat, wait for match end signal or timeout ──
    match.state = 'ACTIVE';
    match.startTime = Date.now();
    for (const def of bots) {
      if (botStats[def.name]) botStats[def.name].active = true;
    }
    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — FIGHT! (${bots.length}-bot FFA)`);

    // Bettor lock — TP escapees back to gallery every 3s
    const bettorLockInterval = setInterval(async () => {
      try {
        await rcon.send(`execute as @a[tag=bettor_${arena}] unless entity @s[${GALLERY_SELECTORS[arena]}] run tp @s ${GALLERY_TP[arena]}`);
      } catch {}
    }, 3000);

    // Race: match-end signal vs timeout vs time announcements
    let cleanupTimers = null;
    const result = await new Promise(resolve => {
      // Timeout after 2 minutes — highest HP wins
      const timeout = setTimeout(() => {
        const alive = [...aliveBots[arena]];
        let winner = null, reason = 'Timeout (Draw)';
        if (alive.length > 0) {
          let bestHP = -1;
          for (const name of alive) {
            const hp = botInstances[name]?.health || 0;
            if (hp > bestHP) { bestHP = hp; winner = name; }
          }
          reason = `Timeout (${winner} had most HP)`;
        }
        signalMatchEnd(arena, reason, winner);
      }, MATCH_DURATION);

      // Time announcements
      const announce = (ms, text, color) => setTimeout(() => {
        if (match.state !== 'ACTIVE') return;
        for (const def of bots) {
          try { rcon.send(`title ${def.name} actionbar {"text":"${text}","color":"${color}"}`); } catch {}
        }
      }, MATCH_DURATION - ms);

      const t60 = announce(60000, '1:00 remaining', 'yellow');
      const t30 = announce(30000, '0:30 remaining', 'gold');
      const t10 = announce(10000, '10 seconds!', 'red');

      // Disconnect check every 3s — end match if only 1 bot connected
      const dcCheck = setInterval(() => {
        const connected = bots.filter(d => botInstances[d.name] && aliveBots[arena].has(d.name)).length;
        if (connected <= 1) {
          const survivor = bots.find(d => botInstances[d.name] && aliveBots[arena].has(d.name));
          signalMatchEnd(arena, connected === 0 ? 'All disconnected' : `${survivor.name} last standing (disconnects)`, survivor?.name || null);
        }
      }, 3000);

      cleanupTimers = () => { clearTimeout(timeout); clearTimeout(t60); clearTimeout(t30); clearTimeout(t10); clearInterval(dcCheck); };
      matchEndResolvers[arena] = { resolve };
    });

    // Clean up timers on early match end (death/fall before 2 min)
    if (cleanupTimers) cleanupTimers();
    clearInterval(bettorLockInterval);

    // ── ENDING: stop combat, announce winner ──
    match.state = 'ENDING';
    match.winner = result.winner;

    for (const def of bots) {
      if (botStats[def.name]) botStats[def.name].active = false;
      const bot = botInstances[def.name];
      if (bot) try { bot.clearControlStates(); } catch {}
    }

    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — ${result.reason} | Winner: ${result.winner || 'DRAW'}`);

    const titleText = result.winner ? `${result.winner} WINS!` : 'DRAW';
    const titleColor = result.winner ? 'green' : 'yellow';
    for (const def of bots) {
      try {
        await rcon.send(`title ${def.name} title {"text":"${titleText}","color":"${titleColor}","bold":true}`);
        await rcon.send(`title ${def.name} subtitle {"text":"${result.reason}","color":"gray"}`);
      } catch {}
    }
    if (result.winner) {
      try { await rcon.send(`scoreboard players add ${result.winner} wins 1`); } catch {}
      if (botStats[result.winner]) botStats[result.winner].kills++;
    }

    // Process betting payouts
    await processBetPayouts(arena, result.winner);

    // TP bettors back to hub after showing results
    await sleep(3000);
    try {
      await rcon.send(`title @a[tag=bettor_${arena}] title {"text":"Returning to Hub","color":"aqua"}`);
    } catch {}
    await sleep(2000);
    try {
      await rcon.send(`tp @a[tag=bettor_${arena}] ${HUB_POS.x} ${HUB_POS.y} ${HUB_POS.z}`);
      await rcon.send(`tag @a[tag=bettor_${arena}] remove bettor_${arena}`);
    } catch {}

    // ── RESETTING: regen terrain, clean entities, heal, regive items ──
    match.state = 'RESETTING';
    console.log(`[${ts()}] [${arena.toUpperCase()}] Resetting...`);

    try {
      // Reset command block timer again during reset phase
      try { await rcon.send(`scoreboard players set ${arena}_t timer 0`); } catch {}

      // Spleef snow regen (BEFORE teleport)
      if (arena === 'spleef') {
        await rcon.send('fill -66 7 -11 -44 7 11 snow_block');
        await rcon.send('fill -66 11 -11 -44 11 11 snow_block');
        await rcon.send('fill -66 15 -11 -44 15 11 snow_block');
        await sleep(500);
      }

      // Kill entities in arena
      const sel = AREA_SELECTORS[arena];
      try { await rcon.send(`kill @e[type=item,${sel}]`); } catch {}
      try { await rcon.send(`kill @e[type=arrow,${sel}]`); } catch {}
      try { await rcon.send(`kill @e[type=experience_orb,${sel}]`); } catch {}

      // TP to spawn
      for (const def of bots) {
        const bot = botInstances[def.name];
        if (bot) bot.chat(`/tp @s ${def.spawn.x} ${def.spawn.y} ${def.spawn.z}`);
      }
      await sleep(1000);

      // Heal
      for (const def of bots) {
        try { await rcon.send(`effect give ${def.name} minecraft:instant_health 1 5`); } catch {}
        try { await rcon.send(`effect give ${def.name} minecraft:saturation 5 5 true`); } catch {}
      }

      // Clear + regive items
      for (const def of bots) {
        const bot = botInstances[def.name];
        if (!bot) continue;
        bot.chat('/clear @s');
        await sleep(200);
        await giveItems(def.name, arena);
        await sleep(500);
        await equipForArena(bot, def.name, arena);
      }
    } catch (e) {
      console.log(`[${ts()}] [${arena.toUpperCase()}] Reset error: ${e.message}`);
    }

    console.log(`[${ts()}] [${arena.toUpperCase()}] Reset complete. Next match in 3s...`);
    await sleep(3000); // Cooldown before next match
  }
}

// Keep endMatch as a thin wrapper for death/fall/forcedMove handlers
function endMatch(arena, reason, winner = null) {
  signalMatchEnd(arena, reason, winner);
  return Promise.resolve();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toISOString().slice(11, 19); }
function log(name, msg) { logToFile(name, msg); }

// ─── Betting commands ─────────────────────────────────────────

async function handleBet(playerName, message) {
  // Initialize player if new
  if (playerCoins[playerName] === undefined) {
    playerCoins[playerName] = STARTING_COINS;
    try { await rcon.send(`scoreboard players set ${playerName} coins ${STARTING_COINS}`); } catch {}
    try { await rcon.send(`tell ${playerName} Welcome! You start with ${STARTING_COINS} coins.`); } catch {}
  }

  // Parse: !bet <botname> [amount]
  const parts = message.split(' ').filter(Boolean);
  if (parts.length < 2) {
    try { await rcon.send(`tell ${playerName} Usage: !bet <botname> [amount]. Default: ${DEFAULT_BET} coins`); } catch {}
    return;
  }

  const targetBot = parts[1];
  const amount = Math.max(1, parseInt(parts[2]) || DEFAULT_BET);

  // Validate bot name
  const botDef = BOT_DEFS.find(d => d.name.toLowerCase() === targetBot.toLowerCase());
  if (!botDef) {
    try { await rcon.send(`tell ${playerName} Unknown bot. Available: ${BOT_DEFS.map(d => d.name).join(', ')}`); } catch {}
    return;
  }

  // Check if betting is open for this arena
  if (!bettingOpen[botDef.arena]) {
    try { await rcon.send(`tell ${playerName} Betting closed for ${botDef.arena}. Wait for next countdown!`); } catch {}
    return;
  }

  // Check balance
  if (playerCoins[playerName] < amount) {
    try { await rcon.send(`tell ${playerName} Not enough coins! Balance: ${playerCoins[playerName]}`); } catch {}
    return;
  }

  // Cancel existing bet on same arena
  if (activeBets[botDef.arena][playerName]) {
    const old = activeBets[botDef.arena][playerName];
    playerCoins[playerName] += old.amount;
  }

  // Place bet
  playerCoins[playerName] -= amount;
  activeBets[botDef.arena][playerName] = { bot: botDef.name, amount };

  try {
    await rcon.send(`scoreboard players set ${playerName} coins ${playerCoins[playerName]}`);
    await rcon.send(`tell ${playerName} Bet: ${amount} coins on ${botDef.name}! Balance: ${playerCoins[playerName]}`);
  } catch {}
  console.log(`[${ts()}] [BET] ${playerName} bet ${amount} on ${botDef.name} (${botDef.arena})`);
}

async function handleGuiBet(playerName, arena, botName) {
  if (!bettingOpen[arena]) {
    try { await rcon.send(`title ${playerName} actionbar {"text":"Betting is closed!","color":"red"}`); } catch {}
    return;
  }

  // Initialize player if new
  if (playerCoins[playerName] === undefined) {
    playerCoins[playerName] = STARTING_COINS;
    try { await rcon.send(`scoreboard players set ${playerName} coins ${STARTING_COINS}`); } catch {}
  }

  // Check balance
  if (playerCoins[playerName] < DEFAULT_BET) {
    try { await rcon.send(`title ${playerName} actionbar {"text":"Not enough coins! Balance: ${playerCoins[playerName]}","color":"red"}`); } catch {}
    return;
  }

  // Cancel existing bet on same arena (refund)
  if (activeBets[arena][playerName]) {
    playerCoins[playerName] += activeBets[arena][playerName].amount;
  }

  // Place bet
  playerCoins[playerName] -= DEFAULT_BET;
  activeBets[arena][playerName] = { bot: botName, amount: DEFAULT_BET };

  try {
    await rcon.send(`scoreboard players set ${playerName} coins ${playerCoins[playerName]}`);
    await rcon.send(`title ${playerName} actionbar {"text":"Bet placed! ${DEFAULT_BET} coins on ${botName}","color":"green"}`);
  } catch {}
  console.log(`[${ts()}] [BET-GUI] ${playerName} bet ${DEFAULT_BET} on ${botName} (${arena})`);
}

async function showBalance(playerName) {
  if (playerCoins[playerName] === undefined) {
    playerCoins[playerName] = STARTING_COINS;
    try { await rcon.send(`scoreboard players set ${playerName} coins ${STARTING_COINS}`); } catch {}
  }
  try { await rcon.send(`tell ${playerName} Balance: ${playerCoins[playerName]} coins`); } catch {}
}

async function processBetPayouts(arena, winner) {
  const bets = activeBets[arena];
  const betEntries = Object.entries(bets);
  if (betEntries.length === 0) return;

  for (const [player, bet] of betEntries) {
    if (winner && bet.bot === winner) {
      const payout = bet.amount * 2;
      playerCoins[player] = (playerCoins[player] || 0) + payout;
      try {
        await rcon.send(`scoreboard players set ${player} coins ${playerCoins[player]}`);
        await rcon.send(`tell ${player} You WON! +${payout} coins (bet on ${bet.bot}). Balance: ${playerCoins[player]}`);
      } catch {}
    } else {
      try { await rcon.send(`tell ${player} You lost ${bet.amount} coins (bet on ${bet.bot}). Balance: ${playerCoins[player] || 0}`); } catch {}
    }
  }

  // Announce total payouts
  const totalPool = betEntries.reduce((s, [, b]) => s + b.amount, 0);
  const winners = betEntries.filter(([, b]) => winner && b.bot === winner);
  try {
    await rcon.send(`say [BETS] ${arena.toUpperCase()}: Pool ${totalPool} coins, ${winners.length}/${betEntries.length} won`);
  } catch {}

  activeBets[arena] = {};
}

// ─── FFA opponent targeting — find nearest alive enemy ──────

function getNearestOpponent(myName, arena) {
  const myBot = botInstances[myName];
  if (!myBot?.entity) return null;

  const alive = aliveBots[arena];
  let bestTarget = null;
  let bestDist = Infinity;

  for (const oppName of alive) {
    if (oppName === myName) continue;
    const oppBot = botInstances[oppName];
    if (!oppBot?.entity) continue;

    const oppPos = oppBot.entity.position;

    // Find the matching entity in MY entity list by position proximity
    let localEntity = null;
    let localBestDist = Infinity;
    for (const entity of Object.values(myBot.entities)) {
      if (entity === myBot.entity) continue;
      if (!entity.position) continue;
      const d = entity.position.distanceTo(oppPos);
      if (d < localBestDist) {
        localBestDist = d;
        localEntity = entity;
      }
    }

    // Use local entity if within 3 blocks match, else fallback to opponent entity ref
    const targetEntity = (localEntity && localBestDist < 3) ? localEntity : oppBot.entity;
    const dist = myBot.entity.position.distanceTo(targetEntity.position);

    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = targetEntity;
    }
  }

  return bestTarget;
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
      `give ${name} minecraft:arrow 128`,
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

// ─── Combat AI (strategy-driven) ─────────────────────────────

async function pvpTick(bot, name, target) {
  const strat = botStrategies[name];
  const range = strat?.combat?.attack_range ?? 3.5;
  const sprintDist = strat?.combat?.chase_sprint_distance ?? 5;
  const strafeChance = strat?.combat?.strafe_chance ?? 0.5;
  const strafeDur = strat?.combat?.strafe_duration_ms ?? 200;
  const critChance = strat?.combat?.sprint_jump_crit_chance ?? 0.3;
  const critDur = strat?.combat?.crit_duration_ms ?? 300;
  const healThresh = strat?.combat?.heal_threshold ?? 10;
  const shieldAfter = strat?.combat?.shield_after_attack ?? false;
  const fleeHP = strat?.combat?.flee_hp_threshold ?? 6;
  const fleeDur = strat?.combat?.flee_duration_ms ?? 800;
  const fleeChance = strat?.combat?.flee_chance ?? 0.3;

  const dist = bot.entity.position.distanceTo(target.position);

  // Flee when low HP and no golden apples
  if (bot.health < fleeHP && fleeHP > 0) {
    const apple = bot.inventory.items().find(i => i.name === 'golden_apple');
    if (!apple) {
      // Sprint away from opponent
      try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}
      bot.setControlState('forward', false);
      bot.setControlState('back', true);
      bot.setControlState('sprint', true);
      const dir = Math.random() > 0.5 ? 'left' : 'right';
      bot.setControlState(dir, true);
      setTimeout(() => {
        bot.setControlState('back', false);
        bot.setControlState('sprint', false);
        bot.setControlState(dir, false);
      }, fleeDur);
      return;
    }
  }

  // Eat golden apple when low HP (with lock to prevent spam)
  if (bot.health < healThresh && !isEating[name]) {
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

  // Random dodge — break off and strafe away briefly
  if (dist <= range && Math.random() < fleeChance && fleeChance > 0) {
    bot.setControlState('forward', false);
    const dir = Math.random() > 0.5 ? 'left' : 'right';
    bot.setControlState(dir, true);
    bot.setControlState('back', true);
    setTimeout(() => {
      bot.setControlState(dir, false);
      bot.setControlState('back', false);
    }, fleeDur / 2);
    return;
  }

  if (dist > range) {
    try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}
    bot.setControlState('forward', true);
    bot.setControlState('sprint', dist > sprintDist);
  } else {
    bot.setControlState('forward', false);
    bot.setControlState('sprint', false);
    try {
      await bot.lookAt(target.position.offset(0, 1.6, 0));
      bot.attack(target);
      botStats[name].attacks++;

      // Shield after attack
      if (shieldAfter) {
        bot.activateItem(); // raise shield (off-hand)
        setTimeout(() => bot.deactivateItem(), 300);
      }

      // Strafe
      if (Math.random() < strafeChance) {
        const dir = Math.random() > 0.5 ? 'left' : 'right';
        bot.setControlState(dir, true);
        setTimeout(() => bot.setControlState(dir, false), strafeDur);
      }

      // Sprint-jump crit
      if (Math.random() < critChance) {
        bot.setControlState('sprint', true);
        bot.setControlState('jump', true);
        setTimeout(() => { bot.setControlState('sprint', false); bot.setControlState('jump', false); }, critDur);
      }
    } catch (e) { log(name, `Attack err: ${e.message}`); }
  }
}

async function sumoTick(bot, name, target) {
  const strat = botStrategies[name];
  const retreatThresh = strat?.combat?.center_retreat_threshold ?? 3;
  const range = strat?.combat?.attack_range ?? 3.5;
  const comboDelay = strat?.combat?.knockback_combo_delay_ms ?? 200;
  const retreatSprint = strat?.combat?.retreat_sprint_ms ?? 400;

  const dist = bot.entity.position.distanceTo(target.position);
  const pos = bot.entity.position;

  // Fall detection — eliminated in FFA
  if (pos.y < SUMO_FALL_Y) {
    log(name, `FELL OFF PLATFORM! (y=${pos.y.toFixed(1)})`);
    eliminateBot('sumo', name);
    return;
  }

  try { await bot.lookAt(target.position.offset(0, 1.6, 0)); } catch {}

  // Edge detection — retreat to center if near edge
  const distToCenter = Math.sqrt((pos.x - SUMO_CENTER.x) ** 2 + (pos.z - SUMO_CENTER.z) ** 2);
  if (distToCenter > SUMO_PLATFORM_RADIUS - retreatThresh && dist > 2) {
    try {
      await bot.lookAt({ x: SUMO_CENTER.x, y: SUMO_CENTER.y + 1.6, z: SUMO_CENTER.z });
    } catch {}
    bot.setControlState('forward', true);
    bot.setControlState('sprint', true);
    setTimeout(() => { bot.setControlState('forward', false); bot.setControlState('sprint', false); }, retreatSprint);
    return;
  }

  // Sprint toward and attack
  bot.setControlState('sprint', true);
  bot.setControlState('forward', true);

  if (dist <= range) {
    try {
      bot.attack(target);
      botStats[name].attacks++;
    } catch {}
    setTimeout(() => { bot.setControlState('sprint', false); bot.setControlState('forward', false); }, comboDelay);
  }
}

async function spleefTick(bot, name, target) {
  const strat = botStrategies[name];
  const chaseDist = strat?.combat?.chase_distance ?? 4;
  const sprintThresh = strat?.combat?.sprint_threshold ?? 7;
  const digRX = strat?.combat?.dig_radius_x ?? 2;
  const digRZ = strat?.combat?.dig_radius_z ?? 2;
  const digDepth = strat?.combat?.dig_depth ?? 3;
  const fleeNoSnow = strat?.combat?.flee_when_no_snow ?? true;
  const safeRadius = strat?.combat?.safe_snow_search_radius ?? 5;

  // Fall detection — eliminated in FFA
  const pos = bot.entity.position;
  if (pos.y < 6) {
    log(name, `FELL THROUGH SNOW! (y=${pos.y.toFixed(1)})`);
    eliminateBot('spleef', name);
    return;
  }

  // Ensure shovel equipped
  const shovel = bot.inventory.items().find(i => i.name === 'iron_shovel');
  if (shovel && bot.heldItem?.name !== 'iron_shovel') {
    try { await bot.equip(shovel, 'hand'); } catch {}
  }

  // Flee to safety if no snow underfoot
  if (fleeNoSnow) {
    const blockBelow = bot.blockAt(pos.offset(0, -1, 0));
    const blockBelow2 = bot.blockAt(pos.offset(0, -2, 0));
    const onSnow = (blockBelow && blockBelow.name === 'snow_block') || (blockBelow2 && blockBelow2.name === 'snow_block');

    if (!onSnow) {
      // Search for nearest safe snow block to flee to
      let safeDist = Infinity;
      let safePos = null;
      for (let dx = -safeRadius; dx <= safeRadius; dx++) {
        for (let dz = -safeRadius; dz <= safeRadius; dz++) {
          for (let dy = -2; dy <= 0; dy++) {
            try {
              const block = bot.blockAt(pos.offset(dx, dy, dz));
              if (block && block.name === 'snow_block') {
                const d = Math.abs(dx) + Math.abs(dz);
                if (d < safeDist) {
                  safeDist = d;
                  safePos = block.position;
                }
              }
            } catch {}
          }
        }
      }
      if (safePos) {
        try { await bot.lookAt(safePos.offset(0, 1, 0)); } catch {}
        bot.setControlState('forward', true);
        bot.setControlState('sprint', true);
        return;
      }
    }
  }

  const dist = bot.entity.position.distanceTo(target.position);
  try { await bot.lookAt(target.position); } catch {}

  if (dist > chaseDist) {
    bot.setControlState('forward', true);
    bot.setControlState('sprint', dist > sprintThresh);
    return;
  }

  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);

  // Dig snow under/near opponent — search wider area
  const tp = target.position;
  for (let dy = 0; dy >= -digDepth; dy--) {
    for (let dx = -digRX; dx <= digRX; dx++) {
      for (let dz = -digRZ; dz <= digRZ; dz++) {
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
  const strat = botStrategies[name];
  const strafeChance = strat?.combat?.strafe_chance ?? 0.4;
  const strafeDur = strat?.combat?.strafe_duration_ms ?? 400;
  const fwdChance = strat?.combat?.forward_chance ?? 0.15;
  const bwdChance = strat?.combat?.backward_chance ?? 0.15;
  const moveDur = strat?.combat?.move_duration_ms ?? 300;
  const chargeBase = strat?.combat?.charge_base_ms ?? 300;
  const chargePerDist = strat?.combat?.charge_per_distance_ms ?? 20;
  const maxCharge = strat?.combat?.max_charge_ms ?? 1000;
  const gravBase = strat?.combat?.gravity_base ?? 1.6;
  const gravPerDist = strat?.combat?.gravity_per_distance ?? 0.04;
  const cooldown = strat?.combat?.cooldown_ms ?? 1500;

  // Equip bow
  const bow = bot.inventory.items().find(i => i.name === 'bow');
  if (bow && bot.heldItem?.name !== 'bow') {
    try { await bot.equip(bow, 'hand'); } catch {}
  }

  const dist = bot.entity.position.distanceTo(target.position);
  const now = Date.now();

  // Gravity compensation
  const yOffset = gravBase + (dist * gravPerDist);
  try { await bot.lookAt(target.position.offset(0, yOffset, 0)); } catch {}

  if (!lastBowShot[name]) lastBowShot[name] = 0;

  // Check arrow count — skip shooting if low
  const arrowCount = bot.inventory.items().filter(i => i.name === 'arrow').reduce((s, i) => s + i.count, 0);

  // Shoot with cooldown (only if arrows available)
  if (arrowCount >= 1 && now - lastBowShot[name] > cooldown) {
    bot.activateItem();
    const chargeTime = Math.min(maxCharge, chargeBase + dist * chargePerDist);
    setTimeout(async () => {
      try { await bot.lookAt(target.position.offset(0, yOffset, 0)); } catch {}
      bot.deactivateItem();
      lastBowShot[name] = Date.now();
      botStats[name].arrows_shot++;
    }, chargeTime);
  }

  // MOVING TARGET — constant strafing between shots
  if (Math.random() < strafeChance) {
    const dir = Math.random() > 0.5 ? 'left' : 'right';
    bot.setControlState(dir, true);
    setTimeout(() => bot.setControlState(dir, false), strafeDur);
  }
  if (Math.random() < fwdChance) {
    bot.setControlState('forward', true);
    setTimeout(() => bot.setControlState('forward', false), moveDur);
  }
  if (Math.random() < bwdChance) {
    bot.setControlState('back', true);
    setTimeout(() => bot.setControlState('back', false), moveDur);
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
  const { name, arena, spawn } = def;

  // Load strategy file
  const strat = loadStrategy(name);
  botStrategies[name] = strat;
  if (strat) {
    log(name, `Loaded strategy v${strat.version} for ${arena} arena`);
  } else {
    log(name, `No strategy file found, using defaults for ${arena} arena`);
  }

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
    arena, attacks: 0, kills: 0, blocks_dug: 0, arrows_shot: 0,
    deaths: 0, tickCount: 0, staleTicks: 0, active: false,
  };

  let combatInterval = null;
  let healthCheckInterval = null;
  let heatmapInterval = null;

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

    botStats[name].active = false; // Inactive until match lifecycle starts
    botInstances[name] = bot;

    // Chat listener — !bet (legacy) and !coins
    bot.on('chat', (username, msg) => {
      if (BOT_DEFS.some(d => d.name === username)) return;
      const key = `${username}:${msg}:${Math.floor(Date.now() / 1000)}`;
      if (chatDedup.has(key)) return;
      chatDedup.add(key);
      setTimeout(() => chatDedup.delete(key), 2000);
      if (msg.startsWith('!bet')) handleBet(username, msg);
      else if (msg === '!coins' || msg === '!balance') showBalance(username);
    });

    // GUI betting — whisper handler for clickable tellraw
    bot.on('whisper', (username, msg) => {
      if (BOT_DEFS.some(d => d.name === username)) return;
      if (!msg.startsWith('BET:')) return;
      const parts = msg.split(':');
      if (parts.length < 3) return;
      const betArena = parts[1];
      const choice = parseInt(parts[2]);
      if (!betArena || isNaN(choice) || choice < 1 || choice > BOTS_PER_ARENA) return;
      const arenaBots = BOT_DEFS.filter(d => d.arena === betArena);
      if (!arenaBots.length || choice > arenaBots.length) return;
      handleGuiBet(username, betArena, arenaBots[choice - 1].name);
    });

    // Start combat loop (250ms) — only ticks during ACTIVE match state
    const combatFn = combatFns[arena];
    combatInterval = setInterval(async () => {
      if (arenaMatches[arena]?.state !== 'ACTIVE') return;
      if (!botStats[name].active) return;
      if (!aliveBots[arena].has(name)) return;
      if (!bot.entity?.position || !isInArena(bot.entity.position, arena)) return;
      const target = getNearestOpponent(name, arena);
      if (!target) return;
      botStats[name].tickCount++;
      try { await combatFn(bot, name, target); } catch (e) {
        log(name, `Combat error: ${e.message}`);
      }
    }, 250);

    // Health check every 10s — logged to per-bot file
    healthCheckInterval = setInterval(() => {
      if (!bot.entity) return;
      const stats = botStats[name];
      const pos = bot.entity.position;
      const target = getNearestOpponent(name, arena);
      const dist = target ? bot.entity.position.distanceTo(target.position).toFixed(1) : 'N/A';
      const alive = aliveBots[arena].size;

      logToFile(name, `[HEALTH-CHECK] HP:${bot.health?.toFixed(1) || '?'}/20 | ` +
        `Pos:(${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}) | ` +
        `Nearest dist:${dist} | Arena:${arena} (${alive} alive) | ` +
        `ATK:${stats.attacks} DIG:${stats.blocks_dug} ARW:${stats.arrows_shot} | ` +
        `Deaths:${stats.deaths} | Tick:${stats.tickCount}`);

      // Stale detection
      if (!target && stats.active) {
        stats.staleTicks++;
        logToFile(name, `[STALE-WARNING] Cannot find opponent for ${stats.staleTicks * 10}s`);
        if (stats.staleTicks >= 3) {
          logToFile(name, `[STALE-RECOVERY] Re-teleporting to spawn...`);
          bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
          stats.staleTicks = 0;
        }
      } else {
        stats.staleTicks = 0;
      }

    }, 10000);

    // Heatmap logging every 1s
    heatmapInterval = setInterval(() => {
      if (!bot.entity) return;
      const p = bot.entity.position;
      const entry = JSON.stringify({
        t: Date.now(), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
        hp: bot.health, food: bot.food, yaw: +bot.entity.yaw.toFixed(2),
        active: botStats[name].active
      });
      fs.appendFileSync(path.join(LOG_DIR, name + '-heatmap.jsonl'), entry + '\n');
    }, 1000);
  });

  // Death handler — FFA elimination
  bot.on('death', () => {
    botStats[name].deaths++;
    log(name, `[DEATH] Eliminated! (death #${botStats[name].deaths})`);
    eliminateBot(arena, name);
  });

  // Forced move (timer TP'd to hub) — end match as timeout
  bot.on('forcedMove', () => {
    const match = arenaMatches[arena];
    if (match && (match.state === 'ENDING' || match.state === 'RESETTING')) return;
    const pos = bot.entity?.position;
    if (pos && Math.abs(pos.x - HUB_POS.x) < 5 && Math.abs(pos.z - HUB_POS.z) < 5) {
      log(name, 'ForcedMove to hub (command block timer expired)');
      endMatch(arena, 'Timer expired', null).catch(() => {});
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
    if (heatmapInterval) { clearInterval(heatmapInterval); heatmapInterval = null; }
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
  console.log('  MINEFORGE ARENA — 20 AI BOTS (5 per arena, FFA)');
  console.log('  PvP | Sumo | Spleef | Archery');
  console.log('='.repeat(70) + '\n');

  rcon = await Rcon.connect(RCON_CFG);
  console.log('RCON connected\n');

  // Set up coins scoreboard for betting
  try { await rcon.send('scoreboard objectives add coins dummy {"text":"Coins","color":"gold"}'); } catch {}
  try { await rcon.send('scoreboard objectives setdisplay list coins'); } catch {}
  console.log('Betting system ready (coins scoreboard)\n');

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

  // OP all bots + tag for gallery selector exclusion
  for (const def of BOT_DEFS) {
    try { await rcon.send(`op ${def.name}`); } catch {}
    try { await rcon.send(`tag ${def.name} add bot`); } catch {}
  }
  console.log('All 20 bots OP\'d + tagged\n');

  // Spawn bots in 5 waves (1 per arena per wave, 4s gap)
  for (let wave = 0; wave < BOTS_PER_ARENA; wave++) {
    console.log(`Spawning wave ${wave + 1}/${BOTS_PER_ARENA} (4 bots)...\n`);
    const waveBots = BOT_DEFS.filter((_, i) => i % BOTS_PER_ARENA === wave);
    for (const def of waveBots) {
      createArenaBot(def);
    }
    if (wave < BOTS_PER_ARENA - 1) await sleep(4000);
  }

  console.log('\nAll 20 bots launched! Monitoring...\n');

  // Entity cleanup every 2 minutes (arrows, dropped items)
  setInterval(entityCleanup, 120000);

  // ─── Launch 4 independent game loops (one per arena) ───
  for (const arena of ['pvp', 'sumo', 'spleef', 'archery']) {
    arenaGameLoop(arena).catch(e => {
      console.error(`[${ts()}] [${arena.toUpperCase()}] Game loop crashed: ${e.message}`);
    });
    console.log(`[${ts()}] Game loop started: ${arena}`);
  }

  // Scoreboard sidebar updater — per-arena leaders every 5s
  const arenaColors = { pvp: 'yellow', sumo: 'green', spleef: 'aqua', archery: 'red' };
  const arenaSidebarTeams = { pvp: 'sb05', sumo: 'sb07', spleef: 'sb09', archery: 'sb11' };
  const arenaStatTeams = { pvp: 'sb06', sumo: 'sb08', spleef: 'sb10', archery: 'sb12' };

  setInterval(async () => {
    if (!rcon) return;
    try {
      let activeFights = 0;
      for (const stats of Object.values(botStats)) {
        if (stats.active) activeFights++;
      }

      // Line 3: active fighters + total matches
      const totalMatches = Object.values(arenaMatches).reduce((sum, m) => sum + m.matchNum, 0);
      await rcon.send(`team modify sb03 prefix [{"text":"Fighters: ","color":"gray"},{"text":"${activeFights}/20","color":"aqua"},{"text":" Matches: ","color":"gray"},{"text":"${totalMatches}","color":"light_purple"}]`);

      // Line 4: per-arena match state
      const arenaStates = ['pvp', 'sumo', 'spleef', 'archery'].map(a => {
        const m = arenaMatches[a];
        const st = m.state === 'ACTIVE' ? 'green' : m.state === 'BETTING' ? 'gold' : m.state === 'COUNTDOWN' ? 'yellow' : 'gray';
        return `{"text":"${a[0].toUpperCase()}${m.matchNum}","color":"${st}"}`;
      }).join(',{"text":" ","color":"gray"},');
      await rcon.send(`team modify sb04 prefix [${arenaStates}]`);

      // Lines 5-12: per-arena leader + alive count (2 lines per arena)
      for (const [arenaKey, team] of Object.entries(arenaSidebarTeams)) {
        const arenaBotStats = BOT_DEFS.filter(d => d.arena === arenaKey)
          .map(d => ({ name: d.name, ...(botStats[d.name] || {}) }))
          .sort((a, b) => (b.kills || 0) - (a.kills || 0));
        const leader = arenaBotStats[0];
        const color = arenaColors[arenaKey];
        if (leader) {
          await rcon.send(`team modify ${team} prefix [{"text":"${arenaKey.toUpperCase()}: ","color":"${color}","bold":true},{"text":"${leader.name} ","color":"white"},{"text":"${leader.kills || 0}K","color":"green"}]`);
        }
      }
      for (const [arenaKey, team] of Object.entries(arenaStatTeams)) {
        const alive = aliveBots[arenaKey].size;
        const state = arenaMatches[arenaKey].state;
        const stateText = state === 'ACTIVE' ? `${alive} alive` : state.toLowerCase();
        await rcon.send(`team modify ${team} prefix [{"text":"  ${stateText}","color":"gray","italic":true}]`);
      }

      // Line 14: active bets + pool
      const allBets = Object.values(activeBets).flatMap(b => Object.entries(b));
      const totalPool = allBets.reduce((s, [, b]) => s + b.amount, 0);
      const betCount = allBets.length;
      await rcon.send(`team modify sb14 prefix [{"text":"Bets: ","color":"gray"},{"text":"${betCount}","color":"aqua"},{"text":" Pool: ","color":"gray"},{"text":"${totalPool}","color":"gold"}]`);

      // Line 15: coin leaderboard (#1 player)
      const coinEntries = Object.entries(playerCoins).sort((a, b) => b[1] - a[1]);
      if (coinEntries.length > 0) {
        const [topName, topCoins] = coinEntries[0];
        await rcon.send(`team modify sb15 prefix [{"text":"#1 ","color":"gold"},{"text":"${topName}","color":"white"},{"text":": ${topCoins}","color":"yellow"}]`);
      }

      // Also update kills scoreboard objective per bot
      for (const [bName, stats] of Object.entries(botStats)) {
        await rcon.send(`scoreboard players set ${bName} kills ${stats.attacks}`);
      }
    } catch {}
  }, 5000);

  // Global status report every 30s
  setInterval(() => {
    console.log('\n' + '='.repeat(90));
    console.log(`[${ts()}] GLOBAL STATUS`);
    console.log('-'.repeat(90));
    for (const [arena, match] of Object.entries(arenaMatches)) {
      const elapsed = match.state === 'ACTIVE' ? Math.floor((Date.now() - match.startTime) / 1000) : 0;
      const alive = aliveBots[arena].size;
      console.log(`  ${arena.padEnd(8)} | State: ${match.state.padEnd(10)} | Match #${match.matchNum} | ` +
        `Winner: ${(match.winner || '-').padEnd(8)} | Alive: ${alive}/5 | Elapsed: ${elapsed}s`);
    }
    console.log('-'.repeat(90));
    for (const [name, stats] of Object.entries(botStats)) {
      const status = stats.active ? 'FIGHTING' : 'IDLE';
      console.log(`  ${name.padEnd(10)} | ${stats.arena.padEnd(8)} | ATK:${String(stats.attacks).padStart(4)} | ` +
        `DIG:${String(stats.blocks_dug).padStart(4)} | ARW:${String(stats.arrows_shot).padStart(4)} | ` +
        `K:${stats.kills} D:${stats.deaths} | TICKS:${stats.tickCount} | ${status}`);
    }
    console.log('='.repeat(90) + '\n');
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
