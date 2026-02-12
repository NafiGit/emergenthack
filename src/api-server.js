// Simple API server to control bots manually
import express from 'express';
import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;
import minecraftData from 'minecraft-data';
import { eventBus } from './eventBus.js';

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

// Create single bot named nafi
const AGENT_NAME = 'nafi';
createBot(AGENT_NAME);

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

    // Attach viewer (first-person POV)
    if (mineflayerViewer) {
      try {
        mineflayerViewer(bot, {
          port: 3002,
          firstPerson: true,
          viewDistance: 4,  // Optimized for performance
        });
        console.log(`🎮 POV View: http://localhost:3002`);
      } catch (err) {
        console.log(`⚠️  Viewer failed:`, err.message);
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

  // Get inventory items
  const inventory = bot.inventory.items().map(item => ({
    name: item.name,
    count: item.count,
    slot: item.slot
  }));

  // Get block bot is looking at
  let lookingAt = null;
  const block = bot.blockAtCursor(5); // 5 blocks reach
  if (block) {
    lookingAt = {
      name: block.name,
      position: block.position
    };
  }

  res.json({
    name: req.params.bot,
    position: bot.entity.position,
    health: bot.health,
    food: bot.food,
    gamemode: bot.game.gameMode,
    inventory: inventory,
    lookingAt: lookingAt
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

    // Publish event to event bus
    const pos = bot.entity.position;
    eventBus.publish('GOTO', {
      agent: req.params.bot,
      source: 'manual',
      data: {
        from: { x: pos.x, y: pos.y, z: pos.z },
        to: { x, y, z }
      }
    });

    res.json({ success: true, message: `${req.params.bot} moving to (${x}, ${y}, ${z})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move bot in direction (smooth control states - no pathfinding)
app.post('/api/:bot/move', async (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { direction, duration = 200 } = req.body; // Short burst of movement
  const pos = bot.entity.position;

  try {
    // Stop any ongoing pathfinding first
    bot.pathfinder.setGoal(null);

    if (direction === 'forward') {
      // Walk forward (uses control state, not pathfinding)
      bot.setControlState('forward', true);
      setTimeout(() => bot.setControlState('forward', false), duration);
    } else if (direction === 'back') {
      // Walk backward
      bot.setControlState('back', true);
      setTimeout(() => bot.setControlState('back', false), duration);
    } else if (direction === 'left') {
      // ONLY rotate camera left (no movement!)
      bot.look(bot.entity.yaw - Math.PI / 16, bot.entity.pitch, true);
    } else if (direction === 'right') {
      // ONLY rotate camera right (no movement!)
      bot.look(bot.entity.yaw + Math.PI / 16, bot.entity.pitch, true);
    } else if (direction === 'up') {
      // Look up
      bot.look(bot.entity.yaw, Math.max(bot.entity.pitch - Math.PI / 16, -Math.PI / 2), true);
    } else if (direction === 'down') {
      // Look down
      bot.look(bot.entity.yaw, Math.min(bot.entity.pitch + Math.PI / 16, Math.PI / 2), true);
    } else {
      return res.status(400).json({ error: 'Invalid direction. Use: forward, back, left, right, up, down' });
    }

    // Publish event to event bus
    eventBus.publish('MOVE', {
      agent: req.params.bot,
      source: 'manual',
      data: {
        direction,
        position: { x: pos.x, y: pos.y, z: pos.z }
      }
    });

    res.json({ success: true, message: `${req.params.bot} ${direction}` });
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

  // Publish event to event bus
  eventBus.publish('CHAT', {
    agent: req.params.bot,
    source: 'manual',
    data: { message }
  });

  res.json({ success: true, message: `${req.params.bot} said: "${message}"` });
});

// Make bot jump
app.post('/api/:bot/jump', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 500);

  // Publish event to event bus
  eventBus.publish('JUMP', {
    agent: req.params.bot,
    source: 'manual',
    data: { position: bot.entity.position }
  });

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

// Mouse look (set yaw/pitch directly for smooth camera control)
app.post('/api/:bot/mouselook', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { deltaX, deltaY, sensitivity = 0.003 } = req.body;

  if (deltaX === undefined && deltaY === undefined) {
    return res.status(400).json({ error: 'Missing deltaX or deltaY' });
  }

  // Update yaw (horizontal) and pitch (vertical)
  const newYaw = bot.entity.yaw + (deltaX || 0) * sensitivity;
  const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, bot.entity.pitch + (deltaY || 0) * sensitivity));

  bot.look(newYaw, newPitch, true);

  res.json({ success: true, yaw: newYaw, pitch: newPitch });
});

// Stop movement
app.post('/api/:bot/stop', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  // Stop all control states
  bot.setControlState('forward', false);
  bot.setControlState('back', false);
  bot.setControlState('left', false);
  bot.setControlState('right', false);
  bot.setControlState('jump', false);
  bot.pathfinder.setGoal(null);

  // Publish event to event bus
  eventBus.publish('STOP', {
    agent: req.params.bot,
    source: 'manual',
    data: { position: bot.entity.position }
  });

  res.json({ success: true, message: `${req.params.bot} stopped` });
});

// Control state (for smooth WASD movement + sprint)
app.post('/api/:bot/control', (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { state, active } = req.body;
  if (state === undefined || active === undefined) {
    return res.status(400).json({ error: 'Missing state or active' });
  }

  bot.setControlState(state, active);
  res.json({ success: true, state, active });
});

// Break block (mine what you're looking at)
app.post('/api/:bot/break', async (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  try {
    const block = bot.blockAtCursor(5);
    if (!block) {
      return res.json({ success: false, message: 'Not looking at a block' });
    }

    // Equip best tool for the job
    const mcData = minecraftData(bot.version);
    await bot.tool.equipForBlock(block, { requireHarvest: false });

    // Mine the block
    await bot.dig(block);

    eventBus.publish('BREAK', {
      agent: req.params.bot,
      source: 'manual',
      data: { block: block.name, position: block.position }
    });

    res.json({ success: true, block: block.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place block (place from hotbar)
app.post('/api/:bot/place', async (req, res) => {
  const bot = bots[req.params.bot];
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  try {
    const { slot = 0 } = req.body;

    // Get block we're looking at (to place against)
    const referenceBlock = bot.blockAtCursor(5);
    if (!referenceBlock) {
      return res.json({ success: false, message: 'Not looking at a block' });
    }

    // Get item from hotbar slot (slots 36-44 are hotbar)
    const hotbarSlot = 36 + slot;
    const item = bot.inventory.slots[hotbarSlot];

    if (!item) {
      return res.json({ success: false, message: 'No item in slot' });
    }

    // Equip the item
    await bot.equip(item, 'hand');

    // Place block against the reference block
    const faceVector = new bot.vec3(0, 1, 0); // Place on top
    await bot.placeBlock(referenceBlock, faceVector);

    eventBus.publish('PLACE', {
      agent: req.params.bot,
      source: 'manual',
      data: { item: item.name, position: referenceBlock.position }
    });

    res.json({ success: true, item: item.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  console.log(`   GET  /api/:bot/status - Get bot status, inventory, looking at`);
  console.log(`   POST /api/:bot/goto - Move to coordinates {"x": 0, "y": 70, "z": 0}`);
  console.log(`   POST /api/:bot/move - Move in direction {"direction": "forward", "duration": 200}`);
  console.log(`   POST /api/:bot/control - Set control state {"state": "forward", "active": true}`);
  console.log(`   POST /api/:bot/mouselook - Mouse look {"deltaX": 10, "deltaY": 5, "sensitivity": 0.005}`);
  console.log(`   POST /api/:bot/break - Break block you're looking at`);
  console.log(`   POST /api/:bot/place - Place block {"slot": 0}`);
  console.log(`   POST /api/:bot/chat - Send chat {"message": "Hello!"}`);
  console.log(`   POST /api/:bot/jump - Make bot jump`);
  console.log(`   POST /api/:bot/look - Look at coordinates {"x": 0, "y": 70, "z": 0}`);
  console.log(`   POST /api/:bot/stop - Stop all movement`);
  console.log(`\n   🎮 Bot name: nafi\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  Object.values(bots).forEach(bot => bot.quit());
  setTimeout(() => process.exit(0), 1000);
});
