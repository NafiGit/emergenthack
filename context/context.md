# SYNAPSE FORGE — Project Context

> **This file is the single source of truth for the entire project. Claude Code should read this before doing anything.**

---

## PROJECT OVERVIEW

**Synapse Forge** is a multi-agent AI civilization inside Minecraft. 5–10 LLM-powered agents autonomously explore, mine, craft, trade, build, and form social dynamics — all without human intervention.

### Two-Phase Strategy

- **Phase 1 (NOW)**: Off-chain Minecraft AI civilization for the Hallucination Hackathon at Mesa school. No blockchain. Pure agent intelligence demo.
- **Phase 2 (LATER)**: Migrate same codebase to Monad blockchain for Moltiverse hackathon. Add onchain identity, NFTs, token, Moltbook integration.

**Phase 1 proves the intelligence. Phase 2 adds the economy. Same core system, different wrappers.**

### What We're Building

- Minecraft server running locally (offline mode, no purchase needed)
- 5–10 Mineflayer bots connected as headless players
- Each bot has a Claude-powered brain that decides what to do every ~5 seconds
- Agents have unique personalities, memories, goals, skills, and relationships
- Agents communicate via Minecraft chat, negotiate trades, collaborate on builds
- All events logged to SQLite
- Real-time web dashboard to observe the simulation

### What We're NOT Building

- No blockchain (Phase 1)
- No GPU/ML training — Claude API handles all intelligence
- No Minecraft client needed — bots are headless, we use prismarine-viewer or dashboard for observation
- No custom Minecraft mods required

---

## TECH STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Game Server | Minecraft Java Edition server JAR | 1.21.x | Shared world |
| Alt Server | flying-squid (pure Node.js) | latest | Zero-Java alternative |
| Bot Engine | mineflayer | ^4.20.1 | Headless Minecraft client for each agent |
| Pathfinding | mineflayer-pathfinder | ^2.4.5 | A* navigation |
| Collection | mineflayer-collectblock | ^1.4.1 | Resource gathering |
| Combat | mineflayer-pvp | ^1.3.2 | Self-defense |
| Agent Framework | mindcraft (fork from mindcraft-bots/mindcraft) | latest | Multi-agent + LLM integration base |
| LLM | Claude API (Sonnet 4) via @anthropic-ai/sdk | ^0.39.0 | Agent decision-making |
| Database | better-sqlite3 | ^11.7.0 | Event log, memories, trades, relationships |
| Dashboard BE | express + ws (WebSocket) | ^4.21.0 / ^8.18.0 | API + real-time streaming |
| Dashboard FE | React + Tailwind + Recharts + D3.js | latest | Visualization |
| 3D Viewer | prismarine-viewer | ^1.28.0 | Browser-based world view |
| Logging | winston | ^3.17.0 | Structured logging |
| Config | dotenv | ^16.4.0 | Environment variables |
| Runtime | Node.js | v20 LTS | Everything |

### Key Repos to Reference

| Repo | Purpose |
|------|---------|
| `mindcraft-bots/mindcraft` | **Primary fork base** — multi-agent LLM Minecraft framework |
| `PrismarineJS/mineflayer` | Bot engine API reference |
| `PrismarineJS/prismarine-viewer` | 3D web viewer |
| `PrismarineJS/mineflayer-pathfinder` | Navigation |
| `PrismarineJS/mineflayer-collectblock` | Resource collection |
| `MineDojo/Voyager` | Reference architecture — skill library, curriculum, iterative prompting |
| `altera-al/project-sid` | Reference — 1000-agent PIANO architecture |
| `gigio1023/minecraft-llm-agent-community` | Reference — multi-agent community formation |

---

## PROJECT STRUCTURE

