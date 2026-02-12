// SYNAPSE FORGE - Emergency 6-Hour Demo
// 3 AI agents with Claude-powered decision making

import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;
import axios from 'axios';
import dotenv from 'dotenv';
import minecraftData from 'minecraft-data';

// Try to load viewer, but don't crash if it fails
let mineflayerViewer = null;
try {
  const viewerModule = await import('prismarine-viewer');
  mineflayerViewer = viewerModule.mineflayer;
} catch (err) {
  console.log('⚠️  Viewer disabled (canvas not installed - non-critical)');
}

dotenv.config();

// Check API key
if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_key_here') {
  console.error('❌ OPENROUTER_API_KEY not set in .env file!');
  console.error('   Get a free key at: https://openrouter.ai/keys');
  console.error('   Then add it to .env file');
  process.exit(1);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Using free models from OpenRouter
const FREE_MODELS = {
  llama: 'meta-llama/llama-3.3-70b-instruct:free', // FREE - VERIFIED WORKING
};

const MODEL = FREE_MODELS.llama; // Using Llama 3.3 70B (verified free model)

console.log('🚀 SYNAPSE FORGE - Emergency Demo\n');

// Agent personalities (simplified for 6-hour demo)
const AGENTS = [
  {
    name: 'Vulkan',
    role: 'Forge Master',
    personality: 'Terse, focused on mining and crafting. Values efficiency.',
    goal: 'Find and mine resources, especially iron and coal',
  },
  {
    name: 'Terra',
    role: 'Explorer',
    personality: 'Curious, adventurous, describes what she sees.',
    goal: 'Explore the world and report interesting findings',
  },
  {
    name: 'Sage',
    role: 'Architect',
    personality: 'Thoughtful, social, interested in building and cooperation.',
    goal: 'Coordinate with others and plan community projects',
  },
];

// Create bots
const bots = [];

AGENTS.forEach((agent, index) => {
  setTimeout(() => {
    createAgent(agent);
  }, index * 3000); // Stagger spawns by 3 seconds
});

function createAgent(agentConfig) {
  console.log(`🤖 Spawning ${agentConfig.name} (${agentConfig.role})...`);

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 55916,
    username: agentConfig.name,
    auth: 'offline',
    version: '1.16.2',
  });

  bot.agentConfig = agentConfig;
  bot.tickCount = 0;

  // Load pathfinder
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`✅ ${agentConfig.name} spawned at ${bot.entity.position}`);

    // Attach viewer to each bot on different ports
    if (mineflayerViewer) {
      try {
        const portMap = { 'Vulkan': 3002, 'Terra': 3003, 'Sage': 3004 };
        const port = portMap[agentConfig.name] || 3005;
        mineflayerViewer(bot, { port: port, firstPerson: false });
        console.log(`\n🎨 ${agentConfig.name}'s View: http://localhost:${port}\n`);
      } catch (err) {
        console.log(`⚠️  Viewer failed for ${agentConfig.name} (non-critical):`, err.message);
      }
    }

    // Start decision loop (every 10 seconds)
    setInterval(() => agentTick(bot), 10000);

    // First tick immediately
    setTimeout(() => agentTick(bot), 2000);
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`💬 ${bot.username} hears ${username}: "${message}"`);
  });

  bot.on('error', (err) => {
    console.error(`❌ ${agentConfig.name} error:`, err.message);
  });

  bot.on('kicked', (reason) => {
    console.log(`⚠️  ${agentConfig.name} kicked: ${reason}`);
  });

  bots.push(bot);
}

async function agentTick(bot) {
  bot.tickCount++;

  try {
    // 1. PERCEIVE - Gather world state
    const state = perceiveWorld(bot);

    // 2. THINK - Call Claude API
    const decision = await callClaude(bot, state);

    // 3. ACT - Execute decision
    await executeAction(bot, decision);

  } catch (error) {
    console.error(`❌ ${bot.username} tick error:`, error.message);
  }
}

function perceiveWorld(bot) {
  const nearbyPlayers = Object.values(bot.players)
    .filter(p => p.username !== bot.username)
    .map(p => p.username);

  const pos = bot.entity.position;

  const nearbyBlocks = [];
  for (let x = -5; x <= 5; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -5; z <= 5; z++) {
        const block = bot.blockAt(pos.offset(x, y, z));
        if (block && block.name !== 'air' && block.name !== 'grass_block') {
          nearbyBlocks.push(block.name);
        }
      }
    }
  }

  const uniqueBlocks = [...new Set(nearbyBlocks)].slice(0, 10);

  return {
    position: `(${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`,
    health: bot.health,
    food: bot.food,
    nearbyPlayers,
    nearbyBlocks: uniqueBlocks,
    inventory: bot.inventory.items().map(item => `${item.name} x${item.count}`).slice(0, 5),
    tickCount: bot.tickCount,
  };
}

