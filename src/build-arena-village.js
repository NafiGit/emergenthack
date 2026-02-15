// MineForge Arena Village — Interactive lobby with button teleporters & timed matches
// Uses RCON (server console) — no OP needed
// Arenas: Classic PvP, Sumo, Spleef, Archery
// Players are in adventure mode — can click buttons but can't break blocks

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

// Arena spawn points (where players teleport to)
const ARENA_SPAWNS = {
  pvp:     { x: 0,   y: Y,       z: 44 },
  sumo:    { x: 44,  y: G + 8,   z: 0 },
  spleef:  { x: -43, y: G + 13,  z: 0 },
  archery: { x: 0,   y: Y,       z: -44 },
};

// Area selectors for detecting players in arenas (x,y,z,dx,dy,dz box)
const ARENA_AREAS = {
  pvp:     { x: -12, y: 0, z: 43,  dx: 24, dy: 30, dz: 24 },
  sumo:    { x: 43,  y: 0, z: -12, dx: 24, dy: 30, dz: 24 },
  spleef:  { x: -67, y: 0, z: -12, dx: 24, dy: 30, dz: 24 },
  archery: { x: -14, y: 0, z: -62, dx: 28, dy: 30, dz: 14 },
};

async function main() {
  console.log('Connecting to server via RCON...');
  const rcon = await Rcon.connect({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASS });
  console.log('Connected!\n');

  console.log('=== BUILDING MINEFORGE ARENA VILLAGE ===\n');

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

  console.log('[8/8] Setting spawn...');
  await runCmds(rcon, setSpawn());

  await rcon.send('time set day');
  await rcon.send('weather clear');

  console.log('\n=== MINEFORGE ARENA VILLAGE COMPLETE! ===');
  console.log(`Spawn: ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`);
  console.log('Mode: Adventure (no block breaking, buttons work)');
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

// Place an impulse command block (button-triggered) with a command
function cmdBlock(x, y, z, command) {
  return `setblock ${x} ${y} ${z} command_block{Command:"${command}"} replace`;
}

// Place a repeating command block (always active)
function repeatBlock(x, y, z, facing, command) {
  return `setblock ${x} ${y} ${z} repeating_command_block[facing=${facing}]{auto:1b,Command:"${command}"} replace`;
}

// Place a chain command block (runs after previous)
function chainBlock(x, y, z, facing, command) {
  return `setblock ${x} ${y} ${z} chain_command_block[facing=${facing}]{auto:1b,Command:"${command}"} replace`;
}

// Area selector string for @a in an arena
function areaSelector(arena) {
  const a = ARENA_AREAS[arena];
  return `x=${a.x},y=${a.y},z=${a.z},dx=${a.dx},dy=${a.dy},dz=${a.dz}`;
}

// Build timer command block chain for an arena
// Places blocks underground at y=1, running east (positive x)
function buildTimerChain(startX, startZ, arenaKey) {
  const cmds = [];
  const timerName = `${arenaKey}_t`;
  const area = areaSelector(arenaKey);
  const hubTP = `${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`;
  const by = 1; // buried y level

  // Clear space for command blocks
  cmds.push(`fill ${startX} ${by} ${startZ} ${startX + 9} ${by} ${startZ} air`);

  // Block 0: Repeating — increment timer when players in area
  cmds.push(repeatBlock(startX, by, startZ, 'east',
    `execute if entity @a[${area}] run scoreboard players add ${timerName} timer 1`));

  // Block 1: Chain — reset timer when NO players in area
  cmds.push(chainBlock(startX + 1, by, startZ, 'east',
    `execute unless entity @a[${area}] run scoreboard players set ${timerName} timer 0`));

  // Block 2: Chain — "1:00 remaining" at 1200 ticks (60s)
  cmds.push(chainBlock(startX + 2, by, startZ, 'east',
    `execute if score ${timerName} timer matches 1200 run title @a[${area}] actionbar {"text":"1:00 remaining","color":"yellow"}`));

  // Block 3: Chain — "30s remaining" at 1800 ticks (90s)
  cmds.push(chainBlock(startX + 3, by, startZ, 'east',
    `execute if score ${timerName} timer matches 1800 run title @a[${area}] actionbar {"text":"0:30 remaining","color":"gold"}`));

  // Block 4: Chain — "10s left!" at 2200 ticks (110s)
  cmds.push(chainBlock(startX + 4, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2200 run title @a[${area}] actionbar {"text":"10 seconds left!","color":"red","bold":true}`));

  // Block 5: Chain — Time's up! title at 2400 ticks (120s)
  cmds.push(chainBlock(startX + 5, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run title @a[${area}] title {"text":"Time's Up!","color":"red","bold":true}`));

  // Block 6: Chain — TP all players back to hub at 2400
  cmds.push(chainBlock(startX + 6, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run tp @a[${area}] ${hubTP}`));

  // Block 7: Chain — reset timer at 2400
  cmds.push(chainBlock(startX + 7, by, startZ, 'east',
    `execute if score ${timerName} timer matches 2400 run scoreboard players set ${timerName} timer 0`));

  return cmds;
}

// ─── CLEAR AREA ─────────────────────────────────────────

function clearArea() {
  const cmds = [];
  // Clear in quadrants to stay under 32768 block limit
  for (const [x1, z1, x2, z2] of [[-80, -80, 0, 0], [1, -80, 80, 0], [-80, 1, 0, 80], [1, 1, 80, 80]]) {
    cmds.push(`fill ${x1} ${Y} ${z1} ${x2} ${Y + 25} ${z2} air`);
  }
  return cmds;
}

// ─── SCOREBOARDS ────────────────────────────────────────

function setupScoreboards() {
  return [
    'scoreboard objectives add timer dummy',
    'scoreboard players set pvp_t timer 0',
    'scoreboard players set sumo_t timer 0',
    'scoreboard players set spleef_t timer 0',
    'scoreboard players set archery_t timer 0',
  ];
}

// ─── CENTRAL HUB ────────────────────────────────────────

function buildHub() {
  const cmds = [];
  const cx = 0, cz = 0;

  // Main platform (concentric rings)
  cmds.push(`fill ${cx-12} ${G} ${cz-12} ${cx+12} ${G} ${cz+12} white_concrete`);
  cmds.push(`fill ${cx-10} ${G} ${cz-10} ${cx+10} ${G} ${cz+10} light_blue_concrete`);
  cmds.push(`fill ${cx-8} ${G} ${cz-8} ${cx+8} ${G} ${cz+8} white_concrete`);
  cmds.push(`fill ${cx-6} ${G} ${cz-6} ${cx+6} ${G} ${cz+6} blue_concrete`);

  // Border ring (low wall)
  cmds.push(`fill ${cx-12} ${Y} ${cz-12} ${cx+12} ${Y} ${cz-12} blue_concrete`);
  cmds.push(`fill ${cx-12} ${Y} ${cz+12} ${cx+12} ${Y} ${cz+12} blue_concrete`);
  cmds.push(`fill ${cx-12} ${Y} ${cz-12} ${cx-12} ${Y} ${cz+12} blue_concrete`);
  cmds.push(`fill ${cx+12} ${Y} ${cz-12} ${cx+12} ${Y} ${cz+12} blue_concrete`);

  // Center pillar (dry — no water!) with MineForge branding
  cmds.push(`fill ${cx-1} ${G} ${cz-1} ${cx+1} ${G} ${cz+1} quartz_block`);
  cmds.push(`fill ${cx} ${Y} ${cz} ${cx} ${Y+5} ${cz} quartz_block`);
  cmds.push(`fill ${cx-1} ${Y+5} ${cz-1} ${cx+1} ${Y+5} ${cz+1} quartz_block`);
  cmds.push(`setblock ${cx} ${Y+6} ${cz} sea_lantern`);

  // MineForge title signs (all 4 faces of pillar)
  cmds.push(`setblock ${cx} ${Y+4} ${cz-1} oak_wall_sign[facing=north]{Text1:'{"text":"MINEFORGE","color":"gold","bold":true}',Text2:'{"text":"Arena Village","color":"white"}',Text3:'{"text":"Click a button","color":"gray"}',Text4:'{"text":"to join a game!","color":"gray"}'}`);
  cmds.push(`setblock ${cx} ${Y+4} ${cz+1} oak_wall_sign[facing=south]{Text1:'{"text":"MINEFORGE","color":"gold","bold":true}',Text2:'{"text":"Arena Village","color":"white"}',Text3:'{"text":"Click a button","color":"gray"}',Text4:'{"text":"to join a game!","color":"gray"}'}`);
  cmds.push(`setblock ${cx+1} ${Y+4} ${cz} oak_wall_sign[facing=east]{Text1:'{"text":"MINEFORGE","color":"gold","bold":true}',Text2:'{"text":"Arena Village","color":"white"}',Text3:'{"text":"4 Arenas","color":"aqua"}',Text4:'{"text":"2 min matches","color":"aqua"}'}`);
  cmds.push(`setblock ${cx-1} ${Y+4} ${cz} oak_wall_sign[facing=west]{Text1:'{"text":"MINEFORGE","color":"gold","bold":true}',Text2:'{"text":"Arena Village","color":"white"}',Text3:'{"text":"4 Arenas","color":"aqua"}',Text4:'{"text":"2 min matches","color":"aqua"}'}`);

  // Lighting (sea lanterns on fence posts)
  for (const [lx, lz] of [[-10,-10],[10,-10],[-10,10],[10,10],[-6,-6],[6,-6],[-6,6],[6,6]]) {
    cmds.push(`fill ${cx+lx} ${Y} ${cz+lz} ${cx+lx} ${Y+2} ${cz+lz} oak_fence`);
    cmds.push(`setblock ${cx+lx} ${Y+3} ${cz+lz} sea_lantern`);
  }

  // ─── Arena Join Booths ───
  // Each booth: quartz pillar + sign + button + buried command block

  // SOUTH booth (PvP) — at (cx-4, cz+8)
  const pvpBooth = { bx: cx - 4, bz: cz + 8 };
  cmds.push(`fill ${pvpBooth.bx} ${Y} ${pvpBooth.bz} ${pvpBooth.bx} ${Y+2} ${pvpBooth.bz} quartz_block`);
  cmds.push(`setblock ${pvpBooth.bx} ${Y+2} ${pvpBooth.bz-1} oak_wall_sign[facing=north]{Text1:'{"text":"[PvP Arena]","color":"red","bold":true}',Text2:'{"text":"Classic 1v1"}',Text3:'{"text":"Sword Combat"}',Text4:'{"text":">> CLICK BUTTON >>","color":"gold"}'}`);
  cmds.push(`setblock ${pvpBooth.bx} ${Y+1} ${pvpBooth.bz-1} stone_button[face=wall,facing=north]`);
  cmds.push(cmdBlock(pvpBooth.bx, Y, pvpBooth.bz - 1,
    `tp @p[distance=..3] ${ARENA_SPAWNS.pvp.x} ${ARENA_SPAWNS.pvp.y} ${ARENA_SPAWNS.pvp.z}`));

  // EAST booth (Sumo) — at (cx+8, cz-4)
  const sumoBooth = { bx: cx + 8, bz: cz - 4 };
  cmds.push(`fill ${sumoBooth.bx} ${Y} ${sumoBooth.bz} ${sumoBooth.bx} ${Y+2} ${sumoBooth.bz} quartz_block`);
  cmds.push(`setblock ${sumoBooth.bx-1} ${Y+2} ${sumoBooth.bz} oak_wall_sign[facing=west]{Text1:'{"text":"[Sumo Arena]","color":"blue","bold":true}',Text2:'{"text":"Knockback 1v1"}',Text3:'{"text":"Push to Win"}',Text4:'{"text":">> CLICK BUTTON >>","color":"gold"}'}`);
  cmds.push(`setblock ${sumoBooth.bx-1} ${Y+1} ${sumoBooth.bz} stone_button[face=wall,facing=west]`);
  cmds.push(cmdBlock(sumoBooth.bx - 1, Y, sumoBooth.bz,
    `tp @p[distance=..3] ${ARENA_SPAWNS.sumo.x} ${ARENA_SPAWNS.sumo.y} ${ARENA_SPAWNS.sumo.z}`));

  // WEST booth (Spleef) — at (cx-8, cz+4)
  const spleefBooth = { bx: cx - 8, bz: cz + 4 };
  cmds.push(`fill ${spleefBooth.bx} ${Y} ${spleefBooth.bz} ${spleefBooth.bx} ${Y+2} ${spleefBooth.bz} quartz_block`);
  cmds.push(`setblock ${spleefBooth.bx+1} ${Y+2} ${spleefBooth.bz} oak_wall_sign[facing=east]{Text1:'{"text":"[Spleef Arena]","color":"green","bold":true}',Text2:'{"text":"Break the Floor"}',Text3:'{"text":"Dont Fall!"}',Text4:'{"text":">> CLICK BUTTON >>","color":"gold"}'}`);
  cmds.push(`setblock ${spleefBooth.bx+1} ${Y+1} ${spleefBooth.bz} stone_button[face=wall,facing=east]`);
  cmds.push(cmdBlock(spleefBooth.bx + 1, Y, spleefBooth.bz,
    `tp @p[distance=..3] ${ARENA_SPAWNS.spleef.x} ${ARENA_SPAWNS.spleef.y} ${ARENA_SPAWNS.spleef.z}`));

  // NORTH booth (Archery) — at (cx+4, cz-8)
  const archBooth = { bx: cx + 4, bz: cz - 8 };
  cmds.push(`fill ${archBooth.bx} ${Y} ${archBooth.bz} ${archBooth.bx} ${Y+2} ${archBooth.bz} quartz_block`);
  cmds.push(`setblock ${archBooth.bx} ${Y+2} ${archBooth.bz+1} oak_wall_sign[facing=south]{Text1:'{"text":"[Archery Arena]","color":"yellow","bold":true}',Text2:'{"text":"Bow Duel 1v1"}',Text3:'{"text":"Snipe to Win"}',Text4:'{"text":">> CLICK BUTTON >>","color":"gold"}'}`);
  cmds.push(`setblock ${archBooth.bx} ${Y+1} ${archBooth.bz+1} stone_button[face=wall,facing=south]`);
  cmds.push(cmdBlock(archBooth.bx, Y, archBooth.bz + 1,
    `tp @p[distance=..3] ${ARENA_SPAWNS.archery.x} ${ARENA_SPAWNS.archery.y} ${ARENA_SPAWNS.archery.z}`));

  // ─── Archways (openings in border wall) ───

  // South archway (to PvP)
  cmds.push(`fill ${cx-1} ${Y} ${cz+12} ${cx+1} ${Y} ${cz+12} air`);
  cmds.push(`fill ${cx-2} ${Y} ${cz+12} ${cx-2} ${Y+4} ${cz+12} blue_concrete`);
  cmds.push(`fill ${cx+2} ${Y} ${cz+12} ${cx+2} ${Y+4} ${cz+12} blue_concrete`);
  cmds.push(`fill ${cx-2} ${Y+4} ${cz+12} ${cx+2} ${Y+4} ${cz+12} quartz_block`);

  // East archway (to Sumo)
  cmds.push(`fill ${cx+12} ${Y} ${cz-1} ${cx+12} ${Y} ${cz+1} air`);
  cmds.push(`fill ${cx+12} ${Y} ${cz-2} ${cx+12} ${Y+4} ${cz-2} blue_concrete`);
  cmds.push(`fill ${cx+12} ${Y} ${cz+2} ${cx+12} ${Y+4} ${cz+2} blue_concrete`);
  cmds.push(`fill ${cx+12} ${Y+4} ${cz-2} ${cx+12} ${Y+4} ${cz+2} quartz_block`);

  // West archway (to Spleef)
  cmds.push(`fill ${cx-12} ${Y} ${cz-1} ${cx-12} ${Y} ${cz+1} air`);
  cmds.push(`fill ${cx-12} ${Y} ${cz-2} ${cx-12} ${Y+4} ${cz-2} blue_concrete`);
  cmds.push(`fill ${cx-12} ${Y} ${cz+2} ${cx-12} ${Y+4} ${cz+2} blue_concrete`);
  cmds.push(`fill ${cx-12} ${Y+4} ${cz-2} ${cx-12} ${Y+4} ${cz+2} quartz_block`);

  // North archway (to Archery)
  cmds.push(`fill ${cx-1} ${Y} ${cz-12} ${cx+1} ${Y} ${cz-12} air`);
  cmds.push(`fill ${cx-2} ${Y} ${cz-12} ${cx-2} ${Y+4} ${cz-12} blue_concrete`);
  cmds.push(`fill ${cx+2} ${Y} ${cz-12} ${cx+2} ${Y+4} ${cz-12} blue_concrete`);
  cmds.push(`fill ${cx-2} ${Y+4} ${cz-12} ${cx+2} ${Y+4} ${cz-12} quartz_block`);

  // Paths to each arena (3-wide gravel)
  cmds.push(`fill ${cx-1} ${G} ${cz+13} ${cx+1} ${G} ${cz+42} gravel`);
  cmds.push(`fill ${cx+13} ${G} ${cz-1} ${cx+42} ${G} ${cz+1} gravel`);
  cmds.push(`fill ${cx-42} ${G} ${cz-1} ${cx-13} ${G} ${cz+1} gravel`);
  cmds.push(`fill ${cx-1} ${G} ${cz-42} ${cx+1} ${G} ${cz-13} gravel`);

  // Path lamps
  for (let d = 20; d <= 36; d += 8) {
    for (const [lx, lz] of [[3, d], [d, 3], [-d, -3], [-3, -d]]) {
      cmds.push(`fill ${cx+lx} ${Y} ${cz+lz} ${cx+lx} ${Y+2} ${cz+lz} oak_fence`);
      cmds.push(`setblock ${cx+lx} ${Y+3} ${cz+lz} sea_lantern`);
    }
  }

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

  // Spawn platforms with chests (iron sword + shield + golden apples)
  cmds.push(`fill ${ax-2} ${G} ${az+9} ${ax+2} ${G} ${az+10} quartz_block`);
  cmds.push(`setblock ${ax} ${Y} ${az+10} chest{Items:[{Slot:0,id:"minecraft:iron_sword",Count:1},{Slot:1,id:"minecraft:shield",Count:1},{Slot:2,id:"minecraft:golden_apple",Count:3}]}`);
  cmds.push(`fill ${ax-2} ${G} ${az-9} ${ax+2} ${G} ${az-10} quartz_block`);
  cmds.push(`setblock ${ax} ${Y} ${az-10} chest{Items:[{Slot:0,id:"minecraft:iron_sword",Count:1},{Slot:1,id:"minecraft:shield",Count:1},{Slot:2,id:"minecraft:golden_apple",Count:3}]}`);

  // Wall top + corner lights
  cmds.push(`fill ${ax-12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az-12} blue_concrete`);
  cmds.push(`fill ${ax-12} ${Y+6} ${az+12} ${ax+12} ${Y+6} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax-12} ${Y+6} ${az-12} ${ax-12} ${Y+6} ${az+12} blue_concrete`);
  cmds.push(`fill ${ax+12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az+12} blue_concrete`);
  for (const [lx, lz] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
    cmds.push(`setblock ${ax+lx} ${Y+7} ${az+lz} sea_lantern`);
  }

  // Label
  cmds.push(`setblock ${ax} ${Y+4} ${az-12} oak_wall_sign[facing=south]{Text1:'{"text":"PVP ARENA","color":"red","bold":true}',Text2:'{"text":"1v1 Sword Combat"}',Text3:'{"text":"Gear up from chests"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (at entrance)
  cmds.push(`setblock ${ax+3} ${Y+1} ${az-12} quartz_block`);
  cmds.push(`setblock ${ax+3} ${Y+2} ${az-13} oak_wall_sign[facing=north]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+3} ${Y+1} ${az-13} stone_button[face=wall,facing=north]`);
  cmds.push(cmdBlock(ax + 3, Y, az - 13,
    `tp @p[distance=..3] ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`));

  // Timer chain (underground at y=1)
  cmds.push(...buildTimerChain(ax - 5, az + 15, 'pvp'));

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

  // Staircase
  for (let step = 0; step < 7; step++) {
    cmds.push(`fill ${ax-16-step} ${Y+step} ${az-1} ${ax-16-step} ${Y+step} ${az+1} quartz_stairs[facing=east]`);
    cmds.push(`setblock ${ax-16-step} ${Y+step} ${az-2} quartz_block`);
    cmds.push(`setblock ${ax-16-step} ${Y+step} ${az+2} quartz_block`);
  }

  // Spectator platforms
  for (const [sx, sz] of [[-9,-9],[9,-9],[-9,9],[9,9]]) {
    cmds.push(`fill ${ax+sx-1} ${platY+3} ${az+sz-1} ${ax+sx+1} ${platY+3} ${az+sz+1} white_stained_glass`);
    cmds.push(`fill ${ax+sx} ${Y} ${az+sz} ${ax+sx} ${platY+2} ${az+sz} oak_fence`);
    cmds.push(`setblock ${ax+sx} ${platY+4} ${az+sz} sea_lantern`);
  }

  // Label
  cmds.push(`setblock ${ax-16} ${Y+8} ${az} oak_sign[rotation=4]{Text1:'{"text":"SUMO ARENA","color":"blue","bold":true}',Text2:'{"text":"1v1 Knockback"}',Text3:'{"text":"No weapons!"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (at base of stairs)
  cmds.push(`setblock ${ax-22} ${Y+1} ${az-2} quartz_block`);
  cmds.push(`setblock ${ax-23} ${Y+2} ${az-2} oak_wall_sign[facing=west]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax-23} ${Y+1} ${az-2} stone_button[face=wall,facing=west]`);
  cmds.push(cmdBlock(ax - 23, Y, az - 2,
    `tp @p[distance=..3] ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`));

  // Timer chain
  cmds.push(...buildTimerChain(ax - 5, az + 15, 'sumo'));

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

  // Staircase
  for (let step = 0; step < 9; step++) {
    cmds.push(`fill ${ax+19+step} ${Y+step} ${az-1} ${ax+19+step} ${Y+step} ${az+1} quartz_stairs[facing=west]`);
  }

  // Shovel chests (with CanDestroy tag for adventure mode!)
  cmds.push(`setblock ${ax-8} ${G+13} ${az-8} chest{Items:[{Slot:0,id:"minecraft:iron_shovel",Count:1b,tag:{CanDestroy:["minecraft:snow_block"]}}]}`);
  cmds.push(`setblock ${ax+8} ${G+13} ${az+8} chest{Items:[{Slot:0,id:"minecraft:iron_shovel",Count:1b,tag:{CanDestroy:["minecraft:snow_block"]}}]}`);

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

  // Return to Hub button (at base of stairs)
  cmds.push(`setblock ${ax+27} ${Y+1} ${az+2} quartz_block`);
  cmds.push(`setblock ${ax+28} ${Y+2} ${az+2} oak_wall_sign[facing=east]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+28} ${Y+1} ${az+2} stone_button[face=wall,facing=east]`);
  cmds.push(cmdBlock(ax + 28, Y, az + 2,
    `tp @p[distance=..3] ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`));

  // Timer chain
  cmds.push(...buildTimerChain(ax - 5, az + 15, 'spleef'));

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

  // Bow + arrow chests
  cmds.push(`setblock ${ax-11} ${Y} ${az} chest{Items:[{Slot:0,id:"minecraft:bow",Count:1},{Slot:1,id:"minecraft:arrow",Count:64},{Slot:2,id:"minecraft:leather_chestplate",Count:1}]}`);
  cmds.push(`setblock ${ax+11} ${Y} ${az} chest{Items:[{Slot:0,id:"minecraft:bow",Count:1},{Slot:1,id:"minecraft:arrow",Count:64},{Slot:2,id:"minecraft:leather_chestplate",Count:1}]}`);

  // Glass ceiling
  cmds.push(`fill ${ax-14} ${Y+6} ${az-7} ${ax+14} ${Y+6} ${az+7} white_stained_glass`);

  // Lighting
  for (const lx of [-12, -6, 0, 6, 12]) {
    cmds.push(`setblock ${ax+lx} ${Y+5} ${az-7} sea_lantern`);
    cmds.push(`setblock ${ax+lx} ${Y+5} ${az+7} sea_lantern`);
  }

  // Label
  cmds.push(`setblock ${ax} ${Y+4} ${az+7} oak_wall_sign[facing=north]{Text1:'{"text":"ARCHERY ARENA","color":"yellow","bold":true}',Text2:'{"text":"1v1 Bow Duel"}',Text3:'{"text":"Take cover & shoot!"}',Text4:'{"text":"2 min match!","color":"gold"}'}`);

  // Return to Hub button (at entrance)
  cmds.push(`setblock ${ax+3} ${Y+1} ${az+7} quartz_block`);
  cmds.push(`setblock ${ax+3} ${Y+2} ${az+8} oak_wall_sign[facing=south]{Text1:'{"text":"[Return]","color":"aqua","bold":true}',Text2:'{"text":"Back to Hub"}',Text3:'{"text":"Click button"}',Text4:'{"text":"below","color":"gray"}'}`);
  cmds.push(`setblock ${ax+3} ${Y+1} ${az+8} stone_button[face=wall,facing=south]`);
  cmds.push(cmdBlock(ax + 3, Y, az + 8,
    `tp @p[distance=..3] ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`));

  // Timer chain
  cmds.push(...buildTimerChain(ax - 5, az - 15, 'archery'));

  return cmds;
}

// ─── SET SPAWN ──────────────────────────────────────────

function setSpawn() {
  return [
    `setworldspawn ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`,
    `spawnpoint @a ${SPAWN.x} ${SPAWN.y} ${SPAWN.z}`,
    `gamerule doImmediateRespawn true`,
    `gamerule keepInventory true`,
    `gamerule showDeathMessages false`,
    `gamerule commandBlockOutput false`,
    `gamerule sendCommandFeedback false`,
  ];
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
