# Minecraft Agent Control Skills

Skills for controlling AI agents and the Minecraft world for the emergentaihack project.

## Skills Included

### 1. minecraft-agent (skill.md)
Control AI agent bots in Minecraft with multiple behavior modes.

**Features:**
- 6 behavior modes: follow, come, patrol, guard, wander, stop
- Bot communication (say command)
- Movement control
- Status monitoring

**Usage:**
```
/minecraft-agent follow Agent2 mcrafter3420
/minecraft-agent say Agent1 "Hello world"
/minecraft-agent wander Agent3 20
```

### 2. minecraft-world-control
RCON-based world manipulation for spawning, items, and environment control.

**Features:**
- Entity spawning
- Item giving and block placement
- Time and weather control
- World editing (fill, setblock)

**Usage via Python:**
```python
from mcrcon import MCRcon
with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    mcr.command('summon creeper -120 71 160')
```

## Project Structure

```
~/.claude/skills/minecraft-agent/
├── README.md                      # This file
├── skill.md                       # Bot control skill
└── minecraft-world-control.md     # World control reference
```

## Related Project Files

```
/home/ubuntu/Desktop/emergentaihack/
├── agents/
│   ├── bot_controller.js          # Bot API (port 8765)
│   ├── minecraft_mcp_server.py    # MCP server with 12 tools
│   ├── spawn_bots.js              # Simple bot spawner
│   ├── requirements.txt           # Python dependencies
│   └── README.md                  # Agent documentation
├── context.md                     # Project documentation
└── server.properties              # Minecraft server config
```

## Setup

### 1. Start Minecraft Server
```bash
cd /home/ubuntu/Desktop/emergentaihack
java -Xmx2G -Xms1G -jar server.jar nogui
```

### 2. Start Bot Controller
```bash
cd /home/ubuntu/Desktop/emergentaihack
node agents/bot_controller.js
```

### 3. Connect to Game
Open http://localhost:3002 in browser and connect to localhost:25565

## Quick Start

### Spawn and Control Bots
```bash
# Bots auto-spawn when bot_controller starts
# Make them follow you
/minecraft-agent follow Agent1 mcrafter3420
/minecraft-agent follow Agent2 mcrafter3420

# Make them explore
/minecraft-agent wander Agent3 15
/minecraft-agent wander Agent4 20

# Set up patrol
/minecraft-agent patrol Agent5 '[{"x":-120,"y":71,"z":160},{"x":-130,"y":71,"z":170}]'
```

### Spawn Entities and Items
```python
from mcrcon import MCRcon

with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    # Spawn mobs
    mcr.command('summon zombie -120 71 160')
    mcr.command('summon villager -125 71 165')

    # Give items
    mcr.command('give mcrafter3420 diamond 64')
    mcr.command('give mcrafter3420 diamond_sword 1')

    # Set environment
    mcr.command('time set day')
    mcr.command('weather clear')
```

## API Reference

### Bot Controller API (port 8765)
- POST `/bot/say` - Make bot speak
- POST `/bot/move` - Move to coordinates
- POST `/bot/follow` - Continuous follow
- POST `/bot/come` - Come once
- POST `/bot/patrol` - Patrol waypoints
- POST `/bot/guard` - Guard position
- POST `/bot/wander` - Random walking
- POST `/bot/stop` - Stop movement
- GET `/bot/list` - List all bots
- GET `/bot/status/:name` - Bot status

### MCP Server Tools
Available via `agents/minecraft_mcp_server.py`:
- `spawn_entity` - Spawn any entity
- `give_item` - Give items to players
- `place_block` - Place/edit blocks
- `teleport_player` - Teleport players
- `set_time` - Change time
- `set_weather` - Change weather
- `execute_command` - Run any command
- `get_player_info` - List online players
- `bot_move` - Move bot
- `bot_follow` - Make bot follow
- `bot_say` - Make bot speak
- `bot_stop` - Stop bot

## Tips

**Bot not responding?**
- Check bot controller: `curl http://localhost:8765/bot/list`
- Check logs: `tail -f /tmp/bot_final.log`

**Entities not spawning?**
- Some entities (zombie_horse, skeleton_horse) may not render in web client
- Check server logs: `tail -f logs/latest.log`

**Clear entities:**
```python
mcr.command('kill @e[type=!player]')  # Kill all non-player entities
```

## Hackathon Ready

This skill set provides everything needed for:
- ✅ AI-controlled agent demonstrations
- ✅ Multi-agent coordination
- ✅ Autonomous behaviors (patrol, follow, wander)
- ✅ World manipulation via RCON
- ✅ LLM integration via MCP tools

Repository: https://github.com/NafiGit/emergenthack
