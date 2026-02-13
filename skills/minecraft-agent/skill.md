---
name: minecraft-agent
description: Control Minecraft AI agents via bot controller API
version: 1.0.0
author: Claude & User
tags:
  - minecraft
  - ai-agents
  - game-control
  - automation
---

# Minecraft Agent Control

Control AI agents in Minecraft through the bot controller API.

## Prerequisites

- Minecraft server running on localhost:25565
- Bot controller running on localhost:8765
- 5 AI agents (Agent1-Agent5) connected to server

## Available Commands

### Basic Commands

**say** - Make a bot speak in chat
```
/minecraft-agent say <bot_name> <message>
```

**move** - Move bot to coordinates
```
/minecraft-agent move <bot_name> <x> <y> <z>
```

**stop** - Stop bot movement
```
/minecraft-agent stop <bot_name>
```

### Behavior Modes

**follow** - Continuously follow a player
```
/minecraft-agent follow <bot_name> <player_name>
```
- Bot will track player movement and follow them continuously
- Optimized to reduce lag (only updates when player moves 3+ blocks)

**come** - Come to player once
```
/minecraft-agent come <bot_name> <player_name>
```
- Bot pathfinds to player's current location and stops

**patrol** - Patrol between waypoints
```
/minecraft-agent patrol <bot_name> <points_json>
```
- Bot walks between specified points in a loop
- Example points: `[{"x":-120,"y":71,"z":160},{"x":-130,"y":71,"z":170}]`

**guard** - Guard a position
```
/minecraft-agent guard <bot_name> <x> <y> <z>
```
- Bot moves to position and stays there

**wander** - Random exploration
```
/minecraft-agent wander <bot_name> <radius>
```
- Bot randomly walks within specified radius from current position

### Status Commands

**list** - List all bots and their positions
```
/minecraft-agent list
```

**status** - Get detailed bot status
```
/minecraft-agent status <bot_name>
```

## Implementation

When invoked, this skill should:

1. Parse the command and arguments
2. Construct appropriate API call to bot controller
3. Execute the API call using curl or requests
4. Return the result to the user

### API Endpoints

Base URL: `http://localhost:8765`

- POST `/bot/say` - Make bot speak
- POST `/bot/move` - Move bot to coordinates
- POST `/bot/follow` - Continuous follow mode
- POST `/bot/come` - Come once mode
- POST `/bot/patrol` - Patrol mode
- POST `/bot/guard` - Guard mode
- POST `/bot/wander` - Wander mode
- POST `/bot/stop` - Stop all movement
- GET `/bot/list` - List all bots
- GET `/bot/status/:name` - Get bot status

### Example API Calls

**Make bot speak:**
```bash
curl -X POST http://localhost:8765/bot/say \
  -H "Content-Type: application/json" \
  -d '{"bot_name": "Agent1", "message": "Hello"}'
```

**Follow player:**
```bash
curl -X POST http://localhost:8765/bot/follow \
  -H "Content-Type: application/json" \
  -d '{"bot_name": "Agent2", "target_name": "mcrafter3420"}'
```

**Wander:**
```bash
curl -X POST http://localhost:8765/bot/wander \
  -H "Content-Type: application/json" \
  -d '{"bot_name": "Agent3", "radius": 20}'
```

## Examples

### Demo Sequence

```bash
# Make agents introduce themselves
/minecraft-agent say Agent1 "I am Agent 1"
/minecraft-agent say Agent2 "I am Agent 2, she/her"

# Move agents to formation
/minecraft-agent move Agent1 -120 71 160
/minecraft-agent move Agent2 -120 71 165

# Set up behaviors
/minecraft-agent follow Agent3 mcrafter3420
/minecraft-agent wander Agent4 15
/minecraft-agent guard Agent5 -100 71 150
```

### Coordinated Actions

```bash
# All agents come to player
/minecraft-agent come Agent1 mcrafter3420
/minecraft-agent come Agent2 mcrafter3420
/minecraft-agent come Agent3 mcrafter3420
/minecraft-agent come Agent4 mcrafter3420
/minecraft-agent come Agent5 mcrafter3420

# Set up patrol
/minecraft-agent patrol Agent1 '[{"x":-120,"y":71,"z":160},{"x":-130,"y":71,"z":160},{"x":-130,"y":71,"z":170},{"x":-120,"y":71,"z":170}]'
```

## Bot Names

Available bots:
- Agent1
- Agent2 (female, she/her)
- Agent3
- Agent4
- Agent5

## Troubleshooting

**Bot not responding:**
- Check if bot controller is running: `curl http://localhost:8765/bot/list`
- Verify bot is connected to server
- Check bot controller logs: `tail -f /tmp/bot_final.log`

**Follow mode laggy:**
- Already optimized to only update when player moves 3+ blocks
- Consider using "come" mode for one-time pathfinding instead

**Bot stuck:**
- Use `/minecraft-agent stop <bot_name>` to reset
- Bot may be stuck on terrain - try moving it with move command
