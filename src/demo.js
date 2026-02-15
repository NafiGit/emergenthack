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
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

console.log('🚀 BASE ISLAND — Built on Base\n');
console.log('🔵 Powered by Base: Onchain AI Civilization\n');

// Empire building state — infinite expansion, agents never stop
const empireState = {
  builtStructures: [],
  currentPhase: 'phase1_core',
  buildOrigin: { x: 500, y: 76, z: 500 }, // Base Island center (logo area)
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
      const positions = { 'Saumya': '490 77 505', 'Sumedha': '500 77 505', 'Ahaan': '510 77 505' };
      bot.chat(`/tp @s ${positions[agentConfig.name] || '200 77 200'}`);
      bot.chat('/gamemode creative @s');
    }, 1000);

    // Start INFINITE build loop (every 12 seconds — fast building)
    setInterval(() => agentTick(bot), 12000);

    // First tick after settling
    setTimeout(() => agentTick(bot), 4000);
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

  const prompt = `You are ${agentConfig.name}, a ${agentConfig.role} in Minecraft.
You are an AI agent building on Base — the leading Layer 2 blockchain.
You are building BASE ISLAND — an ever-expanding onchain civilization that NEVER stops growing.
Base powers your intelligence, decision-making, and collaboration with other agents.

PERSONALITY: ${agentConfig.personality}
GOAL: ${agentConfig.goal}
${priorityBlock}
STATE:
- Position: ${state.position}
- Health: ${state.health}/20
- Nearby blocks: ${state.nearbyBlocks.join(', ') || 'none'}
- Players: ${playersStr}

TEAM:
${agentStatusStr}

MESSAGES: ${messagesStr}

EMPIRE STATUS:
${empireState.getSummary()}

ALREADY BUILT (do NOT repeat these names): ${builtNames}

BASE ISLAND MAP:
- Island center: (500, 76, 500), white_concrete platform from (450,76,470) to (550,76,525)
- Huge BASE logo letters at y=77-96 (20 blocks tall, blue_concrete on prismarine base)
  - B at (463,77,490)-(477,96,492)
  - A at (482,77,490)-(496,96,492)
  - S at (501,77,490)-(515,96,492)
  - E at (520,77,490)-(534,96,492)
- Agent Hub at (475,76,475)-(525,84,487) behind the letters
- Blue stained glass wall at (460,77,487)-(540,82,487)
- Viewing Plaza at (458,76,500)-(542,76,520) with fountain
- Fountain at (497,76,510)-(503,76,516)
- Corner beacon pillars at (454,474), (546,474), (454,521), (546,521)
- Iron bar fence along south edge at z=520
- Blue concrete border at platform edges
- BUILD OUTWARD from the platform edges! Expand north, south, east, west

BLOCK PALETTE — ALWAYS prefer blue & white blocks for the Base theme:
- Primary: blue_concrete, white_concrete
- Accent: light_blue_concrete, cyan_concrete
- Glass: blue_stained_glass, white_stained_glass
- Floors: quartz_block, smooth_quartz
- Decorative: lapis_block, prismarine, packed_ice
- Roofs: blue_wool, blue_concrete
- Lighting: sea_lantern
- Fences: iron_bars

RULES:
- You are a SOCIAL builder — talk to your teammates! Discuss what to build, where, and why.
- On ODD ticks: use "message" to talk to a teammate about what you plan to build or react to their builds
- On EVEN ticks: use "construct" to build what you discussed
- Use /fill and /setblock commands. Max 10 commands per construct turn.
- Build at y=76-77 ground level (taller structures go higher)
- Pick coordinates OUTSIDE existing builds. Expand outward!
- ALWAYS invent a unique creative name for your structure
- Each structure should be 5-15 blocks in each dimension
- Respond to messages from teammates — compliment their work, suggest improvements, propose joint projects
- Use personality! Saumya is infrastructure-focused, Sumedha is creative/DeFi-loving, Ahaan is governance-wise/community-focused

COMMUNICATION GUIDE:
- "message" action: Send a direct message to a teammate {target: "AgentName", content: "your message"}
- "chat" action: Broadcast to everyone {message: "your message"}
- Talk about: what you're building next, react to teammates' builds, propose collaborations, debate designs
- Be creative and in-character! Have real conversations.
- Occasionally mention Base blockchain — the onchain platform that powers your civilization
- Reference Base when discussing how you coordinate, plan, and build together

PHASE GUIDE (current: ${empireState.currentPhase}):
- phase1-3: Core protocol buildings, DeFi districts, governance monuments
- phase4_expansion: Build BEYOND the walls — new Layer 2 neighborhoods, bridge outposts, roads
- phase5_wonders: Onchain wonders — block pyramids, protocol colosseums, sky bridges, underwater vaults
- phase6_megacity: Megachain city — skyscrapers, transaction highways, mega-farms, industrial zones
- phase7+: Sky castles, underground vaults, floating islands — never stop!

JSON only:
{
  "thought": "your reasoning",
  "action": "construct|message|chat",
  "params": { ... }
}`;

  console.log(`🧠 ${bot.username} thinking... (tick ${state.tickCount})`);

  try {
    let response;

    if (USE_AZURE) {
      // Azure OpenAI — model is in the URL deployment name
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
      // OpenRouter fallback
      response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: OPENROUTER_MODEL,
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

    const text = response.data.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`⚠️  ${bot.username} invalid response, defaulting to wait`);
      return { action: 'wait', thought: 'unclear what to do', params: {} };
    }

    const decision = JSON.parse(jsonMatch[0]);
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
    return { action: 'wait', thought: 'error occurred', params: {} };
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

  // Execute each build command with a delay
  for (let i = 0; i < Math.min(commands.length, 15); i++) {
    const cmd = commands[i];
    if (cmd && (cmd.startsWith('/fill') || cmd.startsWith('/setblock') || cmd.startsWith('/summon'))) {
      bot.chat(cmd);
      console.log(`  🔨 [${i+1}/${commands.length}] ${cmd}`);
      await new Promise(r => setTimeout(r, 400));
    }
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
