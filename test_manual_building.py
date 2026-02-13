#!/usr/bin/env python3
"""Test manual building - bots place blocks like real players"""
import requests
import time

BOT_API = "http://localhost:8765"

print("=" * 60)
print("   🏗️ MANUAL BUILDING TEST 🏗️")
print("=" * 60)
print("\nAgents will build like real players - placing blocks manually!\n")

# Test 1: Agent1 builds a small wall manually
print("Test 1: Agent1 building a wall manually")
print("-" * 60)
response = requests.post(f"{BOT_API}/bot/build_manual", json={
    "bot_name": "Agent1",
    "structure": "wall",
    "x": 50, "y": 71, "z": 180,
    "block": "diamond_block"
})
result = response.json()
print(f"Result: {result}")
print()
time.sleep(2)

# Test 2: Agent2 builds a tower manually
print("Test 2: Agent2 building a tower manually")
print("-" * 60)
response = requests.post(f"{BOT_API}/bot/build_manual", json={
    "bot_name": "Agent2",
    "structure": "tower",
    "x": 55, "y": 71, "z": 180,
    "block": "gold_block"
})
result = response.json()
print(f"Result: {result}")
print()
time.sleep(2)

# Test 3: Agent3 builds a tiny house manually
print("Test 3: Agent3 building a house manually")
print("-" * 60)
response = requests.post(f"{BOT_API}/bot/build_manual", json={
    "bot_name": "Agent3",
    "structure": "house",
    "x": 60, "y": 71, "z": 180,
    "block": "oak_planks"
})
result = response.json()
print(f"Result: {result}")
print()

print("=" * 60)
print("   Manual building tests complete!")
print("=" * 60)
print("\nWatch the agents in-game - they're actually placing")
print("blocks one by one like real players! 🤖")
