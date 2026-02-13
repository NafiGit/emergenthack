#!/usr/bin/env python3
"""
Modern Glass Skyscraper Build
A futuristic tower with glass walls and colored floors
"""
import requests
import time

BOT_API = "http://localhost:8765"

def build(bot_name, endpoint, data, description):
    """Helper to build and report progress"""
    print(f"🤖 {bot_name}: {description}")
    response = requests.post(f"{BOT_API}{endpoint}", json=data)
    result = response.json()
    print(f"   ✅ {result.get('message', 'Done')}")
    return result

print("=" * 60)
print("   🏢 SKYSCRAPER CONSTRUCTION PROJECT 🏢")
print("=" * 60)
print("\nBuilding a modern glass tower!\n")

# Building location - away from castle
building_x, building_y, building_z = 20, 70, 180

print("Phase 1: Foundation & Ground Floor")
print("-" * 60)

# Obsidian foundation
build("Agent1", "/bot/build_floor", {
    "bot_name": "Agent1",
    "x": building_x, "y": building_y, "z": building_z,
    "width": 16, "length": 16,
    "block": "obsidian"
}, "Building obsidian foundation")
time.sleep(2)

# Ground floor lobby - polished stone
build("Agent2", "/bot/build_floor", {
    "bot_name": "Agent2",
    "x": building_x, "y": building_y + 1, "z": building_z,
    "width": 14, "length": 14,
    "block": "polished_blackstone"
}, "Creating lobby floor")
time.sleep(2)

print("\nPhase 2: Glass Tower Structure")
print("-" * 60)

# Build 4 corner pillars (quartz) - 30 blocks tall
corners = [
    (building_x - 7, building_z - 7, "Southwest pillar"),
    (building_x + 7, building_z - 7, "Southeast pillar"),
    (building_x - 7, building_z + 7, "Northwest pillar"),
    (building_x + 7, building_z + 7, "Northeast pillar")
]

for i, (x, z, name) in enumerate(corners):
    agent = f"Agent{(i % 5) + 1}"
    build(agent, "/bot/build_pillar", {
        "bot_name": agent,
        "x": x, "y_start": building_y + 2, "z": z,
        "height": 30,
        "block": "quartz_pillar"
    }, f"Building {name}")
    time.sleep(1.5)

print("\nPhase 3: Multi-Colored Floors")
print("-" * 60)

floors = [
    (5, "white_concrete", "White"),
    (8, "light_blue_concrete", "Sky Blue"),
    (11, "cyan_concrete", "Cyan"),
    (14, "blue_concrete", "Blue"),
    (17, "purple_concrete", "Purple"),
    (20, "magenta_concrete", "Magenta"),
    (23, "pink_concrete", "Pink"),
    (26, "red_concrete", "Red"),
    (29, "orange_concrete", "Orange"),
    (32, "gold_block", "Golden Rooftop")
]

for i, (y_offset, block, color_name) in enumerate(floors):
    agent = f"Agent{(i % 5) + 1}"
    build(agent, "/bot/build_floor", {
        "bot_name": agent,
        "x": building_x, "y": building_y + y_offset, "z": building_z,
        "width": 12, "length": 12,
        "block": block
    }, f"Building floor {i+1} - {color_name}")
    time.sleep(1)

print("\nPhase 4: Glass Walls")
print("-" * 60)

# Four glass walls between pillars
walls = [
    ("North", building_x - 7, building_x + 7, building_z - 7, building_z - 7),
    ("South", building_x - 7, building_x + 7, building_z + 7, building_z + 7),
    ("West", building_x - 7, building_x - 7, building_z - 7, building_z + 7),
    ("East", building_x + 7, building_x + 7, building_z - 7, building_z + 7)
]

for i, (direction, x1, x2, z1, z2) in enumerate(walls):
    agent = f"Agent{(i % 4) + 1}"
    build(agent, "/bot/build_wall", {
        "bot_name": agent,
        "x1": x1, "y1": building_y + 2, "z1": z1,
        "x2": x2, "y2": building_y + 31, "z2": z2,
        "block": "glass"
    }, f"Installing {direction} glass wall")
    time.sleep(2)

print("\nPhase 5: Rooftop Features")
print("-" * 60)

# Helipad on roof
build("Agent5", "/bot/build_floor", {
    "bot_name": "Agent5",
    "x": building_x, "y": building_y + 33, "z": building_z,
    "width": 8, "length": 8,
    "block": "light_gray_concrete"
}, "Building rooftop helipad")
time.sleep(2)

# Helipad markings (yellow)
build("Agent1", "/bot/build_cube", {
    "bot_name": "Agent1",
    "x": building_x, "y": building_y + 33, "z": building_z,
    "size": 3,
    "block": "yellow_concrete",
    "hollow": False
}, "Adding helipad markings")
time.sleep(2)

# Rooftop antenna
build("Agent2", "/bot/build_pillar", {
    "bot_name": "Agent2",
    "x": building_x, "y_start": building_y + 34, "z": building_z,
    "height": 5,
    "block": "iron_block"
}, "Installing antenna tower")
time.sleep(1)

# Beacon light on antenna
build("Agent3", "/bot/build_pillar", {
    "bot_name": "Agent3",
    "x": building_x, "y_start": building_y + 39, "z": building_z,
    "height": 2,
    "block": "redstone_lamp"
}, "Adding beacon lights")

print("\nPhase 6: Entrance & Landscaping")
print("-" * 60)

# Diamond entrance path
build("Agent4", "/bot/build_floor", {
    "bot_name": "Agent4",
    "x": building_x, "y": building_y, "z": building_z - 12,
    "width": 4, "length": 8,
    "block": "diamond_block"
}, "Creating VIP entrance path")
time.sleep(1)

# Decorative fountains (water features would be 4 small pools)
fountain_spots = [
    (building_x - 10, building_z - 10),
    (building_x + 10, building_z - 10),
    (building_x - 10, building_z + 10),
    (building_x + 10, building_z + 10)
]

for i, (x, z) in enumerate(fountain_spots):
    agent = f"Agent{(i % 3) + 1}"
    build(agent, "/bot/build_cube", {
        "bot_name": agent,
        "x": x, "y": building_y, "z": z,
        "size": 3,
        "block": "prismarine",
        "hollow": True
    }, f"Adding decorative feature {i+1}")
    time.sleep(0.5)

print("\n" + "=" * 60)
print("   🎉 SKYSCRAPER COMPLETE! 🎉")
print("=" * 60)
print(f"\nLocation: ({building_x}, {building_y}, {building_z})")
print("\nFeatures:")
print("  ✅ 10 colored floors (40+ blocks tall)")
print("  ✅ 4 quartz corner pillars")
print("  ✅ Glass walls on all sides")
print("  ✅ Golden rooftop with helipad")
print("  ✅ Antenna tower with beacon lights")
print("  ✅ Diamond VIP entrance path")
print("  ✅ 4 decorative prismarine features")
print("\nA modern masterpiece! 🏢✨")
