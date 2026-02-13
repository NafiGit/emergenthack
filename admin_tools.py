#!/usr/bin/env python3
"""
Admin Tools - Quick access to server control functions
Usage: python admin_tools.py <command> [args]
"""
from mcrcon import MCRcon
import sys
import requests

RCON_HOST = "localhost"
RCON_PORT = 25575
RCON_PASSWORD = "minecraft123"
BOT_API = "http://localhost:8765"

def execute_rcon(command):
    """Execute RCON command"""
    with MCRcon(RCON_HOST, RCON_PASSWORD, port=RCON_PORT) as mcr:
        return mcr.command(command)

def get_player_pos(player="mcrafter3420"):
    """Get player coordinates"""
    import re
    pos_data = execute_rcon(f"data get entity {player} Pos")
    match = re.search(r'\[([-\d.]+)d, ([-\d.]+)d, ([-\d.]+)d\]', pos_data)
    if match:
        return (int(float(match.group(1))),
                int(float(match.group(2))),
                int(float(match.group(3))))
    return None

# ============================================================
# TELEPORT TOOLS
# ============================================================

def tp_all_to_player(player="mcrafter3420"):
    """Teleport all agents to player"""
    print(f"🚀 Teleporting all agents to {player}...")
    for i in range(1, 6):
        agent = f"Agent{i}"
        result = execute_rcon(f"tp {agent} {player}")
        print(f"   {agent}: {result}")
    print("✅ Done!")

def stop_and_tp(player="mcrafter3420"):
    """Stop all agent movements then teleport to player"""
    print("🛑 Stopping all agents...")
    for i in range(1, 6):
        try:
            requests.post(f"{BOT_API}/bot/stop", json={"bot_name": f"Agent{i}"}, timeout=2)
        except:
            pass

    print(f"🚀 Teleporting to {player}...")
    for i in range(1, 6):
        result = execute_rcon(f"tp Agent{i} {player}")
        print(f"   Agent{i}: {result}")
    print("✅ Done!")

def tp_to_coords(player, x, y, z):
    """Teleport player to specific coordinates"""
    result = execute_rcon(f"tp {player} {x} {y} {z}")
    print(f"📍 {result}")

# ============================================================
# FLATTEN TOOLS
# ============================================================

def flatten_at_player(radius=50, player="mcrafter3420"):
    """Flatten area centered on player"""
    pos = get_player_pos(player)
    if not pos:
        print("❌ Could not get player position")
        return

    x, y, z = pos
    print(f"🌍 Flattening {radius*2}x{radius*2} area at ({x}, {y}, {z})...")

    # Create floor
    x1, x2 = x - radius, x + radius
    z1, z2 = z - radius, z + radius
    floor_y = y - 1

    result = execute_rcon(f"fill {x1} {floor_y} {z1} {x2} {floor_y} {z2} grass_block")
    print(f"   Floor: {result}")

    # Clear above in quadrants
    sections = [
        (x - radius, z - radius, x, z, "SW"),
        (x, z - radius, x + radius, z, "SE"),
        (x - radius, z, x, z + radius, "NW"),
        (x, z, x + radius, z + radius, "NE")
    ]

    for x1, z1, x2, z2, name in sections:
        for y_level in range(y, 120, 12):
            y_end = min(y_level + 11, 120)
            execute_rcon(f"fill {x1} {y_level} {z1} {x2} {y_end} {z2} air")

    print("✅ Flat area created!")

def flatten_coords(x, y, z, size=50):
    """Flatten area at specific coordinates"""
    print(f"🌍 Flattening {size*2}x{size*2} area at ({x}, {y}, {z})...")

    x1, x2 = x - size, x + size
    z1, z2 = z - size, z + size

    # Floor
    result = execute_rcon(f"fill {x1} {y} {z1} {x2} {y} {z2} grass_block")
    print(f"   Floor: {result}")

    # Clear above
    result = execute_rcon(f"fill {x1} {y+1} {z1} {x2} {y+30} {z2} air")
    print(f"   Cleared: {result}")
    print("✅ Done!")

# ============================================================
# WORLD CONTROL
# ============================================================

def set_daytime():
    """Set time to day"""
    result = execute_rcon("time set day")
    print(f"☀️  {result}")

