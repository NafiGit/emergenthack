// Simple API server to control bots manually
import express from 'express';
import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;
import minecraftData from 'minecraft-data';

// Try to load viewer
let mineflayerViewer = null;
try {
  const viewerModule = await import('prismarine-viewer');
  mineflayerViewer = viewerModule.mineflayer;
  console.log('✅ Viewer module loaded successfully');
} catch (err) {
  console.log('⚠️  Viewer disabled:', err.message);
}

const app = express();
app.use(express.json());
app.use(express.static('src')); // Serve static files from src directory

// Store bot instances
const bots = {};

// Create 3 bots
const AGENTS = ['Vulkan', 'Terra', 'Sage'];

AGENTS.forEach((name, index) => {
  setTimeout(() => createBot(name), index * 3000);
});

function createBot(name) {
  console.log(`🤖 Connecting ${name}...`);

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 55916,
    username: name,
    auth: 'offline',
    version: '1.16.2',
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`✅ ${name} connected at ${bot.entity.position}`);
    bots[name.toLowerCase()] = bot;

    // Attach viewer to each bot on different ports
    if (mineflayerViewer) {
      try {
        const portMap = { 'Vulkan': 3002, 'Terra': 3003, 'Sage': 3004 };
        const port = portMap[name] || 3005;
        mineflayerViewer(bot, { port: port, firstPerson: false });
        console.log(`🎨 ${name}'s View: http://localhost:${port}`);
      } catch (err) {
        console.log(`⚠️  Viewer failed for ${name}:`, err.message);
      }
    }
  });

  bot.on('error', (err) => console.error(`❌ ${name} error:`, err.message));
  bot.on('kicked', (reason) => console.log(`⚠️  ${name} kicked:`, reason));
}

// API Routes

// Get bot status
app.get('/api/:bot/status', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  res.json({
    name: req.params.bot,
    position: bot.entity.position,
    health: bot.health,
    food: bot.food,
    gamemode: bot.game.gameMode,
  });
});

// Move bot to coordinates
app.post('/api/:bot/goto', async (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { x, y, z } = req.body;
  if (x === undefined || y === undefined || z === undefined) {
    return res.status(400).json({ error: 'Missing x, y, or z coordinates' });
  }

  try {
    const mcData = minecraftData(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1));

    res.json({ success: true, message: `${req.params.bot} moving to (${x}, ${y}, ${z})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move bot in direction (relative movement)
app.post('/api/:bot/move', async (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { direction, distance = 10 } = req.body;
  const pos = bot.entity.position;

  const directions = {
    forward: { x: 0, z: -distance },
    back: { x: 0, z: distance },
    left: { x: -distance, z: 0 },
    right: { x: distance, z: 0 },
    up: { x: 0, y: distance, z: 0 },
    down: { x: 0, y: -distance, z: 0 },
  };

  const offset = directions[direction];
  if (!offset) {
    return res.status(400).json({ error: 'Invalid direction. Use: forward, back, left, right, up, down' });
  }

  try {
    const target = pos.offset(offset.x || 0, offset.y || 0, offset.z || 0);
    const mcData = minecraftData(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new goals.GoalNear(target.x, target.y, target.z, 1));

    res.json({ success: true, message: `${req.params.bot} moving ${direction}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Make bot chat
app.post('/api/:bot/chat', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  bot.chat(message);
  res.json({ success: true, message: `${req.params.bot} said: "${message}"` });
});

// Make bot jump
app.post('/api/:bot/jump', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 500);

  res.json({ success: true, message: `${req.params.bot} jumped` });
});

// Look at coordinates
app.post('/api/:bot/look', async (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { x, y, z } = req.body;
  if (x === undefined || y === undefined || z === undefined) {
    return res.status(400).json({ error: 'Missing x, y, or z coordinates' });
  }

  try {
    await bot.lookAt(new bot.vec3(x, y, z));
    res.json({ success: true, message: `${req.params.bot} looking at (${x}, ${y}, ${z})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop movement
app.post('/api/:bot/stop', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  bot.pathfinder.setGoal(null);
  res.json({ success: true, message: `${req.params.bot} stopped` });
});

// List all bots
app.get('/api/bots', (req, res) => {
  const botList = Object.keys(bots).map(name => ({
    name,
    connected: !!bots[name],
    position: bots[name]?.entity?.position,
  }));
  res.json({ bots: botList });
});

// Start server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\n🌐 API Server running on http://localhost:${PORT}`);
  console.log(`\n📖 Available endpoints:`);
  console.log(`   GET  /api/bots - List all bots`);
  console.log(`   GET  /api/:bot/status - Get bot status`);
  console.log(`   POST /api/:bot/goto - Move to coordinates {"x": 0, "y": 70, "z": 0}`);
  console.log(`   POST /api/:bot/move - Move in direction {"direction": "forward", "distance": 10}`);
  console.log(`   POST /api/:bot/chat - Send chat {"message": "Hello!"}`);
  console.log(`   POST /api/:bot/jump - Make bot jump`);
  console.log(`   POST /api/:bot/look - Look at coordinates {"x": 0, "y": 70, "z": 0}`);
  console.log(`   POST /api/:bot/stop - Stop movement`);
  console.log(`\n   Replace :bot with: vulkan, terra, or sage\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  Object.values(bots).forEach(bot => bot.quit());
  setTimeout(() => process.exit(0), 1000);
});
