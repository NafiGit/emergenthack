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
