// SKILL: World Control
// Admin/RCON skills — spawn entities, teleport, time, weather, give items

/**
 * Spawn an entity at coordinates.
 */
export function spawnEntity(bot, entity, x, y, z) {
  bot.chat(`/summon minecraft:${entity} ${x} ${y} ${z}`);
}

/**
 * Give items to a player.
 */
export function giveItem(bot, player, item, amount = 1) {
  bot.chat(`/give ${player} minecraft:${item} ${amount}`);
}

/**
 * Teleport a player to coordinates.
 */
export function teleportPlayer(bot, player, x, y, z) {
  bot.chat(`/tp ${player} ${x} ${y} ${z}`);
}

/**
 * Teleport the bot itself to coordinates.
 */
export function teleportSelf(bot, x, y, z) {
  bot.chat(`/tp ${bot.username} ${x} ${y} ${z}`);
}

/**
 * Set the world time.
 * @param {string} time - 'day', 'night', 'noon', 'midnight', or a tick number
 */
export function setTime(bot, time) {
  bot.chat(`/time set ${time}`);
}

/**
 * Set the weather.
 * @param {string} weather - 'clear', 'rain', or 'thunder'
 */
export function setWeather(bot, weather) {
  bot.chat(`/weather ${weather}`);
}

/**
 * Set game mode for a player.
 * @param {string} mode - 'creative', 'survival', 'adventure', 'spectator'
 */
export function setGameMode(bot, player, mode) {
  bot.chat(`/gamemode ${mode} ${player}`);
}

/**
 * Set difficulty.
 * @param {string} difficulty - 'peaceful', 'easy', 'normal', 'hard'
 */
export function setDifficulty(bot, difficulty) {
  bot.chat(`/difficulty ${difficulty}`);
}

/**
 * Execute any arbitrary command.
 */
export function executeCommand(bot, command) {
  const cmd = command.startsWith('/') ? command : `/${command}`;
  bot.chat(cmd);
}

/**
 * Get list of online players.
 */
export function getOnlinePlayers(bot) {
  return Object.values(bot.players).map(p => ({
    name: p.username,
    ping: p.ping,
    position: p.entity?.position || null,
  }));
}

/**
 * Op a player.
 */
export function opPlayer(bot, player) {
  bot.chat(`/op ${player}`);
}

/**
 * Kill an entity or player.
 */
export function killEntity(bot, target) {
  bot.chat(`/kill ${target}`);
}
