// Bot Controller - Manages and controls bot players
import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;
import express from 'express';
import { Rcon } from 'rcon-client';
import { Vec3 } from 'vec3';
import eventBus from './event_bus.js';

const app = express();
app.use(express.json());

const bots = new Map();
const BOT_NAMES = ['Agent1', 'Agent2', 'Agent3', 'Agent4', 'Agent5'];
const followTargets = new Map(); // Track who each bot is following
const botModes = new Map(); // Track each bot's current mode
const patrolPoints = new Map(); // Track patrol points for each bot
const reconnectAttempts = new Map(); // Track reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000; // 5 seconds

// Create and manage bots
function createBot(username) {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: username,
    version: '1.19.4'
  });

  bot.loadPlugin(pathfinder);

  bot.on('spawn', async () => {
    console.log(`✅ ${username} joined`);
    bot.movements = new Movements(bot);

    // Reset reconnect attempts on successful join
    reconnectAttempts.delete(username);

    // Emit join event
    eventBus.emitAgentJoined(username, bot.entity.position);

    // Give the bot building materials
    const blocks = [
      'stone', 'oak_planks', 'diamond_block', 'gold_block',
      'emerald_block', 'glass', 'quartz_block', 'sandstone'
    ];

    for (const block of blocks) {
      try {
        await executeRCON(`give ${username} ${block} 64`);
      } catch (e) {
        // Ignore errors
      }
    }
    console.log(`📦 ${username} equipped with building materials`);
  });

  bot.on('physicsTick', () => {
    // Update movements
    if (bot.pathfinder) {
      bot.movements = new Movements(bot);
    }
  });

  bot.on('error', (err) => {
    console.log(`❌ ${username} error:`, err.message);
    eventBus.emitAgentError(username, err);
  });

  bot.on('end', (reason) => {
    console.log(`🔌 ${username} disconnected: ${reason}`);
    eventBus.emitAgentLeft(username, reason);

    // Auto-reconnect logic
    const attempts = reconnectAttempts.get(username) || 0;

    if (attempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts.set(username, attempts + 1);
      console.log(`🔄 Attempting to reconnect ${username} (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);

      setTimeout(() => {
        try {
          const newBot = createBot(username);
          bots.set(username, newBot);
          eventBus.emitAgentRejoinRequested(username, reason);
        } catch (e) {
          console.log(`❌ Failed to reconnect ${username}: ${e.message}`);
        }
      }, RECONNECT_DELAY);
    } else {
      console.log(`⚠️  ${username} exceeded max reconnect attempts`);
      reconnectAttempts.delete(username);
    }
  });

  return bot;
}

// Initialize all bots
BOT_NAMES.forEach((name, index) => {
  setTimeout(() => {
    const bot = createBot(name);
    bots.set(name, bot);
  }, index * 1000);
});

// API Endpoints for bot control
app.post('/bot/move', (req, res) => {
  const { bot_name, x, y, z } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const goal = new goals.GoalNear(x, y, z, 1);
    bot.pathfinder.setGoal(goal);
    res.json({ success: true, message: `${bot_name} moving to (${x}, ${y}, ${z})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/follow', (req, res) => {
  const { bot_name, target_name } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const target = bot.players[target_name]?.entity;
    if (!target) {
      return res.status(404).json({ error: 'Target player not found' });
    }

    // Store follow target for continuous following
    followTargets.set(bot_name, target_name);

    // Set initial follow goal
    const goal = new goals.GoalFollow(target, 3);
    bot.pathfinder.setGoal(goal);

    // Continuously update goal as player moves (optimized)
    let lastTargetPos = { ...target.position };

    const followInterval = setInterval(() => {
      if (!followTargets.has(bot_name)) {
        clearInterval(followInterval);
        return;
      }

      const currentTarget = bot.players[target_name]?.entity;
      if (currentTarget) {
        // Only update if player moved significantly (reduce lag)
        const dist = Math.sqrt(
          Math.pow(currentTarget.position.x - lastTargetPos.x, 2) +
          Math.pow(currentTarget.position.z - lastTargetPos.z, 2)
        );

        if (dist > 3) { // Only update if player moved 3+ blocks
          lastTargetPos = { ...currentTarget.position };
          const newGoal = new goals.GoalFollow(currentTarget, 3);
          bot.pathfinder.setGoal(newGoal, true);
        }
      }
    }, 500); // Check twice per second

    // Clean up interval when bot disconnects
    bot.once('end', () => {
      clearInterval(followInterval);
      followTargets.delete(bot_name);
    });

    res.json({ success: true, message: `${bot_name} continuously following ${target_name}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/say', (req, res) => {
  const { bot_name, message } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  bot.chat(message);
  eventBus.emitAgentSpoke(bot_name, message);
  res.json({ success: true, message: `${bot_name} said: ${message}` });
});

app.post('/bot/stop', (req, res) => {
  const { bot_name } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  // Clear all modes and targets
  followTargets.delete(bot_name);
  botModes.delete(bot_name);
  patrolPoints.delete(bot_name);
  bot.pathfinder.setGoal(null);
  res.json({ success: true, message: `${bot_name} stopped` });
});

app.post('/bot/come', (req, res) => {
  const { bot_name, target_name } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const target = bot.players[target_name]?.entity;
    if (!target) {
      return res.status(404).json({ error: 'Target player not found' });
    }

    botModes.set(bot_name, 'come');
    const goal = new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2);
    bot.pathfinder.setGoal(goal);
    res.json({ success: true, message: `${bot_name} coming to ${target_name}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/patrol', (req, res) => {
  const { bot_name, points } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    botModes.set(bot_name, 'patrol');
    patrolPoints.set(bot_name, { points, currentIndex: 0 });

    // Start patrol
    const firstPoint = points[0];
    const goal = new goals.GoalNear(firstPoint.x, firstPoint.y, firstPoint.z, 1);
    bot.pathfinder.setGoal(goal);

    // Set up patrol loop
    const patrolInterval = setInterval(() => {
      if (botModes.get(bot_name) !== 'patrol') {
        clearInterval(patrolInterval);
        return;
      }

      if (!bot.pathfinder.isMoving()) {
        const patrolData = patrolPoints.get(bot_name);
        patrolData.currentIndex = (patrolData.currentIndex + 1) % points.length;
        const nextPoint = points[patrolData.currentIndex];
        const newGoal = new goals.GoalNear(nextPoint.x, nextPoint.y, nextPoint.z, 1);
        bot.pathfinder.setGoal(newGoal);
      }
    }, 2000);

    bot.once('end', () => {
      clearInterval(patrolInterval);
    });

    res.json({ success: true, message: `${bot_name} patrolling ${points.length} points` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/guard', (req, res) => {
  const { bot_name, x, y, z } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    botModes.set(bot_name, 'guard');

    // Move to guard position
    const goal = new goals.GoalNear(x, y, z, 0);
    bot.pathfinder.setGoal(goal);

    // Look around while guarding
    const guardInterval = setInterval(() => {
      if (botModes.get(bot_name) !== 'guard') {
        clearInterval(guardInterval);
        return;
      }

      // Rotate to look around (simple guard behavior)
      // Bot will stay at position but look different directions
    }, 3000);

    bot.once('end', () => {
      clearInterval(guardInterval);
    });

    res.json({ success: true, message: `${bot_name} guarding position (${x}, ${y}, ${z})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/wander', (req, res) => {
  const { bot_name, radius } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    botModes.set(bot_name, 'wander');
    const centerPos = bot.entity.position;

    const wanderInterval = setInterval(() => {
      if (botModes.get(bot_name) !== 'wander') {
        clearInterval(wanderInterval);
        return;
      }

      if (!bot.pathfinder.isMoving()) {
        // Pick random point within radius
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (radius || 10);
        const x = centerPos.x + Math.cos(angle) * distance;
        const z = centerPos.z + Math.sin(angle) * distance;

        const goal = new goals.GoalNear(x, centerPos.y, z, 1);
        bot.pathfinder.setGoal(goal);
      }
    }, 3000);

    bot.once('end', () => {
      clearInterval(wanderInterval);
    });

    res.json({ success: true, message: `${bot_name} wandering within ${radius || 10} blocks` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/bot/list', (req, res) => {
  const botList = Array.from(bots.entries()).map(([name, bot]) => ({
    name,
    position: bot.entity?.position || null,
    health: bot.health
  }));
  res.json({ bots: botList });
});

app.get('/bot/status/:name', (req, res) => {
  const bot = bots.get(req.params.name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  res.json({
    name: req.params.name,
    position: bot.entity?.position,
    health: bot.health,
    food: bot.food,
    isMoving: bot.pathfinder.isMoving()
  });
});

// RCON helper for building
async function executeRCON(command) {
  const rcon = await Rcon.connect({
    host: 'localhost',
    port: 25575,
    password: 'minecraft123'
  });
  const response = await rcon.send(command);
  await rcon.end();
  return response;
}

// Building endpoints
app.post('/bot/build_wall', async (req, res) => {
  const { bot_name, x1, y1, z1, x2, y2, z2, block = 'stone' } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    // Move bot near the build location
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const goal = new goals.GoalNear(centerX, y1, centerZ, 3);
    bot.pathfinder.setGoal(goal);

    // Announce what the bot is building
    bot.chat(`I'm building a wall!`);

    // Wait for bot to get close
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Execute the build via RCON
    const command = `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}`;
    const response = await executeRCON(command);

    bot.chat(`Wall complete!`);
    res.json({ success: true, message: `${bot_name} built a wall`, rcon_response: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/build_floor', async (req, res) => {
  const { bot_name, x, y, z, width, length, block = 'stone' } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    // Move bot to the location
    const goal = new goals.GoalNear(x, y, z, 3);
    bot.pathfinder.setGoal(goal);

    bot.chat(`Building a floor platform!`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calculate floor bounds
    const x1 = Math.floor(x - width / 2);
    const x2 = Math.floor(x + width / 2);
    const z1 = Math.floor(z - length / 2);
    const z2 = Math.floor(z + length / 2);

    const command = `fill ${x1} ${y} ${z1} ${x2} ${y} ${z2} ${block}`;
    const response = await executeRCON(command);

    bot.chat(`Floor is ready!`);
    res.json({ success: true, message: `${bot_name} built a floor`, rcon_response: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/build_cube', async (req, res) => {
  const { bot_name, x, y, z, size, block = 'stone', hollow = false } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const goal = new goals.GoalNear(x, y, z, 3);
    bot.pathfinder.setGoal(goal);

    const buildType = hollow ? 'hollow cube' : 'cube';
    bot.chat(`Building a ${buildType}!`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const half = Math.floor(size / 2);
    const x1 = x - half;
    const x2 = x + half;
    const y1 = y;
    const y2 = y + size - 1;
    const z1 = z - half;
    const z2 = z + half;

    const hollowFlag = hollow ? ' hollow' : '';
    const command = `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}${hollowFlag}`;
    const response = await executeRCON(command);

    bot.chat(`${buildType.charAt(0).toUpperCase() + buildType.slice(1)} complete!`);
    res.json({ success: true, message: `${bot_name} built a ${buildType}`, rcon_response: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/build_pillar', async (req, res) => {
  const { bot_name, x, y_start, z, height, block = 'stone' } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const goal = new goals.GoalNear(x, y_start, z, 2);
    bot.pathfinder.setGoal(goal);

    bot.chat(`Building a pillar!`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const y_end = y_start + height - 1;
    const command = `fill ${x} ${y_start} ${z} ${x} ${y_end} ${z} ${block}`;
    const response = await executeRCON(command);

    bot.chat(`Pillar stands tall!`);
    res.json({ success: true, message: `${bot_name} built a pillar`, rcon_response: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/build_pyramid', async (req, res) => {
  const { bot_name, x, y, z, size, block = 'sandstone' } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const goal = new goals.GoalNear(x, y, z, 3);
    bot.pathfinder.setGoal(goal);

    bot.chat(`Building a pyramid!`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const responses = [];
    for (let level = 0; level < size; level++) {
      const half = Math.floor((size - level) / 2);
      const x1 = x - half;
      const x2 = x + half;
      const z1 = z - half;
      const z2 = z + half;
      const y_level = y + level;

      const command = `fill ${x1} ${y_level} ${z1} ${x2} ${y_level} ${z2} ${block}`;
      const response = await executeRCON(command);
      responses.push(`Level ${level}: ${response}`);

      // Small delay between levels
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    bot.chat(`Pyramid complete!`);
    res.json({ success: true, message: `${bot_name} built a pyramid`, rcon_responses: responses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/bot/clear_area', async (req, res) => {
  const { bot_name, x1, y1, z1, x2, y2, z2 } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const goal = new goals.GoalNear(centerX, y1, centerZ, 3);
    bot.pathfinder.setGoal(goal);

    bot.chat(`Clearing area!`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const command = `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air`;
    const response = await executeRCON(command);

    bot.chat(`Area cleared!`);
    res.json({ success: true, message: `${bot_name} cleared an area`, rcon_response: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual block placement endpoint
app.post('/bot/place_block_manual', async (req, res) => {
  const { bot_name, x, y, z, block } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    bot.chat(`Placing ${block} at ${x}, ${y}, ${z}`);

    // First, give the bot the blocks via RCON
    await executeRCON(`give ${bot_name} ${block} 64`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Move bot near the target position
    const goal = new goals.GoalNear(x, y, z, 4);
    bot.pathfinder.setGoal(goal);

    // Wait for bot to get close
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find the block to place on (reference block)
    const targetBlock = bot.blockAt(new Vec3(x, y, z));
    const referenceBlock = bot.blockAt(new Vec3(x, y - 1, z));

    if (!referenceBlock || referenceBlock.name === 'air') {
      // If there's no block below, place one first
      await executeRCON(`setblock ${x} ${y - 1} ${z} stone`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Equip the block
    const item = bot.inventory.items().find(i => i.name === block);
    if (item) {
      await bot.equip(item, 'hand');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Place the block
      const refBlock = bot.blockAt(new Vec3(x, y - 1, z));
      if (refBlock) {
        await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
        bot.chat(`Placed ${block}!`);
        res.json({ success: true, message: `${bot_name} placed ${block}` });
      } else {
        res.status(500).json({ error: 'Could not find reference block' });
      }
    } else {
      res.status(500).json({ error: 'Bot does not have the block' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Build small structure manually
app.post('/bot/build_manual', async (req, res) => {
  const { bot_name, structure, x, y, z, block = 'stone' } = req.body;
  const bot = bots.get(bot_name);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    bot.chat(`Building ${structure} manually!`);

    // Give the bot plenty of blocks
    await executeRCON(`give ${bot_name} ${block} 64`);
    await executeRCON(`give ${bot_name} ${block} 64`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const blocksPlaced = [];

    if (structure === 'wall') {
      // Build a small 5-block wall
      for (let i = 0; i < 5; i++) {
        const blockX = x + i;

        // Move near the position
        const goal = new goals.GoalNear(blockX, y, z, 3);
        bot.pathfinder.setGoal(goal);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Place foundation if needed
        const groundBlock = bot.blockAt(new Vec3(blockX, y - 1, z));
        if (!groundBlock || groundBlock.name === 'air') {
          await executeRCON(`setblock ${blockX} ${y - 1} ${z} stone`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Equip and place
        const item = bot.inventory.items().find(item => item.name === block);
        if (item) {
          await bot.equip(item, 'hand');
          const refBlock = bot.blockAt(new Vec3(blockX, y - 1, z));
          if (refBlock) {
            await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
            blocksPlaced.push(`(${blockX}, ${y}, ${z})`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } else if (structure === 'tower') {
      // Build a small 5-block tower
      for (let i = 0; i < 5; i++) {
        const blockY = y + i;

        // Move near the position
        const goal = new goals.GoalNear(x, blockY, z, 3);
        bot.pathfinder.setGoal(goal);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Place foundation for first block
        if (i === 0) {
          const groundBlock = bot.blockAt(new Vec3(x, y - 1, z));
          if (!groundBlock || groundBlock.name === 'air') {
            await executeRCON(`setblock ${x} ${y - 1} ${z} stone`);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Equip and place
        const item = bot.inventory.items().find(item => item.name === block);
        if (item) {
          await bot.equip(item, 'hand');
          const refY = i === 0 ? y - 1 : blockY - 1;
          const refBlock = bot.blockAt(new Vec3(x, refY, z));
          if (refBlock) {
            await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
            blocksPlaced.push(`(${x}, ${blockY}, ${z})`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } else if (structure === 'house') {
      // Build a tiny 3x3 house
      const positions = [
        // Floor
        [x-1, y, z-1], [x, y, z-1], [x+1, y, z-1],
        [x-1, y, z], [x, y, z], [x+1, y, z],
        [x-1, y, z+1], [x, y, z+1], [x+1, y, z+1],
        // Walls (corners only for speed)
        [x-1, y+1, z-1], [x+1, y+1, z-1],
        [x-1, y+1, z+1], [x+1, y+1, z+1],
      ];

      for (const [bx, by, bz] of positions) {
        // Move near
        const goal = new goals.GoalNear(bx, by, bz, 3);
        bot.pathfinder.setGoal(goal);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Place foundation if needed
        const groundBlock = bot.blockAt(new Vec3(bx, by - 1, bz));
        if (!groundBlock || groundBlock.name === 'air') {
          await executeRCON(`setblock ${bx} ${by - 1} ${bz} stone`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Equip and place
        const item = bot.inventory.items().find(item => item.name === block);
        if (item) {
          await bot.equip(item, 'hand');
          const refBlock = bot.blockAt(new Vec3(bx, by - 1, bz));
          if (refBlock) {
            try {
              await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
              blocksPlaced.push(`(${bx}, ${by}, ${bz})`);
            } catch (e) {
              // Skip if can't place
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
    }

    bot.chat(`${structure} complete! Placed ${blocksPlaced.length} blocks.`);
    res.json({
      success: true,
      message: `${bot_name} built ${structure} manually`,
      blocks_placed: blocksPlaced.length,
      positions: blocksPlaced
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event Bus API endpoints
app.get('/events/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(eventBus.getRecentEvents(limit));
});

app.get('/events/stats', (req, res) => {
  res.json(eventBus.getStats());
});

app.get('/events/agent/:name', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(eventBus.getEventsByAgent(req.params.name, limit));
});

app.get('/events/type/:type', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(eventBus.getEventsByType(req.params.type, limit));
});

app.post('/events/clear', (req, res) => {
  eventBus.clearLog();
  res.json({ success: true, message: 'Event log cleared' });
});

// Manual rejoin trigger
app.post('/bot/rejoin', (req, res) => {
  const { bot_name } = req.body;

  if (!BOT_NAMES.includes(bot_name)) {
    return res.status(400).json({ error: 'Invalid bot name' });
  }

  try {
    // Disconnect existing bot if present
    const existingBot = bots.get(bot_name);
    if (existingBot) {
      existingBot.quit();
    }

    // Create new bot
    setTimeout(() => {
      const newBot = createBot(bot_name);
      bots.set(bot_name, newBot);
      eventBus.emitAgentRejoinRequested(bot_name, 'manual rejoin');
    }, 1000);

    res.json({ success: true, message: `${bot_name} reconnecting...` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 8765;
app.listen(PORT, () => {
  console.log(`🤖 Bot Controller API running on port ${PORT}`);
  console.log(`📡 Endpoints: /bot/move, /bot/follow, /bot/say, /bot/stop, /bot/list, /bot/build_*, /bot/place_block_manual, /bot/build_manual`);
  console.log(`📊 Event Bus: /events/recent, /events/stats, /events/agent/:name, /events/type/:type`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bots...');
  bots.forEach(bot => bot.quit());
  setTimeout(() => process.exit(0), 1000);
});
