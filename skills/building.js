// SKILL: Building & Construction
// Basic building skills — place blocks, build structures via bot or RCON

/**
 * Place a block from hotbar slot against the block bot is looking at.
 */
export async function placeBlock(bot, slot = 0) {
  const referenceBlock = bot.blockAtCursor(5);
  if (!referenceBlock) return { success: false, message: 'Not looking at a block' };

  const hotbarSlot = 36 + slot;
  const item = bot.inventory.slots[hotbarSlot];
  if (!item) return { success: false, message: 'No item in slot' };

  await bot.equip(item, 'hand');
  const { Vec3 } = (await import('vec3')).default || await import('vec3');
  await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
  return { success: true, item: item.name };
}

/**
 * Build a filled wall/region between two points using /fill command.
 */
export function buildWall(bot, x1, y1, z1, x2, y2, z2, block = 'stone') {
  bot.chat(`/fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}`);
}

/**
 * Build a flat floor/platform.
 */
export function buildFloor(bot, x, y, z, width, length, block = 'stone') {
  const x2 = x + width - 1;
  const z2 = z + length - 1;
  bot.chat(`/fill ${x} ${y} ${z} ${x2} ${y} ${z2} ${block}`);
}

/**
 * Build a solid cube.
 */
export function buildCube(bot, x, y, z, size, block = 'stone') {
  const x2 = x + size - 1;
  const y2 = y + size - 1;
  const z2 = z + size - 1;
  bot.chat(`/fill ${x} ${y} ${z} ${x2} ${y2} ${z2} ${block}`);
}

/**
 * Build a hollow cube (walls only, air inside).
 */
export function buildHollowCube(bot, x, y, z, size, block = 'stone') {
  const x2 = x + size - 1;
  const y2 = y + size - 1;
  const z2 = z + size - 1;
  bot.chat(`/fill ${x} ${y} ${z} ${x2} ${y2} ${z2} ${block} hollow`);
}

/**
 * Build a vertical pillar.
 */
export function buildPillar(bot, x, y, z, height, block = 'stone') {
  const y2 = y + height - 1;
  bot.chat(`/fill ${x} ${y} ${z} ${x} ${y2} ${z} ${block}`);
}

/**
 * Build a step pyramid.
 */
export function buildPyramid(bot, x, y, z, baseSize, block = 'sandstone') {
  let currentSize = baseSize;
  let currentY = y;

  while (currentSize > 0) {
    const half = Math.floor(currentSize / 2);
    const x1 = x - half;
    const z1 = z - half;
    const x2 = x + half;
    const z2 = z + half;
    bot.chat(`/fill ${x1} ${currentY} ${z1} ${x2} ${currentY} ${z2} ${block}`);
    currentSize -= 2;
    currentY += 1;
  }
}

/**
 * Clear an area by filling with air.
 */
export function clearArea(bot, x1, y1, z1, x2, y2, z2) {
  bot.chat(`/fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air`);
}

/**
 * Place a single block at exact coordinates via /setblock.
 */
export function setBlock(bot, x, y, z, block) {
  bot.chat(`/setblock ${x} ${y} ${z} ${block}`);
}
