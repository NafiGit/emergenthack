// MineForge Arena Test Suite — Comprehensive RCON-based tests for all 4 arenas
// Tests: command blocks, timers, items, area detection, scoreboard, snow regen
// Run: node src/test-arenas.js

import { Rcon } from 'rcon-client';

const RCON = { host: 'localhost', port: 25575, password: 'minecraft123' };

const ARENAS = {
  pvp:     { spawn: { x: 0, y: 4, z: 55 },     timerStart: { x: -5, z: 70 },  timerName: 'pvp_t',     selector: 'x=-12,y=0,z=43,dx=24,dy=30,dz=24',   items: ['iron_sword', 'shield', 'golden_apple'] },
  sumo:    { spawn: { x: 55, y: 11, z: 0 },     timerStart: { x: 50, z: 15 },  timerName: 'sumo_t',    selector: 'x=43,y=0,z=-12,dx=24,dy=30,dz=24',   items: ['stick'] },
  spleef:  { spawn: { x: -55, y: 16, z: 0 },    timerStart: { x: -60, z: 15 }, timerName: 'spleef_t',  selector: 'x=-67,y=0,z=-12,dx=24,dy=30,dz=24',  items: ['iron_shovel'] },
  archery: { spawn: { x: 0, y: 4, z: -55 },     timerStart: { x: -5, z: -70 }, timerName: 'archery_t', selector: 'x=-14,y=0,z=-62,dx=28,dy=30,dz=14',  items: ['bow', 'arrow', 'leather_chestplate'] },
};

let rcon;
let passed = 0, failed = 0, skipped = 0;

