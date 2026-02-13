// SKILL: Mining & Block Breaking
// Basic mining skills — find blocks, dig, break what you're looking at

/**
 * Break the block the bot is currently looking at.
 */
export async function breakBlock(bot) {
  const block = bot.blockAtCursor(5);
  if (!block) return { success: false, message: 'Not looking at a block' };
  if (block.name === 'bedrock' || block.name === 'air') {
    return { success: false, message: 'Cannot break this block' };
  }

  bot.swingArm();
  await bot.dig(block, true);
  return { success: true, block: block.name, position: block.position };
}

/**
 * Find and mine a specific block type within range.
 */
export async function mineBlock(bot, blockName, maxDistance = 32) {
  const block = bot.findBlock({
    matching: (b) => b.name === blockName,
    maxDistance,
  });

  if (!block) return { success: false, message: `Can't find ${blockName}` };

  await bot.dig(block);
  return { success: true, block: blockName, position: block.position };
}

/**
 * Find nearest block of a type.
 */
export function findBlock(bot, blockName, maxDistance = 64) {
  return bot.findBlock({
    matching: (b) => b.name === blockName,
    maxDistance,
  });
}

/**
 * Find multiple blocks of a type.
 */
export function findBlocks(bot, blockName, maxDistance = 64, count = 10) {
  return bot.findBlocks({
    matching: (b) => b.name === blockName,
    maxDistance,
    count,
  });
}

/**
 * Get the block the bot is looking at.
 */
export function getTargetBlock(bot, reach = 5) {
  return bot.blockAtCursor(reach);
}

/**
 * Get block at specific position.
 */
export function getBlockAt(bot, x, y, z) {
  return bot.blockAt(bot.entity.position.offset(
    x - Math.floor(bot.entity.position.x),
    y - Math.floor(bot.entity.position.y),
    z - Math.floor(bot.entity.position.z)
  ));
}

/**
 * Scan nearby blocks and return unique types.
 */
export function scanNearby(bot, radius = 5) {
  const pos = bot.entity.position;
  const blocks = [];

  for (let x = -radius; x <= radius; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -radius; z <= radius; z++) {
        const block = bot.blockAt(pos.offset(x, y, z));
        if (block && block.name !== 'air') {
          blocks.push(block.name);
        }
      }
    }
  }

  return [...new Set(blocks)];
}
