// SYNAPSE FORGE - Emergency 6-Hour Demo
// 3 AI agents with Claude-powered decision making

import mineflayer from 'mineflayer';
import pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;
import axios from 'axios';
import dotenv from 'dotenv';
import minecraftData from 'minecraft-data';
import { agentMemory } from './agentMemory.js';
import { messageSystem } from './messageSystem.js';
import { eventBus } from './eventBus.js';

// Try to load viewer, but don't crash if it fails
let mineflayerViewer = null;
try {
  const viewerModule = await import('prismarine-viewer');
  mineflayerViewer = viewerModule.mineflayer;
} catch (err) {
  console.log('⚠️  Viewer disabled (canvas not installed - non-critical)');
}

dotenv.config();

// Determine which LLM provider to use: Azure OpenAI preferred, OpenRouter fallback
const USE_AZURE = !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY);

if (USE_AZURE) {
  console.log('🔵 Using Azure OpenAI');
  console.log(`   Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT}`);
  console.log(`   Deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini'}\n`);
} else if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_key_here') {
  console.error('❌ No LLM provider configured!');
  console.error('   Option 1 (Azure): Set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY in .env');
  console.error('   Option 2 (OpenRouter): Set OPENROUTER_API_KEY in .env');
  process.exit(1);
} else {
  console.log('🟠 Using OpenRouter (free tier — may hit rate limits)\n');
}

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
const AZURE_API_VERSION = '2024-10-21';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

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
    port: 25565,
    username: agentConfig.name,
    auth: 'offline',
    version: '1.19.2',
  });

  bot.agentConfig = agentConfig;
  bot.tickCount = 0;
  bot.lastAction = 'none';

  // Register with message system
  messageSystem.registerAgent(agentConfig.name);

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
    // Store chat as a message so the agent sees it in perception
    messageSystem.send(username, agentConfig.name, 'direct_message', message);
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
  const pos = bot.entity.position;

  // Enhanced nearby players with position + distance
  const nearbyPlayers = Object.values(bot.players)
    .filter(p => p.username !== bot.username && p.entity)
    .map(p => {
      const dist = p.entity ? pos.distanceTo(p.entity.position) : null;
      return {
        name: p.username,
        position: p.entity ? `(${Math.floor(p.entity.position.x)}, ${Math.floor(p.entity.position.y)}, ${Math.floor(p.entity.position.z)})` : 'unknown',
        distance: dist ? Math.floor(dist) : null,
      };
    });

  // Other agents status (from bots array)
  const otherAgents = bots
    .filter(b => b.username !== bot.username && b.entity)
    .map(b => ({
      name: b.username,
      position: `(${Math.floor(b.entity.position.x)}, ${Math.floor(b.entity.position.y)}, ${Math.floor(b.entity.position.z)})`,
      health: b.health,
      lastAction: b.lastAction || 'none',
    }));

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

  // Recent messages for this agent
  const recentMessages = messageSystem.getRecent(bot.username, 3).map(m =>
    `[${m.type}] ${m.from}: ${m.content}`
  );

  // Shared knowledge summary
  const sharedKnowledge = agentMemory.getSummary();

  return {
    position: `(${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`,
    health: bot.health,
    food: bot.food,
    nearbyPlayers,
    otherAgents,
    nearbyBlocks: uniqueBlocks,
    inventory: bot.inventory.items().map(item => `${item.name} x${item.count}`).slice(0, 5),
    tickCount: bot.tickCount,
    recentMessages,
    sharedKnowledge,
  };
}

