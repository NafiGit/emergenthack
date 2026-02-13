// SKILL: Combat
// Basic combat skills — attack entities, find targets, defend

/**
 * Attack the entity the bot is looking at.
 */
export async function attackTarget(bot) {
  const entity = bot.entityAtCursor(5);
  if (!entity) return { success: false, message: 'Not looking at an entity' };

  bot.swingArm();
  await bot.attack(entity);
  return {
    success: true,
    target: entity.name || entity.displayName || entity.type,
    type: entity.type,
  };
}

/**
 * Attack a specific entity by reference.
 */
export async function attackEntity(bot, entity) {
  bot.swingArm();
  await bot.attack(entity);
}

/**
 * Find nearest entity of a specific type.
 */
export function findNearestEntity(bot, entityType = null, maxDistance = 16) {
  let nearest = null;
  let nearestDist = maxDistance;

  for (const entity of Object.values(bot.entities)) {
    if (entity === bot.entity) continue;
    if (entityType && entity.name !== entityType && entity.type !== entityType) continue;

    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist < nearestDist) {
      nearest = entity;
      nearestDist = dist;
    }
  }

  return nearest;
}

/**
 * Find all nearby hostile mobs.
 */
export function findHostileMobs(bot, maxDistance = 16) {
  const hostiles = [
    'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
    'witch', 'slime', 'phantom', 'drowned', 'husk',
    'stray', 'pillager', 'vindicator', 'ravager',
  ];

  return Object.values(bot.entities).filter(entity => {
    if (entity === bot.entity) return false;
    const dist = bot.entity.position.distanceTo(entity.position);
    return dist <= maxDistance && hostiles.includes(entity.name);
  });
}

/**
 * Find all nearby animals.
 */
export function findAnimals(bot, maxDistance = 16) {
  const animals = [
    'cow', 'pig', 'sheep', 'chicken', 'horse', 'donkey',
    'rabbit', 'fox', 'cat', 'wolf', 'bee', 'goat',
  ];

  return Object.values(bot.entities).filter(entity => {
    if (entity === bot.entity) return false;
    const dist = bot.entity.position.distanceTo(entity.position);
    return dist <= maxDistance && animals.includes(entity.name);
  });
}

/**
 * Get all nearby players.
 */
export function findPlayers(bot, maxDistance = 32) {
  return Object.values(bot.players)
    .filter(p => p.username !== bot.username && p.entity)
    .filter(p => bot.entity.position.distanceTo(p.entity.position) <= maxDistance)
    .map(p => ({
      name: p.username,
      distance: bot.entity.position.distanceTo(p.entity.position),
      position: p.entity.position,
    }));
}

/**
 * Swing arm (visual feedback for attacks/mining).
 */
export function swingArm(bot) {
  bot.swingArm();
}
