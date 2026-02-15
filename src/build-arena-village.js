// Arena Village — 4 mini-game arenas for 1v1 battles
// Built at spawn (0, 0) so players see it immediately on join
// Uses RCON (server console) — no OP needed
// Arenas: Classic PvP, Sumo, Spleef, Archery
import { Rcon } from 'rcon-client';

const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASS = 'minecraft123';

// Ground level for superflat (player spawns at y~3.77, ground block at y=3)
const G = 3; // grass_block level
const Y = G + 1; // floor build level (one above grass)

async function main() {
  console.log('Connecting to server via RCON...');
  const rcon = await Rcon.connect({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASS });
  console.log('Connected!\n');

  console.log('=== BUILDING ARENA VILLAGE ===\n');

  console.log('[1/6] Clearing build area...');
  await runCmds(rcon, clearArea());

  console.log('[2/6] Building Central Hub...');
  await runCmds(rcon, buildHub());

  console.log('[3/6] Building PvP Arena (south)...');
  await runCmds(rcon, buildPvPArena());

  console.log('[4/6] Building Sumo Arena (east)...');
  await runCmds(rcon, buildSumoArena());

  console.log('[5/6] Building Spleef Arena (west)...');
  await runCmds(rcon, buildSpleefArena());

  console.log('[6/6] Building Archery Arena (north)...');
  await runCmds(rcon, buildArcheryArena());

  // Set day and clear weather
  await rcon.send('time set day');
  await rcon.send('weather clear');

  console.log('\n=== ARENA VILLAGE COMPLETE! ===');
  console.log('Central Hub at spawn (0, 0)');
  console.log('PvP Arena: south | Sumo: east | Spleef: west | Archery: north');
  console.log('\nTeleport there with: /tp @s 0 6 0');

  rcon.end();
}

// ─── Helpers ────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runCmds(rcon, cmds) {
  for (let i = 0; i < cmds.length; i++) {
    // RCON commands don't need the leading /
    const cmd = cmds[i].startsWith('/') ? cmds[i].slice(1) : cmds[i];
    try {
      await rcon.send(cmd);
    } catch (e) {
      console.error(`  Failed: ${cmd} — ${e.message}`);
    }
    await sleep(100);
  }
}

// ─── CLEAR AREA ─────────────────────────────────────────

function clearArea() {
  const cmds = [];
  for (const [x1, z1, x2, z2] of [[-80, -80, 0, 0], [1, -80, 80, 0], [-80, 1, 0, 80], [1, 1, 80, 80]]) {
    cmds.push(`/fill ${x1} ${Y} ${z1} ${x2} ${Y + 25} ${z2} air`);
  }
  return cmds;
}

// ─── CENTRAL HUB ────────────────────────────────────────

