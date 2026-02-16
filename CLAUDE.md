# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MineForge** — An AI-powered Minecraft civilization where 3 autonomous LLM-driven agents build and manage a virtual world, with a 4-arena PvP village ("MineForge Arena Village") at spawn for 1v1 mini-games. Built for the Emergent Hackathon.

The README.md uses marketing names (Vulkan, Terra, Sage) but the actual code uses **Saumya** (Protocol Architect), **Sumedha** (DeFi Designer), **Ahaan** (Governance Sage).

## Commands

Startup order matters: server first, then agents or web client.

```bash
npm run start-minecraft-server   # Start Minecraft Java server (1.16.2) via Node.js launcher
npm run start-ai-agents          # Start all 3 AI agents with LLM decision loop
npm run start-api-server         # Start REST API server for manual bot control (port 4000)
npm run start-web-client         # Start browser-based Minecraft client (requires pnpm in web-client/)
npm run build-arena-village      # Build the MineForge arena village at spawn via RCON (one-time, persists in world)
npm run start-arena-bot          # Start AI competitor bot (joins arenas with players, fights with per-arena AI)
```

Spectator viewers (prismarine-viewer) auto-start with agents on ports 3002-3004.

No lint or test runner. Python helper scripts in project root (`build_castle.py`, `admin_tools.py`, etc.) use `mcrcon` for RCON. ES modules throughout (`"type": "module"` in package.json).

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

- **`src/demo.js`** — Main orchestration: agent spawning, LLM integration, perceive-think-act loop, empire building state machine (10 phases). **Note:** `GROUND_Y = -60` is set for 1.18+ but the server is 1.16.2 (ground at y=3) — agent builds may target invalid Y coords.
- **`src/api-server.js`** — REST API (port 4000) for manual bot control: goto, move, chat, break, place, attack, look, etc.
- **`src/build-arena-village.js`** — RCON-based MineForge arena builder. Builds hub with interactive button teleporters, 4 arenas with 2-minute timer command blocks, and return-to-hub buttons. One-time script, structures persist in world.
- **`src/agentMemory.js`** — Shared blackboard memory with TTL (default 5 min). Categories: resources, POIs, objectives
- **`src/eventBus.js`** — Pub/sub event system for bot actions. Caches last 50 events, logs to `agents/{name}/{name}_actions.log` (rolling 100 lines)
- **`src/messageSystem.js`** — Inter-agent direct messaging with inboxes (max 10 messages, rolling)
- **`src/arena-bot.js`** — 8 arena bots (2 per arena) with per-arena async game loops and match lifecycle. See **Arena Bot Architecture** below for details.
- **`server/start-server.js`** — Node.js launcher for the Java Minecraft server. Auto-accepts EULA, auto-ops agents on join (Saumya, Sumedha, Ahaan, Architect, ArenaBuilder, ArenaBot)
- **`agents/minecraft_mcp_server.py`** — Python MCP server for RCON control (requires `mcrcon`, `mcp` — see `agents/requirements.txt`)

### Building Structures

Two patterns for placing blocks programmatically:

1. **Via mineflayer bot** (`bot.chat('/fill ...')`) — requires the bot to have OP. Used by `src/demo.js`. Bot must be in the auto-OP list in `server/start-server.js`.
2. **Via RCON** (`rcon.send('fill ...')`) — runs as server console, no OP needed. Used by `src/build-arena-village.js`. Connect to `localhost:25575` with password `minecraft123`. Commands sent without leading `/`.

RCON is more reliable for build scripts. The `/fill` command has a 32768 block limit per call — split large fills into smaller chunks.

### MineForge Arena Village

The arena village uses command blocks for interactive gameplay:

- **Button teleporters**: Impulse command blocks buried under stone buttons. `tp @p[distance=..3]` teleports the nearest player to the arena.
- **Timer system**: Per-arena repeating + chain command block chains buried at y=1. Uses scoreboard objective `timer` with fake players (`pvp_t`, `sumo_t`, `spleef_t`, `archery_t`). 2400 ticks = 2 minutes, with countdown warnings at 60s/30s/10s.
- **Area detection**: `@a[x=..,y=..,z=..,dx=..,dy=..,dz=..]` box selectors detect players inside arenas.
- **Adventure mode**: `CanDestroy` NBT tag on spleef shovels allows breaking snow_block in adventure mode.
- **Scoreboard**: `kills` (playerKillCount, auto-tracks PvP kills, shown on sidebar + below nametags) and `wins` (dummy, managed by arena bot on death/match end).
- **Spectator galleries**: 3-block-wide glass corridors wrapping all 4 sides of each arena, outside the detection area. Outer walls (stone_bricks), inner glass walls (viewing into arena), quartz floor, glass ceiling with sea lantern lighting. Entrance passthroughs have glass tunnel walls to prevent spectators from entering arenas. Hub has spectate buttons that TP to gallery corners. Built by `buildSpectatorGallery()` in `build-arena-village.js`.
- **Staircases**: Sumo staircase ascends east toward bridge (x=33→39, y=4→10). Spleef staircase ascends west toward entrance bridge (x=-25→-36, y=4→15). Both have solid fill below for structure.

