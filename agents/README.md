# Minecraft Agent MCP Server

MCP server for AI agents to control Minecraft via RCON.

## Setup

```bash
cd agents
pip install -r requirements.txt
```

## Configuration

Edit `minecraft_mcp_server.py` to configure:
- `RCON_HOST` (default: localhost)
- `RCON_PORT` (default: 25575)
- `RCON_PASSWORD` (default: minecraft123)

## Running

```bash
python minecraft_mcp_server.py
```

## Available Tools

1. **spawn_entity** - Spawn any Minecraft entity
2. **give_item** - Give items to players
3. **place_block** - Place blocks in the world
4. **teleport_player** - Teleport players
5. **set_time** - Change time (day/night)
6. **set_weather** - Change weather
7. **execute_command** - Run any Minecraft command
8. **get_player_info** - List online players

## Usage with Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "python",
      "args": ["/home/ubuntu/Desktop/emergentaihack/agents/minecraft_mcp_server.py"]
    }
  }
}
```

## Examples

**Spawn a creeper:**
```python
spawn_entity(entity="creeper", x=100, y=64, z=100)
```

**Give diamonds:**
```python
give_item(player="mcrafter3420", item="diamond", amount=64)
```

**Build a structure:**
```python
place_block(x=100, y=64, z=100, block="diamond_block")
```