function buildHub() {
  const cmds = [];
  const cx = 0, cz = 0;

  // Main platform (concentric rings)
  cmds.push(`/fill ${cx-12} ${G} ${cz-12} ${cx+12} ${G} ${cz+12} white_concrete`);
  cmds.push(`/fill ${cx-10} ${G} ${cz-10} ${cx+10} ${G} ${cz+10} light_blue_concrete`);
  cmds.push(`/fill ${cx-8} ${G} ${cz-8} ${cx+8} ${G} ${cz+8} white_concrete`);
  cmds.push(`/fill ${cx-6} ${G} ${cz-6} ${cx+6} ${G} ${cz+6} blue_concrete`);

  // Border ring
  cmds.push(`/fill ${cx-12} ${Y} ${cz-12} ${cx+12} ${Y} ${cz-12} blue_concrete`);
  cmds.push(`/fill ${cx-12} ${Y} ${cz+12} ${cx+12} ${Y} ${cz+12} blue_concrete`);
  cmds.push(`/fill ${cx-12} ${Y} ${cz-12} ${cx-12} ${Y} ${cz+12} blue_concrete`);
  cmds.push(`/fill ${cx+12} ${Y} ${cz-12} ${cx+12} ${Y} ${cz+12} blue_concrete`);

  // Center fountain
  cmds.push(`/fill ${cx-2} ${G} ${cz-2} ${cx+2} ${G} ${cz+2} quartz_block`);
  cmds.push(`/fill ${cx-1} ${G} ${cz-1} ${cx+1} ${G} ${cz+1} water`);
  cmds.push(`/fill ${cx-2} ${Y} ${cz-2} ${cx-2} ${Y+1} ${cz+2} quartz_block`);
  cmds.push(`/fill ${cx+2} ${Y} ${cz-2} ${cx+2} ${Y+1} ${cz+2} quartz_block`);
  cmds.push(`/fill ${cx-2} ${Y} ${cz-2} ${cx+2} ${Y+1} ${cz-2} quartz_block`);
  cmds.push(`/fill ${cx-2} ${Y} ${cz+2} ${cx+2} ${Y+1} ${cz+2} quartz_block`);
  cmds.push(`/setblock ${cx} ${Y} ${cz} sea_lantern`);

  // Lighting (sea lanterns on fence posts)
  for (const [lx, lz] of [[-10,-10],[10,-10],[-10,10],[10,10],[-6,-6],[6,-6],[-6,6],[6,6]]) {
    cmds.push(`/fill ${cx+lx} ${Y} ${cz+lz} ${cx+lx} ${Y+2} ${cz+lz} oak_fence`);
    cmds.push(`/setblock ${cx+lx} ${Y+3} ${cz+lz} sea_lantern`);
  }

  // South archway (to PvP)
  cmds.push(`/fill ${cx-1} ${Y} ${cz+12} ${cx+1} ${Y+3} ${cz+12} air`);
  cmds.push(`/fill ${cx-2} ${Y} ${cz+12} ${cx-2} ${Y+4} ${cz+12} blue_concrete`);
  cmds.push(`/fill ${cx+2} ${Y} ${cz+12} ${cx+2} ${Y+4} ${cz+12} blue_concrete`);
  cmds.push(`/fill ${cx-2} ${Y+4} ${cz+12} ${cx+2} ${Y+4} ${cz+12} quartz_block`);

  // East archway (to Sumo)
  cmds.push(`/fill ${cx+12} ${Y} ${cz-1} ${cx+12} ${Y+3} ${cz+1} air`);
  cmds.push(`/fill ${cx+12} ${Y} ${cz-2} ${cx+12} ${Y+4} ${cz-2} blue_concrete`);
  cmds.push(`/fill ${cx+12} ${Y} ${cz+2} ${cx+12} ${Y+4} ${cz+2} blue_concrete`);
  cmds.push(`/fill ${cx+12} ${Y+4} ${cz-2} ${cx+12} ${Y+4} ${cz+2} quartz_block`);

  // West archway (to Spleef)
  cmds.push(`/fill ${cx-12} ${Y} ${cz-1} ${cx-12} ${Y+3} ${cz+1} air`);
  cmds.push(`/fill ${cx-12} ${Y} ${cz-2} ${cx-12} ${Y+4} ${cz-2} blue_concrete`);
  cmds.push(`/fill ${cx-12} ${Y} ${cz+2} ${cx-12} ${Y+4} ${cz+2} blue_concrete`);
  cmds.push(`/fill ${cx-12} ${Y+4} ${cz-2} ${cx-12} ${Y+4} ${cz+2} quartz_block`);

  // North archway (to Archery)
  cmds.push(`/fill ${cx-1} ${Y} ${cz-12} ${cx+1} ${Y+3} ${cz-12} air`);
  cmds.push(`/fill ${cx-2} ${Y} ${cz-12} ${cx-2} ${Y+4} ${cz-12} blue_concrete`);
  cmds.push(`/fill ${cx+2} ${Y} ${cz-12} ${cx+2} ${Y+4} ${cz-12} blue_concrete`);
  cmds.push(`/fill ${cx-2} ${Y+4} ${cz-12} ${cx+2} ${Y+4} ${cz-12} quartz_block`);

  // Notice board signs
  cmds.push(`/setblock ${cx-4} ${Y+1} ${cz+10} oak_sign[rotation=8]{Text1:'{"text":"[PvP Arena]","color":"red","bold":true}',Text2:'{"text":"Classic 1v1"}',Text3:'{"text":"Sword Combat"}',Text4:'{"text":">> South >>","color":"gold"}'}`);
  cmds.push(`/setblock ${cx+10} ${Y+1} ${cz-4} oak_sign[rotation=12]{Text1:'{"text":"[Sumo Arena]","color":"blue","bold":true}',Text2:'{"text":"Knockback 1v1"}',Text3:'{"text":"Push to Win"}',Text4:'{"text":">> East >>","color":"gold"}'}`);
  cmds.push(`/setblock ${cx-10} ${Y+1} ${cz+4} oak_sign[rotation=4]{Text1:'{"text":"[Spleef Arena]","color":"green","bold":true}',Text2:'{"text":"Break the Floor"}',Text3:'{"text":"Dont Fall!"}',Text4:'{"text":"<< West <<","color":"gold"}'}`);
  cmds.push(`/setblock ${cx+4} ${Y+1} ${cz-10} oak_sign[rotation=0]{Text1:'{"text":"[Archery Arena]","color":"yellow","bold":true}',Text2:'{"text":"Bow Duel 1v1"}',Text3:'{"text":"Snipe to Win"}',Text4:'{"text":"<< North <<","color":"gold"}'}`);

  // Welcome sign
  cmds.push(`/setblock ${cx} ${Y+2} ${cz+3} oak_sign[rotation=8]{Text1:'{"text":"ARENA VILLAGE","color":"gold","bold":true}',Text2:'{"text":"Choose Your"}',Text3:'{"text":"Battle!"}',Text4:'{"text":"4 Arenas Available","color":"gray"}'}`);

  // Paths to each arena (3-wide gravel)
  cmds.push(`/fill ${cx-1} ${G} ${cz+13} ${cx+1} ${G} ${cz+42} gravel`);
  cmds.push(`/fill ${cx+13} ${G} ${cz-1} ${cx+42} ${G} ${cz+1} gravel`);
  cmds.push(`/fill ${cx-42} ${G} ${cz-1} ${cx-13} ${G} ${cz+1} gravel`);
  cmds.push(`/fill ${cx-1} ${G} ${cz-42} ${cx+1} ${G} ${cz-13} gravel`);

  // Path lamps
  for (let d = 20; d <= 36; d += 8) {
    cmds.push(`/fill ${cx+3} ${Y} ${cz+d} ${cx+3} ${Y+2} ${cz+d} oak_fence`);
    cmds.push(`/setblock ${cx+3} ${Y+3} ${cz+d} sea_lantern`);
    cmds.push(`/fill ${cx+d} ${Y} ${cz+3} ${cx+d} ${Y+2} ${cz+3} oak_fence`);
    cmds.push(`/setblock ${cx+d} ${Y+3} ${cz+3} sea_lantern`);
    cmds.push(`/fill ${cx-d} ${Y} ${cz-3} ${cx-d} ${Y+2} ${cz-3} oak_fence`);
    cmds.push(`/setblock ${cx-d} ${Y+3} ${cz-3} sea_lantern`);
    cmds.push(`/fill ${cx-3} ${Y} ${cz-d} ${cx-3} ${Y+2} ${cz-d} oak_fence`);
    cmds.push(`/setblock ${cx-3} ${Y+3} ${cz-d} sea_lantern`);
  }

  return cmds;
}