### Arena Bot Architecture

`src/arena-bot.js` runs 8 bots in a single process (2 per arena), each with strategy-driven combat AI.

**Bot pairs:**
| Arena | Bot 1 | Bot 2 | Spawn Y | Win Condition |
|-------|-------|-------|---------|---------------|
| PvP | Pvp1 (0,4,46) | Pvp2 (0,4,64) | 4 | Death or timeout HP compare |
| Sumo | Sumo1 (50,11,5) | Sumo2 (60,11,-5) | 11 | Fall below y=5 (`SUMO_FALL_Y`) or death |
| Spleef | Spleef1 (-50,16,5) | Spleef2 (-60,16,-5) | 16 | Death (lava at y=3) |
| Archery | Archer1 (5,4,-52) | Archer2 (-5,4,-58) | 4 | Death or timeout HP compare |

**Per-arena game loop** (`arenaGameLoop(arena)`) — each arena runs independently:
```
WAITING → COUNTDOWN (3-2-1-FIGHT, 4s) → ACTIVE (combat, up to 2min)
    → ENDING (announce winner, 3s) → RESETTING (regen/heal/regive, 3s) → loop
```

**Match end signaling:** Promise-based. `matchEndResolvers[arena]` holds a resolve function. Death handler, sumo fall detection, or timeout calls `signalMatchEnd()` which resolves the Promise in the game loop. Second signal for same match is a no-op (resolver already deleted).

**Combat ticks:** 250ms interval per bot, gated on `arenaMatches[arena].state === 'ACTIVE'`. Each arena has its own tick function: `pvpTick`, `sumoTick`, `spleefTick`, `archeryTick`.

**Strategy files** (`strategies/<BotName>.json`): Optional per-bot JSON with tunable combat parameters (attack_range, strafe_chance, heal_threshold, etc.). Loaded at bot spawn, fallback defaults if missing.

**Arena configs** (`arenas/<arena>.json`): Coordinates, bounds, spawn points, and design notes for each arena.

**Spleef snow regen:** During RESETTING, three `fill` commands regenerate snow at y=7, y=11, y=15 via RCON *before* teleporting bots back. 500ms sleep after regen.

**Logging:** Per-bot file logging to `/tmp/arena-logs/<BotName>.log`. Heatmap JSONL logging (position every 1s) to `/tmp/arena-logs/<BotName>_heatmap.jsonl`.

**Auto-OP:** Bots are OP'd via RCON on spawn. New bot names must be added to the auto-OP list in `server/start-server.js`.

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

Copy `.env.example` to `.env` and configure at least one LLM provider (Azure OpenAI recommended, OpenRouter free tier as fallback).

## Server Configuration

Minecraft 1.16.2 on superflat world. Key settings in `server/java-server/server.properties`:

- `difficulty=normal`, `pvp=true`, `gamemode=adventure`, `force-gamemode=true`
- `allow-flight=true` (required — web client triggers fly detection without it, causing timeout kicks)
- `spawn-monsters=false`, `spawn-animals=false`, `spawn-npcs=false` (no mobs)
- `online-mode=false`, `enable-command-block=true`, `spawn-protection=0`
- `view-distance=10`, `level-type=flat`, `generate-structures=false`

World spawn is set to `0, 4, -8` (MineForge hub, solid ground). Adventure mode prevents block breaking; buttons + command blocks handle arena teleportation. Each arena has a 2-minute timer (repeating command blocks underground at y=1) and a "Return to Hub" button. AI agents build around (500, 500). Base-themed blocks: `blue_concrete`, `white_concrete`, `light_blue_concrete`, `quartz_block`, `sea_lantern`, `prismarine`, `lapis_block`, `packed_ice`. Ground level on superflat: y=3.

**Arena centers** (from `build-arena-village.js`): PvP at (0, 55) south, Sumo at (55, 0) east, Spleef at (-55, 0) west, Archery at (0, -55) north. G=3 (ground), Y=4 (build floor). Sumo platform at y=10 (platY=G+7).
