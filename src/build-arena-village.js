// MineForge Arena Village — Interactive lobby with button teleporters & timed matches
// Uses RCON (server console) — no OP needed
// Arenas: Classic PvP, Sumo, Spleef, Archery
// Players are in adventure mode — can click buttons but can't break blocks
// Isolation: items auto-granted on arena entry, stripped on exit/death
// Spleef shovels have CanDestroy tag — only works on snow_block

import { Rcon } from 'rcon-client';

const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASS = 'minecraft123';

// Ground level for superflat
const G = 3;   // grass_block level
const Y = G + 1; // floor build level

// Hub spawn (safe location on solid platform, facing south)
const SPAWN = { x: 0, y: Y, z: -8 };

// Arena centers
const ARENAS = {
  pvp:     { x: 0,   z: 55,  name: 'PvP Arena',     color: 'red' },
  sumo:    { x: 55,  z: 0,   name: 'Sumo Arena',     color: 'blue' },
  spleef:  { x: -55, z: 0,   name: 'Spleef Arena',   color: 'green' },
  archery: { x: 0,   z: -55, name: 'Archery Arena',  color: 'yellow' },
};

// Arena spawn points (MUST be inside ARENA_AREAS detection boxes)
const ARENA_SPAWNS = {
  pvp:     { x: 0,   y: Y,       z: 52 },
  sumo:    { x: 55,  y: G + 8,   z: 0 },
  spleef:  { x: -55, y: G + 13,  z: 0 },
  archery: { x: 0,   y: Y,       z: -55 },
};

// Area selectors for detecting players in arenas (x,y,z,dx,dy,dz box)
const ARENA_AREAS = {
  pvp:     { x: -12, y: 0, z: 43,  dx: 24, dy: 30, dz: 24 },
  sumo:    { x: 43,  y: 0, z: -12, dx: 24, dy: 30, dz: 24 },
  spleef:  { x: -67, y: 0, z: -12, dx: 24, dy: 30, dz: 24 },
  archery: { x: -14, y: 0, z: -62, dx: 28, dy: 30, dz: 14 },
};

// Items given to players on arena entry (give command format)
// Spleef shovel uses CanDestroy — ONLY block you can break in adventure mode
const ARENA_ITEMS = {
  pvp: [
    'minecraft:iron_sword',
    'minecraft:shield',
    'minecraft:golden_apple 3',
  ],
  sumo: [
    'minecraft:stick',
  ],
  spleef: [
    "minecraft:iron_shovel{CanDestroy:['minecraft:snow_block']}",
  ],
  archery: [
    'minecraft:bow',
    'minecraft:arrow 64',
    'minecraft:leather_chestplate',
  ],
};

// Spleef snow layer regen commands (run when match ends)
const SPLEEF_REGEN = [
  'fill -66 7 -11 -44 7 11 snow_block',
  'fill -66 11 -11 -44 11 11 snow_block',
  'fill -66 15 -11 -44 15 11 snow_block',
];

async function main() {
  console.log('Connecting to server via RCON...');
  const rcon = await Rcon.connect({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASS });
  console.log('Connected!\n');

  console.log('=== BUILDING MINEFORGE ARENA VILLAGE ===\n');

  // Silence command block output FIRST to prevent log spam from old blocks
  console.log('[0/8] Silencing command blocks...');
  await rcon.send('gamerule commandBlockOutput false');
  await rcon.send('gamerule sendCommandFeedback false');

  console.log('[0.5/8] Force-loading arena chunks...');
  // Keep all arena chunks permanently loaded so command blocks always execute
  // and fill/setblock commands work even when no player is nearby
  await rcon.send('forceload add -80 -80 80 80');

  console.log('[1/8] Clearing build area...');
  await runCmds(rcon, clearArea());

  console.log('[2/8] Setting up scoreboards...');
  await runCmds(rcon, setupScoreboards());

  console.log('[3/8] Building Central Hub...');
  await runCmds(rcon, buildHub());

  console.log('[4/8] Building PvP Arena (south)...');
  await runCmds(rcon, buildPvPArena());

  console.log('[5/8] Building Sumo Arena (east)...');
  await runCmds(rcon, buildSumoArena());

  console.log('[6/8] Building Spleef Arena (west)...');
  await runCmds(rcon, buildSpleefArena());

  console.log('[7/8] Building Archery Arena (north)...');
  await runCmds(rcon, buildArcheryArena());

  console.log('[8/8] Setting spawn & gamerules...');
  await runCmds(rcon, setSpawn());

  await rcon.send('time set day');
  await rcon.send('weather clear');

  console.log('\n=== MINEFORGE ARENA VILLAGE COMPLETE! ===');
  console.log(`Spawn: ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`);
  console.log('Mode: Adventure (no block breaking, buttons work)');
  console.log('Isolation: items auto-granted on entry, stripped on exit/death');
  console.log('PvP: south | Sumo: east | Spleef: west | Archery: north');
  console.log('Each arena has 2-minute timer + return button');

  rcon.end();
}

// ─── Helpers ────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runCmds(rcon, cmds) {
  for (const raw of cmds) {
    const cmd = raw.startsWith('/') ? raw.slice(1) : raw;
    try {
      await rcon.send(cmd);
    } catch (e) {
      console.error(`  Failed: ${cmd.slice(0, 80)} — ${e.message}`);
    }
    await sleep(100);
  }
}