```
synapse-forge/
├── context.md                      # THIS FILE — project bible
├── package.json
├── settings.js                     # Global configuration
├── .env                            # ANTHROPIC_API_KEY=sk-ant-...
├── src/
│   ├── orchestrator.js             # Main entry — spawns & manages all agents
│   ├── agents/
│   │   ├── agent.js                # Base agent class (Mindcraft fork)
│   │   ├── personality.js          # Big Five trait system + backstory
│   │   ├── memory.js               # Three-layer memory (working/episodic/semantic)
│   │   ├── goals.js                # Goal stack with priorities (1-10)
│   │   └── social.js               # Relationship tracking (trust, trade history)
│   ├── behaviors/
│   │   ├── gather.js               # Resource collection logic
│   │   ├── craft.js                # Crafting decision tree
│   │   ├── build.js                # Collaborative structure building
│   │   ├── trade.js                # Agent-to-agent trading protocol
│   │   ├── explore.js              # Exploration & terrain mapping
│   │   └── communicate.js          # Chat message handling & parsing
│   ├── world/
│   │   ├── shared-state.js         # Shared knowledge (resource locations, points of interest)
│   │   ├── territory.js            # Agent territory claims
│   │   └── economy.js              # Price discovery from trade history
│   ├── llm/
│   │   ├── claude-adapter.js       # Claude API wrapper (@anthropic-ai/sdk)
│   │   ├── prompt-builder.js       # Context-aware prompt construction per tick
│   │   └── response-parser.js      # Parse structured JSON from Claude responses
│   ├── logging/
│   │   ├── event-store.js          # SQLite event logger
│   │   ├── init-db.js              # Database schema initialization script
│   │   ├── metrics.js              # Agent performance metrics
│   │   └── narrator.js             # Human-readable event narration for dashboard
│   └── dashboard/
│       ├── server.js               # Express + WebSocket server
│       ├── api.js                  # REST endpoints for historical data
│       └── public/                 # React frontend (or served separately)
├── profiles/                       # Agent personality configs (1 JSON per agent)
│   ├── vulkan.json                 # Forge Master
│   ├── terra.json                  # Deep Miner
│   ├── sage.json                   # Architect
│   ├── drift.json                  # Scout/Explorer
│   └── barter.json                 # Merchant
└── data/
    └── synapse-forge.db            # SQLite database (auto-created)
```

---

## AGENT ROSTER

### 5 Starter Agents

| Name | Role | Personality | Primary Goals | Skills (high) |
|------|------|-------------|---------------|---------------|
| **Vulkan** | Forge Master | Terse, perfectionist, loner | Smelt ores, craft tools, build forge | Crafting 0.9, Mining 0.7 |
| **Terra** | Deep Miner | Brave, stubborn, superstitious | Mine deep, find diamonds, map caves | Mining 0.9, Exploration 0.6 |
| **Sage** | Architect | Creative, patient, philosophical | Design buildings, plan village layout | Building 0.9, Crafting 0.6 |
| **Drift** | Scout/Explorer | Restless, curious, chatty | Map terrain, find biomes, report resources | Exploration 0.9, Combat 0.5 |
| **Barter** | Merchant | Charismatic, calculating, fair | Facilitate trades, stockpile goods, set prices | Trading 0.9, Communication 0.8 |

### Agent Profile Format

```json
{
  "name": "Vulkan",
  "role": "Forge Master",
  "personality": {
    "traits": {
      "extraversion": 0.3,
      "agreeableness": 0.5,
      "conscientiousness": 0.9,
      "openness": 0.4,
      "neuroticism": 0.2
    },
    "values": ["craftsmanship", "efficiency", "self-reliance"],
    "communication_style": "terse, practical, uses forge metaphors",
    "backstory": "A meticulous craftsman who believes the quality of one's tools defines the quality of one's work. Prefers working alone at the furnace but will trade finished goods."
  },
  "initial_goals": [
    { "goal": "build_forge_area", "priority": 9 },
    { "goal": "collect_iron_and_coal", "priority": 8 },
    { "goal": "craft_iron_tools_for_community", "priority": 7 }
  ],
  "skills": {
    "mining": 0.7,
    "crafting": 0.9,
    "building": 0.5,
    "trading": 0.4,
    "combat": 0.3,
    "exploration": 0.2
  }
}
```

---

## AGENT ARCHITECTURE

### Decision Loop (runs every ~5 seconds per agent)

