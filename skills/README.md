# Skills Directory

AI agent skills for the Minecraft hackathon project.

## Purpose

This directory contains skill definitions that AI agents can use to control Minecraft bots and the game world. Skills provide structured interfaces for LLMs and autonomous agents to interact with the Minecraft server.

## Available Skills

### minecraft-agent

Complete bot control and world manipulation skills.

**Location:** `skills/minecraft-agent/`

**Includes:**
- `skill.md` - Bot control skill with YAML frontmatter
- `minecraft-world-control.md` - RCON world control reference
- `README.md` - Complete documentation

**Capabilities:**
- Control 5 AI agent bots (Agent1-5)
- 6 behavior modes: follow, come, patrol, guard, wander, stop
- Spawn entities and mobs
- Give items and place blocks
- Change time and weather
- World editing and terraforming

## Usage for AI Agents

### For LLMs via MCP

Use the MCP server at `agents/minecraft_mcp_server.py`:

```python
# Available MCP tools:
- spawn_entity(entity, x, y, z)
- give_item(player, item, amount)
- place_block(x, y, z, block)
- teleport_player(player, x, y, z)
- set_time(time)
- set_weather(weather)
- execute_command(command)
- get_player_info()
- bot_move(bot_name, x, y, z)
- bot_follow(bot_name, target_name)
- bot_say(bot_name, message)
- bot_stop(bot_name)
```

### For Direct API Access

Use the Bot Controller API at `http://localhost:8765`:

```bash
# Follow player
curl -X POST http://localhost:8765/bot/follow \
  -H "Content-Type: application/json" \
  -d '{"bot_name": "Agent1", "target_name": "mcrafter3420"}'

# Wander randomly
curl -X POST http://localhost:8765/bot/wander \
  -H "Content-Type: application/json" \
  -d '{"bot_name": "Agent2", "radius": 20}'

# Make bot speak
curl -X POST http://localhost:8765/bot/say \
  -H "Content-Type: application/json" \
  -d '{"bot_name": "Agent3", "message": "Hello world"}'
```

### For RCON Control

Use Python with mcrcon:

```python
from mcrcon import MCRcon

with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    # Spawn entities
    mcr.command('summon zombie -120 71 160')

    # Give items
    mcr.command('give mcrafter3420 diamond 64')

    # Change time
    mcr.command('time set day')
```

## Skill Structure

Each skill follows this structure:

```
skills/
└── minecraft-agent/
    ├── skill.md                    # Main skill with YAML frontmatter
    ├── minecraft-world-control.md  # Reference documentation
    └── README.md                   # Skill-specific docs
```

**YAML Frontmatter Format:**
```yaml
---
name: skill-name
description: Brief description
version: 1.0.0
author: Author name
tags:
  - tag1
  - tag2
---
```

## Integration Points

### 1. Bot Controller
- **Location:** `agents/bot_controller.js`
- **Port:** 8765
- **Start:** `node agents/bot_controller.js`

### 2. MCP Server
- **Location:** `agents/minecraft_mcp_server.py`
- **Start:** `python agents/minecraft_mcp_server.py`

### 3. Minecraft Server
- **Port:** 25565
- **RCON:** 25575
- **Start:** `java -Xmx2G -Xms1G -jar server.jar nogui`

## Creating New Skills

To add a new skill:

1. Create directory: `skills/your-skill-name/`
2. Add `skill.md` with YAML frontmatter
3. Add implementation details
4. Add examples and API reference
5. Update this README

## Example: Using Skills in an AI Agent

```python
# Pseudocode for an AI agent using these skills

class MinecraftAIAgent:
    def __init__(self):
        self.mcp_client = MCPClient("localhost")
        self.skills = load_skills("skills/")

    async def execute_task(self, task):
        # Agent reads skill documentation
        skill = self.skills["minecraft-agent"]

        # Agent uses MCP tools based on skill instructions
        if task == "gather resources":
            # Move bots to mining area
            await self.mcp_client.call_tool("bot_move", {
                "bot_name": "Agent1",
                "x": -100, "y": 70, "z": 150
            })

            # Make them patrol the area
            await self.mcp_client.call_tool("bot_follow", {
                "bot_name": "Agent1",
                "target_name": "mcrafter3420"
            })

        elif task == "build structure":
            # Place blocks using RCON
            await self.mcp_client.call_tool("place_block", {
                "x": -120, "y": 71, "z": 160,
                "block": "diamond_block"
            })
```

## Hackathon Ready

These skills enable:
- ✅ LLM-driven bot control
- ✅ Multi-agent coordination
- ✅ Autonomous world manipulation
- ✅ Real-time decision making
- ✅ Structured AI-Minecraft interface

Perfect for building autonomous agents that can play, build, and interact in Minecraft! 🎮🤖

---

**Repository:** https://github.com/NafiGit/emergenthack
**Project:** Emergent AI Hack - Minecraft Agent Control