// ─── CLASSIC PVP ARENA (south, centered at 0, z=55) ─────

function buildPvPArena() {
  const cmds = [];
  const ax = 0, az = 55;

  cmds.push(`/fill ${ax-12} ${G} ${az-12} ${ax+12} ${G} ${az+12} sand`);

  // Walls
  cmds.push(`/fill ${ax-12} ${Y} ${az-12} ${ax+12} ${Y+5} ${az-12} blue_concrete`);
  cmds.push(`/fill ${ax-12} ${Y} ${az+12} ${ax+12} ${Y+5} ${az+12} blue_concrete`);
  cmds.push(`/fill ${ax-12} ${Y} ${az-12} ${ax-12} ${Y+5} ${az+12} blue_concrete`);
  cmds.push(`/fill ${ax+12} ${Y} ${az-12} ${ax+12} ${Y+5} ${az+12} blue_concrete`);
  cmds.push(`/fill ${ax-11} ${Y} ${az-11} ${ax+11} ${Y+5} ${az+11} air`);

  // Entrance
  cmds.push(`/fill ${ax-1} ${Y} ${az-12} ${ax+1} ${Y+3} ${az-12} air`);

  // Glass ceiling
  cmds.push(`/fill ${ax-12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az+12} white_stained_glass`);

  // Obstacle pillars
  for (const [px, pz] of [[-6,-4],[6,-4],[-6,4],[6,4],[0,0],[-3,8],[3,-8]]) {
    cmds.push(`/fill ${ax+px} ${Y} ${az+pz} ${ax+px+1} ${Y+2} ${az+pz+1} quartz_block`);
  }

  // Spawn platforms with chests
  cmds.push(`/fill ${ax-2} ${G} ${az+9} ${ax+2} ${G} ${az+10} quartz_block`);
  cmds.push(`/setblock ${ax} ${Y} ${az+10} chest{Items:[{Slot:0,id:"minecraft:iron_sword",Count:1},{Slot:1,id:"minecraft:shield",Count:1},{Slot:2,id:"minecraft:golden_apple",Count:3}]}`);
  cmds.push(`/fill ${ax-2} ${G} ${az-9} ${ax+2} ${G} ${az-10} quartz_block`);
  cmds.push(`/setblock ${ax} ${Y} ${az-10} chest{Items:[{Slot:0,id:"minecraft:iron_sword",Count:1},{Slot:1,id:"minecraft:shield",Count:1},{Slot:2,id:"minecraft:golden_apple",Count:3}]}`);

  // Wall top + corners
  cmds.push(`/fill ${ax-12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az-12} blue_concrete`);
  cmds.push(`/fill ${ax-12} ${Y+6} ${az+12} ${ax+12} ${Y+6} ${az+12} blue_concrete`);
  cmds.push(`/fill ${ax-12} ${Y+6} ${az-12} ${ax-12} ${Y+6} ${az+12} blue_concrete`);
  cmds.push(`/fill ${ax+12} ${Y+6} ${az-12} ${ax+12} ${Y+6} ${az+12} blue_concrete`);
  for (const [lx, lz] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
    cmds.push(`/setblock ${ax+lx} ${Y+7} ${az+lz} sea_lantern`);
  }

  // Label
  cmds.push(`/setblock ${ax} ${Y+4} ${az-12} oak_wall_sign[facing=south]{Text1:'{"text":"PVP ARENA","color":"red","bold":true}',Text2:'{"text":"1v1 Sword Combat"}',Text3:'{"text":"Gear up from chests"}',Text4:'{"text":"Last one standing wins!","color":"gold"}'}`);

  return cmds;
}