```
1. PERCEIVE  — Read world state via Mineflayer API
   ├── bot.health, bot.food
   ├── bot.inventory.items()
   ├── bot.nearestEntity(), bot.blockAt()
   ├── Incoming chat messages (bot.on('chat'))
   └── Time of day, weather, position

2. THINK  — Call Claude API with full context prompt
   ├── System prompt: personality + role + rules
   ├── User prompt: inventory, surroundings, chat, memories, goals, relationships
   ├── Claude returns structured JSON:
   │   {
   │     "thought": "reasoning in 1-2 sentences",
   │     "action": "mine|craft|build|trade|chat|explore|wait",
   │     "params": { ... action-specific ... },
   │     "goal_update": null | { "add": "goal_name", "priority": 1-10 }
   │   }
   └── Parse and validate response

3. ACT  — Execute via Mineflayer
   ├── mine → bot.dig(block)
   ├── craft → bot.craft(recipe)
   ├── build → bot.placeBlock(reference, faceVector)
   ├── trade → navigate to partner + bot.tossItem()
   ├── chat → bot.chat(message) or bot.whisper(agent, message)
   ├── explore → pathfinder.goto(goal)
   └── wait → do nothing this tick

4. REMEMBER  — Update memory and state
   ├── Log event to SQLite (event_store)
   ├── Store significant events as episodic memory
   ├── Update relationship scores if interaction occurred
   ├── Update skill proficiency (+0.01 success, -0.005 failure)
   └── Prune old/low-importance memories if over limit

5. REPEAT → back to PERCEIVE
```

### Three-Layer Memory System

```
WORKING MEMORY (context window)
├── Last 5 minutes of events
├── Sent to Claude every tick
└── Always fresh, never stored

EPISODIC MEMORY (SQLite, per-agent)
├── Significant events: trades, discoveries, deaths, conversations
├── Fields: timestamp, event_type, description, importance (1-10), agents_involved, location
├── Retrieved by relevance (top-K) before each LLM call
└── Max 500 per agent, oldest pruned

SEMANTIC MEMORY (key-value, per-agent)
├── Learned facts and beliefs
├── "iron_ore_location": "cave at 120,30,-60"
├── "barter_trustworthy": true
├── "best_wood_source": "forest north of spawn"
└── Updated periodically as agent learns
```

### Communication

Agents talk through **Minecraft chat** (Mineflayer `bot.chat()`):

```
BROADCAST  → bot.chat("message")           — All agents hear it
WHISPER    → bot.whisper("agent", "msg")    — Private
TRADE_REQ  → "[TRADE] Offering 20 wood for 5 iron @Vulkan"
ALERT      → "[ALERT] Creeper spotted near the forge!"
SOCIAL     → "Nice build, Sage! The roof looks great."
```

### Trading Protocol

```
1. Agent A proposes: "[TRADE] 20 oak_log for 5 iron_ingot @AgentB"
2. Agent B's LLM evaluates: need, price fairness, trust level
3. Agent B responds: "[ACCEPT] Deal!" or "[COUNTER] 25 oak for 5 iron" or "[REJECT] No thanks"
4. On accept: both navigate to meeting point, drop items (bot.tossItem)
5. Event logged to both agents' memory + global trade history
6. Trust updated: +0.05 on success, -0.1 on failure/no-show
```

### Price Discovery (Emergent)

No hardcoded prices. Market rates emerge from trade history:

```javascript
getMarketRate(itemA, itemB) {
  // Average exchange rate from last 20 trades of these items
  // Returns null if no data → agent guesses
}
```

### Social Dynamics

```javascript
Relationship {
  trust: 0.0 - 1.0      // 0 = enemy, 1 = best friend
  tradeCount: number     // successful trades
  chatCount: number      // conversations held
  conflicts: number      // failed trades, arguments
  lastInteraction: Date
}
```

Trust affects LLM decisions — agents are told relationship scores in their prompt and naturally avoid unreliable partners.

### Skill Growth

```javascript
// Agents improve at tasks they perform frequently
updateSkill(agent, skillName, success) {
  delta = success ? +0.01 : -0.005  // Learn faster from success
  agent.skills[skillName] = clamp(0, 1, current + delta)
}
// High-skill agents naturally gravitate toward their strengths
// because the LLM sees skill levels in the prompt
```

---

## DATABASE SCHEMA (SQLite)

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,        -- mine, craft, trade, chat, build, die, explore, goal_change, social
  description TEXT,
  data JSON,
  location_x REAL,
  location_y REAL,
  location_z REAL,
  importance INTEGER DEFAULT 5
);

