#!/usr/bin/env python3
"""Test building tools"""
from mcrcon import MCRcon

RCON_HOST = "localhost"
RCON_PORT = 25575
RCON_PASSWORD = "minecraft123"

def test_builds():
    with MCRcon(RCON_HOST, RCON_PASSWORD, port=RCON_PORT) as mcr:
        print("Testing building tools...\n")

        # Test 1: Build a small wall
        print("1. Building wall...")
        response = mcr.command("fill -115 71 160 -115 75 165 stone")
        print(f"   Result: {response}\n")

        # Test 2: Build a floor
        print("2. Building floor platform...")
        response = mcr.command("fill -120 70 170 -110 70 180 diamond_block")
        print(f"   Result: {response}\n")

        # Test 3: Build a pillar
        print("3. Building pillar...")
        response = mcr.command("fill -100 71 160 -100 80 160 gold_block")
        print(f"   Result: {response}\n")

        # Test 4: Build a small cube
        print("4. Building solid cube...")
        response = mcr.command("fill -105 71 170 -100 76 175 emerald_block")
        print(f"   Result: {response}\n")

        # Test 5: Build hollow cube
        print("5. Building hollow cube (room)...")
        response = mcr.command("fill -95 71 160 -85 76 170 glass hollow")
        print(f"   Result: {response}\n")

        # Test 6: Build pyramid (layer by layer)
        print("6. Building small pyramid...")
        x, y, z = -110, 71, 190
        for level in range(5):
            half = (5 - level) // 2
            x1, x2 = x - half, x + half
            z1, z2 = z - half, z + half
            y_level = y + level
            response = mcr.command(f"fill {x1} {y_level} {z1} {x2} {y_level} {z2} sandstone")
            print(f"   Level {level}: {response}")
        print()

        # Test 7: Clear a small area
        print("7. Clearing test area...")
        response = mcr.command("fill -80 71 160 -75 75 165 air")
        print(f"   Result: {response}\n")

        print("All building tests completed!")

if __name__ == "__main__":
    test_builds()