def set_peaceful():
    """Disable mob spawning"""
    result = execute_rcon("gamerule doMobSpawning false")
    print(f"🚫 {result}")

def clear_mobs():
    """Kill all hostile mobs"""
    for mob in ["zombie", "skeleton", "creeper", "spider", "witch", "enderman"]:
        execute_rcon(f"kill @e[type={mob}]")
    print("💀 Cleared all hostile mobs")

def set_weather_clear():
    """Set clear weather"""
    result = execute_rcon("weather clear")
    print(f"☀️  {result}")

# ============================================================
# AGENT CONTROL
# ============================================================

def stop_all_agents():
    """Stop all agent movements"""
    print("🛑 Stopping all agents...")
    for i in range(1, 6):
        try:
            requests.post(f"{BOT_API}/bot/stop", json={"bot_name": f"Agent{i}"}, timeout=2)
            print(f"   Agent{i}: Stopped")
        except:
            print(f"   Agent{i}: Failed")
    print("✅ Done!")

def agents_follow_player(player="mcrafter3420"):
    """Make all agents follow player"""
    print(f"👥 All agents following {player}...")
    for i in range(1, 6):
        try:
            requests.post(f"{BOT_API}/bot/follow",
                         json={"bot_name": f"Agent{i}", "target_name": player},
                         timeout=2)
            print(f"   Agent{i}: Following")
        except:
            print(f"   Agent{i}: Failed")
    print("✅ Done!")

def agent_say_all(message):
    """Make all agents say something"""
    for i in range(1, 6):
        try:
            requests.post(f"{BOT_API}/bot/say",
                         json={"bot_name": f"Agent{i}", "message": message},
                         timeout=2)
        except:
            pass
    print(f"💬 All agents: '{message}'")

# ============================================================
# QUICK SETUP
# ============================================================

def quick_setup():
    """Quick world setup: peaceful, day, flat area, agents to player"""
    print("⚡ QUICK SETUP")
    print("=" * 60)

    set_daytime()
    set_peaceful()
    set_weather_clear()
    clear_mobs()
    print()

    flatten_at_player(50)
    print()

    stop_and_tp()
    print()

    print("✅ World ready for building!")

# ============================================================
# MAIN CLI
# ============================================================

def show_help():
    """Show available commands"""
    print("""
🔧 ADMIN TOOLS
============================================================

TELEPORT:
  tp              - Teleport all agents to you
  stop-tp         - Stop movements then teleport
  tp-coords X Y Z - Teleport you to coordinates

FLATTEN:
  flatten         - Flatten 100x100 area at your location
  flatten-big     - Flatten 200x200 area

WORLD:
  day             - Set time to day
  peaceful        - Disable mob spawning
  clear-mobs      - Kill all hostile mobs
  clear-weather   - Set clear weather

AGENTS:
  stop            - Stop all agent movements
  follow          - Make agents follow you
  say <msg>       - Make all agents say something

QUICK:
  setup           - Full setup (peaceful, day, flat, tp agents)

USAGE:
  python admin_tools.py <command> [args]
  python admin_tools.py tp
  python admin_tools.py flatten
  python admin_tools.py setup
""")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        show_help()
        sys.exit(0)

    cmd = sys.argv[1].lower()

    if cmd == "tp":
        tp_all_to_player()
    elif cmd == "stop-tp":
        stop_and_tp()
    elif cmd == "tp-coords" and len(sys.argv) >= 5:
        tp_to_coords("mcrafter3420", int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]))
    elif cmd == "flatten":
        flatten_at_player(50)
    elif cmd == "flatten-big":
        flatten_at_player(100)
    elif cmd == "day":
        set_daytime()
    elif cmd == "peaceful":
        set_peaceful()
    elif cmd == "clear-mobs":
        clear_mobs()
    elif cmd == "clear-weather":
        set_weather_clear()
    elif cmd == "stop":
        stop_all_agents()
    elif cmd == "follow":
        agents_follow_player()
    elif cmd == "say" and len(sys.argv) >= 3:
        agent_say_all(" ".join(sys.argv[2:]))
    elif cmd == "setup":
        quick_setup()
    else:
        show_help()
