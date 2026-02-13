// Bot Controller - Manages and controls bot players
import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;
import express from 'express';

const app = express();
app.use(express.json());

const bots = new Map();
const BOT_NAMES = ['Agent1', 'Agent2', 'Agent3', 'Agent4', 'Agent5'];
const followTargets = new Map(); // Track who each bot is following
const botModes = new Map(); // Track each bot's current mode
const patrolPoints = new Map(); // Track patrol points for each bot

// Create and manage bots
function createBot(username) {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: username,
    version: '1.19.4'
  });

  bot.loadPlugin(pathfinder);

  bot.on('spawn', () => {
    console.log(`✅ ${username} joined`);
    bot.movements = new Movements(bot);
  });

  bot.on('error', (err) => {
    console.log(`❌ ${username} error:`, err.message);
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

const PORT = 8765;
app.listen(PORT, () => {
  console.log(`🤖 Bot Controller API running on port ${PORT}`);
  console.log(`📡 Endpoints: /bot/move, /bot/follow, /bot/say, /bot/stop, /bot/list`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bots...');
  bots.forEach(bot => bot.quit());
  setTimeout(() => process.exit(0), 1000);
});