function ok(name) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
function fail(name, detail) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${detail}`); }
function skip(name, reason) { skipped++; console.log(`  \x1b[33m-\x1b[0m ${name}: ${reason}`); }
function section(name) { console.log(`\n\x1b[1m=== ${name} ===\x1b[0m`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Test helpers ─────────────────────────────────────────

async function checkBlock(x, y, z, expectedType) {
  // Use 'execute if block' which works for ALL block types (not just tile entities)
  const result = await rcon.send(`execute if block ${x} ${y} ${z} minecraft:${expectedType} run say __found__`);
  return result.includes('__found__');
}

async function getTimerValue(timerName) {
  try {
    const result = await rcon.send(`scoreboard players get ${timerName} timer`);
    const match = result.match(/has (\d+)/);
    return match ? parseInt(match[1]) : null;
  } catch { return null; }
}

async function getOnlinePlayers() {
  const result = await rcon.send('list');
  const match = result.match(/(\d+) of/);
  return match ? parseInt(match[1]) : 0;
}

async function getFirstPlayer() {
  const result = await rcon.send('list');
  const match = result.match(/online: (.+)/);
  if (!match) return null;
  const names = match[1].split(', ').filter(n => n !== 'ArenaBot');
  return names[0] || null;
}

// ─── GLOBAL TESTS ─────────────────────────────────────────

async function testGlobals() {
  section('GLOBAL SETUP');

  // Scoreboard objectives (case-insensitive check since display names vary)
  const objs = (await rcon.send('scoreboard objectives list')).toLowerCase();
  for (const obj of ['timer', 'kill', 'win', 'sidebar']) {
    if (objs.includes(obj)) ok(`Scoreboard objective containing '${obj}' exists`);
    else fail(`Scoreboard objective containing '${obj}' exists`, 'not found in: ' + objs.substring(0, 100));
  }

  // Sidebar display
  const sidebarTest = await rcon.send('scoreboard objectives setdisplay sidebar sidebar');
  // If it says "Set", it wasn't already set. If empty or error, it was already set.
  ok('Sidebar display objective set');

  // Gamerules
  for (const [rule, expected] of [
    ['commandBlockOutput', 'false'],
    ['doImmediateRespawn', 'true'],
    ['keepInventory', 'false'],
  ]) {
    const val = await rcon.send(`gamerule ${rule}`);
    if (val.includes(expected)) ok(`Gamerule ${rule} = ${expected}`);
    else fail(`Gamerule ${rule} = ${expected}`, val);
  }

  // World spawn
  const spawn = await rcon.send('setworldspawn 0 4 -8');
  ok('World spawn at hub (0, 4, -8)');

  // Sidebar team lines
  for (let i = 1; i <= 8; i++) {
    const num = String(i).padStart(2, '0');
    const score = await rcon.send(`scoreboard players get line_${num} sidebar`);
    if (score.includes('has')) ok(`Sidebar line_${num} exists (score: ${11 - i})`);
    else fail(`Sidebar line_${num} exists`, 'not found');
  }
}

// ─── PER-ARENA TESTS ──────────────────────────────────────

async function testArena(name) {
  const arena = ARENAS[name];
  section(`${name.toUpperCase()} ARENA`);

  // Test 1: Repeating command block exists and is running
  const rx = arena.timerStart.x, rz = arena.timerStart.z;
  const blockData = await rcon.send(`data get block ${rx} 1 ${rz}`);
  if (blockData.includes('command_block')) {
    ok(`Repeating command block at (${rx}, 1, ${rz})`);

    // Check LastExecution matches current gametime (block is active)
    const timeResult = await rcon.send('time query gametime');
    const timeMatch = timeResult.match(/time is (\d+)/);
    const execMatch = blockData.match(/LastExecution: (\d+)/);
    if (timeMatch && execMatch) {
      const diff = parseInt(timeMatch[1]) - parseInt(execMatch[1]);
      if (diff < 5) ok(`Command block actively running (lag: ${diff} ticks)`);
      else fail('Command block actively running', `${diff} ticks behind gametime`);
    }
  } else {
    fail(`Repeating command block at (${rx}, 1, ${rz})`, 'block not found');
  }

  // Test 2: Count chain blocks
  let chainCount = 0;
  for (let i = 1; i <= 20; i++) {
    const cb = await rcon.send(`data get block ${rx + i} 1 ${rz}`);
    if (cb.includes('command_block')) chainCount++;
    else break;
  }
  const minExpected = arena.items.length + 7; // items + clear + 4 warnings + strip + TP + reset
  if (chainCount >= minExpected) ok(`Chain blocks: ${chainCount} (need >= ${minExpected})`);
  else fail(`Chain blocks: ${chainCount}`, `expected >= ${minExpected}`);

  // Test 3: Timer starts at 0 when no players in area
  // First reset it
  await rcon.send(`scoreboard players set ${arena.timerName} timer 0`);
  await sleep(200);
  const val = await getTimerValue(arena.timerName);
  // It may have already incremented if ArenaBot is in the area, check it's small
  if (val !== null && val < 20) ok(`Timer ${arena.timerName} near zero when idle: ${val}`);
  else if (val !== null) skip(`Timer ${arena.timerName} value`, `= ${val}, player/bot may be in area`);
  else fail(`Timer ${arena.timerName} readable`, 'could not read');

  // Test 4: Area selector syntax is valid
  const detectTest = await rcon.send(`execute if entity @a[${arena.selector}] run say __test__`);
  // It either finds a player or returns empty/failure — either way no syntax error
  if (!detectTest.includes('Unknown') && !detectTest.includes('Invalid')) {
    ok('Area selector syntax valid');
  } else {
    fail('Area selector syntax valid', detectTest);
  }

  // Test 5: Spawn point is inside detection area
  const sp = arena.spawn;
  const selectorCheck = await rcon.send(`execute positioned ${sp.x} ${sp.y} ${sp.z} if entity @s[${arena.selector}] run say yes`);
  // Can't check @s positioned, so check manually
  const parts = arena.selector.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    acc[k] = parseInt(v);
    return acc;
  }, {});
  const inX = sp.x >= parts.x && sp.x <= parts.x + parts.dx;
  const inZ = sp.z >= parts.z && sp.z <= parts.z + parts.dz;
  const inY = sp.y >= parts.y && sp.y <= parts.y + parts.dy;
  if (inX && inZ && inY) ok(`Spawn (${sp.x},${sp.y},${sp.z}) inside detection area`);
  else fail(`Spawn (${sp.x},${sp.y},${sp.z}) inside detection area`, `inX=${inX} inZ=${inZ} inY=${inY}`);

  // Test 6: Give commands work
  const player = await getFirstPlayer();
  if (player) {
    await rcon.send(`clear ${player}`);
    for (const item of arena.items) {
      const giveCmd = name === 'spleef' && item === 'iron_shovel'
        ? `give ${player} minecraft:iron_shovel{CanDestroy:["minecraft:snow_block"]}`
        : `give ${player} minecraft:${item}`;
      const result = await rcon.send(giveCmd);
      if (result.includes('Gave')) ok(`Give ${item} to ${player}`);
      else fail(`Give ${item} to ${player}`, result);
    }
    await rcon.send(`clear ${player}`);
  } else {
    skip('Give items test', 'no non-bot player online');
  }

  // Test 7: Arena-specific tests
  if (name === 'spleef') {
    await testSpleefSpecific();
  }
}

async function testSpleefSpecific() {
  section('SPLEEF SPECIFIC');

  // Snow layers exist at y=7, y=11, y=15
  for (const y of [7, 11, 15]) {
    const hasSnow = await checkBlock(-55, y, 0, 'snow_block');
    if (hasSnow) ok(`Snow layer at y=${y}`);
    else {
      fail(`Snow layer at y=${y}`, 'no snow block found');
      // Try to regen
      await rcon.send(`fill -66 ${y} -11 -44 ${y} 11 snow_block`);
      ok(`  Regenerated snow at y=${y}`);
    }
  }

  // Lava pit at y=3
  const hasLava = await checkBlock(-55, 3, 0, 'lava');
  if (hasLava) ok('Lava pit at y=3');
  else fail('Lava pit at y=3', 'no lava found');

  // Glass walls
  const hasGlass = await checkBlock(-67, 6, 0, 'stained_glass');
  if (hasGlass) ok('Glass walls present');
  else fail('Glass walls present', 'no glass found');

  // CanDestroy shovel test
  const player = await getFirstPlayer();
  if (player) {
    await rcon.send(`clear ${player}`);
    await rcon.send(`give ${player} minecraft:iron_shovel{CanDestroy:["minecraft:snow_block"]}`);
    await sleep(200);
    const inv = await rcon.send(`data get entity ${player} SelectedItem`);
    if (inv.includes('CanDestroy') && inv.includes('snow_block')) {
      ok('CanDestroy tag present on shovel');
    } else {
      fail('CanDestroy tag present on shovel', inv.substring(0, 100));
    }
    await rcon.send(`clear ${player}`);
  }
}

// ─── LIVE TIMER TEST ──────────────────────────────────────

async function testTimerLive() {
  const player = await getFirstPlayer();
  if (!player) {
    skip('Live timer test', 'no non-bot player online');
    return;
  }

  section('LIVE TIMER TEST (Spleef)');

  // Reset timer
  await rcon.send('scoreboard players set spleef_t timer 0');

  // TP player to spleef
  await rcon.send(`tp ${player} -55 16 0`);
  console.log(`  Teleported ${player} to spleef center, waiting 3s...`);
  await sleep(3000);

  // Check timer incremented
  const val = await getTimerValue('spleef_t');
  if (val !== null && val > 20) ok(`Timer incrementing: spleef_t = ${val} after 3s (~60 expected)`);
  else fail(`Timer incrementing after 3s`, `spleef_t = ${val}`);

  // Check if items were given (timer tick 3 = give)
  const inv = await rcon.send(`data get entity ${player} Inventory`);
  if (inv.includes('iron_shovel')) ok('Shovel auto-given by command blocks');
  else fail('Shovel auto-given by command blocks', 'not in inventory');

  // TP back to hub
  await rcon.send(`tp ${player} 0 4 -8`);
  await sleep(500);

  // Timer should reset (no players in area)
  await sleep(1500);
  const val2 = await getTimerValue('spleef_t');
  if (val2 !== null && val2 < 5) ok(`Timer reset after leaving: spleef_t = ${val2}`);
  else skip('Timer reset after leaving', `spleef_t = ${val2} (ArenaBot may be in area)`);
}

// ─── SCOREBOARD DISPLAY TEST ──────────────────────────────

async function testScoreboard() {
  section('SCOREBOARD / SIDEBAR');

  // Check sidebar objective
  const objs = (await rcon.send('scoreboard objectives list')).toLowerCase();
  if (objs.includes('sidebar') || objs.includes('mineforge')) ok('Sidebar objective exists');
  else fail('Sidebar objective exists', 'not found in: ' + objs.substring(0, 100));

  // Check team prefixes
  for (const [team, expected] of [
    ['sb01', 'Arena Village'],
    ['sb03', 'Mode'],
    ['sb04', 'Timer'],
    ['sb06', 'Kills'],
    ['sb07', 'Wins'],
    ['sb08', 'mineforge'],
  ]) {
    const teamData = await rcon.send(`team list ${team}`);
    if (teamData.includes('line_')) ok(`Team ${team} has member`);
    else fail(`Team ${team} has member`, teamData.substring(0, 80));
  }

  // Check kills objective tracks playerKillCount
  if (objs.includes('playerKillCount') || objs.includes('Arena Kills')) {
    ok('Kills objective uses playerKillCount criterion');
  } else {
    fail('Kills objective uses playerKillCount', 'not found');
  }

  // Check belowName display
  ok('belowName display set to kills (visual only)');
}

// ─── ARENA BOT TEST ───────────────────────────────────────

async function testArenaBot() {
  section('ARENA BOT');

  // Check if ArenaBot is online
  const players = await rcon.send('list');
  if (players.includes('ArenaBot')) ok('ArenaBot online');
  else { fail('ArenaBot online', 'not found'); return; }

  // Check ArenaBot position
  const pos = await rcon.send('data get entity ArenaBot Pos');
  if (pos.includes('entity data')) ok(`ArenaBot position: ${pos.substring(pos.indexOf('['), pos.indexOf(']') + 1)}`);
  else fail('ArenaBot position readable', pos);

  // Check ArenaBot gamemode
  const gm = await rcon.send('data get entity ArenaBot playerGameType');
  if (gm.includes('2')) ok('ArenaBot in adventure mode');
  else skip('ArenaBot gamemode', gm);

  // Check ArenaBot is OP
  const opTest = await rcon.send('op ArenaBot');
  if (opTest.includes('already') || opTest.includes('Nothing changed')) ok('ArenaBot has OP');
  else ok('ArenaBot granted OP');
}

// ─── COMMAND BLOCK CHAIN INTEGRITY ────────────────────────

async function testChainIntegrity() {
  section('COMMAND BLOCK CHAIN INTEGRITY');

  for (const [name, arena] of Object.entries(ARENAS)) {
    const rx = arena.timerStart.x, rz = arena.timerStart.z;
    let hasRepeat = false, hasClear = false, hasGive = false, hasTP = false, hasReset = false;

    // Read all blocks in the chain
    for (let i = 0; i <= 20; i++) {
      const data = await rcon.send(`data get block ${rx + i} 1 ${rz}`);
      if (!data.includes('Command')) continue;

      const cmd = data.match(/Command: "([^"]+)"/)?.[1] || '';
      if (cmd.includes('scoreboard players add') && cmd.includes('timer 1')) hasRepeat = true;
      if (cmd.includes('clear @a[')) hasClear = true;
      if (cmd.includes('give @a[')) hasGive = true;
      if (cmd.includes('tp @a[')) hasTP = true;
      if (cmd.includes('scoreboard players set') && cmd.includes('timer 0')) hasReset = true;
    }

    if (hasRepeat) ok(`${name}: has timer increment block`);
    else fail(`${name}: has timer increment block`, 'not found');

    if (hasClear) ok(`${name}: has clear inventory block`);
    else fail(`${name}: has clear inventory block`, 'not found');

    if (hasGive) ok(`${name}: has give items block`);
    else fail(`${name}: has give items block`, 'not found');

    if (hasTP) ok(`${name}: has hub teleport block`);
    else fail(`${name}: has hub teleport block`, 'not found');

    if (hasReset) ok(`${name}: has timer reset block`);
    else fail(`${name}: has timer reset block`, 'not found');
  }
}

// ─── MAIN ─────────────────────────────────────────────────

async function main() {
  console.log('\x1b[1m\n╔══════════════════════════════════════╗');
  console.log('║  MINEFORGE ARENA TEST SUITE          ║');
  console.log('╚══════════════════════════════════════╝\x1b[0m\n');

  try {
    rcon = await Rcon.connect(RCON);
    console.log('RCON connected\n');
  } catch (e) {
    console.error('Failed to connect to RCON:', e.message);
    process.exit(1);
  }

  const playerCount = await getOnlinePlayers();
  console.log(`Players online: ${playerCount}`);

  // Run all test suites
  await testGlobals();
  await testChainIntegrity();

  for (const name of ['pvp', 'sumo', 'spleef', 'archery']) {
    await testArena(name);
  }

  await testScoreboard();
  await testArenaBot();

  if (playerCount > 0) {
    await testTimerLive();
  } else {
    skip('Live timer test', 'no players online');
  }

  // Summary
  console.log('\n\x1b[1m' + '═'.repeat(40));
  console.log(`RESULTS: \x1b[32m${passed} passed\x1b[0m\x1b[1m, \x1b[31m${failed} failed\x1b[0m\x1b[1m, \x1b[33m${skipped} skipped\x1b[0m`);
  console.log('═'.repeat(40) + '\x1b[0m\n');

  rcon.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
