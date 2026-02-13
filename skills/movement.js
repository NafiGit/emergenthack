// SKILL: Movement & Navigation
// Basic bot movement without LLM — pathfinding, follow, patrol, wander, guard

import pathfinderPlugin from 'mineflayer-pathfinder';
const { Movements, goals } = pathfinderPlugin;
import minecraftData from 'minecraft-data';

/**
 * Move bot to exact coordinates using pathfinding.
 */
export function moveTo(bot, x, y, z, reach = 1) {
  const mcData = minecraftData(bot.version);
  const movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);
  bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, reach));
}

/**
 * Follow a player continuously. Returns an interval ID to stop later.
 */
export function follow(bot, playerName, distance = 3, updateInterval = 500) {
  const interval = setInterval(() => {
    const target = bot.players[playerName]?.entity;
    if (!target) return;

    const dist = bot.entity.position.distanceTo(target.position);
    if (dist > distance) {
      const mcData = minecraftData(bot.version);
      const movements = new Movements(bot, mcData);
      bot.pathfinder.setMovements(movements);
      bot.pathfinder.setGoal(new goals.GoalFollow(target, distance), true);
    }
  }, updateInterval);

  return interval;
}

/**
 * Come to a player once (not continuous).
 */
export function come(bot, playerName) {
  const target = bot.players[playerName]?.entity;
  if (!target) return false;

  const pos = target.position;
  moveTo(bot, pos.x, pos.y, pos.z, 2);
  return true;
}

/**
 * Patrol between waypoints in a loop. Returns interval ID.
 */
export function patrol(bot, points, checkInterval = 2000) {
  let currentIndex = 0;

  moveTo(bot, points[0].x, points[0].y, points[0].z);

  const interval = setInterval(() => {
    if (!bot.pathfinder.isMoving()) {
      currentIndex = (currentIndex + 1) % points.length;
      const next = points[currentIndex];
      moveTo(bot, next.x, next.y, next.z);
    }
  }, checkInterval);

  return interval;
}

/**
 * Guard a specific position.
 */
export function guard(bot, x, y, z) {
  moveTo(bot, x, y, z, 1);
}

/**
 * Wander randomly within a radius. Returns interval ID.
 */
export function wander(bot, radius = 10, interval = 3000) {
  const origin = bot.entity.position.clone();

  const id = setInterval(() => {
    if (!bot.pathfinder.isMoving()) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const x = origin.x + Math.cos(angle) * dist;
      const z = origin.z + Math.sin(angle) * dist;
      moveTo(bot, x, origin.y, z, 2);
    }
  }, interval);

  return id;
}

/**
 * Explore in a cardinal direction by a set distance.
 */
export function explore(bot, direction, distance = 10) {
  const directions = {
    north: { x: 0, z: -distance },
    south: { x: 0, z: distance },
    east: { x: distance, z: 0 },
    west: { x: -distance, z: 0 },
  };
  const dir = directions[direction] || directions.north;
  const pos = bot.entity.position;
  moveTo(bot, pos.x + dir.x, pos.y, pos.z + dir.z);
}

/**
 * Stop all movement and pathfinding.
 */
export function stop(bot) {
  bot.pathfinder.setGoal(null);
  bot.setControlState('forward', false);
  bot.setControlState('back', false);
  bot.setControlState('left', false);
  bot.setControlState('right', false);
  bot.setControlState('jump', false);
  bot.setControlState('sprint', false);
}

/**
 * Look at specific coordinates.
 */
export async function lookAt(bot, x, y, z) {
  const { Vec3 } = (await import('vec3')).default || await import('vec3');
  await bot.lookAt(new Vec3(x, y, z));
}

/**
 * Jump once.
 */
export function jump(bot) {
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 500);
}