// Escape double quotes inside a command so it can be placed in Command:"..." NBT
function escCmd(command) {
  return command.replace(/"/g, '\\"');
}

// Place an impulse command block (button-triggered, facing down for chaining)
function cmdBlockDown(x, y, z, command) {
  return `setblock ${x} ${y} ${z} command_block[facing=down]{Command:"${escCmd(command)}"} replace`;
}

// Place a repeating command block (always active)
function repeatBlock(x, y, z, facing, command) {
  return `setblock ${x} ${y} ${z} repeating_command_block[facing=${facing}]{auto:1b,Command:"${escCmd(command)}"} replace`;
}

// Place a chain command block (runs after previous)
function chainBlock(x, y, z, facing, command) {
  return `setblock ${x} ${y} ${z} chain_command_block[facing=${facing}]{auto:1b,Command:"${escCmd(command)}"} replace`;
}

// Area selector string for @a in an arena
function areaSelector(arena) {
  const a = ARENA_AREAS[arena];
  return `x=${a.x},y=${a.y},z=${a.z},dx=${a.dx},dy=${a.dy},dz=${a.dz}`;
}

// Return button: clear inventory → TP to hub (impulse + chain, vertical)
function returnButton(x, y, z) {
  return [
    cmdBlockDown(x, y, z, `clear @p[distance=..3]`),
    chainBlock(x, y - 1, z, 'down', `tp @p[distance=..5] ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`),
  ];
}

// Spectate button: TP to spectator box (no clear/equip needed)
// Clear block first to prevent stale NBT when replacing command blocks
function spectateButton(x, y, z, spawn) {
  return [
    `setblock ${x} ${y} ${z} air`,
    cmdBlockDown(x, y, z, `tp @p[distance=..3] ${spawn.x} ${spawn.y} ${spawn.z}`),
  ];
}

// Build a glass spectator gallery wrapping all 4 sides of an arena
// x1,z1,x2,z2: arena wall boundaries. Gallery is a 3-wide corridor ring outside these walls.
function buildSpectatorGallery(x1, z1, x2, z2, floorY, height) {
  const cmds = [];
  const ceilY = floorY + height;

  // Floor (quartz_block) — 4 strips forming a ring
  cmds.push(`fill ${x1-3} ${floorY} ${z1-3} ${x2+3} ${floorY} ${z1-1} quartz_block`);
  cmds.push(`fill ${x1-3} ${floorY} ${z2+1} ${x2+3} ${floorY} ${z2+3} quartz_block`);
  cmds.push(`fill ${x2+1} ${floorY} ${z1} ${x2+3} ${floorY} ${z2} quartz_block`);
  cmds.push(`fill ${x1-3} ${floorY} ${z1} ${x1-1} ${floorY} ${z2} quartz_block`);

  // Ceiling (glass) — 4 strips
  cmds.push(`fill ${x1-3} ${ceilY} ${z1-3} ${x2+3} ${ceilY} ${z1-1} glass`);
  cmds.push(`fill ${x1-3} ${ceilY} ${z2+1} ${x2+3} ${ceilY} ${z2+3} glass`);
  cmds.push(`fill ${x2+1} ${ceilY} ${z1} ${x2+3} ${ceilY} ${z2} glass`);
  cmds.push(`fill ${x1-3} ${ceilY} ${z1} ${x1-1} ${ceilY} ${z2} glass`);

  // Outer walls (stone_bricks) — 4 faces
  cmds.push(`fill ${x1-3} ${floorY+1} ${z1-3} ${x2+3} ${ceilY-1} ${z1-3} stone_bricks`);
  cmds.push(`fill ${x1-3} ${floorY+1} ${z2+3} ${x2+3} ${ceilY-1} ${z2+3} stone_bricks`);
  cmds.push(`fill ${x2+3} ${floorY+1} ${z1-3} ${x2+3} ${ceilY-1} ${z2+3} stone_bricks`);
  cmds.push(`fill ${x1-3} ${floorY+1} ${z1-3} ${x1-3} ${ceilY-1} ${z2+3} stone_bricks`);

  // Interior air — 4 strips, overlapping at corners for walkability
  cmds.push(`fill ${x1-2} ${floorY+1} ${z1-2} ${x2+2} ${ceilY-1} ${z1-1} air`);
  cmds.push(`fill ${x1-2} ${floorY+1} ${z2+1} ${x2+2} ${ceilY-1} ${z2+2} air`);
  cmds.push(`fill ${x2+1} ${floorY+1} ${z1-2} ${x2+2} ${ceilY-1} ${z2+2} air`);
  cmds.push(`fill ${x1-2} ${floorY+1} ${z1-2} ${x1-1} ${ceilY-1} ${z2+2} air`);

  // Lighting — sea lanterns in ceiling every 5 blocks + corners
  for (let x = x1; x <= x2; x += 5) {
    cmds.push(`setblock ${x} ${ceilY} ${z1-2} sea_lantern`);
    cmds.push(`setblock ${x} ${ceilY} ${z2+2} sea_lantern`);
  }
  for (let z = z1; z <= z2; z += 5) {
    cmds.push(`setblock ${x2+2} ${ceilY} ${z} sea_lantern`);
    cmds.push(`setblock ${x1-2} ${ceilY} ${z} sea_lantern`);
  }
  cmds.push(`setblock ${x1-2} ${ceilY} ${z1-2} sea_lantern`);
  cmds.push(`setblock ${x2+2} ${ceilY} ${z1-2} sea_lantern`);
  cmds.push(`setblock ${x1-2} ${ceilY} ${z2+2} sea_lantern`);
  cmds.push(`setblock ${x2+2} ${ceilY} ${z2+2} sea_lantern`);

  return cmds;
}

// Build timer + equip command block chain for an arena
// Places blocks underground at y=1, running east (positive x)
// equipItems: array of give-command item strings
// resetCmds: extra commands at match end (e.g., spleef snow regen)
function buildTimerChain(startX, startZ, arenaKey, equipItems = [], resetCmds = []) {
  const cmds = [];
  const timerName = `${arenaKey}_t`;
  const area = areaSelector(arenaKey);
  const hubTP = `${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`;
  const by = 1; // buried y level
  let idx = 0;

  // Clear space for command blocks (generous width)
  const totalBlocks = 8 + equipItems.length + resetCmds.length + 2;
  cmds.push(`fill ${startX} ${by} ${startZ} ${startX + totalBlocks} ${by} ${startZ} air`);

  // Block: Repeating — increment timer when players in area
  cmds.push(repeatBlock(startX + idx, by, startZ, 'east',
    `execute if entity @a[${area}] run scoreboard players add ${timerName} timer 1`));
  idx++;

  // Block: Chain — reset timer when NO players AND timer > 0
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute unless entity @a[${area}] if score ${timerName} timer matches 1.. run scoreboard players set ${timerName} timer 0`));
  idx++;

  // Block: Chain — clear inventory on tick 2 (just entered arena)
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2 run clear @a[${area}]`));
  idx++;

  // Blocks: Chain — give each item on tick 3
  for (const item of equipItems) {
    cmds.push(chainBlock(startX + idx, by, startZ, 'east',
      `execute if score ${timerName} timer matches 3 run give @a[${area}] ${item}`));
    idx++;
  }

  // Block: Chain — "1:00 remaining" at 1200 ticks (60s)
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 1200 run title @a[${area}] actionbar {"text":"1:00 remaining","color":"yellow"}`));
  idx++;

  // Block: Chain — "30s remaining" at 1800 ticks (90s)
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 1800 run title @a[${area}] actionbar {"text":"0:30 remaining","color":"gold"}`));
  idx++;

  // Block: Chain — "10s left!" at 2200 ticks (110s)
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2200 run title @a[${area}] actionbar {"text":"10 seconds left!","color":"red","bold":true}`));
  idx++;

  // Block: Chain — Time's up! title at 2400 ticks (120s)
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run title @a[${area}] title {"text":"Time's Up!","color":"red","bold":true}`));
  idx++;

  // Block: Chain — clear inventory at 2400 (strip items before TP)
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run clear @a[${area}]`));
  idx++;

  // Blocks: Chain — arena reset commands at 2400 (e.g., spleef snow regen)
  for (const rc of resetCmds) {
    cmds.push(chainBlock(startX + idx, by, startZ, 'east',
      `execute if score ${timerName} timer matches 2400 run ${rc}`));
    idx++;
  }

  // Block: Chain — TP all players back to hub at 2400
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run tp @a[${area}] ${hubTP}`));
  idx++;

  // Block: Chain — reset timer at 2400
  cmds.push(chainBlock(startX + idx, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run scoreboard players set ${timerName} timer 0`));

  return cmds;
}

// ─── CLEAR AREA ─────────────────────────────────────────

function clearArea() {
  const cmds = [];
  // Kill old underground command blocks at y=1 FIRST (stops timer spam)
  for (const [x1, z1, x2, z2] of [[-80, -80, 0, 0], [1, -80, 80, 0], [-80, 1, 0, 80], [1, 1, 80, 80]]) {
    cmds.push(`fill ${x1} 0 ${z1} ${x2} 2 ${z2} stone`);
  }
  // Clear above-ground builds
  for (const [x1, z1, x2, z2] of [[-80, -80, 0, 0], [1, -80, 80, 0], [-80, 1, 0, 80], [1, 1, 80, 80]]) {
    cmds.push(`fill ${x1} ${Y} ${z1} ${x2} ${Y + 25} ${z2} air`);
  }
  return cmds;
}

// ─── SCOREBOARDS ────────────────────────────────────────

function setupScoreboards() {
  return [
    // Internal timer objective (tick counter per arena)
    'scoreboard objectives add timer dummy',
    'scoreboard players set pvp_t timer 0',
    'scoreboard players set sumo_t timer 0',
    'scoreboard players set spleef_t timer 0',
    'scoreboard players set archery_t timer 0',

    // Player-visible objectives
    'scoreboard objectives add kills playerKillCount {"text":"Arena Kills","color":"gold"}',
    'scoreboard objectives add wins dummy {"text":"Arena Wins","color":"aqua"}',
    'scoreboard objectives add coins dummy {"text":"Coins","color":"gold"}',
    'scoreboard objectives setdisplay list coins',

    // Hypixel-style sidebar — dummy objective with fake player lines + teams for text
    'scoreboard objectives add sidebar dummy {"text":"MINEFORGE","bold":true,"color":"gold"}',
    'scoreboard objectives setdisplay sidebar sidebar',
    'scoreboard objectives setdisplay belowName kills',

    // Sidebar line entries — use §<color>§r as invisible player names (unique per line)
    // §0§r, §1§r, ... §e§r = 15 unique invisible names
    `scoreboard players set \u00a70\u00a7r sidebar 16`,
    `scoreboard players set \u00a71\u00a7r sidebar 15`,
    `scoreboard players set \u00a72\u00a7r sidebar 14`,
    `scoreboard players set \u00a73\u00a7r sidebar 13`,
    `scoreboard players set \u00a74\u00a7r sidebar 12`,
    `scoreboard players set \u00a75\u00a7r sidebar 11`,
    `scoreboard players set \u00a76\u00a7r sidebar 10`,
    `scoreboard players set \u00a77\u00a7r sidebar 9`,
    `scoreboard players set \u00a78\u00a7r sidebar 8`,
    `scoreboard players set \u00a79\u00a7r sidebar 7`,
    `scoreboard players set \u00a7a\u00a7r sidebar 6`,
    `scoreboard players set \u00a7b\u00a7r sidebar 5`,
    `scoreboard players set \u00a7c\u00a7r sidebar 4`,
    `scoreboard players set \u00a7d\u00a7r sidebar 3`,
    `scoreboard players set \u00a7e\u00a7r sidebar 2`,
    `scoreboard players set \u00a7f\u00a7r sidebar 1`,

    // Create teams for each line (prefix controls displayed text)
    'team add sb01', 'team add sb02', 'team add sb03', 'team add sb04',
    'team add sb05', 'team add sb06', 'team add sb07', 'team add sb08',
    'team add sb09', 'team add sb10', 'team add sb11', 'team add sb12',
    'team add sb13', 'team add sb14', 'team add sb15', 'team add sb16',

    // Join invisible players to teams
    `team join sb01 \u00a70\u00a7r`, `team join sb02 \u00a71\u00a7r`,
    `team join sb03 \u00a72\u00a7r`, `team join sb04 \u00a73\u00a7r`,
    `team join sb05 \u00a74\u00a7r`, `team join sb06 \u00a75\u00a7r`,
    `team join sb07 \u00a76\u00a7r`, `team join sb08 \u00a77\u00a7r`,
    `team join sb09 \u00a78\u00a7r`, `team join sb10 \u00a79\u00a7r`,
    `team join sb11 \u00a7a\u00a7r`, `team join sb12 \u00a7b\u00a7r`,
    `team join sb13 \u00a7c\u00a7r`, `team join sb14 \u00a7d\u00a7r`,
    `team join sb15 \u00a7e\u00a7r`, `team join sb16 \u00a7f\u00a7r`,

    // Set line text via team prefixes
    'team modify sb01 prefix {"text":"Arena Village","color":"white"}',
    'team modify sb02 prefix {"text":""}',
    'team modify sb03 prefix [{"text":"Fighters: ","color":"gray"},{"text":"8","color":"aqua"}]',
    'team modify sb04 prefix {"text":""}',
    // Bot name lines (sb05-sb12) — updated live by arena-bot.js
    'team modify sb05 prefix [{"text":"Pvp1","color":"yellow"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb06 prefix [{"text":"Pvp2","color":"yellow"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb07 prefix [{"text":"Sumo1","color":"green"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb08 prefix [{"text":"Sumo2","color":"green"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb09 prefix [{"text":"Spleef1","color":"aqua"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb10 prefix [{"text":"Spleef2","color":"aqua"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb11 prefix [{"text":"Archer1","color":"red"},{"text":" 0K 0D","color":"gray"}]',
    'team modify sb12 prefix [{"text":"Archer2","color":"red"},{"text":" 0K 0D","color":"gray"}]',
    // Betting section (sb13-sb16 — updated live by arena-bot.js)
    'team modify sb13 prefix [{"text":"── ","color":"dark_gray"},{"text":"BETTING","color":"light_purple","bold":true},{"text":" ──","color":"dark_gray"}]',
    'team modify sb14 prefix [{"text":"Bets: ","color":"gray"},{"text":"0","color":"aqua"},{"text":" Pool: ","color":"gray"},{"text":"0","color":"gold"}]',
    'team modify sb15 prefix [{"text":"No bettors yet","color":"gray","italic":true}]',
    'team modify sb16 prefix [{"text":"Spectate to bet!","color":"dark_gray","italic":true}]',

    // Show death messages for kill tracking
    'gamerule showDeathMessages true',
  ];
}

// ─── CENTRAL HUB ────────────────────────────────────────

function buildHub() {
  const cmds = [];
  const cx = 0, cz = 0;
  const R = 14; // room half-width
  const H = 9;  // wall height

  // ─── Floor (concentric dark rings) ───
  cmds.push(`fill ${cx-R} ${G} ${cz-R} ${cx+R} ${G} ${cz+R} polished_blackstone`);
  cmds.push(`fill ${cx-10} ${G} ${cz-10} ${cx+10} ${G} ${cz+10} polished_blackstone_bricks`);
  cmds.push(`fill ${cx-6} ${G} ${cz-6} ${cx+6} ${G} ${cz+6} blue_concrete`);
  cmds.push(`fill ${cx-3} ${G} ${cz-3} ${cx+3} ${G} ${cz+3} purple_concrete`);
  cmds.push(`fill ${cx-1} ${G} ${cz-1} ${cx+1} ${G} ${cz+1} crying_obsidian`);
  // Directional floor lights (point toward spectate stations)
  for (const [fx, fz] of [[-8,0],[8,0],[0,-8],[0,8]]) {
    cmds.push(`setblock ${cx+fx} ${G} ${cz+fz} sea_lantern`);
  }

  // ─── Walls (sealed room, polished blackstone bricks) ───
  cmds.push(`fill ${cx-R} ${Y} ${cz-R} ${cx+R} ${Y+H} ${cz-R} polished_blackstone_bricks`);
  cmds.push(`fill ${cx-R} ${Y} ${cz+R} ${cx+R} ${Y+H} ${cz+R} polished_blackstone_bricks`);
  cmds.push(`fill ${cx-R} ${Y} ${cz-R} ${cx-R} ${Y+H} ${cz+R} polished_blackstone_bricks`);
  cmds.push(`fill ${cx+R} ${Y} ${cz-R} ${cx+R} ${Y+H} ${cz+R} polished_blackstone_bricks`);
  // Interior air
  cmds.push(`fill ${cx-R+1} ${Y} ${cz-R+1} ${cx+R-1} ${Y+H-1} ${cz+R-1} air`);

  // ─── Ceiling (dark glass) ───
  cmds.push(`fill ${cx-R+1} ${Y+H} ${cz-R+1} ${cx+R-1} ${Y+H} ${cz+R-1} black_stained_glass`);

  // ─── Corner pillars ───
  for (const [px, pz] of [[-R,-R],[R,-R],[-R,R],[R,R]]) {
    cmds.push(`fill ${cx+px} ${Y} ${cz+pz} ${cx+px} ${Y+H} ${cz+pz} gilded_blackstone`);
  }

  // ─── Wall lighting (sea lanterns embedded) ───
  for (let i = -10; i <= 10; i += 5) {
    cmds.push(`setblock ${cx+i} ${Y+4} ${cz-R} sea_lantern`);
    cmds.push(`setblock ${cx+i} ${Y+4} ${cz+R} sea_lantern`);
    cmds.push(`setblock ${cx-R} ${Y+4} ${cz+i} sea_lantern`);
    cmds.push(`setblock ${cx+R} ${Y+4} ${cz+i} sea_lantern`);
  }

  // ─── Crying obsidian wall accents ───
  for (const h of [Y+1, Y+7]) {
    for (let i = -8; i <= 8; i += 8) {
      cmds.push(`setblock ${cx+i} ${h} ${cz-R} crying_obsidian`);
      cmds.push(`setblock ${cx+i} ${h} ${cz+R} crying_obsidian`);
      cmds.push(`setblock ${cx-R} ${h} ${cz+i} crying_obsidian`);
      cmds.push(`setblock ${cx+R} ${h} ${cz+i} crying_obsidian`);
    }
  }

  // ─── Hanging soul lanterns ───
  for (const [lx, lz] of [[-8,-8],[8,-8],[-8,8],[8,8]]) {
    cmds.push(`setblock ${cx+lx} ${Y+H-1} ${cz+lz} chain`);
    cmds.push(`setblock ${cx+lx} ${Y+H-2} ${cz+lz} soul_lantern`);
  }
  cmds.push(`setblock ${cx} ${Y+H-1} ${cz} shroomlight`);

  // ─── Soul fire corner accents ───
  for (const [sx, sz] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
    cmds.push(`setblock ${cx+sx} ${G} ${cz+sz} soul_soil`);
    cmds.push(`setblock ${cx+sx} ${Y} ${cz+sz} soul_fire`);
  }

  // ─── Center pillar (MineForge branding + betting info) ───
  cmds.push(`fill ${cx-1} ${Y} ${cz-1} ${cx+1} ${Y+4} ${cz+1} obsidian`);
  cmds.push(`fill ${cx} ${Y+1} ${cz} ${cx} ${Y+3} ${cz} crying_obsidian`);
  cmds.push(`fill ${cx-1} ${Y+5} ${cz-1} ${cx+1} ${Y+5} ${cz+1} obsidian`);
  cmds.push(`setblock ${cx} ${Y+5} ${cz} shroomlight`);
  // Branding signs (4 faces)
  cmds.push(`setblock ${cx} ${Y+4} ${cz-2} oak_wall_sign[facing=north]{Text1:'{"text":"MINEFORGE","color":"gold","bold":true}',Text2:'{"text":"Arena Village","color":"white"}',Text3:'{"text":"Spectate & Bet","color":"gray"}',Text4:'{"text":"on bot fights!","color":"gray"}'}`);
  cmds.push(`setblock ${cx} ${Y+4} ${cz+2} oak_wall_sign[facing=south]{Text1:'{"text":"MINEFORGE","color":"gold","bold":true}',Text2:'{"text":"Arena Village","color":"white"}',Text3:'{"text":"Spectate & Bet","color":"gray"}',Text4:'{"text":"on bot fights!","color":"gray"}'}`);
  cmds.push(`setblock ${cx+2} ${Y+4} ${cz} oak_wall_sign[facing=east]{Text1:'{"text":"BETTING","color":"light_purple","bold":true}',Text2:'{"text":"Spectate a game","color":"white"}',Text3:'{"text":"Click to bet!","color":"aqua"}',Text4:'{"text":"!coins = balance","color":"gray"}'}`);
  cmds.push(`setblock ${cx-2} ${Y+4} ${cz} oak_wall_sign[facing=west]{Text1:'{"text":"BETTING","color":"light_purple","bold":true}',Text2:'{"text":"15s betting phase","color":"white"}',Text3:'{"text":"Win = 2x payout","color":"green"}',Text4:'{"text":"Start: 100 coins","color":"gray"}'}`);

  // ─── Spectate Stations (one per wall) ───

  // SOUTH WALL — PvP Spectate
  cmds.push(`fill ${cx-3} ${Y} ${cz+R-1} ${cx-3} ${Y+5} ${cz+R-1} polished_blackstone`);
  cmds.push(`fill ${cx+3} ${Y} ${cz+R-1} ${cx+3} ${Y+5} ${cz+R-1} polished_blackstone`);
  cmds.push(`setblock ${cx-3} ${Y+3} ${cz+R-1} red_concrete`);
  cmds.push(`setblock ${cx+3} ${Y+3} ${cz+R-1} red_concrete`);
  cmds.push(`fill ${cx-2} ${Y+5} ${cz+R-1} ${cx+2} ${Y+5} ${cz+R-1} red_concrete`);
  cmds.push(`setblock ${cx} ${Y+4} ${cz+R-1} oak_wall_sign[facing=north]{Text1:'{"text":"[PvP Arena]","color":"red","bold":true}',Text2:'{"text":"Sword 1v1"}',Text3:'{"text":">> SPECTATE >>","color":"gold"}',Text4:'{"text":"Click button below","color":"gray"}'}`);
  cmds.push(`setblock ${cx} ${Y+2} ${cz+R-1} stone_button[face=wall,facing=north]`);
  cmds.push(...spectateButton(cx, Y+1, cz+R-1, { x: 14, y: Y, z: 41 }));

  // EAST WALL — Sumo Spectate
  cmds.push(`fill ${cx+R-1} ${Y} ${cz-3} ${cx+R-1} ${Y+5} ${cz-3} polished_blackstone`);
  cmds.push(`fill ${cx+R-1} ${Y} ${cz+3} ${cx+R-1} ${Y+5} ${cz+3} polished_blackstone`);
  cmds.push(`setblock ${cx+R-1} ${Y+3} ${cz-3} blue_concrete`);
  cmds.push(`setblock ${cx+R-1} ${Y+3} ${cz+3} blue_concrete`);
  cmds.push(`fill ${cx+R-1} ${Y+5} ${cz-2} ${cx+R-1} ${Y+5} ${cz+2} blue_concrete`);
  cmds.push(`setblock ${cx+R-1} ${Y+4} ${cz} oak_wall_sign[facing=west]{Text1:'{"text":"[Sumo Arena]","color":"blue","bold":true}',Text2:'{"text":"Knockback 1v1"}',Text3:'{"text":">> SPECTATE >>","color":"gold"}',Text4:'{"text":"Click button below","color":"gray"}'}`);
  cmds.push(`setblock ${cx+R-1} ${Y+2} ${cz} stone_button[face=wall,facing=west]`);
  cmds.push(...spectateButton(cx+R-1, Y+1, cz, { x: 41, y: 11, z: -14 }));

  // WEST WALL — Spleef Spectate
  cmds.push(`fill ${cx-R+1} ${Y} ${cz-3} ${cx-R+1} ${Y+5} ${cz-3} polished_blackstone`);
  cmds.push(`fill ${cx-R+1} ${Y} ${cz+3} ${cx-R+1} ${Y+5} ${cz+3} polished_blackstone`);
  cmds.push(`setblock ${cx-R+1} ${Y+3} ${cz-3} green_concrete`);
  cmds.push(`setblock ${cx-R+1} ${Y+3} ${cz+3} green_concrete`);
  cmds.push(`fill ${cx-R+1} ${Y+5} ${cz-2} ${cx-R+1} ${Y+5} ${cz+2} green_concrete`);
  cmds.push(`setblock ${cx-R+1} ${Y+4} ${cz} oak_wall_sign[facing=east]{Text1:'{"text":"[Spleef Arena]","color":"green","bold":true}',Text2:'{"text":"Break the Floor!"}',Text3:'{"text":">> SPECTATE >>","color":"gold"}',Text4:'{"text":"Click button below","color":"gray"}'}`);
  cmds.push(`setblock ${cx-R+1} ${Y+2} ${cz} stone_button[face=wall,facing=east]`);
  cmds.push(...spectateButton(cx-R+1, Y+1, cz, { x: -41, y: 16, z: -14 }));

  // NORTH WALL — Archery Spectate
  cmds.push(`fill ${cx-3} ${Y} ${cz-R+1} ${cx-3} ${Y+5} ${cz-R+1} polished_blackstone`);
  cmds.push(`fill ${cx+3} ${Y} ${cz-R+1} ${cx+3} ${Y+5} ${cz-R+1} polished_blackstone`);
  cmds.push(`setblock ${cx-3} ${Y+3} ${cz-R+1} yellow_concrete`);
  cmds.push(`setblock ${cx+3} ${Y+3} ${cz-R+1} yellow_concrete`);
  cmds.push(`fill ${cx-2} ${Y+5} ${cz-R+1} ${cx+2} ${Y+5} ${cz-R+1} yellow_concrete`);
  cmds.push(`setblock ${cx} ${Y+4} ${cz-R+1} oak_wall_sign[facing=south]{Text1:'{"text":"[Archery Arena]","color":"yellow","bold":true}',Text2:'{"text":"Bow Duel 1v1"}',Text3:'{"text":">> SPECTATE >>","color":"gold"}',Text4:'{"text":"Click button below","color":"gray"}'}`);
  cmds.push(`setblock ${cx} ${Y+2} ${cz-R+1} stone_button[face=wall,facing=south]`);
  cmds.push(...spectateButton(cx, Y+1, cz-R+1, { x: 16, y: Y, z: -46 }));

  return cmds;
}

// ─── CLASSIC PVP ARENA (south, centered at 0, z=55) ─────

function buildPvPArena() {
  const cmds = [];
  const ax = 0, az = 55;

  // Floor
  cmds.push(`fill ${ax-12} ${G} ${az-12} ${ax+12} ${G} ${az+12} sand`);

  // Walls
  cmds.push(`fill ${ax-12} ${Y} ${az-12} ${ax+12} ${Y+5} ${az-12} blue_concrete`);
  cmds.push(`fill ${ax-12} ${Y} ${az+12} ${ax+12} ${Y+5} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax-12} ${Y} ${az-12} ${ax-12} ${Y+5} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax+12} ${Y} ${az-12} ${ax+12} ${Y+5} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax-11} ${Y} ${az-11} ${ax+11} ${Y+5} ${az+11} air`);

  // Entrance
  cmds.push(`fill ${ax-1} ${Y} ${az-12} ${ax+1} ${Y+3} ${az-12} air`);

  // Glass ceiling
  cmds.push(`fill ${ax-12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az+12} white_stained_glass`);

  // Obstacle pillars
  for (const [px, pz] of [[-6,-4],[6,-4],[-6,4],[6,4],[0,0],[-3,8],[3,-8]]) {
    cmds.push(`fill ${ax+px} ${Y} ${az+pz} ${ax+px+1} ${Y+2} ${az+pz+1} quartz_block`);
  }

  // Spawn platforms (decorative, items given automatically now)
  cmds.push(`fill ${ax-2} ${G} ${az+9} ${ax+2} ${G} ${az+10} quartz_block`);
  cmds.push(`fill ${ax-2} ${G} ${az-9} ${ax+2} ${G} ${az-10} quartz_block`);

  // Wall top + corner lights
  cmds.push(`fill ${ax-12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az-12} blue_concrete`);
  cmds.push(`fill ${ax-12} ${Y+6} ${az+12} ${ax+12} ${Y+6} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax-12} ${Y+6} ${az-12} ${ax-12} ${Y+6} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax+12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az+12} blue_concrete`);
  for (const [lx, lz] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
    cmds.push(`setblock ${ax+lx} ${Y+7} ${az+lz} sea_lantern`);
  }

  // Label
  cmds.push(`setblock ${ax} ${Y+4} ${az-12} oak_wall_sign[facing=south]{Text1:'{"text":"PVP ARENA","color":"red","bold":true}',Text2:'{"text":"1v1 Sword Combat"}',Text3:'{"text":"Auto-equipped!"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (clear + TP chain)
  cmds.push(`setblock ${ax+3} ${Y+1} ${az-12} quartz_block`);
  cmds.push(`setblock ${ax+3} ${Y+2} ${az-13} oak_wall_sign[facing=north]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+3} ${Y+1} ${az-13} stone_button[face=wall,facing=north]`);
  cmds.push(...returnButton(ax + 3, Y, az - 13));

  // Timer + equip chain (underground at y=1)
  cmds.push(...buildTimerChain(ax - 5, az + 15, 'pvp', ARENA_ITEMS.pvp));

  // ─── Spectator Gallery (wraps all 4 sides of arena) ───
  // Arena walls: x=[-12,12] z=[43,67], gallery floor at fighter level
  cmds.push(...buildSpectatorGallery(-12, 43, 12, 67, G, 4));
  // Replace arena walls with glass for viewing (y=4 to y=6)
  cmds.push(`fill ${ax-11} ${Y} ${az-12} ${ax+11} ${G+3} ${az-12} glass`);
  cmds.push(`fill ${ax-11} ${Y} ${az+12} ${ax+11} ${G+3} ${az+12} glass`);
  cmds.push(`fill ${ax-12} ${Y} ${az-11} ${ax-12} ${G+3} ${az+11} glass`);
  cmds.push(`fill ${ax+12} ${Y} ${az-11} ${ax+12} ${G+3} ${az+11} glass`);
  // Re-cut arena entrance (glass replacement overwrites it)
  cmds.push(`fill ${ax-1} ${Y} ${az-12} ${ax+1} ${Y+3} ${az-12} air`);
  // Cut entrance passthrough in gallery north corridor
  cmds.push(`fill ${ax-1} ${Y} ${az-15} ${ax+1} ${G+3} ${az-13} air`);
  // Tunnel walls to separate gallery corridor from entrance path
  cmds.push(`fill ${ax-2} ${Y} ${az-15} ${ax-2} ${G+3} ${az-13} glass`);
  cmds.push(`fill ${ax+2} ${Y} ${az-15} ${ax+2} ${G+3} ${az-13} glass`);
  // Return button in gallery (NE corner of north corridor)
  cmds.push(`setblock ${ax+13} ${Y+1} ${az-14} oak_wall_sign[facing=south]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+13} ${Y} ${az-14} stone_button[face=wall,facing=south]`);
  cmds.push(...returnButton(ax + 13, G, az - 14));

  return cmds;
}

