# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Emergent Island / Base Island** — An AI-powered self-sustaining Minecraft civilization where 3 autonomous LLM-driven agents (Saumya, Sumedha, Ahaan) build and manage a virtual world themed around the Base blockchain (blue/white/quartz blocks). Built for the Emergent Hackathon.

## Commands

```bash
npm run start-minecraft-server   # Start Minecraft Java server (1.19.2) via Node.js launcher
npm run start-ai-agents          # Start all 3 AI agents with LLM decision loop
npm run start-api-server         # Start REST API server for manual bot control
npm run start-web-client         # Start browser-based Minecraft client (http://localhost:9111)
npm run start-spectator-viewer   # Info: prismarine spectator viewers auto-start with agents on ports 3002-3004
```

There is no lint or test runner configured. Manual test scripts exist in `tests/` (run with `node tests/<file>.js`).

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
Web Client (browser, http://localhost:9111)        ← main client (minecraft-web-client submodule)
Spectator Viewer (browser, ports 3002-3004)        ← per-agent prismarine-viewer (auto-starts with agents)
```

### Agent Decision Loop (Perceive-Think-Act)

Every ~30 seconds per agent (staggered, respects ~6 RPM rate limit):

1. **Perceive**: Gather world state (position, nearby blocks/players, inventory, team status, messages, shared memory)
2. **Think**: Call LLM with agent role, world state, and build guidelines. LLM returns a JSON action (`construct`, `message`, `chat`, `explore`, `mine`, etc.)
3. **Act**: Execute the action — `/fill` and `/setblock` commands for builds, pathfinding for movement, message routing for communication

If the LLM fails, deterministic fallback structure templates are used. Retry logic: 3 attempts with exponential backoff.

### Key Source Files

- **`src/demo.js`** — Main orchestration: agent spawning, LLM integration, perceive-think-act loop, empire building state machine (10 phases)
- **`src/api-server.js`** — REST API for manual bot control and status
- **`src/agentMemory.js`** — Shared blackboard memory (resources, POIs, objectives)
- **`src/eventBus.js`** — Pub/sub event system for bot actions
- **`src/messageSystem.js`** — Inter-agent direct messaging with inboxes
- **`agents/bot_controller.js`** — REST API for individual bot management
- **`agents/minecraft_mcp_server.py`** — Python MCP server for RCON control
- **`server/start-server.js`** — Node.js launcher for the Java Minecraft server

### LLM Provider Chain

Priority order with fallback:
1. Azure OpenAI (configured via `AZURE_OPENAI_*` env vars)
2. OpenRouter with model rotation (configured via `OPENROUTER_API_KEY`)
3. Deterministic fallback templates (no LLM needed)

## Environment Setup

Copy `.env.example` to `.env` and configure at least one LLM provider. The project uses ES modules (`"type": "module"` in package.json).

## Server Configuration

The Minecraft server runs in peaceful/survival mode with online-mode=OFF, command blocks enabled, spawn protection disabled, and RCON password `minecraft123`. Config lives in `server/java-server/server.properties`.