// ─── SUMO ARENA (east, centered at x=55, z=0) ──────────

function buildSumoArena() {
  const cmds = [];
  const ax = 55, az = 0;

  // Water pool below
  cmds.push(`/fill ${ax-10} ${G-3} ${az-10} ${ax+10} ${G-1} ${az+10} stone`);
  cmds.push(`/fill ${ax-8} ${G-2} ${az-8} ${ax+8} ${G-1} ${az+8} water`);

  const platY = G + 7;
  // Support pillars
  cmds.push(`/fill ${ax-1} ${Y} ${az-1} ${ax+1} ${platY-1} ${az+1} white_concrete`);
  cmds.push(`/fill ${ax-7} ${Y} ${az-1} ${ax-6} ${platY-1} ${az+1} white_concrete`);
  cmds.push(`/fill ${ax+6} ${Y} ${az-1} ${ax+7} ${platY-1} ${az+1} white_concrete`);
  cmds.push(`/fill ${ax-1} ${Y} ${az-7} ${ax+1} ${platY-1} ${az-6} white_concrete`);
  cmds.push(`/fill ${ax-1} ${Y} ${az+6} ${ax+1} ${platY-1} ${az+7} white_concrete`);

  // Circular platform
  cmds.push(`/fill ${ax-7} ${platY} ${az-3} ${ax+7} ${platY} ${az+3} white_concrete`);
  cmds.push(`/fill ${ax-6} ${platY} ${az-5} ${ax+6} ${platY} ${az+5} white_concrete`);
  cmds.push(`/fill ${ax-5} ${platY} ${az-6} ${ax+5} ${platY} ${az+6} white_concrete`);
  cmds.push(`/fill ${ax-3} ${platY} ${az-7} ${ax+3} ${platY} ${az+7} white_concrete`);

  // Center ring
  cmds.push(`/fill ${ax-4} ${platY} ${az-1} ${ax+4} ${platY} ${az+1} light_blue_concrete`);
  cmds.push(`/fill ${ax-1} ${platY} ${az-4} ${ax+1} ${platY} ${az+4} light_blue_concrete`);
  cmds.push(`/fill ${ax-3} ${platY} ${az-3} ${ax+3} ${platY} ${az+3} blue_concrete`);
  cmds.push(`/fill ${ax-1} ${platY} ${az-1} ${ax+1} ${platY} ${az+1} white_concrete`);

  // Spawn torches
  cmds.push(`/setblock ${ax-5} ${platY+1} ${az} torch`);
  cmds.push(`/setblock ${ax+5} ${platY+1} ${az} torch`);

  // Bridge from hub
  cmds.push(`/fill ${ax-15} ${platY} ${az-1} ${ax-8} ${platY} ${az+1} quartz_block`);
  cmds.push(`/fill ${ax-15} ${platY+1} ${az-2} ${ax-8} ${platY+1} ${az-2} oak_fence`);
  cmds.push(`/fill ${ax-15} ${platY+1} ${az+2} ${ax-8} ${platY+1} ${az+2} oak_fence`);

  // Staircase
  for (let step = 0; step < 7; step++) {
    cmds.push(`/fill ${ax-16-step} ${Y+step} ${az-1} ${ax-16-step} ${Y+step} ${az+1} quartz_stairs[facing=east]`);
    cmds.push(`/setblock ${ax-16-step} ${Y+step} ${az-2} quartz_block`);
    cmds.push(`/setblock ${ax-16-step} ${Y+step} ${az+2} quartz_block`);
  }

  // Spectator platforms
  for (const [sx, sz] of [[-9,-9],[9,-9],[-9,9],[9,9]]) {
    cmds.push(`/fill ${ax+sx-1} ${platY+3} ${az+sz-1} ${ax+sx+1} ${platY+3} ${az+sz+1} white_stained_glass`);
    cmds.push(`/fill ${ax+sx} ${Y} ${az+sz} ${ax+sx} ${platY+2} ${az+sz} oak_fence`);
    cmds.push(`/setblock ${ax+sx} ${platY+4} ${az+sz} sea_lantern`);
  }

  // Label
  cmds.push(`/setblock ${ax-16} ${Y+8} ${az} oak_sign[rotation=4]{Text1:'{"text":"SUMO ARENA","color":"blue","bold":true}',Text2:'{"text":"1v1 Knockback"}',Text3:'{"text":"No weapons!"}',Text4:'{"text":"Push them off!","color":"gold"}'}`);

  return cmds;
}

