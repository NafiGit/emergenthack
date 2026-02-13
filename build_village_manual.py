#!/usr/bin/env python3
"""
Agents build a small village manually - placing blocks like real players!
"""
import requests
import time

BOT_API = "http://localhost:8765"

def build_manual(bot_name, structure, x, y, z, block, description):
    """Have a bot build a structure manually"""
    print(f"🤖 {bot_name}: {description}")
    try:
        response = requests.post(f"{BOT_API}/bot/build_manual", json={
            "bot_name": bot_name,
            "structure": structure,
            "x": x, "y": y, "z": z,
            "block": block
        }, timeout=120)
        result = response.json()
        if 'blocks_placed' in result:
            print(f"   ✅ Placed {result['blocks_placed']} blocks")
        else:
            print(f"   {result.get('message', 'Done')}")
        return result
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return {}

print("=" * 60)
print("   🏘️  VILLAGE CONSTRUCTION - MANUAL MODE 🏘️")
print("=" * 60)
print("\nAgents will build a village by placing blocks manually!\n")
print("Watch them work in-game - they move and place blocks")
print("one at a time like real players!\n")

# Village center at (0, 70, 180) on the flat platform

print("Phase 1: Foundations")
print("-" * 60)

# Agent1 builds first house base
build_manual("Agent1", "house", -10, 70, 180, "oak_planks",
             "Building first house (oak planks)")
time.sleep(3)

# Agent2 builds second house base
build_manual("Agent2", "house", 10, 70, 180, "stone",
             "Building second house (stone)")
time.sleep(3)

print("\nPhase 2: Towers")
print("-" * 60)

# Agent3 builds a watchtower
build_manual("Agent3", "tower", 0, 70, 170, "quartz_block",
             "Building watchtower (quartz)")
time.sleep(3)

print("\nPhase 3: Walls & Pathways")
print("-" * 60)

# Agent1 builds connecting wall
build_manual("Agent1", "wall", -15, 70, 175, "stone",
             "Building village wall")
time.sleep(3)

# Agent2 builds pathway
build_manual("Agent2", "wall", -5, 70, 185, "diamond_block",
             "Building diamond pathway")
time.sleep(3)

print("\n" + "=" * 60)
print("   🎉 VILLAGE COMPLETE! 🎉")
print("=" * 60)
print("\nLocation: Around (0, 70, 180)")
print("\nFeatures:")
print("  ✅ 2 houses (oak & stone)")
print("  ✅ 1 watchtower (quartz)")
print("  ✅ Village walls")
print("  ✅ Diamond pathway")
print("\n🤖 All blocks placed manually by AI agents!")
print("   Watch the replay to see them work! 🏗️")
