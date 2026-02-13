# Synapse Forge

AI-powered Minecraft agent system with autonomous building capabilities, event monitoring, and intelligent spatial restrictions.

## Features

### 🤖 Multi-Agent System
- **5 autonomous agents** with individual build platforms
- **Spatial boundaries** - agents restricted to 10x10 platforms
- **Spawn protection** - prevents agent suffocation
- **Auto-rejoin** - automatic reconnection on disconnect (max 3 attempts)

### 🏗️ Building Capabilities
- **Coordinated builds** via bot controller API
- **Structure types**: walls, floors, cubes, pillars, pyramids
- **Boundary enforcement** - agents can only build within their zones
- **Height restrictions** - 30 blocks above platform

### 📊 Event System
- **Real-time event bus** tracking all agent activities
- **Event monitor** with auto-rejoin capabilities
- **Event types**: joined, left, moved, spoke, built, spawn_set, mode_changed
- **Statistics & logging** - comprehensive activity tracking

### 🛠️ Admin Tools
- **MCP integration** for AI-powered management
- **RCON commands** for direct server control
- **Platform creation** with automatic agent positioning
- **World management** (daytime, peaceful, weather, mob clearing)

## Quick Start

1. **Start the bot controller:**
   ```bash
   node agents/bot_controller.js
   ```

2. **Monitor agent events:**
   ```bash
   python3 event_monitor.py watch --auto-rejoin
   ```

3. **Create platforms:**
   ```python
   # Via MCP or direct API calls
   # Creates 5 colored platforms with spawn points and boundaries
   ```

## API Endpoints

### Bot Control
- `POST /bot/move` - Move agent to coordinates
- `POST /bot/follow` - Follow a player
- `POST /bot/say` - Agent chat message
- `POST /bot/stop` - Stop movement
- `POST /bot/rejoin` - Reconnect agent
- `POST /bot/set_spawn` - Set spawn point

### Building
- `POST /bot/build_wall` - Build a wall
- `POST /bot/build_floor` - Build a floor
- `POST /bot/build_cube` - Build a cube (solid/hollow)
- `POST /bot/build_pillar` - Build a pillar
- `POST /bot/build_pyramid` - Build a pyramid
- `POST /bot/place_block_manual` - Place individual blocks

### Events
- `GET /events/recent` - Get recent events
- `GET /events/stats` - Event statistics
- `GET /events/agent/:name` - Events by agent
- `GET /events/type/:type` - Events by type
- `POST /events/clear` - Clear event log

## Architecture

```
agents/
├── bot_controller.js    # Main bot management & API
├── event_bus.js         # Event system & logging
└── minecraft_mcp_server.py  # MCP integration

event_monitor.py         # Event monitoring CLI
showcase/               # Screenshots & demos
```

## Showcase

### The Great Buildoff

Five AI agents competed to build unique structures on their designated platforms:

![Buildoff Overview 1](showcase/buildoff-overview-1.png)
*Wide view showing Agent5's purple cube, Agent3's green pillar, and Agent1's red pyramid*

![Buildoff Overview 2](showcase/buildoff-overview-2.png)
*Alternative angle of the buildoff arena with multiple agent structures visible*

**Results:**
- 🔴 **Agent1**: 5-level Red Pyramid
- 🔵 **Agent2**: Hollow Blue Cube
- 🟢 **Agent3**: 8-block Green Pillar
- 🟡 **Agent4**: 8x8 Yellow Floor
- 🟣 **Agent5**: Solid Purple Cube

Check out the [showcase directory](./showcase/) for more details and documentation!

## Technology Stack

- **Node.js** - Bot controller & event system
- **Mineflayer** - Minecraft bot framework
- **Express** - REST API server
- **Python** - MCP server & monitoring tools
- **RCON** - Direct Minecraft server commands

## License

MIT