// ─── SUMO ARENA (east, centered at x=55, z=0) ──────────

function buildSumoArena() {
  const cmds = [];
  const ax = 55, az = 0;

  // Water pool below
  cmds.push(`fill ${ax-10} ${G-3} ${az-10} ${ax+10} ${G-1} ${az+10} stone`);
  cmds.push(`fill ${ax-8} ${G-2} ${az-8} ${ax+8} ${G-1} ${az+8} water`);

  const platY = G + 7;

  // Support pillars
  cmds.push(`fill ${ax-1} ${Y} ${az-1} ${ax+1} ${platY-1} ${az+1} white_concrete`);
  cmds.push(`fill ${ax-7} ${Y} ${az-1} ${ax-6} ${platY-1} ${az+1} white_concrete`);
  cmds.push(`fill ${ax+6} ${Y} ${az-1} ${ax+7} ${platY-1} ${az+1} white_concrete`);
  cmds.push(`fill ${ax-1} ${Y} ${az-7} ${ax+1} ${platY-1} ${az-6} white_concrete`);
  cmds.push(`fill ${ax-1} ${Y} ${az+6} ${ax+1} ${platY-1} ${az+7} white_concrete`);

  // Circular platform
  cmds.push(`fill ${ax-7} ${platY} ${az-3} ${ax+7} ${platY} ${az+3} white_concrete`);
  cmds.push(`fill ${ax-6} ${platY} ${az-5} ${ax+6} ${platY} ${az+5} white_concrete`);
  cmds.push(`fill ${ax-5} ${platY} ${az-6} ${ax+5} ${platY} ${az+6} white_concrete`);
  cmds.push(`fill ${ax-3} ${platY} ${az-7} ${ax+3} ${platY} ${az+7} white_concrete`);

  // Center ring
  cmds.push(`fill ${ax-4} ${platY} ${az-1} ${ax+4} ${platY} ${az+1} light_blue_concrete`);
  cmds.push(`fill ${ax-1} ${platY} ${az-4} ${ax+1} ${platY} ${az+4} light_blue_concrete`);
  cmds.push(`fill ${ax-3} ${platY} ${az-3} ${ax+3} ${platY} ${az+3} blue_concrete`);
  cmds.push(`fill ${ax-1} ${platY} ${az-1} ${ax+1} ${platY} ${az+1} white_concrete`);

  // Spawn torches
  cmds.push(`setblock ${ax-5} ${platY+1} ${az} torch`);
  cmds.push(`setblock ${ax+5} ${platY+1} ${az} torch`);

  // Bridge from hub
  cmds.push(`fill ${ax-15} ${platY} ${az-1} ${ax-8} ${platY} ${az+1} quartz_block`);
  cmds.push(`fill ${ax-15} ${platY+1} ${az-2} ${ax-8} ${platY+1} ${az-2} oak_fence`);
  cmds.push(`fill ${ax-15} ${platY+1} ${az+2} ${ax-8} ${platY+1} ${az+2} oak_fence`);

  // Staircase (ascending east toward bridge — x=33→39, y=4→10)
  for (let step = 0; step < 7; step++) {
    const sx = ax - 22 + step;
    cmds.push(`fill ${sx} ${Y+step} ${az-1} ${sx} ${Y+step} ${az+1} quartz_stairs[facing=east]`);
    if (step > 0) cmds.push(`fill ${sx} ${Y} ${az-1} ${sx} ${Y+step-1} ${az+1} quartz_block`);
    cmds.push(`setblock ${sx} ${Y+step} ${az-2} quartz_block`);
    cmds.push(`setblock ${sx} ${Y+step} ${az+2} quartz_block`);
  }

  // Spectator platforms
  for (const [sx, sz] of [[-9,-9],[9,-9],[-9,9],[9,9]]) {
    cmds.push(`fill ${ax+sx-1} ${platY+3} ${az+sz-1} ${ax+sx+1} ${platY+3} ${az+sz+1} white_stained_glass`);
    cmds.push(`fill ${ax+sx} ${Y} ${az+sz} ${ax+sx} ${platY+2} ${az+sz} oak_fence`);
    cmds.push(`setblock ${ax+sx} ${platY+4} ${az+sz} sea_lantern`);
  }

  // Label
  cmds.push(`setblock ${ax-16} ${Y+8} ${az} oak_sign[rotation=4]{Text1:'{"text":"SUMO ARENA","color":"blue","bold":true}',Text2:'{"text":"1v1 Knockback"}',Text3:'{"text":"No weapons!"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (clear + TP chain)
  cmds.push(`setblock ${ax-22} ${Y+1} ${az-2} quartz_block`);
  cmds.push(`setblock ${ax-23} ${Y+2} ${az-2} oak_wall_sign[facing=west]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax-23} ${Y+1} ${az-2} stone_button[face=wall,facing=west]`);
  cmds.push(...returnButton(ax - 23, Y, az - 2));

  // Timer + equip chain
  cmds.push(...buildTimerChain(ax - 5, az + 15, 'sumo', ARENA_ITEMS.sumo));

  // ─── Spectator Gallery (wraps all 4 sides of detection area) ───
  // Detection area: x=[43,67] z=[-12,12], gallery floor at platform level
  cmds.push(...buildSpectatorGallery(43, -12, 67, 12, platY, 4));
  // Add glass inner walls (sumo has no arena walls, open platform)
  cmds.push(`fill 43 ${platY+1} -12 67 ${platY+3} -12 glass`);
  cmds.push(`fill 43 ${platY+1} 12 67 ${platY+3} 12 glass`);
  cmds.push(`fill 67 ${platY+1} -12 67 ${platY+3} 12 glass`);
  cmds.push(`fill 43 ${platY+1} -12 43 ${platY+3} 12 glass`);
  // Cut entrance passthrough from bridge (west side)
  cmds.push(`fill 40 ${platY+1} -1 40 ${platY+3} 1 air`);
  cmds.push(`fill 43 ${platY+1} -1 43 ${platY+3} 1 air`);
  // Tunnel walls to separate gallery corridor from entrance path
  cmds.push(`fill 40 ${platY+1} -2 42 ${platY+3} -2 glass`);
  cmds.push(`fill 40 ${platY+1} 2 42 ${platY+3} 2 glass`);
  // Return button in gallery (NW corner of north corridor)
  cmds.push(`setblock 41 ${platY+2} -14 oak_wall_sign[facing=south]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock 41 ${platY+1} -14 stone_button[face=wall,facing=south]`);
  cmds.push(...returnButton(41, platY, -14));

  return cmds;
}

// ─── SPLEEF ARENA (west, centered at x=-55, z=0) ───────

function buildSpleefArena() {
  const cmds = [];
  const ax = -55, az = 0;

  // Glass walls
  cmds.push(`fill ${ax-12} ${Y} ${az-12} ${ax+12} ${Y+16} ${az-12} white_stained_glass`);
  cmds.push(`fill ${ax-12} ${Y} ${az+12} ${ax+12} ${Y+16} ${az+12} white_stained_glass`);
  cmds.push(`fill ${ax-12} ${Y} ${az-12} ${ax-12} ${Y+16} ${az+12} white_stained_glass`);
  cmds.push(`fill ${ax+12} ${Y} ${az-12} ${ax+12} ${Y+16} ${az+12} white_stained_glass`);

  // Lava pit
  cmds.push(`fill ${ax-11} ${G} ${az-11} ${ax+11} ${G} ${az+11} lava`);
  cmds.push(`fill ${ax-11} ${Y} ${az-11} ${ax+11} ${Y+2} ${az+11} air`);

  // Spleef layers (snow_block)
  cmds.push(`fill ${ax-11} ${G+4} ${az-11} ${ax+11} ${G+4} ${az+11} snow_block`);
  cmds.push(`fill ${ax-11} ${G+8} ${az-11} ${ax+11} ${G+8} ${az+11} snow_block`);
  cmds.push(`fill ${ax-11} ${G+12} ${az-11} ${ax+11} ${G+12} ${az+11} snow_block`);

  // Air between layers
  cmds.push(`fill ${ax-11} ${G+5} ${az-11} ${ax+11} ${G+7} ${az+11} air`);
  cmds.push(`fill ${ax-11} ${G+9} ${az-11} ${ax+11} ${G+11} ${az+11} air`);
  cmds.push(`fill ${ax-11} ${G+13} ${az-11} ${ax+11} ${G+15} ${az+11} air`);

  // Entrance at top layer
  cmds.push(`fill ${ax+12} ${G+12} ${az-1} ${ax+12} ${G+14} ${az+1} air`);
  cmds.push(`fill ${ax+13} ${G+12} ${az-1} ${ax+18} ${G+12} ${az+1} quartz_block`);
  cmds.push(`fill ${ax+13} ${G+13} ${az-2} ${ax+18} ${G+13} ${az-2} oak_fence`);
  cmds.push(`fill ${ax+13} ${G+13} ${az+2} ${ax+18} ${G+13} ${az+2} oak_fence`);

  // Staircase (ascending west toward entrance bridge — x=-25→-36, y=4→15)
  for (let step = 0; step < 12; step++) {
    const sx = ax + 30 - step;
    cmds.push(`fill ${sx} ${Y+step} ${az-1} ${sx} ${Y+step} ${az+1} quartz_stairs[facing=west]`);
    if (step > 0) cmds.push(`fill ${sx} ${Y} ${az-1} ${sx} ${Y+step-1} ${az+1} quartz_block`);
  }

  // Lighting
  for (let lz = -10; lz <= 10; lz += 5) {
    cmds.push(`setblock ${ax-12} ${G+10} ${az+lz} sea_lantern`);
    cmds.push(`setblock ${ax+12} ${G+10} ${az+lz} sea_lantern`);
  }
  for (let lx = -10; lx <= 10; lx += 5) {
    cmds.push(`setblock ${ax+lx} ${G+10} ${az-12} sea_lantern`);
    cmds.push(`setblock ${ax+lx} ${G+10} ${az+12} sea_lantern`);
  }

  // Glass roof
  cmds.push(`fill ${ax-12} ${Y+17} ${az-12} ${ax+12} ${Y+17} ${az+12} white_stained_glass`);

  // Label
  cmds.push(`setblock ${ax+12} ${G+15} ${az} oak_wall_sign[facing=east]{Text1:'{"text":"SPLEEF ARENA","color":"green","bold":true}',Text2:'{"text":"1v1 Dig Down"}',Text3:'{"text":"Break the snow!"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (clear + TP chain)
  cmds.push(`setblock ${ax+27} ${Y+1} ${az+2} quartz_block`);
  cmds.push(`setblock ${ax+28} ${Y+2} ${az+2} oak_wall_sign[facing=east]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+28} ${Y+1} ${az+2} stone_button[face=wall,facing=east]`);
  cmds.push(...returnButton(ax + 28, Y, az + 2));

  // Timer + equip chain (with snow regen on match end)
  cmds.push(...buildTimerChain(ax - 5, az + 15, 'spleef', ARENA_ITEMS.spleef, SPLEEF_REGEN));

  // ─── Spectator Gallery (wraps all 4 sides of arena) ───
  // Arena walls: x=[-67,-43] z=[-12,12], gallery floor at top snow layer level
  cmds.push(...buildSpectatorGallery(-67, -12, -43, 12, 15, 5));
  // Spleef already has glass walls — no replacement needed, spectators see through them
  // Cut entrance passthrough in gallery east corridor (bridge enters from east)
  cmds.push(`fill -40 16 -1 -40 19 1 air`);
  // Tunnel walls to separate gallery corridor from entrance path
  cmds.push(`fill -42 16 -2 -40 19 -2 glass`);
  cmds.push(`fill -42 16 2 -40 19 2 glass`);
  // Re-add bridge floor through gallery east corridor
  cmds.push(`fill -42 15 -1 -40 15 1 quartz_block`);
  // Return button in gallery (NE corner of north corridor)
  cmds.push(`setblock -41 17 -14 oak_wall_sign[facing=south]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock -41 16 -14 stone_button[face=wall,facing=south]`);
  cmds.push(...returnButton(-41, 15, -14));

  return cmds;
}

// ─── ARCHERY ARENA (north, centered at 0, z=-55) ───────

function buildArcheryArena() {
  const cmds = [];
  const ax = 0, az = -55;

  // Floor
  cmds.push(`fill ${ax-14} ${G} ${az-7} ${ax+14} ${G} ${az+7} stone_bricks`);

  // Walls
  cmds.push(`fill ${ax-14} ${Y} ${az-7} ${ax+14} ${Y+5} ${az-7} stone_bricks`);
  cmds.push(`fill ${ax-14} ${Y} ${az+7} ${ax+14} ${Y+5} ${az+7} stone_bricks`);
  cmds.push(`fill ${ax-14} ${Y} ${az-7} ${ax-14} ${Y+5} ${az+7} stone_bricks`);
  cmds.push(`fill ${ax+14} ${Y} ${az-7} ${ax+14} ${Y+5} ${az+7} stone_bricks`);
  cmds.push(`fill ${ax-13} ${Y} ${az-6} ${ax+13} ${Y+5} ${az+6} air`);

  // Entrance
  cmds.push(`fill ${ax-1} ${Y} ${az+7} ${ax+1} ${Y+3} ${az+7} air`);

  // Cover walls
  for (const px of [-8, -3, 3, 8]) {
    cmds.push(`fill ${ax+px} ${Y} ${az-3} ${ax+px} ${Y+2} ${az-3} stone_bricks`);
    cmds.push(`fill ${ax+px} ${Y} ${az+3} ${ax+px} ${Y+2} ${az+3} stone_bricks`);
  }

  // Center pillars
  cmds.push(`fill ${ax} ${Y} ${az-4} ${ax} ${Y+3} ${az-4} stone_brick_slab`);
  cmds.push(`fill ${ax} ${Y} ${az+4} ${ax} ${Y+3} ${az+4} stone_brick_slab`);

  // Hay bale targets
  cmds.push(`fill ${ax-12} ${Y} ${az-1} ${ax-12} ${Y+2} ${az+1} hay_block`);
  cmds.push(`fill ${ax+12} ${Y} ${az-1} ${ax+12} ${Y+2} ${az+1} hay_block`);
  cmds.push(`setblock ${ax-12} ${Y+1} ${az} red_wool`);
  cmds.push(`setblock ${ax+12} ${Y+1} ${az} red_wool`);

  // Glass ceiling
  cmds.push(`fill ${ax-14} ${Y+6} ${az-7} ${ax+14} ${Y+6} ${az+7} white_stained_glass`);

  // Lighting
  for (const lx of [-12, -6, 0, 6, 12]) {
    cmds.push(`setblock ${ax+lx} ${Y+5} ${az-7} sea_lantern`);
    cmds.push(`setblock ${ax+lx} ${Y+5} ${az+7} sea_lantern`);
  }

  // Label
  cmds.push(`setblock ${ax} ${Y+4} ${az+7} oak_wall_sign[facing=north]{Text1:'{"text":"ARCHERY ARENA","color":"yellow","bold":true}',Text2:'{"text":"1v1 Bow Duel"}',Text3:'{"text":"Take cover & shoot!"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (clear + TP chain)
  cmds.push(`setblock ${ax+3} ${Y+1} ${az+7} quartz_block`);
  cmds.push(`setblock ${ax+3} ${Y+2} ${az+8} oak_wall_sign[facing=south]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+3} ${Y+1} ${az+8} stone_button[face=wall,facing=south]`);
  cmds.push(...returnButton(ax + 3, Y, az + 8));

  // Timer + equip chain
  cmds.push(...buildTimerChain(ax - 5, az - 15, 'archery', ARENA_ITEMS.archery));

  // ─── Spectator Gallery (wraps all 4 sides of arena) ───
  // Arena walls: x=[-14,14] z=[-62,-48], gallery floor at fighter level
  cmds.push(...buildSpectatorGallery(-14, -62, 14, -48, G, 4));
  // Replace arena walls with glass for viewing (y=4 to y=6)
  cmds.push(`fill ${ax-13} ${Y} ${az-7} ${ax+13} ${G+3} ${az-7} glass`);
  cmds.push(`fill ${ax-13} ${Y} ${az+7} ${ax+13} ${G+3} ${az+7} glass`);
  cmds.push(`fill ${ax-14} ${Y} ${az-6} ${ax-14} ${G+3} ${az+6} glass`);
  cmds.push(`fill ${ax+14} ${Y} ${az-6} ${ax+14} ${G+3} ${az+6} glass`);
  // Re-cut arena entrance (glass replacement overwrites it)
  cmds.push(`fill ${ax-1} ${Y} ${az+7} ${ax+1} ${Y+3} ${az+7} air`);
  // Cut entrance passthrough in gallery south corridor
  cmds.push(`fill ${ax-1} ${Y} ${az+8} ${ax+1} ${G+3} ${az+10} air`);
  // Tunnel walls to separate gallery corridor from entrance path
  cmds.push(`fill ${ax-2} ${Y} ${az+8} ${ax-2} ${G+3} ${az+10} glass`);
  cmds.push(`fill ${ax+2} ${Y} ${az+8} ${ax+2} ${G+3} ${az+10} glass`);
  // Return button in gallery (SE corner of south corridor)
  cmds.push(`setblock ${ax+16} ${Y+1} ${az+9} oak_wall_sign[facing=north]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+16} ${Y} ${az+9} stone_button[face=wall,facing=north]`);
  cmds.push(...returnButton(ax + 16, G, az + 9));

  return cmds;
}

// ─── SET SPAWN ──────────────────────────────────────────

function setSpawn() {
  return [
    `setworldspawn ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`,
    `spawnpoint @a ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`,
    `gamerule doImmediateRespawn true`,
    `gamerule keepInventory false`,
    `gamerule showDeathMessages false`,
    `gamerule commandBlockOutput false`,
    `gamerule sendCommandFeedback false`,
  ];
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
