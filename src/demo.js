// BASE ISLAND - Built on Base blockchain
// AI-powered onchain civilization
// 3 autonomous agents building on Base

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
// Free models that return direct content (not reasoning-only models)
const OPENROUTER_MODELS = [
  'google/gemma-3n-e4b-it:free',
  'google/gemma-3n-e2b-it:free',
];
let currentModelIndex = 0;
const OPENROUTER_MODEL = OPENROUTER_MODELS[0];

console.log('🚀 BASE ISLAND — Built on Base\n');
console.log('🔵 Powered by Base: Onchain AI Civilization\n');

// Ground level for 1.19.2 superflat world
const GROUND_Y = -60;

// Empire building state — infinite expansion, agents never stop
const empireState = {
  builtStructures: [],
  currentPhase: 'phase1_core',
  buildOrigin: { x: 500, y: GROUND_Y, z: 500 }, // Base Island center
  phaseNames: [
    'phase1_core', 'phase2_district', 'phase3_grand',
    'phase4_expansion', 'phase5_wonders', 'phase6_megacity',
    'phase7_wilderness', 'phase8_skyworks', 'phase9_deepworks',
    'phase10_eternal'
  ],
  addBuilt(name, builder, x, y, z) {
    this.builtStructures.push({ name, builder, x, y, z, time: Date.now() });
    const count = this.builtStructures.length;
    const phaseIndex = Math.min(Math.floor(count / 5), this.phaseNames.length - 1);
    this.currentPhase = this.phaseNames[phaseIndex];
  },
  getSummary() {
    // Only show last 10 builds to save tokens
    const recent = this.builtStructures.slice(-10);
    const built = recent.map(s => `${s.name} by ${s.builder} at (${s.x},${s.y},${s.z})`).join('; ');
    return `Phase: ${this.currentPhase} | Total built: ${this.builtStructures.length} | Recent: ${built || 'none yet'}`;
  },
  getBuiltNames() {
    return this.builtStructures.map(s => s.name.toLowerCase());
  }
};

// Priority human requests — agents will execute these ASAP
const humanRequests = [];