async function callClaude(bot, state) {
  const { agentConfig } = bot;

  // Format other agents status
  const agentStatusStr = state.otherAgents.length > 0
    ? state.otherAgents.map(a => `  ${a.name}: pos=${a.position}, health=${a.health}, lastAction="${a.lastAction}"`).join('\n')
    : '  none nearby';

  // Format recent messages
  const messagesStr = state.recentMessages.length > 0
    ? state.recentMessages.join('\n  ')
    : 'none';

  // Format shared knowledge
  const knowledgeParts = [];
  for (const [cat, entries] of Object.entries(state.sharedKnowledge)) {
    if (entries.length > 0) {
      knowledgeParts.push(`  ${cat}: ${entries.join('; ')}`);
    }
  }
  const knowledgeStr = knowledgeParts.length > 0 ? knowledgeParts.join('\n') : '  nothing shared yet';

  // Format nearby players
  const playersStr = state.nearbyPlayers.length > 0
    ? state.nearbyPlayers.map(p => `${p.name} at ${p.position} (${p.distance}m away)`).join(', ')
    : 'none';

  const prompt = `You are ${agentConfig.name}, a ${agentConfig.role} in a Minecraft world.

PERSONALITY: ${agentConfig.personality}
GOAL: ${agentConfig.goal}

CURRENT STATE:
- Position: ${state.position}
- Health: ${state.health}/20 | Food: ${state.food}/20
- Nearby blocks: ${state.nearbyBlocks.join(', ') || 'none visible'}
- Inventory: ${state.inventory.join(', ') || 'empty'}
- Nearby players: ${playersStr}

OTHER AGENTS STATUS:
${agentStatusStr}

RECENT MESSAGES TO YOU:
  ${messagesStr}

SHARED TEAM KNOWLEDGE:
${knowledgeStr}

Decide what to do next. Available actions:
1. chat — broadcast a message to all {message}
2. message — send direct message to an agent {target, content}
3. request_help — ask an agent for help {target, task}
4. share_location — share a discovered spot with team {name, locationType}
5. follow_agent — follow another agent {target}
6. explore — move in a direction {direction: north/south/east/west}
7. look — look around and observe
8. mine — mine a nearby block {block}
9. gather — collect a resource {resource}
10. build — place a block {block}
11. defend — attack nearest hostile mob
12. give_item — drop an item for another agent {target, item, count}
13. wait — do nothing this turn

IMPORTANT: Collaborate! Message teammates, share discoveries, request help, and coordinate.

Respond with JSON only:
{
  "thought": "your internal reasoning",
  "action": "chat|message|request_help|share_location|follow_agent|explore|look|mine|gather|build|defend|give_item|wait",
  "params": { ... relevant params for your chosen action ... }
}`;

  console.log(`🧠 ${bot.username} thinking... (tick ${state.tickCount})`);

  try {
    let response;

    if (USE_AZURE) {
      // Azure OpenAI — model is in the URL deployment name
      const url = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;
      response = await axios.post(url, {
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 400,
      }, {
        headers: {
          'api-key': AZURE_API_KEY,
          'Content-Type': 'application/json',
        }
      });
    } else {
      // OpenRouter fallback
      response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 400,
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/NafiGit/emergenthack',
          'X-Title': 'Synapse Forge',
          'Content-Type': 'application/json',
        }
      });
    }

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
    console.error(`❌ LLM API error for ${bot.username}:`, error.response?.status || '', error.message);
    return { action: 'wait', thought: 'error occurred', params: {} };
  }
}