async function callClaude(bot, state) {
  const { agentConfig } = bot;

  const prompt = `You are ${agentConfig.name}, a ${agentConfig.role} in a Minecraft world.

PERSONALITY: ${agentConfig.personality}
GOAL: ${agentConfig.goal}

CURRENT STATE:
- Position: ${state.position}
- Health: ${state.health}/20 | Food: ${state.food}/20
- Nearby agents: ${state.nearbyPlayers.length > 0 ? state.nearbyPlayers.join(', ') : 'none'}
- Nearby blocks: ${state.nearbyBlocks.join(', ') || 'none visible'}
- Inventory: ${state.inventory.join(', ') || 'empty'}

Decide what to do next. You can:
1. chat - Say something (to all agents or to someone specific)
2. explore - Move in a direction (north/south/east/west)
3. look - Look around and observe
4. mine - Try to mine a nearby block
5. wait - Do nothing this turn

Respond with JSON only:
{
  "thought": "your internal reasoning",
  "action": "chat|explore|look|mine|wait",
  "params": {
    "message": "chat message" (if action=chat),
    "direction": "north" (if action=explore),
    "block": "stone" (if action=mine)
  }
}`;

  console.log(`🧠 ${bot.username} thinking... (tick ${state.tickCount})`);

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        }
      ],
      temperature: 0.8,
      max_tokens: 300,
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/NafiGit/emergenthack',
        'X-Title': 'Synapse Forge',
        'Content-Type': 'application/json',
      }
    });

    const text = response.data.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`⚠️  ${bot.username} invalid response, defaulting to wait`);
      return { action: 'wait', thought: 'unclear what to do', params: {} };
    }

    const decision = JSON.parse(jsonMatch[0]);
    console.log(`💭 ${bot.username}: "${decision.thought}"`);

    return decision;

  } catch (error) {
    console.error(`❌ OpenRouter API error for ${bot.username}:`, error.message);
    return { action: 'wait', thought: 'error occurred', params: {} };
  }
}

async function executeAction(bot, decision) {
  const { action, params } = decision;

  try {
    switch (action) {
      case 'chat':
        if (params.message) {
          bot.chat(params.message);
          console.log(`💬 ${bot.username}: "${params.message}"`);
        }
        break;

      case 'explore':
        const directions = {
          north: { x: 0, z: -10 },
          south: { x: 0, z: 10 },
          east: { x: 10, z: 0 },
          west: { x: -10, z: 0 },
        };
        const dir = directions[params.direction] || directions.north;
        const target = bot.entity.position.offset(dir.x, 0, dir.z);

        const mcData = minecraftData(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);
        bot.pathfinder.setGoal(new goals.GoalNear(target.x, target.y, target.z, 1));

        console.log(`🚶 ${bot.username} exploring ${params.direction}`);
        break;

      case 'look':
        bot.look(bot.entity.yaw + Math.PI / 2, 0);
        console.log(`👀 ${bot.username} looking around`);
        break;

      case 'mine':
        if (params.block) {
          const block = bot.findBlock({
            matching: (b) => b.name === params.block,
            maxDistance: 32,
          });
          if (block) {
            await bot.dig(block);
            console.log(`⛏️  ${bot.username} mined ${params.block}`);
          } else {
            console.log(`⚠️  ${bot.username} can't find ${params.block}`);
          }
        }
        break;

      case 'wait':
        console.log(`⏸️  ${bot.username} waiting`);
        break;

      default:
        console.log(`⚠️  ${bot.username} unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`❌ ${bot.username} action failed:`, error.message);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down agents...');
  bots.forEach(bot => bot.quit());
  setTimeout(() => process.exit(0), 1000);
});

console.log('⏳ Agents will spawn in 3-second intervals...');
console.log('📊 Watch console for agent decisions');
console.log('🌐 3D Views (one for each bot):');
console.log('   🔥 Vulkan: http://localhost:3002');
console.log('   🌍 Terra:  http://localhost:3003');
console.log('   🏗️  Sage:   http://localhost:3004\n');
