#!/bin/bash
# Official Minecraft Server for Synapse Forge (Java 17 + 1.19.2)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/java-server"

echo "🎮 Starting Minecraft 1.19.2 Server (Java 17)..."
echo ""

# Check Java
if ! command -v java &> /dev/null; then
    echo "❌ Java not found! Install Java 17:"
    echo "   sudo apt install openjdk-17-jre-headless"
    exit 1
fi

# Check server.jar
if [ ! -f "$SERVER_DIR/server.jar" ]; then
    echo "📥 Downloading Minecraft 1.19.2 server..."
    mkdir -p "$SERVER_DIR"
    curl -o "$SERVER_DIR/server.jar" \
        "https://piston-data.mojang.com/v1/objects/f69c284232d7c7580bd89a5a4931c3581eae1378/server.jar"
fi

# Accept EULA
echo "eula=true" > "$SERVER_DIR/eula.txt"

cd "$SERVER_DIR"
java -Xmx2G -Xms1G -jar server.jar nogui
