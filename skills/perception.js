// SKILL: Perception & State
// Gather information about the bot, world, and nearby entities

/**
 * Get full bot status.
 */
export function getStatus(bot) {
  const pos = bot.entity.position;
  return {
    name: bot.username,
    position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
    health: bot.health,
    food: bot.food,
    gameMode: bot.game.gameMode,
    isMoving: bot.pathfinder?.isMoving() || false,
    yaw: bot.entity.yaw,
    pitch: bot.entity.pitch,
  };
}

/**
 * Get what the bot is looking at (block or entity).
 */
export function getLookingAt(bot, reach = 5) {
  const block = bot.blockAtCursor(reach);
  if (block && block.name !== 'air') {
    return { type: 'block', name: block.name, position: block.position };
  }

  const entity = bot.entityAtCursor(reach);
  if (entity) {
    return {
      type: 'entity',
      name: entity.name || entity.displayName || entity.type,
      entityType: entity.type,
      position: entity.position,
    };
  }

  return null;
}

/**
 * Scan nearby blocks within a radius.
 */
export function scanBlocks(bot, radius = 5) {
  const pos = bot.entity.position;
  const blocks = new Map();

  for (let x = -radius; x <= radius; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -radius; z <= radius; z++) {
        const block = bot.blockAt(pos.offset(x, y, z));
        if (block && block.name !== 'air') {
          blocks.set(block.name, (blocks.get(block.name) || 0) + 1);
        }
      }
    }
  }

  return Object.fromEntries(blocks);
}

/**
 * Get all nearby entities with distance.
 */
export function getNearbyEntities(bot, maxDistance = 16) {
  return Object.values(bot.entities)
    .filter(e => e !== bot.entity)
    .map(e => ({
      name: e.name || e.displayName || e.type,
      type: e.type,
      distance: bot.entity.position.distanceTo(e.position),
      position: e.position,
    }))
    .filter(e => e.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Get nearby players.
 */
export function getNearbyPlayers(bot) {
  return Object.values(bot.players)
    .filter(p => p.username !== bot.username)
    .map(p => ({
      name: p.username,
      position: p.entity?.position || null,
      ping: p.ping,
    }));
}

/**
 * Get the current time of day as a string.
 */
export function getTimeOfDay(bot) {
  const time = bot.time.timeOfDay;
  if (time < 6000) return 'morning';
  if (time < 12000) return 'afternoon';
  if (time < 18000) return 'evening';
  return 'night';
}

/**
 * Check if it's raining.
 */
export function isRaining(bot) {
  return bot.isRaining;
}

/**
 * Get bot's current biome.
 */
export function getBiome(bot) {
  const pos = bot.entity.position;
  const block = bot.blockAt(pos);
  return block?.biome?.name || 'unknown';
}