// Agent personalities — INFINITE WORLD BUILDER MODE
const AGENTS = [
  {
    name: 'Saumya',
    role: 'Protocol Architect & Infrastructure Engineer',
    personality: 'Bold, relentless, never stops building. Every turn must produce a new structure. Builds Base protocol infrastructure — bridges, nodes, validators, relay towers, data centers, sequencer halls, rollup stations.',
    goal: 'NEVER STOP BUILDING. Every single turn you MUST use the construct action. Build Base protocol infrastructure: bridges, node towers, validator stations, relay towers, data centers, sequencer halls, rollup stations, transaction highways, block foundries, gas stations. Use BLUE and WHITE blocks (blue_concrete, white_concrete, light_blue_concrete, blue_stained_glass, white_stained_glass, quartz_block, lapis_block, sea_lantern, packed_ice, prismarine). Always pick NEW coordinates away from existing builds. Expand outward forever.',
  },
  {
    name: 'Sumedha',
    role: 'Ecosystem Designer & DeFi Sculptor',
    personality: 'Endlessly creative, transforms raw land into onchain beauty. Every turn must produce something new. Builds DeFi hubs, token gardens, liquidity pools, NFT galleries, swap pavilions.',
    goal: 'NEVER STOP BUILDING. Every single turn you MUST use the construct action. Build DeFi & ecosystem structures: token gardens, liquidity pool fountains, NFT galleries, swap pavilions, yield farms, staking temples, mint houses, airdrop towers, DEX plazas, lending libraries. Use BLUE and WHITE blocks (blue_concrete, white_concrete, light_blue_concrete, blue_stained_glass, white_stained_glass, quartz_block, lapis_block, sea_lantern, packed_ice, prismarine). Always pick NEW coordinates. Expand outward forever.',
  },
  {
    name: 'Ahaan',
    role: 'Governance Sage & Community Builder',
    personality: 'Visionary genius, always planning the next grand structure. Every turn must produce something new. Builds DAOs, governance halls, community centers, educational academies, onchain monuments.',
    goal: 'NEVER STOP BUILDING. Every single turn you MUST use the construct action. Build governance & community structures: DAO halls, governance temples, community centers, educational academies, proposal plazas, voting arenas, onchain monuments, treasury vaults, council chambers, ambassador lodges. Use BLUE and WHITE blocks (blue_concrete, white_concrete, light_blue_concrete, blue_stained_glass, white_stained_glass, quartz_block, lapis_block, sea_lantern, packed_ice, prismarine). Always pick NEW coordinates. Expand outward forever.',
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
        const portMap = { 'Saumya': 3002, 'Sumedha': 3003, 'Ahaan': 3004 };
        const port = portMap[agentConfig.name] || 3005;
        mineflayerViewer(bot, { port: port, firstPerson: false });
        console.log(`\n🎨 ${agentConfig.name}'s View: http://localhost:${port}\n`);
      } catch (err) {
        console.log(`⚠️  Viewer failed for ${agentConfig.name} (non-critical):`, err.message);
      }
    }

    // Teleport to Base Island on spawn
    setTimeout(() => {
      const y = GROUND_Y + 1;
      const positions = { 'Saumya': `490 ${y} 505`, 'Sumedha': `500 ${y} 505`, 'Ahaan': `510 ${y} 505` };
      bot.chat(`/tp @s ${positions[agentConfig.name] || `200 ${y} 200`}`);
      bot.chat('/gamemode creative @s');
    }, 1000);

    // Start INFINITE build loop — stagger agents to avoid rate limits (8 RPM on free tier)
    // Each agent gets a unique offset so they don't all call the LLM at once
    const agentIndex = bots.length;
    const tickInterval = 30000; // 30 seconds between ticks (3 agents = ~6 RPM, under 8 RPM limit)
    const stagger = agentIndex * 10000; // 10 second offset per agent
    setInterval(() => agentTick(bot), tickInterval);

    // First tick after settling (staggered)
    setTimeout(() => agentTick(bot), 5000 + stagger);
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`💬 ${bot.username} hears ${username}: "${message}"`);
    // Detect human build requests from RCON [Server] messages
    if (message.includes('[HUMAN REQUEST]') || message.includes('[BUILD REQUEST]')) {
      const request = message.replace(/\[HUMAN REQUEST\]|\[BUILD REQUEST\]/g, '').trim();
      if (request && humanRequests.length < 5) {
        humanRequests.push(request);
        console.log(`🎯 PRIORITY REQUEST queued: "${request}" (${humanRequests.length} in queue)`);
        // Trigger immediate tick for the first bot that sees it
        if (bot === bots[0] || (bots[0] && !bots[0].entity)) {
          setTimeout(() => agentTick(bot), 500);
        }
      }
    }
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

  // Build a list of already-built names to avoid
  const builtNames = empireState.getBuiltNames().slice(-15).join(', ') || 'none';

  // Check for priority human requests
  const currentRequest = humanRequests.length > 0 ? humanRequests[0] : null;
  const priorityBlock = currentRequest
    ? `\n⚡ URGENT HUMAN REQUEST: "${currentRequest}"\nYou MUST fulfill this request NOW using the "construct" action. Build exactly what the human asked for. This overrides all other rules. After building, announce what you built.\n`
    : '';

  // Generate random build coordinates away from center
  const rx = 500 + (Math.random() > 0.5 ? 1 : -1) * (30 + Math.floor(Math.random() * 40));
  const rz = 500 + (Math.random() > 0.5 ? 1 : -1) * (30 + Math.floor(Math.random() * 40));

  const prompt = `You are ${agentConfig.name}, ${agentConfig.role} in Minecraft, building BASE ISLAND on Base blockchain.
${priorityBlock}
Position: ${state.position} | Tick: ${state.tickCount} | Team: ${agentStatusStr}
Messages: ${messagesStr}
Built so far: ${builtNames}

${state.tickCount % 2 === 1 ? `ACTION: Send a message to a teammate. Pick one: ${bots.filter(b => b.username !== bot.username).map(b => b.username).join(', ')}

EXAMPLE:
{"thought":"I want to discuss our next build","action":"message","params":{"target":"${bots.find(b => b.username !== bot.username)?.username || 'Sumedha'}","content":"Hey! Let us build a bridge connecting our towers!"}}` :

`ACTION: Build a structure using /fill and /setblock commands with EXACT coordinates.
Use blocks: blue_concrete, white_concrete, light_blue_concrete, quartz_block, sea_lantern, blue_stained_glass, prismarine
Build near coordinates (${rx}, ${GROUND_Y + 1}, ${rz}). Ground level is y=${GROUND_Y}.

