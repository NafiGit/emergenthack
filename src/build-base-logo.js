// Build huge BASE logo in blue & white at a new area (500, 76, 500)
// Connects to existing server, builds the logo, teleports agents there
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
  console.log('Architect spawned! Building huge BASE logo...\n');
  await new Promise(r => setTimeout(r, 2000));

  bot.chat('/tp @s 500 80 510');
  await new Promise(r => setTimeout(r, 1500));
  bot.chat('/gamemode creative @s');
  await new Promise(r => setTimeout(r, 500));

  // Letters: 15 wide, 20 tall (y=77-96), 3 deep (z=490-492), stroke=3
  // B at x=463, A at x=482, S at x=501, E at x=520
  // Gap between letters: 4 blocks

  const cmds = [
    // === CLEAR BUILD AREA (split to stay under 32768 block limit) ===
    '/fill 450 77 470 499 105 497 air',
    '/fill 450 77 498 499 105 525 air',
    '/fill 500 77 470 550 105 497 air',
    '/fill 500 77 498 550 105 525 air',

    // === GROUND PLATFORM (white concrete) ===
    '/fill 450 75 470 550 76 525 white_concrete',

    // === BLUE CONCRETE BORDER ===
    '/fill 450 76 470 550 76 470 blue_concrete',
    '/fill 450 76 525 550 76 525 blue_concrete',
    '/fill 450 76 470 450 76 525 blue_concrete',
    '/fill 550 76 470 550 76 525 blue_concrete',
    // Inner accent border
    '/fill 452 76 472 548 76 472 light_blue_concrete',
    '/fill 452 76 523 548 76 523 light_blue_concrete',
    '/fill 452 76 472 452 76 523 light_blue_concrete',
    '/fill 548 76 472 548 76 523 light_blue_concrete',

    // === PRISMARINE BASE UNDER LETTERS ===
    '/fill 460 76 488 537 76 494 prismarine',

    // ============================================
    // === LETTER B (x=463-477, y=77-96, z=490-492) ===
    // ============================================
    '/fill 463 77 490 465 96 492 blue_concrete',   // left pillar
    '/fill 463 94 490 477 96 492 blue_concrete',   // top bar
    '/fill 463 85 490 477 87 492 blue_concrete',   // middle bar
    '/fill 463 77 490 477 79 492 blue_concrete',   // bottom bar
    '/fill 475 88 490 477 93 492 blue_concrete',   // right upper curve
    '/fill 475 80 490 477 84 492 blue_concrete',   // right lower curve

    // ============================================
    // === LETTER A (x=482-496, y=77-96, z=490-492) ===
    // ============================================
    '/fill 482 77 490 484 96 492 blue_concrete',   // left pillar
    '/fill 494 77 490 496 96 492 blue_concrete',   // right pillar
    '/fill 482 94 490 496 96 492 blue_concrete',   // top bar
    '/fill 482 85 490 496 87 492 blue_concrete',   // middle crossbar

    // ============================================
    // === LETTER S (x=501-515, y=77-96, z=490-492) ===
    // ============================================
    '/fill 501 94 490 515 96 492 blue_concrete',   // top bar
    '/fill 501 85 490 515 87 492 blue_concrete',   // middle bar
    '/fill 501 77 490 515 79 492 blue_concrete',   // bottom bar
    '/fill 501 88 490 503 93 492 blue_concrete',   // left upper
    '/fill 513 80 490 515 84 492 blue_concrete',   // right lower

    // ============================================
    // === LETTER E (x=520-534, y=77-96, z=490-492) ===
    // ============================================
    '/fill 520 77 490 522 96 492 blue_concrete',   // left pillar
    '/fill 520 94 490 534 96 492 blue_concrete',   // top bar
    '/fill 520 85 490 534 87 492 blue_concrete',   // middle bar
    '/fill 520 77 490 534 79 492 blue_concrete',   // bottom bar

    // ============================================
    // === SEA LANTERN TOPS ON EACH LETTER ===
    // ============================================
    '/setblock 470 97 491 sea_lantern',
    '/setblock 489 97 491 sea_lantern',
    '/setblock 508 97 491 sea_lantern',
    '/setblock 527 97 491 sea_lantern',

    // === VIEWING PLAZA (south of letters) ===
    '/fill 458 76 500 542 76 520 smooth_quartz',
    '/fill 458 76 500 542 76 500 blue_concrete',

    // === CORNER BEACON PILLARS ===
    '/fill 454 77 474 454 84 474 white_concrete',
    '/setblock 454 85 474 sea_lantern',
    '/fill 546 77 474 546 84 474 white_concrete',
    '/setblock 546 85 474 sea_lantern',
    '/fill 454 77 521 454 84 521 white_concrete',
    '/setblock 454 85 521 sea_lantern',
    '/fill 546 77 521 546 84 521 white_concrete',
    '/setblock 546 85 521 sea_lantern',

    // === BLUE STAINED GLASS ACCENT WALL (behind letters) ===
    '/fill 460 77 487 540 82 487 blue_stained_glass',

    // === AGENT HUB BEHIND LETTERS ===
    // Floor
    '/fill 475 76 475 525 76 487 quartz_block',
    // Back wall
    '/fill 475 77 475 525 84 475 white_concrete',
    '/fill 477 78 476 523 83 476 air',
    // Side walls
    '/fill 475 77 475 475 84 487 white_concrete',
    '/fill 525 77 475 525 84 487 white_concrete',
    // Hollow inside
    '/fill 476 77 476 524 83 486 air',
    // Roof
    '/fill 475 84 475 525 84 487 blue_concrete',
    // Entrance (south side)
    '/fill 495 77 487 505 81 487 air',
    // Windows (blue stained glass)
    '/fill 480 80 475 490 82 475 blue_stained_glass',
    '/fill 510 80 475 520 82 475 blue_stained_glass',
    // Interior sea lanterns
    '/setblock 485 83 481 sea_lantern',
    '/setblock 500 83 481 sea_lantern',
    '/setblock 515 83 481 sea_lantern',

    // === DECORATIVE FOUNTAIN IN PLAZA ===
    '/fill 497 76 510 503 76 516 prismarine',
    '/fill 498 76 511 502 76 515 water',
    '/fill 497 77 510 497 79 510 white_concrete',
    '/fill 503 77 510 503 79 510 white_concrete',
    '/fill 497 77 516 497 79 516 white_concrete',
    '/fill 503 77 516 503 79 516 white_concrete',
    '/setblock 497 80 510 sea_lantern',
    '/setblock 503 80 510 sea_lantern',
    '/setblock 497 80 516 sea_lantern',
    '/setblock 503 80 516 sea_lantern',

    // === LAPIS BLOCK ACCENTS ON GROUND ===
    '/fill 463 76 496 477 76 496 lapis_block',
    '/fill 482 76 496 496 76 496 lapis_block',
    '/fill 501 76 496 515 76 496 lapis_block',
    '/fill 520 76 496 534 76 496 lapis_block',

    // === IRON BAR FENCES ALONG PLAZA EDGE ===
    '/fill 458 77 520 542 78 520 iron_bars',

    // === DAY + CLEAR WEATHER ===
    '/time set day',
    '/weather clear',
  ];

  console.log(`Executing ${cmds.length} build commands...\n`);

  for (let i = 0; i < cmds.length; i++) {
    bot.chat(cmds[i]);
    console.log(`[${i+1}/${cmds.length}] ${cmds[i]}`);
    await new Promise(r => setTimeout(r, 450));
  }

  console.log('\n=== HUGE BASE LOGO BUILT! ===');
  console.log('20-block tall BASE letters in blue_concrete');
  console.log('White concrete platform with prismarine accents');
  console.log('Agent hub, fountain, beacon pillars, glass walls\n');

  // Teleport agents to the new area
  await new Promise(r => setTimeout(r, 1000));
  bot.chat('/tp Saumya 490 77 505');
  await new Promise(r => setTimeout(r, 500));
  bot.chat('/tp Sumedha 500 77 505');
  await new Promise(r => setTimeout(r, 500));
  bot.chat('/tp Ahaan 510 77 505');
  await new Promise(r => setTimeout(r, 500));

  // Teleport player to viewing spot
  bot.chat('/tp @a 500 77 518');

  console.log('All agents teleported to BASE logo area!');
  console.log('You are at the viewing plaza facing the logo.');
  console.log('\nCtrl+C to disconnect builder.\n');
});

process.on('SIGINT', () => {
  bot.quit();
  setTimeout(() => process.exit(0), 500);
});
