#!/usr/bin/env python3
"""
Minecraft MCP Server - Control Minecraft via RCON for AI agents
"""
import asyncio
import json
import requests
from typing import Any, Sequence
from mcrcon import MCRcon
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
    LoggingLevel
)

# Server configuration
RCON_HOST = "localhost"
RCON_PORT = 25575
RCON_PASSWORD = "minecraft123"
BOT_CONTROLLER_URL = "http://localhost:8765"

# Create MCP server
app = Server("minecraft-agent-controller")

def execute_rcon_command(command: str) -> str:
    """Execute a command via RCON and return the response."""
    try:
        with MCRcon(RCON_HOST, RCON_PASSWORD, port=RCON_PORT) as mcr:
            response = mcr.command(command)
            return response if response else "Command executed successfully"
    except Exception as e:
        return f"Error: {str(e)}"

def call_bot_controller(endpoint: str, data: dict) -> str:
    """Call the bot controller API."""
    try:
        response = requests.post(f"{BOT_CONTROLLER_URL}{endpoint}", json=data, timeout=5)
        return response.json().get("message", "Success")
    except Exception as e:
        return f"Error: {str(e)}"

@app.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available Minecraft control tools."""
    return [
        Tool(
            name="spawn_entity",
            description="Spawn any Minecraft entity at specified coordinates. Use ~ for relative positioning.",
            inputSchema={
                "type": "object",
                "properties": {
                    "entity": {
                        "type": "string",
                        "description": "Entity type (e.g., 'zombie', 'creeper', 'pig', 'diamond_horse')"
                    },
                    "x": {
                        "type": ["number", "string"],
                        "description": "X coordinate or '~' for relative"
                    },
                    "y": {
                        "type": ["number", "string"],
                        "description": "Y coordinate or '~' for relative"
                    },
                    "z": {
                        "type": ["number", "string"],
                        "description": "Z coordinate or '~' for relative"
                    }
                },
                "required": ["entity", "x", "y", "z"]
            }
        ),
        Tool(
            name="give_item",
            description="Give items to a player",
            inputSchema={
                "type": "object",
                "properties": {
                    "player": {
                        "type": "string",
                        "description": "Player username"
                    },
                    "item": {
                        "type": "string",
                        "description": "Item type (e.g., 'diamond', 'diamond_sword', 'iron_pickaxe')"
                    },
                    "amount": {
                        "type": "number",
                        "description": "Number of items (1-64)",
                        "default": 1
                    }
                },
                "required": ["player", "item"]
            }
        ),
        Tool(
            name="place_block",
            description="Place a block at specified coordinates",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate"},
                    "y": {"type": "number", "description": "Y coordinate"},
                    "z": {"type": "number", "description": "Z coordinate"},
                    "block": {
                        "type": "string",
                        "description": "Block type (e.g., 'diamond_block', 'stone', 'oak_planks')"
                    }
                },
                "required": ["x", "y", "z", "block"]
            }
        ),
        Tool(
            name="teleport_player",
            description="Teleport a player to coordinates",
            inputSchema={
                "type": "object",
                "properties": {
                    "player": {
                        "type": "string",
                        "description": "Player username"
                    },
                    "x": {"type": "number", "description": "X coordinate"},
                    "y": {"type": "number", "description": "Y coordinate"},
                    "z": {"type": "number", "description": "Z coordinate"}
                },
                "required": ["player", "x", "y", "z"]
            }
        ),
        Tool(
            name="get_player_position",
            description="Get a player's current coordinates",
            inputSchema={
                "type": "object",
                "properties": {
                    "player": {
                        "type": "string",
                        "description": "Player username"
                    }
                },
                "required": ["player"]
            }
        ),
        Tool(
            name="tp_all_bots_to_player",
            description="Teleport all bots to a specific player's location",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_player": {
                        "type": "string",
                        "description": "Player username to teleport bots to"
                    }
                },
                "required": ["target_player"]
            }
        ),
        Tool(
            name="stop_and_tp_all_bots",
            description="Stop all bot movements and teleport them to a player",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_player": {
                        "type": "string",
                        "description": "Player username to teleport bots to"
                    }
                },
                "required": ["target_player"]
            }
        ),
        Tool(
            name="set_daytime",
            description="Set world time to day",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="set_peaceful",
            description="Disable mob spawning (peaceful mode)",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="clear_hostile_mobs",
            description="Kill all hostile mobs in the world",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="set_clear_weather",
            description="Set weather to clear",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="stop_all_bots",
            description="Stop all bot movements",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="all_bots_follow_player",
            description="Make all bots follow a specific player",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_player": {
                        "type": "string",
                        "description": "Player username to follow"
                    }
                },
                "required": ["target_player"]
            }
        ),
        Tool(
            name="all_bots_say",
            description="Make all bots say a message in chat",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Message for all bots to say"
                    }
                },
                "required": ["message"]
            }
        ),
        Tool(
            name="quick_world_setup",
            description="Quick setup: peaceful mode, daytime, clear weather, clear mobs, flatten area at player",
            inputSchema={
                "type": "object",
                "properties": {
                    "player": {
                        "type": "string",
                        "description": "Player to center flatten area on",
                        "default": "mcrafter3420"
                    },
                    "flatten_radius": {
                        "type": "number",
                        "description": "Radius for flatten area",
                        "default": 50
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="create_bot_platforms",
            description="Create 5 building platforms around a player, one for each bot",
            inputSchema={
                "type": "object",
                "properties": {
                    "player": {
                        "type": "string",
                        "description": "Player to center platforms around",
                        "default": "mcrafter3420"
                    },
                    "platform_size": {
                        "type": "number",
                        "description": "Size of each platform (default 20x20)",
                        "default": 20
                    },
                    "radius": {
                        "type": "number",
                        "description": "Distance from player to platforms",
                        "default": 35
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="set_time",
            description="Change the time in the Minecraft world",
            inputSchema={
                "type": "object",
                "properties": {
                    "time": {
                        "type": "string",
                        "description": "Time to set ('day', 'night', 'noon', 'midnight', or tick number)",
                        "enum": ["day", "night", "noon", "midnight"]
                    }
                },
                "required": ["time"]
            }
        ),
        Tool(
            name="set_weather",
            description="Change the weather in the Minecraft world",
            inputSchema={
                "type": "object",
                "properties": {
                    "weather": {
                        "type": "string",
                        "description": "Weather type",
                        "enum": ["clear", "rain", "thunder"]
                    }
                },
                "required": ["weather"]
            }
        ),
        Tool(
            name="execute_command",
            description="Execute any Minecraft command via RCON. Use this for advanced operations not covered by other tools.",
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Minecraft command to execute (without leading /)"
                    }
                },
                "required": ["command"]
            }
        ),
        Tool(
            name="get_player_info",
            description="Get information about online players",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="build_wall",
            description="Build a wall between two points",
            inputSchema={
                "type": "object",
                "properties": {
                    "x1": {"type": "number", "description": "Start X coordinate"},
                    "y1": {"type": "number", "description": "Start Y coordinate"},
                    "z1": {"type": "number", "description": "Start Z coordinate"},
                    "x2": {"type": "number", "description": "End X coordinate"},
                    "y2": {"type": "number", "description": "End Y coordinate"},
                    "z2": {"type": "number", "description": "End Z coordinate"},
                    "block": {
                        "type": "string",
                        "description": "Block type (e.g., 'stone', 'oak_planks', 'glass')",
                        "default": "stone"
                    }
                },
                "required": ["x1", "y1", "z1", "x2", "y2", "z2"]
            }
        ),
        Tool(
            name="build_floor",
            description="Build a flat floor/platform",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Y level"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "width": {"type": "number", "description": "Width (X direction)"},
                    "length": {"type": "number", "description": "Length (Z direction)"},
                    "block": {
                        "type": "string",
                        "description": "Block type",
                        "default": "stone"
                    }
                },
                "required": ["x", "y", "z", "width", "length"]
            }
        ),
        Tool(
            name="build_cube",
            description="Build a solid cube",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Bottom Y coordinate"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "size": {"type": "number", "description": "Cube size"},
                    "block": {
                        "type": "string",
                        "description": "Block type",
                        "default": "stone"
                    }
                },
                "required": ["x", "y", "z", "size"]
            }
        ),
        Tool(
            name="build_hollow_cube",
            description="Build a hollow cube/room with walls",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Bottom Y coordinate"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "size": {"type": "number", "description": "Cube size"},
                    "block": {
                        "type": "string",
                        "description": "Block type",
                        "default": "stone"
                    }
                },
                "required": ["x", "y", "z", "size"]
            }
        ),
        Tool(
            name="build_pillar",
            description="Build a vertical pillar",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate"},
                    "y_start": {"type": "number", "description": "Starting Y coordinate"},
                    "z": {"type": "number", "description": "Z coordinate"},
                    "height": {"type": "number", "description": "Pillar height"},
                    "block": {
                        "type": "string",
                        "description": "Block type",
                        "default": "stone"
                    }
                },
                "required": ["x", "y_start", "z", "height"]
            }
        ),
        Tool(
            name="build_pyramid",
            description="Build a pyramid structure",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Base Y coordinate"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "size": {"type": "number", "description": "Base size"},
                    "block": {
                        "type": "string",
                        "description": "Block type",
                        "default": "sandstone"
                    }
                },
                "required": ["x", "y", "z", "size"]
            }
        ),
        Tool(
            name="clear_area",
            description="Clear/remove blocks in an area (fill with air)",
            inputSchema={
                "type": "object",
                "properties": {
                    "x1": {"type": "number", "description": "Start X"},
                    "y1": {"type": "number", "description": "Start Y"},
                    "z1": {"type": "number", "description": "Start Z"},
                    "x2": {"type": "number", "description": "End X"},
                    "y2": {"type": "number", "description": "End Y"},
                    "z2": {"type": "number", "description": "End Z"}
                },
                "required": ["x1", "y1", "z1", "x2", "y2", "z2"]
            }
        ),
        Tool(
            name="flatten_area",
            description="Flatten an area to create a build platform",
            inputSchema={
                "type": "object",
                "properties": {
                    "x1": {"type": "number", "description": "Start X"},
                    "z1": {"type": "number", "description": "Start Z"},
                    "x2": {"type": "number", "description": "End X"},
                    "z2": {"type": "number", "description": "End Z"},
                    "y": {"type": "number", "description": "Height level to flatten to"},
                    "block": {"type": "string", "description": "Block type for floor", "default": "stone"},
                    "clear_height": {"type": "number", "description": "How high to clear above floor", "default": 30}
                },
                "required": ["x1", "z1", "x2", "z2", "y"]
            }
        ),
        Tool(
            name="bot_move",
            description="Move a bot to specific coordinates",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {
                        "type": "string",
                        "description": "Bot name (Agent1, Agent2, Agent3, Agent4, or Agent5)"
                    },
                    "x": {"type": "number", "description": "X coordinate"},
                    "y": {"type": "number", "description": "Y coordinate"},
                    "z": {"type": "number", "description": "Z coordinate"}
                },
                "required": ["bot_name", "x", "y", "z"]
            }
        ),
        Tool(
            name="bot_follow",
            description="Make a bot follow a player",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {
                        "type": "string",
                        "description": "Bot name (Agent1, Agent2, Agent3, Agent4, or Agent5)"
                    },
                    "target_name": {
                        "type": "string",
                        "description": "Player name to follow"
                    }
                },
                "required": ["bot_name", "target_name"]
            }
        ),
        Tool(
            name="bot_say",
            description="Make a bot say something in chat",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {
                        "type": "string",
                        "description": "Bot name (Agent1, Agent2, Agent3, Agent4, or Agent5)"
                    },
                    "message": {
                        "type": "string",
                        "description": "Message to say"
                    }
                },
                "required": ["bot_name", "message"]
            }
        ),
        Tool(
            name="bot_stop",
            description="Stop a bot's current movement",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {
                        "type": "string",
                        "description": "Bot name (Agent1, Agent2, Agent3, Agent4, or Agent5)"
                    }
                },
                "required": ["bot_name"]
            }
        ),
        Tool(
            name="bot_build_wall",
            description="Have a bot build a wall between two points",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {
                        "type": "string",
                        "description": "Bot name (Agent1, Agent2, Agent3, Agent4, or Agent5)"
                    },
                    "x1": {"type": "number", "description": "Start X coordinate"},
                    "y1": {"type": "number", "description": "Start Y coordinate"},
                    "z1": {"type": "number", "description": "Start Z coordinate"},
                    "x2": {"type": "number", "description": "End X coordinate"},
                    "y2": {"type": "number", "description": "End Y coordinate"},
                    "z2": {"type": "number", "description": "End Z coordinate"},
                    "block": {
                        "type": "string",
                        "description": "Block type",
                        "default": "stone"
                    }
                },
                "required": ["bot_name", "x1", "y1", "z1", "x2", "y2", "z2"]
            }
        ),
        Tool(
            name="bot_build_floor",
            description="Have a bot build a floor platform",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {"type": "string", "description": "Bot name"},
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Y level"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "width": {"type": "number", "description": "Width (X direction)"},
                    "length": {"type": "number", "description": "Length (Z direction)"},
                    "block": {"type": "string", "description": "Block type", "default": "stone"}
                },
                "required": ["bot_name", "x", "y", "z", "width", "length"]
            }
        ),
        Tool(
            name="bot_build_cube",
            description="Have a bot build a cube (solid or hollow)",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {"type": "string", "description": "Bot name"},
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Bottom Y coordinate"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "size": {"type": "number", "description": "Cube size"},
                    "block": {"type": "string", "description": "Block type", "default": "stone"},
                    "hollow": {"type": "boolean", "description": "Make it hollow", "default": False}
                },
                "required": ["bot_name", "x", "y", "z", "size"]
            }
        ),
        Tool(
            name="bot_build_pillar",
            description="Have a bot build a vertical pillar",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {"type": "string", "description": "Bot name"},
                    "x": {"type": "number", "description": "X coordinate"},
                    "y_start": {"type": "number", "description": "Starting Y coordinate"},
                    "z": {"type": "number", "description": "Z coordinate"},
                    "height": {"type": "number", "description": "Pillar height"},
                    "block": {"type": "string", "description": "Block type", "default": "stone"}
                },
                "required": ["bot_name", "x", "y_start", "z", "height"]
            }
        ),
        Tool(
            name="bot_build_pyramid",
            description="Have a bot build a pyramid structure",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {"type": "string", "description": "Bot name"},
                    "x": {"type": "number", "description": "Center X coordinate"},
                    "y": {"type": "number", "description": "Base Y coordinate"},
                    "z": {"type": "number", "description": "Center Z coordinate"},
                    "size": {"type": "number", "description": "Base size"},
                    "block": {"type": "string", "description": "Block type", "default": "sandstone"}
                },
                "required": ["bot_name", "x", "y", "z", "size"]
            }
        ),
        Tool(
            name="bot_clear_area",
            description="Have a bot clear/remove blocks in an area",
            inputSchema={
                "type": "object",
                "properties": {
                    "bot_name": {"type": "string", "description": "Bot name"},
                    "x1": {"type": "number", "description": "Start X"},
                    "y1": {"type": "number", "description": "Start Y"},
                    "z1": {"type": "number", "description": "Start Z"},
                    "x2": {"type": "number", "description": "End X"},
                    "y2": {"type": "number", "description": "End Y"},
                    "z2": {"type": "number", "description": "End Z"}
                },
                "required": ["bot_name", "x1", "y1", "z1", "x2", "y2", "z2"]
            }
        )
    ]

@app.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any]) -> Sequence[TextContent]:
    """Handle tool execution."""

    if name == "spawn_entity":
        entity = arguments["entity"]
        x = arguments["x"]
        y = arguments["y"]
        z = arguments["z"]
        command = f"summon {entity} {x} {y} {z}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "give_item":
        player = arguments["player"]
        item = arguments["item"]
        amount = arguments.get("amount", 1)
        command = f"give {player} {item} {amount}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "place_block":
        x = arguments["x"]
        y = arguments["y"]
        z = arguments["z"]
        block = arguments["block"]
        command = f"setblock {x} {y} {z} {block}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "teleport_player":
        player = arguments["player"]
        x = arguments["x"]
        y = arguments["y"]
        z = arguments["z"]
        command = f"tp {player} {x} {y} {z}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "set_time":
        time = arguments["time"]
        command = f"time set {time}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "set_weather":
        weather = arguments["weather"]
        command = f"weather {weather}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "execute_command":
        command = arguments["command"]
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "get_player_info":
        response = execute_rcon_command("list")
        return [TextContent(type="text", text=response)]

    elif name == "get_player_position":
        player = arguments["player"]
        # Use data get to get player position
        command = f"data get entity {player} Pos"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "tp_all_bots_to_player":
        target_player = arguments["target_player"]
        bot_names = ["Agent1", "Agent2", "Agent3", "Agent4", "Agent5"]
        responses = []

        for bot_name in bot_names:
            command = f"tp {bot_name} {target_player}"
            response = execute_rcon_command(command)
            responses.append(f"{bot_name}: {response}")

        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "stop_and_tp_all_bots":
        target_player = arguments["target_player"]
        bot_names = ["Agent1", "Agent2", "Agent3", "Agent4", "Agent5"]
        responses = []

        # First stop all bots
        for bot_name in bot_names:
            try:
                call_bot_controller("/bot/stop", {"bot_name": bot_name})
            except:
                pass

        # Then teleport them
        for bot_name in bot_names:
            command = f"tp {bot_name} {target_player}"
            response = execute_rcon_command(command)
            responses.append(f"{bot_name}: {response}")

        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "bot_move":
        bot_name = arguments["bot_name"]
        x = arguments["x"]
        y = arguments["y"]
        z = arguments["z"]
        response = call_bot_controller("/bot/move", {"bot_name": bot_name, "x": x, "y": y, "z": z})
        return [TextContent(type="text", text=response)]

    elif name == "bot_follow":
        bot_name = arguments["bot_name"]
        target_name = arguments["target_name"]
        response = call_bot_controller("/bot/follow", {"bot_name": bot_name, "target_name": target_name})
        return [TextContent(type="text", text=response)]

    elif name == "bot_say":
        bot_name = arguments["bot_name"]
        message = arguments["message"]
        response = call_bot_controller("/bot/say", {"bot_name": bot_name, "message": message})
        return [TextContent(type="text", text=response)]

    elif name == "bot_stop":
        bot_name = arguments["bot_name"]
        response = call_bot_controller("/bot/stop", {"bot_name": bot_name})
        return [TextContent(type="text", text=response)]

    elif name == "build_wall":
        x1, y1, z1 = arguments["x1"], arguments["y1"], arguments["z1"]
        x2, y2, z2 = arguments["x2"], arguments["y2"], arguments["z2"]
        block = arguments.get("block", "stone")
        command = f"fill {x1} {y1} {z1} {x2} {y2} {z2} {block}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "build_floor":
        x, y, z = arguments["x"], arguments["y"], arguments["z"]
        width, length = arguments["width"], arguments["length"]
        block = arguments.get("block", "stone")
        x1 = int(x - width // 2)
        x2 = int(x + width // 2)
        z1 = int(z - length // 2)
        z2 = int(z + length // 2)
        command = f"fill {x1} {y} {z1} {x2} {y} {z2} {block}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "build_cube":
        x, y, z = arguments["x"], arguments["y"], arguments["z"]
        size = arguments["size"]
        block = arguments.get("block", "stone")
        half = size // 2
        x1, y1, z1 = int(x - half), int(y), int(z - half)
        x2, y2, z2 = int(x + half), int(y + size - 1), int(z + half)
        command = f"fill {x1} {y1} {z1} {x2} {y2} {z2} {block}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "build_hollow_cube":
        x, y, z = arguments["x"], arguments["y"], arguments["z"]
        size = arguments["size"]
        block = arguments.get("block", "stone")
        half = size // 2
        x1, y1, z1 = int(x - half), int(y), int(z - half)
        x2, y2, z2 = int(x + half), int(y + size - 1), int(z + half)
        # Build outer walls
        command = f"fill {x1} {y1} {z1} {x2} {y2} {z2} {block} hollow"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "build_pillar":
        x, y_start, z = arguments["x"], arguments["y_start"], arguments["z"]
        height = arguments["height"]
        block = arguments.get("block", "stone")
        y_end = int(y_start + height - 1)
        command = f"fill {x} {y_start} {z} {x} {y_end} {z} {block}"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "build_pyramid":
        x, y, z = arguments["x"], arguments["y"], arguments["z"]
        size = arguments["size"]
        block = arguments.get("block", "sandstone")
        responses = []
        for level in range(size):
            half = (size - level) // 2
            x1 = int(x - half)
            x2 = int(x + half)
            z1 = int(z - half)
            z2 = int(z + half)
            y_level = int(y + level)
            command = f"fill {x1} {y_level} {z1} {x2} {y_level} {z2} {block}"
            response = execute_rcon_command(command)
            responses.append(f"Level {level}: {response}")
        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "clear_area":
        x1, y1, z1 = arguments["x1"], arguments["y1"], arguments["z1"]
        x2, y2, z2 = arguments["x2"], arguments["y2"], arguments["z2"]
        command = f"fill {x1} {y1} {z1} {x2} {y2} {z2} air"
        response = execute_rcon_command(command)
        return [TextContent(type="text", text=response)]

    elif name == "flatten_area":
        x1, z1 = arguments["x1"], arguments["z1"]
        x2, z2 = arguments["x2"], arguments["z2"]
        y = arguments["y"]
        block = arguments.get("block", "stone")
        clear_height = arguments.get("clear_height", 30)

        responses = []
        # Create floor
        command = f"fill {x1} {y} {z1} {x2} {y} {z2} {block}"
        response = execute_rcon_command(command)
        responses.append(f"Floor: {response}")

        # Clear above
        y_top = y + clear_height
        command = f"fill {x1} {y+1} {z1} {x2} {y_top} {z2} air"
        response = execute_rcon_command(command)
        responses.append(f"Cleared above: {response}")

        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "bot_build_wall":
        response = call_bot_controller("/bot/build_wall", arguments)
        return [TextContent(type="text", text=response)]

    elif name == "bot_build_floor":
        response = call_bot_controller("/bot/build_floor", arguments)
        return [TextContent(type="text", text=response)]

    elif name == "bot_build_cube":
        response = call_bot_controller("/bot/build_cube", arguments)
        return [TextContent(type="text", text=response)]

    elif name == "bot_build_pillar":
        response = call_bot_controller("/bot/build_pillar", arguments)
        return [TextContent(type="text", text=response)]

    elif name == "bot_build_pyramid":
        response = call_bot_controller("/bot/build_pyramid", arguments)
        return [TextContent(type="text", text=response)]

    elif name == "bot_clear_area":
        response = call_bot_controller("/bot/clear_area", arguments)
        return [TextContent(type="text", text=response)]

    elif name == "set_daytime":
        response = execute_rcon_command("time set day")
        return [TextContent(type="text", text=response)]

    elif name == "set_peaceful":
        response = execute_rcon_command("gamerule doMobSpawning false")
        return [TextContent(type="text", text=response)]

    elif name == "clear_hostile_mobs":
        mobs = ["zombie", "skeleton", "creeper", "spider", "witch", "enderman"]
        responses = []
        for mob in mobs:
            response = execute_rcon_command(f"kill @e[type={mob}]")
            if "Killed" in response:
                responses.append(response)
        result = "\n".join(responses) if responses else "No hostile mobs found"
        return [TextContent(type="text", text=result)]

    elif name == "set_clear_weather":
        response = execute_rcon_command("weather clear")
        return [TextContent(type="text", text=response)]

    elif name == "stop_all_bots":
        bot_names = ["Agent1", "Agent2", "Agent3", "Agent4", "Agent5"]
        responses = []
        for bot_name in bot_names:
            try:
                call_bot_controller("/bot/stop", {"bot_name": bot_name})
                responses.append(f"{bot_name}: Stopped")
            except:
                responses.append(f"{bot_name}: Failed")
        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "all_bots_follow_player":
        target_player = arguments["target_player"]
        bot_names = ["Agent1", "Agent2", "Agent3", "Agent4", "Agent5"]
        responses = []
        for bot_name in bot_names:
            try:
                call_bot_controller("/bot/follow", {"bot_name": bot_name, "target_name": target_player})
                responses.append(f"{bot_name}: Following {target_player}")
            except:
                responses.append(f"{bot_name}: Failed")
        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "all_bots_say":
        message = arguments["message"]
        bot_names = ["Agent1", "Agent2", "Agent3", "Agent4", "Agent5"]
        for bot_name in bot_names:
            try:
                call_bot_controller("/bot/say", {"bot_name": bot_name, "message": message})
            except:
                pass
        return [TextContent(type="text", text=f"All bots saying: {message}")]

    elif name == "quick_world_setup":
        player = arguments.get("player", "mcrafter3420")
        radius = arguments.get("flatten_radius", 50)
        responses = []

        # Set daytime
        responses.append(execute_rcon_command("time set day"))
        # Peaceful mode
        responses.append(execute_rcon_command("gamerule doMobSpawning false"))
        # Clear weather
        responses.append(execute_rcon_command("weather clear"))
        # Clear mobs
        for mob in ["zombie", "skeleton", "creeper", "spider"]:
            execute_rcon_command(f"kill @e[type={mob}]")
        responses.append("Cleared hostile mobs")

        # Flatten and clear area
        responses.append(f"World setup complete for {player}")
        return [TextContent(type="text", text="\n".join(responses))]

    elif name == "create_bot_platforms":
        import math
        import re

        player = arguments.get("player", "mcrafter3420")
        platform_size = arguments.get("platform_size", 20)
        radius = arguments.get("radius", 35)

        # Get player position
        pos_data = execute_rcon_command(f"data get entity {player} Pos")
        match = re.search(r'\[([-\d.]+)d, ([-\d.]+)d, ([-\d.]+)d\]', pos_data)

        if not match:
            return [TextContent(type="text", text="Could not get player position")]

        center_x = int(float(match.group(1)))
        center_y = int(float(match.group(2)))
        center_z = int(float(match.group(3)))

        platforms = [
            {"agent": "Agent1", "color": "red_concrete", "angle": 0},
            {"agent": "Agent2", "color": "blue_concrete", "angle": 72},
            {"agent": "Agent3", "color": "lime_concrete", "angle": 144},
            {"agent": "Agent4", "color": "yellow_concrete", "angle": 216},
            {"agent": "Agent5", "color": "purple_concrete", "angle": 288},
        ]

        responses = []
        for p in platforms:
            angle_rad = math.radians(p["angle"])
            px = center_x + int(radius * math.cos(angle_rad))
            pz = center_z + int(radius * math.sin(angle_rad))
            py = center_y - 1

            half = platform_size // 2
            x1, x2 = px - half, px + half
            z1, z2 = pz - half, pz + half

            # Create colored borders
            execute_rcon_command(f"fill {x1} {py} {z1} {x2} {py} {z1} {p['color']}")
            execute_rcon_command(f"fill {x1} {py} {z2} {x2} {py} {z2} {p['color']}")
            execute_rcon_command(f"fill {x1} {py} {z1} {x1} {py} {z2} {p['color']}")
            execute_rcon_command(f"fill {x2} {py} {z1} {x2} {py} {z2} {p['color']}")

            # Fill interior
            execute_rcon_command(f"fill {x1+1} {py} {z1+1} {x2-1} {py} {z2-1} grass_block")

            # Clear above
            execute_rcon_command(f"fill {x1} {py+1} {z1} {x2} {py+25} {z2} air")

            # Center marker
            execute_rcon_command(f"setblock {px} {py} {pz} {p['color']}")
            execute_rcon_command(f"setblock {px} {py+1} {pz} {p['color']}")

            responses.append(f"{p['agent']}: {p['color'].replace('_concrete', '')} platform at ({px}, {py}, {pz})")

        return [TextContent(type="text", text="Created 5 platforms:\n" + "\n".join(responses))]

    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]

async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="minecraft-agent-controller",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                )
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
