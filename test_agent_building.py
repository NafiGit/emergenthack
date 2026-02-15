#!/usr/bin/env python3
"""Test agent building capabilities"""
import requests
import time

BOT_API = "http://localhost:8765"

print("Testing agent building capabilities...\n")

# Test 1: Agent1 builds a diamond wall
print("1. Agent1 building a diamond wall...")
response = requests.post(f"{BOT_API}/bot/build_wall", json={
    "bot_name": "Agent1",
    "x1": -90, "y1": 71, "z1": 150,
    "x2": -90, "y2": 75, "z2": 155,
    "block": "diamond_block"
})
print(f"   Response: {response.json()}\n")
time.sleep(3)

# Test 2: Agent2 builds a gold floor
print("2. Agent2 building a gold floor...")
response = requests.post(f"{BOT_API}/bot/build_floor", json={
    "bot_name": "Agent2",
    "x": -80, "y": 70, "z": 150,
    "width": 10, "length": 10,
    "block": "gold_block"
})
print(f"   Response: {response.json()}\n")
time.sleep(3)

# Test 3: Agent3 builds an emerald pillar
print("3. Agent3 building an emerald pillar...")
response = requests.post(f"{BOT_API}/bot/build_pillar", json={
    "bot_name": "Agent3",
    "x": -70, "y_start": 71, "z": 150,
    "height": 10,
    "block": "emerald_block"
})
print(f"   Response: {response.json()}\n")
time.sleep(3)

# Test 4: Agent4 builds a glass cube
print("4. Agent4 building a glass cube...")
response = requests.post(f"{BOT_API}/bot/build_cube", json={
    "bot_name": "Agent4",
    "x": -60, "y": 71, "z": 150,
    "size": 5,
    "block": "glass",
    "hollow": True
})
print(f"   Response: {response.json()}\n")
time.sleep(3)

# Test 5: Agent5 builds a small pyramid
print("5. Agent5 building a pyramid...")
response = requests.post(f"{BOT_API}/bot/build_pyramid", json={
    "bot_name": "Agent5",
    "x": -50, "y": 71, "z": 150,
    "size": 5,
    "block": "sandstone"
})
print(f"   Response: {response.json()}\n")

print("All agent building tests complete! Check the game to see the structures!")
