// MineForge Arena — 20 AI Bots (5 per arena, 1v1 on-demand spawning)
// Only 2 bots connect per arena at a time (the active fighters)
// After each match, fighters disconnect and the next pair spawns in

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

// ─── Bot definitions (5 per arena, 1v1) ──────────────────────

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

// ─── 1v1 match tracking ────────────────────────────────────
const aliveBots = { pvp: new Set(), sumo: new Set(), spleef: new Set(), archery: new Set() };
const currentFighters = { pvp: [], sumo: [], spleef: [], archery: [] }; // [name1, name2] for active 1v1

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

// ─── 1v1 elimination handler ────────────────────────────────
function eliminateBot(arena, deadName) {
  aliveBots[arena].delete(deadName);
  if (botStats[deadName]) botStats[deadName].active = false;

  const fighters = currentFighters[arena];
  if (!fighters.includes(deadName)) return;

  const winner = fighters.find(n => n !== deadName) || null;
  console.log(`[${ts()}] [${arena.toUpperCase()}] ${deadName} eliminated! Winner: ${winner}`);
  signalMatchEnd(arena, `${deadName} eliminated`, winner);
}

// ─── The Game Loop (one per arena, runs forever) ──────
// 1v1 round-robin: pick 2 from 5, fight, rotate through all pairs
async function arenaGameLoop(arena) {
  const match = arenaMatches[arena];
  const allBots = BOT_DEFS.filter(d => d.arena === arena);

  // Generate all 1v1 pairs (10 matchups per arena)
  function generatePairs() {
    const pairs = [];
    for (let i = 0; i < allBots.length; i++) {
      for (let j = i + 1; j < allBots.length; j++) {
        pairs.push([allBots[i], allBots[j]]);
      }
    }
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    return pairs;
  }

  let matchQueue = generatePairs();

  while (true) {
    if (matchQueue.length === 0) matchQueue = generatePairs();
    const [fighter1, fighter2] = matchQueue.shift();

    // ── WAITING: spawn both fighters on-demand ──
    match.state = 'WAITING';
    match.winner = null;
    console.log(`[${ts()}] [${arena.toUpperCase()}] Spawning ${fighter1.name} & ${fighter2.name}...`);

    try {
      await Promise.all([spawnFighter(fighter1), spawnFighter(fighter2)]);
    } catch (e) {
      console.log(`[${ts()}] [${arena.toUpperCase()}] Failed to spawn fighters: ${e.message}. Retrying in 5s...`);
      await sleep(5000);
      continue; // retry this match pair
    }

    currentFighters[arena] = [fighter1.name, fighter2.name];

    // ── COUNTDOWN: 3-2-1-FIGHT ──
    match.state = 'COUNTDOWN';
    match.matchNum++;
    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — ${fighter1.name} vs ${fighter2.name}`);

    try { await rcon.send(`scoreboard players set ${arena}_t timer 0`); } catch {}
    try { await rcon.send(`tag @a[tag=bettor_${arena}] remove bettor_${arena}`); } catch {}

    // Initialize alive set with only the 2 fighters
    aliveBots[arena] = new Set([fighter1.name, fighter2.name]);

    // Freeze fighters at spawn, send non-fighters to hub
    const fighters = [fighter1, fighter2];
    for (const def of fighters) {
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
      for (const def of fighters) {
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
      await rcon.send(`title ${galSel} subtitle {"text":"${fighter1.name} vs ${fighter2.name}","color":"white"}`);

      const tellrawParts = [
        {"text":"\n"},
        {"text":"═══ PLACE YOUR BET ═══","color":"gold","bold":true},
        {"text":"\n\n"},
        {"text":`[${fighter1.name}]`,"color":"green","bold":true,
         "clickEvent":{"action":"run_command","value":`/msg ${fighter1.name} BET:${arena}:1`},
         "hoverEvent":{"action":"show_text","value":`Bet ${DEFAULT_BET} coins on ${fighter1.name}`}},
        {"text":" vs ","color":"gray"},
        {"text":`[${fighter2.name}]`,"color":"red","bold":true,
         "clickEvent":{"action":"run_command","value":`/msg ${fighter1.name} BET:${arena}:2`},
         "hoverEvent":{"action":"show_text","value":`Bet ${DEFAULT_BET} coins on ${fighter2.name}`}},
        {"text":"\n"},
        {"text":`${DEFAULT_BET} coins per bet · Click to place`,"color":"gray","italic":true},
        {"text":"\n"},
      ];
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

    for (const playerName of Object.keys(activeBets[arena])) {
      try { await rcon.send(`tag ${playerName} add bettor_${arena}`); } catch {}
    }

    // ── FIGHT! ──
    for (const def of fighters) {
      try {
        await rcon.send(`title ${def.name} title {"text":"FIGHT!","color":"green","bold":true}`);
        await rcon.send(`title ${def.name} subtitle {"text":"${fighter1.name} vs ${fighter2.name}","color":"gray"}`);
      } catch {}
    }
    try { await rcon.send(`title ${galSel} title {"text":"FIGHT!","color":"green","bold":true}`); } catch {}

    // ── ACTIVE: enable combat for the 2 fighters only ──
    match.state = 'ACTIVE';
    match.startTime = Date.now();
    for (const def of fighters) {
      if (botStats[def.name]) botStats[def.name].active = true;
    }
    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — FIGHT! (${fighter1.name} vs ${fighter2.name})`);

    // Bettor lock — TP escapees back to gallery every 3s
    const bettorLockInterval = setInterval(async () => {
      try {
        await rcon.send(`execute as @a[tag=bettor_${arena}] unless entity @s[${GALLERY_SELECTORS[arena]}] run tp @s ${GALLERY_TP[arena]}`);
      } catch {}
    }, 3000);

    // Race: match-end signal vs timeout
    let cleanupTimers = null;
    const result = await new Promise(resolve => {
      const timeout = setTimeout(() => {
        const hp1 = botInstances[fighter1.name]?.health || 0;
        const hp2 = botInstances[fighter2.name]?.health || 0;
        let winner, reason;
        if (hp1 > hp2) { winner = fighter1.name; reason = `Timeout (${fighter1.name} had more HP)`; }
        else if (hp2 > hp1) { winner = fighter2.name; reason = `Timeout (${fighter2.name} had more HP)`; }
        else { winner = null; reason = 'Timeout (Draw)'; }
        signalMatchEnd(arena, reason, winner);
      }, MATCH_DURATION);

      const announce = (ms, text, color) => setTimeout(() => {
        if (match.state !== 'ACTIVE') return;
        for (const def of fighters) {
          try { rcon.send(`title ${def.name} actionbar {"text":"${text}","color":"${color}"}`); } catch {}
        }
      }, MATCH_DURATION - ms);

      const t60 = announce(60000, '1:00 remaining', 'yellow');
      const t30 = announce(30000, '0:30 remaining', 'gold');
      const t10 = announce(10000, '10 seconds!', 'red');

      const dcCheck = setInterval(() => {
        const f1 = botInstances[fighter1.name] && aliveBots[arena].has(fighter1.name);
        const f2 = botInstances[fighter2.name] && aliveBots[arena].has(fighter2.name);
        if (!f1 && !f2) signalMatchEnd(arena, 'Both disconnected', null);
        else if (!f1) signalMatchEnd(arena, `${fighter1.name} disconnected`, fighter2.name);
        else if (!f2) signalMatchEnd(arena, `${fighter2.name} disconnected`, fighter1.name);
      }, 3000);

      cleanupTimers = () => { clearTimeout(timeout); clearTimeout(t60); clearTimeout(t30); clearTimeout(t10); clearInterval(dcCheck); };
      matchEndResolvers[arena] = { resolve };
    });

    if (cleanupTimers) cleanupTimers();
    clearInterval(bettorLockInterval);

    // ── ENDING: stop combat, announce winner ──
    match.state = 'ENDING';
    match.winner = result.winner;
    currentFighters[arena] = [];

    for (const def of fighters) {
      if (botStats[def.name]) botStats[def.name].active = false;
      const bot = botInstances[def.name];
      if (bot) try { bot.clearControlStates(); } catch {}
    }

    console.log(`[${ts()}] [${arena.toUpperCase()}] Match #${match.matchNum} — ${result.reason} | Winner: ${result.winner || 'DRAW'}`);

    const titleText = result.winner ? `${result.winner} WINS!` : 'DRAW';
    const titleColor = result.winner ? 'green' : 'yellow';
    for (const def of fighters) {
      try {
        await rcon.send(`title ${def.name} title {"text":"${titleText}","color":"${titleColor}","bold":true}`);
        await rcon.send(`title ${def.name} subtitle {"text":"${result.reason}","color":"gray"}`);
      } catch {}
    }
    try { await rcon.send(`title ${galSel} title {"text":"${titleText}","color":"${titleColor}","bold":true}`); } catch {}

    if (result.winner) {
      try { await rcon.send(`scoreboard players add ${result.winner} wins 1`); } catch {}
      if (botStats[result.winner]) botStats[result.winner].kills++;
    }

    await processBetPayouts(arena, result.winner);

    await sleep(3000);
    try { await rcon.send(`title @a[tag=bettor_${arena}] title {"text":"Returning to Hub","color":"aqua"}`); } catch {}
    await sleep(2000);
    try {
      await rcon.send(`tp @a[tag=bettor_${arena}] ${HUB_POS.x} ${HUB_POS.y} ${HUB_POS.z}`);
      await rcon.send(`tag @a[tag=bettor_${arena}] remove bettor_${arena}`);
    } catch {}

    // ── RESETTING: despawn fighters, clean arena ──
    match.state = 'RESETTING';
    console.log(`[${ts()}] [${arena.toUpperCase()}] Resetting...`);

    // Despawn the 2 fighters (disconnect from server)
    despawnFighter(fighter1.name);
    despawnFighter(fighter2.name);

    try {
      try { await rcon.send(`scoreboard players set ${arena}_t timer 0`); } catch {}

      if (arena === 'spleef') {
        await rcon.send('fill -66 7 -11 -44 7 11 snow_block');
        await rcon.send('fill -66 11 -11 -44 11 11 snow_block');
        await rcon.send('fill -66 15 -11 -44 15 11 snow_block');
        await sleep(500);
      }

      const sel = AREA_SELECTORS[arena];
      try { await rcon.send(`kill @e[type=item,${sel}]`); } catch {}
      try { await rcon.send(`kill @e[type=arrow,${sel}]`); } catch {}
      try { await rcon.send(`kill @e[type=experience_orb,${sel}]`); } catch {}
    } catch (e) {
      console.log(`[${ts()}] [${arena.toUpperCase()}] Reset error: ${e.message}`);
    }

    console.log(`[${ts()}] [${arena.toUpperCase()}] Reset complete. Next match in 3s...`);
    await sleep(3000);
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

// ─── 1v1 opponent targeting — find nearest alive enemy ──────

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
  const comboDelay = strat?.combat?.knockback_combo_delay_ms ?? 400;   // 8 ticks forward after hit
  const retreatSprint = strat?.combat?.retreat_sprint_ms ?? 500;

  const dist = bot.entity.position.distanceTo(target.position);
  const pos = bot.entity.position;

  // Fall detection — eliminated in 1v1
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

  // Fall detection — eliminated in 1v1
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

// ─── Create one arena bot (on-demand, returns Promise) ──────

function spawnFighter(def) {
  return new Promise((resolve, reject) => {
    const { name, arena, spawn } = def;

    // Load strategy file (cached after first load)
    if (!botStrategies[name]) {
      const strat = loadStrategy(name);
      botStrategies[name] = strat;
      if (strat) log(name, `Loaded strategy v${strat.version} for ${arena} arena`);
      else log(name, `No strategy file found, using defaults for ${arena} arena`);
    }

    // Initialize persistent stats (survives across matches)
    if (!botStats[name]) {
      botStats[name] = {
        arena, attacks: 0, kills: 0, blocks_dug: 0, arrows_shot: 0,
        deaths: 0, tickCount: 0, staleTicks: 0, active: false,
      };
    }

    log(name, `Spawning for ${arena} match...`);

    const bot = mineflayer.createBot({
      host: 'localhost',
      port: 25565,
      username: name,
      auth: 'offline',
      version: '1.16.2',
    });

    bot.loadPlugin(pathfinder);

    // Track whether this bot was intentionally quit (vs kicked/crashed)
    bot._intentionalQuit = false;

    let combatInterval = null;
    let healthCheckInterval = null;
    let heatmapInterval = null;

    bot.once('spawn', async () => {
      log(name, 'Spawned! Waiting for OP...');
      await sleep(2000);

      try { await rcon.send(`op ${name}`); } catch {}
      try { await rcon.send(`tag ${name} add bot`); } catch {}

      // Teleport to arena spawn
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

      botStats[name].active = false;
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

      // GUI betting — whisper handler for clickable tellraw (1v1: choice 1 or 2)
      bot.on('whisper', (username, msg) => {
        if (BOT_DEFS.some(d => d.name === username)) return;
        if (!msg.startsWith('BET:')) return;
        const parts = msg.split(':');
        if (parts.length < 3) return;
        const betArena = parts[1];
        const choice = parseInt(parts[2]);
        if (!betArena || isNaN(choice) || choice < 1 || choice > 2) return;
        const fighters = currentFighters[betArena];
        if (!fighters || fighters.length < 2) return;
        handleGuiBet(username, betArena, fighters[choice - 1]);
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

      // Health check every 10s
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

        if (!target && stats.active) {
          stats.staleTicks++;
          logToFile(name, `[STALE-WARNING] Cannot find opponent for ${stats.staleTicks * 10}s`);
          if (stats.staleTicks >= 3) {
            logToFile(name, `[STALE-RECOVERY] Re-teleporting to spawn...`);
            bot.chat(`/tp @s ${spawn.x} ${spawn.y} ${spawn.z}`);
            stats.staleTicks = 0;
          }
        } else if (botStats[name]) {
          botStats[name].staleTicks = 0;
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

      // Bot is ready — resolve the promise
      resolve(bot);
    });

    // Death handler — 1v1 elimination
    bot.on('death', () => {
      if (botStats[name]) botStats[name].deaths++;
      log(name, `[DEATH] Eliminated! (death #${botStats[name]?.deaths})`);
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

    bot.on('error', (err) => {
      log(name, `ERROR: ${err.message}`);
      if (!botInstances[name]) reject(err);
    });

    bot.on('kicked', (reason) => {
      log(name, `KICKED: ${JSON.stringify(reason)}`);
      cleanup();
    });

    bot.on('end', () => {
      log(name, bot._intentionalQuit ? 'Disconnected (match over)' : 'DISCONNECTED unexpectedly');
      cleanup();
    });

    function cleanup() {
      if (combatInterval) { clearInterval(combatInterval); combatInterval = null; }
      if (healthCheckInterval) { clearInterval(healthCheckInterval); healthCheckInterval = null; }
      if (heatmapInterval) { clearInterval(heatmapInterval); heatmapInterval = null; }
      if (botStats[name]) botStats[name].active = false;
      delete botInstances[name];
    }
  });
}

// Disconnect a fighter after their match ends
function despawnFighter(name) {
  const bot = botInstances[name];
  if (!bot) return;
  bot._intentionalQuit = true;
  try { bot.quit(); } catch {}
  delete botInstances[name];
  log(name, 'Despawned (match complete)');
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  MINEFORGE ARENA — 1v1 ON-DEMAND (5 bots per arena, 2 at a time)');
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

  console.log('Bots spawn on-demand (2 per arena per match)\n');

  // Entity cleanup every 2 minutes (arrows, dropped items)
  setInterval(entityCleanup, 120000);

  // ─── Launch 4 independent game loops (one per arena) ───
  for (const arena of ['pvp', 'sumo', 'spleef', 'archery']) {
    arenaGameLoop(arena).catch(e => {
      console.error(`[${ts()}] [${arena.toUpperCase()}] Game loop crashed: ${e.message}`);
    });
    console.log(`[${ts()}] Game loop started: ${arena}`);
  }

  // Scoreboard sidebar updater — 2 lines per arena + leaderboard
  const arenaColors = { pvp: 'yellow', sumo: 'green', spleef: 'aqua', archery: 'red' };
  const arenaTeams = [
    { arena: 'pvp',     matchLine: 'sb01', statsLine: 'sb02' },
    { arena: 'sumo',    matchLine: 'sb03', statsLine: 'sb04' },
    { arena: 'spleef',  matchLine: 'sb05', statsLine: 'sb06' },
    { arena: 'archery', matchLine: 'sb07', statsLine: 'sb08' },
  ];

  setInterval(async () => {
    if (!rcon) return;
    try {
      // --- Arena lines: matchup (odd) + all bot kills (even) ---
      for (const { arena: arenaKey, matchLine, statsLine } of arenaTeams) {
        const color = arenaColors[arenaKey];
        const fighters = currentFighters[arenaKey];
        const state = arenaMatches[arenaKey].state;

        // Line 1: matchup with current fighters' K/D
        if (fighters.length === 2 && (state === 'ACTIVE' || state === 'BETTING' || state === 'COUNTDOWN')) {
          const f1 = fighters[0], f2 = fighters[1];
          const s1 = botStats[f1] || {}, s2 = botStats[f2] || {};
          const stColor = state === 'ACTIVE' ? 'green' : state === 'BETTING' ? 'gold' : 'yellow';
          await rcon.send(`team modify ${matchLine} prefix [{"text":"${arenaKey.toUpperCase()} ","color":"${color}","bold":true},{"text":"${f1}","color":"white"},{"text":" ${s1.kills||0}/${s1.deaths||0} ","color":"gray"},{"text":"vs ","color":"${stColor}"},{"text":"${f2}","color":"white"},{"text":" ${s2.kills||0}/${s2.deaths||0}","color":"gray"}]`);
        } else {
          await rcon.send(`team modify ${matchLine} prefix [{"text":"${arenaKey.toUpperCase()} ","color":"${color}","bold":true},{"text":"${state.toLowerCase()}","color":"gray","italic":true}]`);
        }

        // Line 2: all bots sorted by kills (compact: Name:K format)
        const arenaBots = BOT_DEFS.filter(d => d.arena === arenaKey)
          .map(d => ({ name: d.name, kills: (botStats[d.name] || {}).kills || 0 }))
          .sort((a, b) => b.kills - a.kills);
        const statsText = arenaBots.map(b => `${b.name.substring(0, 4)}:${b.kills}`).join(' ');
        await rcon.send(`team modify ${statsLine} prefix [{"text":" ${statsText}","color":"gray"}]`);
      }

      // --- Matches + Best (sb10-sb11) ---
      const totalMatches = Object.values(arenaMatches).reduce((sum, m) => sum + m.matchNum, 0);
      await rcon.send(`team modify sb10 prefix [{"text":"Matches: ","color":"gray"},{"text":"${totalMatches}","color":"light_purple"}]`);

      const allBotStats = BOT_DEFS.map(d => ({
        name: d.name, kills: (botStats[d.name] || {}).kills || 0, deaths: (botStats[d.name] || {}).deaths || 0,
      })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      const top2 = allBotStats.slice(0, 2);
      if (top2.length >= 2 && (top2[0].kills > 0 || top2[1].kills > 0)) {
        await rcon.send(`team modify sb11 prefix [{"text":"Best: ","color":"gray"},{"text":"${top2[0].name}","color":"white"},{"text":" ${top2[0].kills}/${top2[0].deaths}","color":"yellow"},{"text":" · ","color":"dark_gray"},{"text":"${top2[1].name}","color":"white"},{"text":" ${top2[1].kills}/${top2[1].deaths}","color":"yellow"}]`);
      }

      // --- Leaderboard (sb14-sb15): top 3 bettors ---
      const coinEntries = Object.entries(playerCoins).sort((a, b) => b[1] - a[1]);
      if (coinEntries.length === 0) {
        await rcon.send(`team modify sb14 prefix [{"text":"No bettors yet","color":"gray","italic":true}]`);
        await rcon.send(`team modify sb15 prefix {"text":""}`);
      } else if (coinEntries.length === 1) {
        const [n1, c1] = coinEntries[0];
        await rcon.send(`team modify sb14 prefix [{"text":"1. ","color":"gold","bold":true},{"text":"${n1} ","color":"white"},{"text":"${c1}","color":"yellow"}]`);
        await rcon.send(`team modify sb15 prefix {"text":""}`);
      } else {
        const [n1, c1] = coinEntries[0];
        await rcon.send(`team modify sb14 prefix [{"text":"1. ","color":"gold","bold":true},{"text":"${n1} ","color":"white"},{"text":"${c1}","color":"yellow"}]`);
        const parts = [];
        if (coinEntries[1]) { const [n2, c2] = coinEntries[1]; parts.push(`{"text":"2. ","color":"gray"},{"text":"${n2} ","color":"white"},{"text":"${c2}","color":"yellow"}`); }
        if (coinEntries[2]) { const [n3, c3] = coinEntries[2]; parts.push(`{"text":" 3. ","color":"gray"},{"text":"${n3} ","color":"white"},{"text":"${c3}","color":"yellow"}`); }
        await rcon.send(`team modify sb15 prefix [${parts.join(',')}]`);
      }

      // --- Pool info (sb16) ---
      const allBets = Object.values(activeBets).flatMap(b => Object.entries(b));
      const totalPool = allBets.reduce((s, [, b]) => s + b.amount, 0);
      const betCount = allBets.length;
      await rcon.send(`team modify sb16 prefix [{"text":"Pool: ","color":"gray"},{"text":"${totalPool}","color":"gold"},{"text":" · ","color":"dark_gray"},{"text":"${betCount}","color":"aqua"},{"text":" bets","color":"gray"}]`);

      // Update kills scoreboard (belowName display)
      for (const [bName, stats] of Object.entries(botStats)) {
        await rcon.send(`scoreboard players set ${bName} kills ${stats.kills || 0}`);
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
      const curFighters = currentFighters[arena];
      const matchup = curFighters.length === 2 ? `${curFighters[0]} vs ${curFighters[1]}` : '-';
      console.log(`  ${arena.padEnd(8)} | State: ${match.state.padEnd(10)} | Match #${match.matchNum} | ` +
        `Winner: ${(match.winner || '-').padEnd(8)} | 1v1: ${matchup} | Elapsed: ${elapsed}s`);
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
  console.log('\nShutting down active bots...');
  for (const [name, bot] of Object.entries(botInstances)) {
    try { bot._intentionalQuit = true; bot.quit(); } catch {}
  }
  if (rcon) rcon.end();
  process.exit(0);
});