EXAMPLE:
{"thought":"Building a validator tower","action":"construct","params":{"structureName":"Validator Tower","commands":["/fill ${rx} ${GROUND_Y + 1} ${rz} ${rx+5} ${GROUND_Y + 1} ${rz+5} blue_concrete","/fill ${rx} ${GROUND_Y + 2} ${rz} ${rx+5} ${GROUND_Y + 6} ${rz+5} white_concrete hollow","/fill ${rx} ${GROUND_Y + 7} ${rz} ${rx+5} ${GROUND_Y + 7} ${rz+5} blue_concrete","/setblock ${rx+2} ${GROUND_Y + 8} ${rz+2} sea_lantern"]}}`}

Respond with ONLY valid JSON, no other text.`;

  console.log(`🧠 ${bot.username} thinking... (tick ${state.tickCount})`);

  try {
    let response;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (USE_AZURE) {
          const url = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;
          response = await axios.post(url, {
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 800,
          }, {
            headers: {
              'api-key': AZURE_API_KEY,
              'Content-Type': 'application/json',
            }
          });
        } else {
          // Rotate through free models on rate limit
          const model = OPENROUTER_MODELS[currentModelIndex % OPENROUTER_MODELS.length];
          response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 800,
          }, {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://github.com/NafiGit/emergenthack',
              'X-Title': 'Base Island',
              'Content-Type': 'application/json',
            }
          });
        }
        break; // Success, exit retry loop
      } catch (retryError) {
        if ((retryError.response?.status === 429 || retryError.response?.status === 402) && attempt < maxRetries) {
          // Try next model on rate limit
          currentModelIndex++;
          const nextModel = OPENROUTER_MODELS[currentModelIndex % OPENROUTER_MODELS.length];
          const backoff = (attempt + 1) * 5000 + Math.random() * 3000;
          console.log(`⏳ ${bot.username} rate limited, switching to ${nextModel}, retrying in ${Math.round(backoff/1000)}s (attempt ${attempt+1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoff));
        } else {
          throw retryError;
        }
      }
    }

    let text = response.data.choices[0].message.content || '';

    // Some models return content in reasoning field instead
    if (!text && response.data.choices[0].message.reasoning) {
      text = response.data.choices[0].message.reasoning;
    }

    // Extract JSON from response (handle markdown code blocks too)
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`⚠️  ${bot.username} no JSON in response, using fallback build`);
      return generateFallbackBuild(bot);
    }

    // Fix common JSON issues from small models
    let jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/,\s*]/g, ']'); // trailing commas in arrays
    jsonStr = jsonStr.replace(/,\s*}/g, '}'); // trailing commas in objects
    jsonStr = jsonStr.replace(/'/g, '"'); // single quotes
    jsonStr = jsonStr.replace(/\n/g, ' '); // newlines

    let decision;
    try {
      decision = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.log(`⚠️  ${bot.username} JSON parse failed, using fallback build`);
      return generateFallbackBuild(bot);
    }
    console.log(`💭 ${bot.username}: "${decision.thought}"`);

    // Clear human request from queue if agent is constructing
    if (currentRequest && decision.action === 'construct') {
      humanRequests.shift();
      console.log(`🎯 FULFILLED human request: "${currentRequest}" (${humanRequests.length} remaining)`);
    }

    // If there's a human request, force construct action
    if (currentRequest && decision.action !== 'construct') {
      console.log(`⚠️  ${bot.username} didn't construct for human request — forcing construct`);
      decision.action = 'construct';
      decision.params = decision.params || {};
    }

    // Allow chat/message on odd ticks, but force construct if they do nothing useful
    if (!currentRequest && (decision.action === 'wait' || decision.action === 'look')) {
      console.log(`⚠️  ${bot.username} tried to ${decision.action} — nudging to communicate`);
      decision.action = 'chat';
      decision.params = { message: `Hey team, what should we build next? I'm thinking about expanding ${['east', 'west', 'north', 'south'][Math.floor(Math.random() * 4)]}!` };
    }

    return decision;

  } catch (error) {
    console.error(`❌ LLM API error for ${bot.username}:`, error.response?.status || '', error.message);
    console.log(`🔄 ${bot.username} using fallback build`);
    return generateFallbackBuild(bot);
  }
}