// ─── SPLEEF ARENA (west, centered at x=-55, z=0) ───────

function buildSpleefArena() {
  const cmds = [];
  const ax = -55, az = 0;

  // Glass walls
  cmds.push(`/fill ${ax-12} ${Y} ${az-12} ${ax+12} ${Y+16} ${az-12} white_stained_glass`);
  cmds.push(`/fill ${ax-12} ${Y} ${az+12} ${ax+12} ${Y+16} ${az+12} white_stained_glass`);
  cmds.push(`/fill ${ax-12} ${Y} ${az-12} ${ax-12} ${Y+16} ${az+12} white_stained_glass`);
  cmds.push(`/fill ${ax+12} ${Y} ${az-12} ${ax+12} ${Y+16} ${az+12} white_stained_glass`);

  // Lava pit
  cmds.push(`/fill ${ax-11} ${G} ${az-11} ${ax+11} ${G} ${az+11} lava`);
  cmds.push(`/fill ${ax-11} ${Y} ${az-11} ${ax+11} ${Y+2} ${az+11} air`);

  // Spleef layers
  cmds.push(`/fill ${ax-11} ${G+4} ${az-11} ${ax+11} ${G+4} ${az+11} snow_block`);
  cmds.push(`/fill ${ax-11} ${G+8} ${az-11} ${ax+11} ${G+8} ${az+11} snow_block`);
  cmds.push(`/fill ${ax-11} ${G+12} ${az-11} ${ax+11} ${G+12} ${az+11} snow_block`);

  // Air between layers
  cmds.push(`/fill ${ax-11} ${G+5} ${az-11} ${ax+11} ${G+7} ${az+11} air`);
  cmds.push(`/fill ${ax-11} ${G+9} ${az-11} ${ax+11} ${G+11} ${az+11} air`);
  cmds.push(`/fill ${ax-11} ${G+13} ${az-11} ${ax+11} ${G+15} ${az+11} air`);

  // Entrance at top layer
  cmds.push(`/fill ${ax+12} ${G+12} ${az-1} ${ax+12} ${G+14} ${az+1} air`);
  cmds.push(`/fill ${ax+13} ${G+12} ${az-1} ${ax+18} ${G+12} ${az+1} quartz_block`);
  cmds.push(`/fill ${ax+13} ${G+13} ${az-2} ${ax+18} ${G+13} ${az-2} oak_fence`);
  cmds.push(`/fill ${ax+13} ${G+13} ${az+2} ${ax+18} ${G+13} ${az+2} oak_fence`);

  // Staircase
  for (let step = 0; step < 9; step++) {
    cmds.push(`/fill ${ax+19+step} ${Y+step} ${az-1} ${ax+19+step} ${Y+step} ${az+1} quartz_stairs[facing=west]`);
  }

  // Shovel chests
  cmds.push(`/setblock ${ax-8} ${G+13} ${az-8} chest{Items:[{Slot:0,id:"minecraft:iron_shovel",Count:1}]}`);
  cmds.push(`/setblock ${ax+8} ${G+13} ${az+8} chest{Items:[{Slot:0,id:"minecraft:iron_shovel",Count:1}]}`);

  // Lighting
  for (let lz = -10; lz <= 10; lz += 5) {
    cmds.push(`/setblock ${ax-12} ${G+10} ${az+lz} sea_lantern`);
    cmds.push(`/setblock ${ax+12} ${G+10} ${az+lz} sea_lantern`);
  }
  for (let lx = -10; lx <= 10; lx += 5) {
    cmds.push(`/setblock ${ax+lx} ${G+10} ${az-12} sea_lantern`);
    cmds.push(`/setblock ${ax+lx} ${G+10} ${az+12} sea_lantern`);
  }

  // Glass roof
  cmds.push(`/fill ${ax-12} ${Y+17} ${az-12} ${ax+12} ${Y+17} ${az+12} white_stained_glass`);

  // Label
  cmds.push(`/setblock ${ax+12} ${G+15} ${az} oak_wall_sign[facing=east]{Text1:'{"text":"SPLEEF ARENA","color":"green","bold":true}',Text2:'{"text":"1v1 Dig Down"}',Text3:'{"text":"Break the snow!"}',Text4:'{"text":"Dont fall in lava!","color":"gold"}'}`);

  return cmds;
}

