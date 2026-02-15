# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Base Island** — An AI-powered Minecraft civilization where 3 autonomous LLM-driven agents (Saumya, Sumedha, Ahaan) build and manage a virtual world themed around the Base blockchain (blue/white/quartz blocks). Built for the Emergent Hackathon. Includes a 4-arena PvP village at spawn for 1v1 mini-games.

## Commands

Startup order matters: server first, then agents or web client.

```bash
npm run start-minecraft-server   # Start Minecraft Java server (1.16.2) via Node.js launcher
npm run start-ai-agents          # Start all 3 AI agents with LLM decision loop
npm run start-api-server         # Start REST API server for manual bot control (port 4000)
npm run start-web-client         # Start browser-based Minecraft client (requires pnpm in web-client/)
npm run build-arena-village      # Build the 4-arena PvP village at spawn via RCON (one-time, persists in world)
```

Spectator viewers (prismarine-viewer) auto-start with agents on ports 3002-3004.

No lint or test runner. Manual test scripts exist in the project root (e.g., `build_castle.py`, `test_agent_building.py`). ES modules (`"type": "module"` in package.json).

## Ports

| Port | Service |
|------|---------|
| 25565 | Minecraft Java server |
| 25575 | RCON (password: `minecraft123`) |
| 4000 | API server (`src/api-server.js`) |
| 9112 | Web client proxy + prod frontend (`web-client/server.js`) |
| 9111 | Web client dev server (rsbuild, only during `pnpm start`) |
| 3002-3004 | Prismarine spectator viewers (auto-start with agents) |
| 3007 | Prismarine viewer for API server's `base_bot` |

## Architecture

```
LLM (Azure OpenAI / OpenRouter)
        ↓
Node.js Agent Orchestration (src/demo.js)
        ↓
   3 AI Agents using mineflayer
   - Saumya (Protocol Architect)
   - Sumedha (DeFi Designer)
   - Ahaan (Governance Sage)
        ↓
Minecraft Java Server (port 25565, RCON 25575)
        ↓
Web Client (browser → proxy on 9112 → WebSocket → TCP → MC server)
Spectator Viewer (ports 3002-3004, per-agent prismarine-viewer)
```

### Agent Decision Loop (Perceive-Think-Act)

Every ~30 seconds per agent (staggered by 10s, respects ~6 RPM rate limit):

1. **Perceive**: Gather world state (position, nearby blocks/players, inventory, team status, messages, shared memory)
2. **Think**: Call LLM with agent role, world state, and build guidelines. LLM returns a JSON action (`construct`, `message`, `chat`, `explore`, `mine`, etc.)
3. **Act**: Execute the action — `/fill` and `/setblock` commands for builds, pathfinding for movement, message routing for communication

If the LLM fails, deterministic fallback structure templates are used. Retry logic: 3 attempts with exponential backoff (5s + random 3s).

### Key Source Files

- **`src/demo.js`** — Main orchestration: agent spawning, LLM integration, perceive-think-act loop, empire building state machine (10 phases)
- **`src/api-server.js`** — REST API (port 4000) for manual bot control: goto, move, chat, break, place, attack, look, etc.
- **`src/build-arena-village.js`** — RCON-based arena builder: 4 mini-game arenas (PvP, Sumo, Spleef, Archery) at spawn. One-time script, structures persist in world
- **`src/agentMemory.js`** — Shared blackboard memory with TTL (default 5 min). Categories: resources, POIs, objectives
- **`src/eventBus.js`** — Pub/sub event system for bot actions. Caches last 50 events, logs to `agents/{name}/{name}_actions.log` (rolling 100 lines)
- **`src/messageSystem.js`** — Inter-agent direct messaging with inboxes (max 10 messages, rolling)
- **`server/start-server.js`** — Node.js launcher for the Java Minecraft server. Auto-accepts EULA, auto-ops agents on join (Saumya, Sumedha, Ahaan, Architect, ArenaBuilder)
- **`agents/minecraft_mcp_server.py`** — Python MCP server for RCON control (requires `mcrcon`, `mcp` — see `agents/requirements.txt`)

### Building Structures

Two patterns for placing blocks programmatically:

1. **Via mineflayer bot** (`bot.chat('/fill ...')`) — requires the bot to have OP. Used by `src/demo.js` and `src/build-demo.js`. Bot must be in the auto-OP list in `server/start-server.js`.
2. **Via RCON** (`rcon.send('fill ...')`) — runs as server console, no OP needed. Used by `src/build-arena-village.js`. Connect to `localhost:25575` with password `minecraft123`. Commands sent without leading `/`.

RCON is more reliable for build scripts. The `/fill` command has a 32768 block limit per call — split large fills into smaller chunks.

### LLM Provider Chain

Priority order with automatic fallback:
1. Azure OpenAI (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`)
2. OpenRouter with model rotation (`OPENROUTER_API_KEY`) — rotates free models (Gemma 3, etc.) on 429/402 errors
3. Deterministic fallback templates (no LLM needed)

### Web Client (Submodule)

The `web-client/` directory is a git submodule (fork at `NafiGit/minecraft-web-client`). Browser can't do raw TCP, so it connects via WebSocket proxy:

```
Browser (localhost:9112) → WebSocket → Proxy (net-browserify) → TCP → MC server (25565)
```

- **Production**: `node web-client/server.js --prod` serves both the proxy and the built frontend on port 9112
- **Development**: `pnpm start` in `web-client/` runs proxy (9112) + rsbuild dev server (9111) in parallel
- Proxy timeout: 120 seconds. Auto-version: 1.16.2

## Environment Setup

Copy `.env.example` to `.env` and configure at least one LLM provider.

## Server Configuration

Minecraft 1.16.2 on superflat world. Key settings in `server/java-server/server.properties`:

- `difficulty=normal`, `pvp=true`, `gamemode=survival`, `force-gamemode=true`
- `allow-flight=true` (required — web client triggers fly detection without it, causing timeout kicks)
- `spawn-monsters=false`, `spawn-animals=false`, `spawn-npcs=false` (no mobs)
- `online-mode=false`, `enable-command-block=true`, `spawn-protection=0`
- `view-distance=10`, `level-type=flat`, `generate-structures=false`

World spawn is set to `0, 12, 0` (arena village hub). AI agents build around (500, 500). Base-themed blocks: `blue_concrete`, `white_concrete`, `light_blue_concrete`, `quartz_block`, `sea_lantern`, `prismarine`, `lapis_block`, `packed_ice`. Ground level on superflat: y=3.