CREATE TABLE agent_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  agent_id TEXT NOT NULL,
  health REAL,
  hunger REAL,
  inventory JSON,
  position JSON,
  current_goal TEXT,
  skill_levels JSON
);

CREATE TABLE relationships (
  agent_a TEXT NOT NULL,
  agent_b TEXT NOT NULL,
  trust REAL DEFAULT 0.5,
  trade_count INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0,
  conflicts INTEGER DEFAULT 0,
  last_interaction DATETIME,
  PRIMARY KEY (agent_a, agent_b)
);

CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  proposer TEXT NOT NULL,
  accepter TEXT NOT NULL,
  offered_item TEXT,
  offered_qty INTEGER,
  received_item TEXT,
  received_qty INTEGER,
  status TEXT DEFAULT 'completed',
  location JSON
);

CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  memory_type TEXT,                  -- episodic, semantic
  content TEXT,
  importance INTEGER DEFAULT 5,
  embedding BLOB
);
```

---

## LLM PROMPT STRUCTURE

### System Prompt (set once per agent)

```
You are {name}, a {role} in a Minecraft world called Synapse Forge.

PERSONALITY:
{backstory}
Communication style: {communication_style}
Values: {values}

SKILLS (0-1 proficiency):
Mining: {mining} | Crafting: {crafting} | Building: {building}
Trading: {trading} | Combat: {combat} | Exploration: {exploration}

RULES:
- You are autonomous. Make your own decisions based on your personality and goals.
- You can talk to other agents via chat.
- You can propose and accept trades.
- You have goals but can change them based on circumstances.
- You remember past events and learn from them.
- Always respond with a valid JSON action object.

ACTION FORMAT:
{
  "thought": "Your internal reasoning (1-2 sentences)",
  "action": "mine|craft|build|trade|chat|explore|wait",
  "params": { ... action-specific parameters ... },
  "goal_update": null | { "add": "goal_name", "priority": 1-10 }
}

VALID ACTIONS:
- mine: { "block": "iron_ore" } — mine nearest matching block
- craft: { "item": "iron_pickaxe", "count": 1 } — craft if materials available
- build: { "block": "cobblestone", "position": [x, y, z] } — place block
- trade: { "to": "AgentName", "offer": "oak_log", "offer_qty": 20, "want": "iron_ingot", "want_qty": 5 }
- chat: { "msg": "message text", "to": "AgentName" | null } — null = broadcast
- explore: { "direction": "north" | "south" | "east" | "west" | "down" | "random" }
- wait: {} — do nothing this tick
```

### Per-Tick User Prompt (built dynamically)

```
CURRENT STATE:
- Time: Day {day}, {time} ({period})
- Health: {health}/20 | Hunger: {hunger}/20
- Position: ({x}, {y}, {z}) — {biome} biome
- Inventory: [{item} x{count}, ...]

NEARBY (16 blocks):
- Agents: {agent} ({distance} blocks {direction}), ...
- Blocks: {block_types}
- Entities: {mobs}

RECENT CHAT (last 2 minutes):
[{time}] {agent}: "{message}"
...

RELEVANT MEMORIES:
- {memory_description} ({when})
...

CURRENT GOALS:
1. [P{priority}] {goal_description} — {status}
...

RELATIONSHIPS:
- {agent}: trust {trust} ({context})
...

What do you do?
```

---

## CONFIGURATION

### settings.js

```javascript
module.exports = {
  minecraft: {
    host: "localhost",
    port: 55916,
    version: "1.21.4",
    auth: "offline",                 // No Microsoft account needed
  },
  agents: {
    count: 5,
    profiles_dir: "./profiles",
    tick_interval_ms: 5000,          // Decision loop frequency
    spawn_delay_ms: 3000,            // Stagger agent joins
  },
  llm: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0.7,
    api_key_env: "ANTHROPIC_API_KEY",
  },
  memory: {
    max_episodic_per_agent: 500,
    working_memory_minutes: 5,
    retrieval_top_k: 5,
  },
  economy: {
    enable_trading: true,
    trade_timeout_ms: 30000,
    meeting_point_radius: 5,
  },
  dashboard: {
    port: 3000,
    ws_port: 3001,
    enable_viewer: true,
    viewer_port: 3002,
  },
  logging: {
    db_path: "./data/synapse-forge.db",
    log_level: "info",
    narrate_events: true,
  },
};
```

### .env

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## RUNNING THE PROJECT

```bash
# 1. Start Minecraft server
# Option A: Official server JAR (requires Java)
#   Download from minecraft.net, set online-mode=false in server.properties
#   java -jar server.jar --nogui