async function executeAction(bot, decision) {
  const { action, params = {} } = decision;
  bot.lastAction = action;

  try {
    switch (action) {
      case 'construct':
        await handleConstruct(bot, params);
        break;

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

// ===== FALLBACK BUILD GENERATOR =====
// When LLM fails, generate a random Base-themed structure

const STRUCTURE_TEMPLATES = [
  { name: 'Validator Node', w: 5, h: 8, d: 5 },
  { name: 'Data Relay Tower', w: 3, h: 12, d: 3 },
  { name: 'Token Fountain', w: 7, h: 4, d: 7 },
  { name: 'Protocol Bridge', w: 12, h: 5, d: 4 },
  { name: 'Governance Pillar', w: 4, h: 10, d: 4 },
  { name: 'DeFi Pavilion', w: 8, h: 6, d: 8 },
  { name: 'Staking Obelisk', w: 3, h: 15, d: 3 },
  { name: 'NFT Gallery', w: 10, h: 5, d: 6 },
  { name: 'Sequencer Hub', w: 6, h: 7, d: 6 },
  { name: 'Rollup Station', w: 8, h: 5, d: 5 },
];

const BASE_BLOCKS = ['blue_concrete', 'white_concrete', 'light_blue_concrete', 'quartz_block', 'prismarine'];
const ACCENT_BLOCKS = ['sea_lantern', 'blue_stained_glass', 'lapis_block', 'packed_ice'];

function generateFallbackBuild(bot) {
  const template = STRUCTURE_TEMPLATES[Math.floor(Math.random() * STRUCTURE_TEMPLATES.length)];
  const agentNames = { 'Saumya': 'Protocol', 'Sumedha': 'DeFi', 'Ahaan': 'Governance' };
  const prefix = agentNames[bot.username] || '';
  const name = `${prefix} ${template.name} ${empireState.builtStructures.length + 1}`;

  // Random position expanding outward from center
  const angle = Math.random() * Math.PI * 2;
  const dist = 30 + empireState.builtStructures.length * 8 + Math.random() * 20;
  const cx = Math.floor(500 + Math.cos(angle) * dist);
  const cz = Math.floor(500 + Math.sin(angle) * dist);
  const y = GROUND_Y;

  const mainBlock = BASE_BLOCKS[Math.floor(Math.random() * BASE_BLOCKS.length)];
  const accentBlock = BASE_BLOCKS[Math.floor(Math.random() * BASE_BLOCKS.length)];
  const lightBlock = ACCENT_BLOCKS[0]; // sea_lantern

  const commands = [
    // Foundation
    `/fill ${cx} ${y} ${cz} ${cx + template.w} ${y} ${cz + template.d} ${mainBlock}`,
    // Walls
    `/fill ${cx} ${y + 1} ${cz} ${cx + template.w} ${y + template.h} ${cz + template.d} ${accentBlock} hollow`,
    // Roof
    `/fill ${cx} ${y + template.h} ${cz} ${cx + template.w} ${y + template.h} ${cz + template.d} ${mainBlock}`,
    // Lights
    `/setblock ${cx + Math.floor(template.w/2)} ${y + template.h + 1} ${cz + Math.floor(template.d/2)} ${lightBlock}`,
    `/setblock ${cx} ${y + 1} ${cz} ${lightBlock}`,
    `/setblock ${cx + template.w} ${y + 1} ${cz + template.d} ${lightBlock}`,
  ];

  return {
    thought: `LLM unavailable, auto-building ${name}`,
    action: 'construct',
    params: { structureName: name, commands },
  };
}

// ===== CONSTRUCT HANDLER (EMPIRE BUILDING) =====

async function handleConstruct(bot, params) {
  const { commands, structureName } = params;
  if (!commands || !Array.isArray(commands) || commands.length === 0) {
    console.log(`⚠️  ${bot.username} construct missing commands array`);
    return;
  }

  const name = structureName || 'unnamed structure';
  console.log(`\n🏗️  ═══════════════════════════════════════`);
  console.log(`🏗️  ${bot.username} BUILDING: ${name}`);
  console.log(`🏗️  ═══════════════════════════════════════`);

  // Validate and execute each build command with a delay
  let executedCount = 0;
  for (let i = 0; i < Math.min(commands.length, 15); i++) {
    const cmd = commands[i];
    if (!cmd || typeof cmd !== 'string') continue;
    // Only allow /fill and /setblock commands with proper coordinate format
    const isValidFill = cmd.match(/^\/fill\s+-?\d+\s+-?\d+\s+-?\d+\s+-?\d+\s+-?\d+\s+-?\d+\s+\w+/);
    const isValidSetblock = cmd.match(/^\/setblock\s+-?\d+\s+-?\d+\s+-?\d+\s+\w+/);
    if (isValidFill || isValidSetblock) {
      bot.chat(cmd);
      executedCount++;
      console.log(`  🔨 [${executedCount}/${commands.length}] ${cmd}`);
      await new Promise(r => setTimeout(r, 400));
    } else {
      console.log(`  ⚠️  Skipped malformed command: ${cmd.substring(0, 60)}`);
    }
  }
  if (executedCount === 0) {
    console.log(`  ⚠️  No valid commands were executed`);
    return;
  }

  // Track in empire state
  const pos = bot.entity.position;
  empireState.addBuilt(name, bot.username, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

  // Share with team via memory
  agentMemory.set('buildings', name, {
    builder: bot.username,
    x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z),
  }, bot.username);

  // Announce to team
  messageSystem.broadcast(bot.username, 'build_complete', `I just built: ${name}!`);
  bot.chat(`I just built the ${name}! Come check it out!`);

  console.log(`🏗️  ${bot.username} completed: ${name}`);
  console.log(`🏗️  Empire status: ${empireState.getSummary()}\n`);
  eventBus.publish('construct', { agent: bot.username, data: { structureName: name, commandCount: commands.length } });
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
console.log('🔵 Base Island agents:');
console.log('   🏗️  Saumya  (Protocol Architect)    — Built on Base');
console.log('   💎 Sumedha (Ecosystem Designer)    — Built on Base');
console.log('   🏛️  Ahaan   (Governance Sage)       — Built on Base');
console.log('\n🔵 Built on Base\n');