async function executeAction(bot, decision) {
  const { action, params = {} } = decision;
  bot.lastAction = action;

  try {
    switch (action) {
      case 'chat':
        if (params.message) {
          bot.chat(params.message);
          console.log(`💬 ${bot.username}: "${params.message}"`);
          eventBus.publish('chat', { agent: bot.username, data: { message: params.message } });
        }
        break;

      case 'message':
        await handleMessage(bot, params);
        break;

      case 'request_help':
        await handleRequestHelp(bot, params);
        break;

      case 'share_location':
        await handleShareLocation(bot, params);
        break;

      case 'follow_agent':
        await handleFollowAgent(bot, params);
        break;

      case 'explore': {
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

        console.log(`🚶 ${bot.username} exploring ${params.direction || 'north'}`);
        eventBus.publish('explore', { agent: bot.username, data: { direction: params.direction } });
        break;
      }

      case 'look':
        bot.look(bot.entity.yaw + Math.PI / 2, 0);
        console.log(`👀 ${bot.username} looking around`);
        eventBus.publish('look', { agent: bot.username, data: {} });
        break;

      case 'mine':
        if (params.block) {
          const block = bot.findBlock({
            matching: (b) => b.name === params.block,
            maxDistance: 32,
          });
          if (block) {
            const mcData = minecraftData(bot.version);
            const movements = new Movements(bot, mcData);
            bot.pathfinder.setMovements(movements);
            bot.pathfinder.setGoal(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 2));
            // Wait a bit for pathfinding, then dig
            setTimeout(async () => {
              try {
                const freshBlock = bot.findBlock({ matching: (b) => b.name === params.block, maxDistance: 6 });
                if (freshBlock) await bot.dig(freshBlock);
              } catch (e) { /* block may have moved out of range */ }
            }, 3000);
            console.log(`⛏️  ${bot.username} mining ${params.block}`);
            eventBus.publish('mine', { agent: bot.username, data: { block: params.block } });
          } else {
            console.log(`⚠️  ${bot.username} can't find ${params.block}`);
          }
        }
        break;

      case 'gather':
        await handleGather(bot, params);
        break;

      case 'build':
        await handleBuild(bot, params);
        break;

      case 'defend':
        await handleDefend(bot, params);
        break;

      case 'give_item':
        await handleGiveItem(bot, params);
        break;

      case 'wait':
        console.log(`⏸️  ${bot.username} waiting`);
        eventBus.publish('wait', { agent: bot.username, data: {} });
        break;

      default:
        console.log(`⚠️  ${bot.username} unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`❌ ${bot.username} action failed:`, error.message);
  }
}

// ===== NEW ACTION HANDLERS =====

async function handleMessage(bot, params) {
  const { target, content } = params;
  if (!target || !content) {
    console.log(`⚠️  ${bot.username} message missing target or content`);
    return;
  }
  messageSystem.send(bot.username, target, 'direct_message', content);
  console.log(`📨 ${bot.username} -> ${target}: "${content}"`);
  eventBus.publish('message', { agent: bot.username, data: { target, content } });
}

async function handleRequestHelp(bot, params) {
  const { target, task } = params;
  if (!target || !task) {
    console.log(`⚠️  ${bot.username} help request missing target or task`);
    return;
  }
  messageSystem.send(bot.username, target, 'help_request', task);
  console.log(`🆘 ${bot.username} asks ${target} for help: "${task}"`);
  eventBus.publish('request_help', { agent: bot.username, data: { target, task } });
}

async function handleShareLocation(bot, params) {
  const { name, locationType } = params;
  if (!name) {
    console.log(`⚠️  ${bot.username} share_location missing name`);
    return;
  }
  const pos = bot.entity.position;
  const locationData = {
    x: Math.floor(pos.x),
    y: Math.floor(pos.y),
    z: Math.floor(pos.z),
    type: locationType || 'unknown',
    sharedBy: bot.username,
  };
  agentMemory.set('poi', name, locationData, bot.username);
  // Broadcast to all other agents
  messageSystem.broadcast(bot.username, 'location_share', `Found ${name} (${locationType || 'poi'}) at (${locationData.x}, ${locationData.y}, ${locationData.z})`);
  console.log(`📍 ${bot.username} shared location: ${name} (${locationType || 'poi'})`);
  eventBus.publish('share_location', { agent: bot.username, data: { name, locationType, position: locationData } });
}

async function handleFollowAgent(bot, params) {
  const { target } = params;
  if (!target) {
    console.log(`⚠️  ${bot.username} follow_agent missing target`);
    return;
  }
  const targetEntity = bot.players[target]?.entity;
  if (!targetEntity) {
    console.log(`⚠️  ${bot.username} can't find ${target} to follow`);
    return;
  }
  const mcData = minecraftData(bot.version);
  const movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);
  bot.pathfinder.setGoal(new goals.GoalFollow(targetEntity, 3), true);
  console.log(`🚶 ${bot.username} following ${target}`);
  eventBus.publish('follow_agent', { agent: bot.username, data: { target } });
}