# Option B: flying-squid (pure Node.js, no Java)
#   npx flying-squid --config '{"online-mode": false, "port": 55916}'

# 2. Install dependencies
npm install

# 3. Set API key
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# 4. Initialize database
node src/logging/init-db.js

# 5. Launch all agents
node src/orchestrator.js

# 6. Open dashboard
# → http://localhost:3000

# 7. (Optional) Open 3D viewer
# → http://localhost:3002

# 8. Watch the civilization emerge
```

---

## COST BREAKDOWN

| Item | Cost | Notes |
|------|------|-------|
| Minecraft Java Edition | $26.95 (optional) | Only if you want to spectate in-game. Not required. |
| Claude API (Sonnet) | ~$2-5 per demo session | 5 agents × 1 call/5sec × ~$0.003/call |
| Everything else | $0 | All open source |
| GPU | Not needed | Claude API runs remotely. Nothing is GPU-bound. |

---

## PHASE 2 MIGRATION PATH (Monad/Moltiverse)

Phase 1 is designed so onchain integration is **additive, not invasive**.

### What stays the same:
- Minecraft server, Mineflayer bots, Claude brains, memory system, personality system, dashboard

### What gets added:
```
src/chain/                          # NEW folder
├── wallet.js                       # Monad wallet per agent (viem library)
├── contracts/
│   ├── AgentRegistry.sol           # Maps wallet address → MC username
│   ├── LootNFT.sol                 # ERC-721 for rare mined items
│   └── TradeEscrow.sol             # Atomic P2P agent trades
├── hooks.js                        # Event hooks: onDiamondMined → mintNFT()
├── moltbook.js                     # Post milestones to Moltbook
└── token.js                        # Launch $SYNAPSEFORGE on nad.fun
```

### Monad Network Config
```
Mainnet: Chain ID 143, RPC https://rpc.monad.xyz
Testnet: Chain ID 10143, RPC https://testnet-rpc.monad.xyz
Deploy via Foundry (identical to Ethereum workflow)
```

### Moltiverse Hackathon Details
- Dates: Feb 2-15, 2026
- Prizes: $200K total
- Agent+Token track: 10×$10K + 1×$40K liquidity boost
- Judges want: Weird, creative, boundary-pushing, A2A coordination

---

## DIFFERENTIATION

| Competitor | What they do | How we're different |
|------------|-------------|-------------------|
| ClaudeCraft (Solana) | Single agent, Solana chain | Multi-agent society, emergent behavior |
| Lumiterra | Farming game | Open-world exploration, PVP, collaborative builds |
| Project Sid | 1000 agents research paper | We add onchain economics (Phase 2) |
| Voyager | Single agent skill learning | Multi-agent society with trading & social dynamics |

**First-mover advantage**: Zero Minecraft autonomous societies submitted to Moltiverse.

---

## BUILD PRIORITIES

### For Hackathon Demo (Minimum Viable Civilization)

1. **Server + bot connections** — 5 bots join and move around
2. **Claude decision loop** — bots make LLM-driven decisions
3. **Basic behaviors** — mine, craft, explore
4. **Inter-agent chat** — bots talk to each other
5. **Trading** — at least one successful trade in demo
6. **Dashboard** — live feed showing what agents are doing
7. **Memory** — agents remember and reference past events

### Nice-to-Have

- Collaborative building (Sage designs, others gather materials)
- prismarine-viewer 3D view
- Relationship graph visualization
- Emergent price curves
- Agent skill specialization over time

---

## DEMO SCRIPT (5 minutes)

- **0:00-1:00** — 5 agents spawn, spread out, begin exploring
- **1:00-2:00** — Agents mine, craft first tools, chat about finds
- **2:00-3:00** — First trade happens organically (show chat log + dashboard)
- **3:00-4:00** — Architect begins community build, others deliver materials
- **4:00-5:00** — Show relationship graph, economy stats, emergent specialization
- **5:00** — "Phase 2 puts this all onchain — every trade, every item, every identity"