// ─── ARCHERY ARENA (north, centered at 0, z=-55) ───────

function buildArcheryArena() {
  const cmds = [];
  const ax = 0, az = -55;

  cmds.push(`/fill ${ax-14} ${G} ${az-7} ${ax+14} ${G} ${az+7} stone_bricks`);

  // Walls
  cmds.push(`/fill ${ax-14} ${Y} ${az-7} ${ax+14} ${Y+5} ${az-7} stone_bricks`);
  cmds.push(`/fill ${ax-14} ${Y} ${az+7} ${ax+14} ${Y+5} ${az+7} stone_bricks`);
  cmds.push(`/fill ${ax-14} ${Y} ${az-7} ${ax-14} ${Y+5} ${az+7} stone_bricks`);
  cmds.push(`/fill ${ax+14} ${Y} ${az-7} ${ax+14} ${Y+5} ${az+7} stone_bricks`);
  cmds.push(`/fill ${ax-13} ${Y} ${az-6} ${ax+13} ${Y+5} ${az+6} air`);

  // Entrance
  cmds.push(`/fill ${ax-1} ${Y} ${az+7} ${ax+1} ${Y+3} ${az+7} air`);

  // Cover walls
  for (const px of [-8, -3, 3, 8]) {
    cmds.push(`/fill ${ax+px} ${Y} ${az-3} ${ax+px} ${Y+2} ${az-3} stone_bricks`);
    cmds.push(`/fill ${ax+px} ${Y} ${az+3} ${ax+px} ${Y+2} ${az+3} stone_bricks`);
  }

  // Center pillars
  cmds.push(`/fill ${ax} ${Y} ${az-4} ${ax} ${Y+3} ${az-4} stone_brick_slab`);
  cmds.push(`/fill ${ax} ${Y} ${az+4} ${ax} ${Y+3} ${az+4} stone_brick_slab`);

  // Hay bale targets
  cmds.push(`/fill ${ax-12} ${Y} ${az-1} ${ax-12} ${Y+2} ${az+1} hay_block`);
  cmds.push(`/fill ${ax+12} ${Y} ${az-1} ${ax+12} ${Y+2} ${az+1} hay_block`);
  cmds.push(`/setblock ${ax-12} ${Y+1} ${az} red_wool`);
  cmds.push(`/setblock ${ax+12} ${Y+1} ${az} red_wool`);

  // Bow + arrow chests
  cmds.push(`/setblock ${ax-11} ${Y} ${az} chest{Items:[{Slot:0,id:"minecraft:bow",Count:1},{Slot:1,id:"minecraft:arrow",Count:64},{Slot:2,id:"minecraft:leather_chestplate",Count:1}]}`);
  cmds.push(`/setblock ${ax+11} ${Y} ${az} chest{Items:[{Slot:0,id:"minecraft:bow",Count:1},{Slot:1,id:"minecraft:arrow",Count:64},{Slot:2,id:"minecraft:leather_chestplate",Count:1}]}`);

  // Glass ceiling
  cmds.push(`/fill ${ax-14} ${Y+6} ${az-7} ${ax+14} ${Y+6} ${az+7} white_stained_glass`);

  // Lighting
  for (const lx of [-12, -6, 0, 6, 12]) {
    cmds.push(`/setblock ${ax+lx} ${Y+5} ${az-7} sea_lantern`);
    cmds.push(`/setblock ${ax+lx} ${Y+5} ${az+7} sea_lantern`);
  }

  // Label
  cmds.push(`/setblock ${ax} ${Y+4} ${az+7} oak_wall_sign[facing=north]{Text1:'{"text":"ARCHERY ARENA","color":"yellow","bold":true}',Text2:'{"text":"1v1 Bow Duel"}',Text3:'{"text":"Take cover & shoot!"}',Text4:'{"text":"First to 3 kills wins!","color":"gold"}'}`);

  return cmds;
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
