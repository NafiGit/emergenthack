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
