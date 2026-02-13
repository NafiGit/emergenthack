#!/usr/bin/env python3
"""Set peaceful conditions - no mobs, daytime"""
from mcrcon import MCRcon
import time
import threading

RCON_HOST = "localhost"
RCON_PORT = 25575
RCON_PASSWORD = "minecraft123"

def execute_command(command):
    with MCRcon(RCON_HOST, RCON_PASSWORD, port=RCON_PORT) as mcr:
        response = mcr.command(command)
        return response

print("🌅 Setting peaceful conditions...")
print()

# Set to daytime
print("☀️  Setting time to day...")
response = execute_command("time set day")
print(f"   {response}")

# Disable mob spawning
print("🚫 Disabling mob spawning...")
response = execute_command("gamerule doMobSpawning false")
print(f"   {response}")

# Clear existing hostile mobs
print("💀 Clearing existing hostile mobs...")
for mob in ["zombie", "skeleton", "creeper", "spider", "witch"]:
    response = execute_command(f"kill @e[type={mob}]")
    if "Killed" in response:
        print(f"   {response}")

print()
print("✅ Peaceful mode activated!")
print()
print("Mob spawning will be disabled for 1 hour.")
print("The world is now safe to explore! 🏰")
print()

# Schedule re-enabling after 1 hour
def re_enable_mobs():
    time.sleep(3600)  # Wait 1 hour (3600 seconds)
    print("\n⏰ 1 hour has passed!")
    print("🔄 Re-enabling mob spawning...")
    response = execute_command("gamerule doMobSpawning true")
    print(f"   {response}")
    print("✅ Normal mob spawning restored!")

# Start timer in background
timer_thread = threading.Thread(target=re_enable_mobs, daemon=True)
timer_thread.start()

print("Timer started: Mobs will return in 1 hour")
print("(Script will keep running in background)")
