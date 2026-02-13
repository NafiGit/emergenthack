#!/usr/bin/env python3
"""
Set up building zones for each agent with colored boundaries
Each agent gets a 20x20 plot to build in
"""
from mcrcon import MCRcon

RCON_HOST = "localhost"
RCON_PORT = 25575
RCON_PASSWORD = "minecraft123"

def execute_command(command):
    with MCRcon(RCON_HOST, RCON_PASSWORD, port=RCON_PORT) as mcr:
        response = mcr.command(command)
        return response

print("=" * 60)
print("   🗺️  AGENT BUILDING ZONES 🗺️")
print("=" * 60)
print("\nCreating designated zones for each agent...\n")

# Define zones for 5 agents (20x20 plots with 5-block gaps)
zones = [
    {"agent": "Agent1", "name": "Red Zone", "x": -40, "z": 150, "color": "red_concrete"},
    {"agent": "Agent2", "name": "Blue Zone", "x": -10, "z": 150, "color": "blue_concrete"},
    {"agent": "Agent3", "name": "Green Zone", "x": 20, "z": 150, "color": "lime_concrete"},
    {"agent": "Agent4", "name": "Yellow Zone", "x": -40, "z": 185, "color": "yellow_concrete"},
    {"agent": "Agent5", "name": "Purple Zone", "x": -10, "z": 185, "color": "purple_concrete"},
]

y = 70  # Build level

print("Building zone markers...")
print()

for zone in zones:
    agent = zone["agent"]
    name = zone["name"]
    x = zone["x"]
    z = zone["z"]
    color = zone["color"]

    print(f"🏗️  {agent} - {name}")
    print(f"   Center: ({x}, {y}, {z})")
    print(f"   Size: 20x20")

    # Create colored border (just corners for visibility)
    corners = [
        (x - 10, z - 10),  # Southwest
        (x + 10, z - 10),  # Southeast
        (x - 10, z + 10),  # Northwest
        (x + 10, z + 10),  # Northeast
    ]

    for cx, cz in corners:
        # Place a small colored pillar at each corner
        execute_command(f"fill {cx} {y} {cz} {cx} {y+3} {cz} {color}")

    # Place a sign or marker at center
    execute_command(f"setblock {x} {y} {z} {color}")

    print(f"   ✅ Zone marked with {color} corners")
    print()

print("=" * 60)
print("   ✅ ALL ZONES SET UP!")
print("=" * 60)
print("\nZone Layout:")
print()
print("  [Agent4-Yellow]  [Agent5-Purple]")
print()
print("  [Agent1-Red]     [Agent2-Blue]     [Agent3-Green]")
print()
print("\nEach agent has a 20x20 plot with colored corner markers!")
print("Agents can now build within their designated zones! 🎨")
