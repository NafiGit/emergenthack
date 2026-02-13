#!/usr/bin/env python3
"""Simple manual block placement test"""
import requests
import time

BOT_API = "http://localhost:8765"

print("Testing simple manual block placement...")
print()

# Just have Agent3 place one block
print("Agent3 placing one diamond block manually...")
response = requests.post(f"{BOT_API}/bot/place_block_manual", json={
    "bot_name": "Agent3",
    "x": 70,
    "y": 72,
    "z": 180,
    "block": "diamond_block"
}, timeout=30)

print(f"Response: {response.json()}")
