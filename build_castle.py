#!/usr/bin/env python3
"""
Coordinated multi-agent castle build
All 5 agents work together to build an epic castle!
"""
import requests
import time

BOT_API = "http://localhost:8765"

def build_structure(bot_name, endpoint, data, description):
    """Helper to build and report progress"""
    print(f"🤖 {bot_name}: {description}")
    response = requests.post(f"{BOT_API}{endpoint}", json=data)
    result = response.json()
    print(f"   ✅ {result.get('message', 'Done')}")
    return result

print("=" * 60)
print("   🏰 CASTLE CONSTRUCTION PROJECT 🏰")
print("=" * 60)
print("\n5 AI Agents working together to build an epic castle!\n")

# Castle coordinates - centered at (-30, 70, 180)
castle_x, castle_y, castle_z = -30, 70, 180

print("Phase 1: Foundation")
print("-" * 60)
build_structure("Agent1", "/bot/build_floor", {
    "bot_name": "Agent1",
    "x": castle_x, "y": castle_y, "z": castle_z,
    "width": 30, "length": 30,
    "block": "stone_bricks"
}, "Building massive stone foundation (30x30)")
time.sleep(3)

# Add second layer for strength
build_structure("Agent2", "/bot/build_floor", {
    "bot_name": "Agent2",
    "x": castle_x, "y": castle_y + 1, "z": castle_z,
    "width": 28, "length": 28,
    "block": "stone"
}, "Reinforcing foundation with stone layer")
time.sleep(3)

print("\nPhase 2: Corner Towers")
print("-" * 60)

# Four corner towers (15 blocks tall)
towers = [
    (-45, castle_z - 15, "Northwest Tower"),
    (-15, castle_z - 15, "Northeast Tower"),
    (-45, castle_z + 15, "Southwest Tower"),
    (-15, castle_z + 15, "Southeast Tower")
]

for i, (x, z, name) in enumerate(towers):
    agent = f"Agent{(i % 4) + 1}"  # Rotate through agents
    build_structure(agent, "/bot/build_pillar", {
        "bot_name": agent,
        "x": x, "y_start": castle_y + 2, "z": z,
        "height": 15,
        "block": "stone_bricks"
    }, f"Building {name}")
    time.sleep(2)

print("\nPhase 3: Castle Walls")
print("-" * 60)

# North wall
build_structure("Agent1", "/bot/build_wall", {
    "bot_name": "Agent1",
    "x1": -45, "y1": castle_y + 2, "z1": castle_z - 15,
    "x2": -15, "y2": castle_y + 8, "z2": castle_z - 15,
    "block": "stone_bricks"
}, "Building North wall")
time.sleep(2)

# South wall
build_structure("Agent2", "/bot/build_wall", {
    "bot_name": "Agent2",
    "x1": -45, "y1": castle_y + 2, "z1": castle_z + 15,
    "x2": -15, "y2": castle_y + 8, "z2": castle_z + 15,
    "block": "stone_bricks"
}, "Building South wall")
time.sleep(2)

# East wall
build_structure("Agent3", "/bot/build_wall", {
    "bot_name": "Agent3",
    "x1": -15, "y1": castle_y + 2, "z1": castle_z - 15,
    "x2": -15, "y2": castle_y + 8, "z2": castle_z + 15,
    "block": "stone_bricks"
}, "Building East wall")
time.sleep(2)

# West wall
build_structure("Agent4", "/bot/build_wall", {
    "bot_name": "Agent4",
    "x1": -45, "y1": castle_y + 2, "z1": castle_z - 15,
    "x2": -45, "y2": castle_y + 8, "z2": castle_z + 15,
    "block": "stone_bricks"
}, "Building West wall")
time.sleep(2)

print("\nPhase 4: Throne Room")
print("-" * 60)

# Throne room floor (polished stone)
build_structure("Agent5", "/bot/build_floor", {
    "bot_name": "Agent5",
    "x": castle_x, "y": castle_y + 2, "z": castle_z,
    "width": 10, "length": 10,
    "block": "polished_andesite"
}, "Creating throne room floor")
time.sleep(2)

# Throne (small gold structure)
build_structure("Agent1", "/bot/build_cube", {
    "bot_name": "Agent1",
    "x": castle_x, "y": castle_y + 2, "z": castle_z - 3,
    "size": 3,
    "block": "gold_block",
    "hollow": False
}, "Building golden throne")
time.sleep(2)

print("\nPhase 5: Central Tower (Pyramid Roof)")
print("-" * 60)

# Central pillar
build_structure("Agent2", "/bot/build_pillar", {
    "bot_name": "Agent2",
    "x": castle_x, "y_start": castle_y + 2, "z": castle_z,
    "height": 10,
    "block": "quartz_block"
}, "Building central tower")
time.sleep(2)

# Pyramid cap
build_structure("Agent3", "/bot/build_pyramid", {
    "bot_name": "Agent3",
    "x": castle_x, "y": castle_y + 12, "z": castle_z,
    "size": 7,
    "block": "gold_block"
}, "Adding golden pyramid roof")
time.sleep(2)

print("\nPhase 6: Decorative Elements")
print("-" * 60)

# Diamond accents on tower tops
for i, (x, z, name) in enumerate(towers):
    agent = f"Agent{(i % 3) + 1}"
    build_structure(agent, "/bot/build_cube", {
        "bot_name": agent,
        "x": x, "y": castle_y + 17, "z": z,
        "size": 3,
        "block": "diamond_block",
        "hollow": False
    }, f"Adding diamond cap to {name}")
    time.sleep(1)

# Beacon in the center
build_structure("Agent5", "/bot/build_pillar", {
    "bot_name": "Agent5",
    "x": castle_x, "y_start": castle_y + 19, "z": castle_z,
    "height": 3,
    "block": "glowstone"
}, "Installing beacon light at the peak")

print("\n" + "=" * 60)
print("   🎉 CASTLE CONSTRUCTION COMPLETE! 🎉")
print("=" * 60)
print(f"\nLocation: ({castle_x}, {castle_y}, {castle_z})")
print("\nFeatures:")
print("  ✅ 30x30 stone foundation")
print("  ✅ 4 corner towers with diamond caps")
print("  ✅ Stone brick walls")
print("  ✅ Polished throne room floor")
print("  ✅ Golden throne")
print("  ✅ Central tower with pyramid roof")
print("  ✅ Glowstone beacon at peak")
print("\nGo check it out in the game! 🏰")