async function handleGather(bot, params) {
  const { resource } = params;
  if (!resource) {
    console.log(`⚠️  ${bot.username} gather missing resource`);
    return;
  }
  const block = bot.findBlock({
    matching: (b) => b.name.includes(resource),
    maxDistance: 32,
  });
  if (block) {
    const mcData = minecraftData(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 2));
    // Wait for pathfinding then dig
    setTimeout(async () => {
      try {
        const freshBlock = bot.findBlock({ matching: (b) => b.name.includes(resource), maxDistance: 6 });
        if (freshBlock) await bot.dig(freshBlock);
      } catch (e) { /* block out of range */ }
    }, 3000);
    // Share resource location with team
    agentMemory.set('resources', resource, {
      x: Math.floor(block.position.x),
      y: Math.floor(block.position.y),
      z: Math.floor(block.position.z),
    }, bot.username);
    console.log(`🪨 ${bot.username} gathering ${resource}`);
    eventBus.publish('gather', { agent: bot.username, data: { resource } });
  } else {
    console.log(`⚠️  ${bot.username} can't find ${resource} to gather`);
  }
}

async function handleBuild(bot, params) {
  const { block: blockName } = params;
  if (!blockName) {
    console.log(`⚠️  ${bot.username} build missing block`);
    return;
  }
  const item = bot.inventory.items().find(i => i.name.includes(blockName));
  if (!item) {
    console.log(`⚠️  ${bot.username} doesn't have ${blockName} in inventory`);
    return;
  }
  try {
    await bot.equip(item, 'hand');
    const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (referenceBlock) {
      await bot.placeBlock(referenceBlock, { x: 0, y: 1, z: 0 });
      console.log(`🏗️  ${bot.username} placed ${blockName}`);
      eventBus.publish('build', { agent: bot.username, data: { block: blockName } });
    }
  } catch (e) {
    console.log(`⚠️  ${bot.username} build failed: ${e.message}`);
  }
}

async function handleDefend(bot, params) {
  const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch'];
  const mob = bot.nearestEntity(entity =>
    entity.type === 'mob' && hostileMobs.some(h => entity.name?.includes(h))
  );
  if (mob) {
    bot.attack(mob);
    console.log(`⚔️  ${bot.username} attacking ${mob.name}`);
    // Alert team about danger
    messageSystem.broadcast(bot.username, 'danger_alert', `Hostile ${mob.name} at (${Math.floor(mob.position.x)}, ${Math.floor(mob.position.y)}, ${Math.floor(mob.position.z)})`);
    eventBus.publish('defend', { agent: bot.username, data: { mob: mob.name } });
  } else {
    console.log(`⚠️  ${bot.username} no hostile mobs nearby`);
  }
}

async function handleGiveItem(bot, params) {
  const { target, item: itemName, count = 1 } = params;
  if (!target || !itemName) {
    console.log(`⚠️  ${bot.username} give_item missing target or item`);
    return;
  }
  const item = bot.inventory.items().find(i => i.name.includes(itemName));
  if (!item) {
    console.log(`⚠️  ${bot.username} doesn't have ${itemName}`);
    return;
  }
  const targetEntity = bot.players[target]?.entity;
  if (!targetEntity) {
    console.log(`⚠️  ${bot.username} can't find ${target} to give item`);
    return;
  }
  try {
    await bot.lookAt(targetEntity.position);
    await bot.toss(item.type, null, Math.min(count, item.count));
    console.log(`🎁 ${bot.username} gave ${itemName} x${count} to ${target}`);
    eventBus.publish('give_item', { agent: bot.username, data: { target, item: itemName, count } });
  } catch (e) {
    console.log(`⚠️  ${bot.username} give_item failed: ${e.message}`);
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
