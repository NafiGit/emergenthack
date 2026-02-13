---
name: minecraft-world-control
description: Control Minecraft world via RCON (spawn entities, change time/weather, give items)
version: 1.0.0
author: Claude & User
tags:
  - minecraft
  - rcon
  - world-control
  - admin
---

# Minecraft World Control

Control the Minecraft world using RCON commands for spawning, items, time, weather, and more.

## Prerequisites

- Minecraft server running with RCON enabled
- RCON port: 25575
- RCON password: minecraft123
- Python with mcrcon library installed

## Available Commands

### Entity Spawning

**Spawn any entity at coordinates:**
```python
from mcrcon import MCRcon
with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    mcr.command('summon <entity> <x> <y> <z>')
```

**Common entities:**
- Hostile: `creeper`, `zombie`, `skeleton`, `spider`, `witch`
- Passive: `cow`, `pig`, `sheep`, `chicken`, `horse`
- NPCs: `villager`, `iron_golem`
- Special: `zombie_horse`, `skeleton_horse` (may not render in web client)

### Item Management

**Give items to player:**
```python
mcr.command('give <player> <item> <amount>')
```

**Place blocks:**
```python
mcr.command('setblock <x> <y> <z> <block>')
```

**Fill area with blocks:**
```python
mcr.command('fill <x1> <y1> <z1> <x2> <y2> <z2> <block>')
```

### World Control

**Time:**
```python
mcr.command('time set day')     # 1000 ticks
mcr.command('time set night')   # 13000 ticks
mcr.command('time set noon')    # 6000 ticks
mcr.command('time set midnight') # 18000 ticks
```

**Weather:**
```python
mcr.command('weather clear')
mcr.command('weather rain')
mcr.command('weather thunder')
```

**Teleport:**
```python
mcr.command('tp <player> <x> <y> <z>')
```

### World Editing

**Create flat area:**
```python
# Create grass platform
mcr.command('fill -150 70 140 -100 70 190 grass_block')
# Clear above
mcr.command('fill -150 71 140 -100 85 190 air')
```

**Build structures:**
```python
# Diamond block pillar
for y in range(70, 80):
    mcr.command(f'setblock -120 {y} 160 diamond_block')
```

## Quick Functions

### Entity Spawner
```python
def spawn_entity(entity_type, x, y, z):
    from mcrcon import MCRcon
    with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
        response = mcr.command(f'summon {entity_type} {x} {y} {z}')
        return response
```

### Item Giver
```python
def give_items(player, item, amount=64):
    from mcrcon import MCRcon
    with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
        response = mcr.command(f'give {player} {item} {amount}')
        return response
```

### World Time Controller
```python
def set_time(time='day'):
    from mcrcon import MCRcon
    with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
        response = mcr.command(f'time set {time}')
        return response
```

## Examples

### Spawn Army
```python
from mcrcon import MCRcon
with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    # Spawn 5 iron golems in a circle
    for i in range(5):
        angle = (i / 5) * 2 * 3.14159
        x = -120 + 10 * cos(angle)
        z = 160 + 10 * sin(angle)
        mcr.command(f'summon iron_golem {x} 71 {z}')
```

### Give Starter Kit
```python
from mcrcon import MCRcon
with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    player = 'mcrafter3420'
    mcr.command(f'give {player} diamond_sword 1')
    mcr.command(f'give {player} diamond_pickaxe 1')
    mcr.command(f'give {player} diamond 64')
    mcr.command(f'give {player} cooked_beef 64')
```

### Build Platform
```python
from mcrcon import MCRcon
with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    # 50x50 diamond block platform
    mcr.command('fill -125 70 135 -75 70 185 diamond_block')
```

## Entity Rendering

**Known Issues with minecraft-web-client:**
- ✅ Works: creepers, zombies, skeletons, villagers, cows, pigs, horses
- ❌ May not render: zombie_horse, skeleton_horse
- If entity doesn't appear, it may still exist on server (check with `/kill @e[type=entity]`)

## Tips

**Clean up entities:**
```python
# Kill all creepers
mcr.command('kill @e[type=creeper]')

# Kill all mobs except players
mcr.command('kill @e[type=!player]')
```

**Check online players:**
```python
mcr.command('list')
```

**Clear weather and set day:**
```python
mcr.command('weather clear')
mcr.command('time set day')
```

## Integration with MCP Server

These commands are exposed via the MCP server at `agents/minecraft_mcp_server.py` with tools:
- `spawn_entity`
- `give_item`
- `place_block`
- `teleport_player`
- `set_time`
- `set_weather`
- `execute_command`
- `get_player_info`

Use the MCP tools for AI agent integration.
