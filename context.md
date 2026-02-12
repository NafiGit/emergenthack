# Minecraft Server + AI Agent Setup

## Current Working Setup

### Running Services
1. **Minecraft Java Server** (Multiplayer)
   - Port: 25565
   - Version: 1.19.4
   - Java: 17 (via SDKMAN)
   - World: `/home/ubuntu/Desktop/emergentaihack/world/`
   - Logs: `/home/ubuntu/Desktop/emergentaihack/logs/latest.log`

2. **minecraft-web-client** (Browser-based client)
   - URL: http://localhost:3002
   - WebSocket Proxy: Port 9090
   - Location: `/tmp/minecraft-web-client/`
   - Connects players to the multiplayer server

### Key Configuration Files

**server.properties:**
- `server-port=25565`
- `online-mode=false` (offline mode for local development)
- `enforce-secure-profile=false` (CRITICAL: allows unsigned commands)
- `enable-rcon=true`
- `rcon.port=25575`
- `rcon.password=minecraft123`

**ops.json:**
```json
[
  {
    "uuid": "6a7a4268-5582-be77-5b68-31499468d1c2",
    "name": "mcrafter3420",
    "level": 4
  }
]
```
- UUIDs calculated using: `MD5("OfflinePlayer:username")`
- Level 4 = full admin access

## How Commands Work

### ❌ What DOESN'T Work
- **Bot commands via mineflayer** `.chat('/command')` → Gets "Unknown or incomplete command" error
- **Web client chat commands** → Client-side bug prevents commands from reaching server
- Manual ops.json edits without server restart

### ✅ What WORKS
- **RCON (Remote Console)** → Bypasses all authentication, works perfectly!

### Working RCON Setup

**Python (mcrcon library):**
```python
from mcrcon import MCRcon

with MCRcon('localhost', 'minecraft123', port=25575) as mcr:
    response = mcr.command('summon creeper ~ ~ ~')
    print(response)  # "Summoned new Creeper"
```

**Useful Commands:**
```bash
# Spawn entities
summon creeper X Y Z
summon zombie_horse X Y Z

# Give items
give <player> diamond 64
give <player> diamond_sword 1

# Place blocks
setblock X Y Z diamond_block

# Time/Weather
time set day
weather clear

# Teleport
tp <player> X Y Z
```

## Singleplayer vs Multiplayer

**Singleplayer (minecraft-web-client):**
- Uses flying-squid server running IN the browser
- World stored in browser IndexedDB
- Cannot access from filesystem
- Isolated from our Minecraft Java server

**Multiplayer (our setup):**
- External Java server on port 25565
- World on disk: `/home/ubuntu/Desktop/emergentaihack/world/`
- Can control via RCON
- This is what we use for AI agents

## For Hackathon: MCP Server

**Goal:** Build MCP server for AI agents to control Minecraft

**Capabilities:**
- Spawn any entity
- Place/break blocks
- Give items to players
- Change time/weather
- Teleport players
- Execute any Minecraft command via RCON

**Implementation:**
- Use Python `mcrcon` library
- Expose tools via MCP protocol
- Connect to localhost:25575 with RCON

## Troubleshooting

**Entities not spawning?**
- Check RCON connection (port 25575, password: minecraft123)
- Verify coordinates match player position
- Check server logs: `/home/ubuntu/Desktop/emergentaihack/logs/latest.log`

**Web client not connecting?**
- Ensure server is running on port 25565
- Check WebSocket proxy on port 9090
- Verify minecraft-web-client is running on port 3002

**Commands rejected?**
- Use RCON instead of bot `.chat()` commands
- Ensure `enforce-secure-profile=false` in server.properties
- Don't use commands through web client (client-side bug)

## Dependencies

**System:**
- Java 17 (SDKMAN)
- Node.js 18+
- Python 3 + mcrcon library

**NPM Packages:**
- mineflayer (for bots, though commands don't work through them)
- minecraft-web-client

## Working Directory Structure
```
/home/ubuntu/Desktop/emergentaihack/
├── server.jar                 # Minecraft 1.19.4 server
├── server.properties          # Server configuration
├── ops.json                   # Operator permissions
├── world/                     # Multiplayer world data
├── logs/                      # Server logs
└── package.json               # Node.js dependencies
```

## Next Steps

1. Build MCP server with RCON integration
2. Create tools for:
   - Entity spawning
   - Block placement
   - Item giving
   - World manipulation
3. Test with AI agents for hackathon
