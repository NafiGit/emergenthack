// SKILL: Inventory Management
// Basic inventory skills — equip, eat, drop, list items

/**
 * List all items in inventory.
 */
export function listItems(bot) {
  return bot.inventory.items().map(item => ({
    name: item.name,
    count: item.count,
    slot: item.slot,
  }));
}

/**
 * Get items in hotbar (slots 0-8).
 */
export function getHotbar(bot) {
  const items = [];
  for (let i = 0; i < 9; i++) {
    const slot = 36 + i;
    const item = bot.inventory.slots[slot];
    items.push({
      slot: i,
      item: item ? { name: item.name, count: item.count } : null,
    });
  }
  return items;
}

/**
 * Equip an item from inventory to hand.
 */
export async function equipItem(bot, itemName) {
  const item = bot.inventory.items().find(i => i.name.includes(itemName));
  if (!item) return { success: false, message: `No ${itemName} in inventory` };

  await bot.equip(item, 'hand');
  return { success: true, item: item.name };
}

/**
 * Eat food from a specific hotbar slot.
 */
export async function eat(bot, slot = 0) {
  const hotbarSlot = 36 + slot;
  const item = bot.inventory.slots[hotbarSlot];
  if (!item) return { success: false, message: 'No item in slot' };

  await bot.equip(item, 'hand');
  await bot.consume();
  return { success: true, food: item.name, health: bot.health, hunger: bot.food };
}

/**
 * Drop items from a hotbar slot.
 */
export async function dropItem(bot, slot = 0, count = 1) {
  const hotbarSlot = 36 + slot;
  const item = bot.inventory.slots[hotbarSlot];
  if (!item) return { success: false, message: 'No item in slot' };

  await bot.toss(item.type, null, count);
  return { success: true, dropped: item.name, count };
}

/**
 * Find an item in inventory by name.
 */
export function findItem(bot, itemName) {
  return bot.inventory.items().find(i => i.name.includes(itemName));
}

/**
 * Count how many of an item the bot has.
 */
export function countItem(bot, itemName) {
  return bot.inventory.items()
    .filter(i => i.name.includes(itemName))
    .reduce((sum, i) => sum + i.count, 0);
}

/**
 * Activate/right-click the block or entity bot is looking at.
 */
export async function activate(bot) {
  const block = bot.blockAtCursor(5);
  if (block) {
    await bot.activateBlock(block);
    return { success: true, activated: block.name, type: 'block' };
  }

  const entity = bot.entityAtCursor(5);
  if (entity) {
    await bot.activateEntity(entity);
    return { success: true, activated: entity.name || entity.type, type: 'entity' };
  }

  return { success: false, message: 'Nothing to activate' };
}
