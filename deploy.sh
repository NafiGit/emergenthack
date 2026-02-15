#!/bin/bash
set -e

echo "=== BASE ISLAND - VM DEPLOYMENT ==="
echo "Setting up on $(hostname) at $(date)"

# System updates & dependencies
echo "[1/8] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq openjdk-17-jre-headless git curl unzip screen > /dev/null 2>&1

# Install Node.js 20
echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y -qq nodejs > /dev/null 2>&1
fi
echo "   Node: $(node --version), NPM: $(npm --version)"

# Install pnpm
echo "[3/8] Installing pnpm..."
if ! command -v pnpm &> /dev/null; then
    sudo npm install -g pnpm > /dev/null 2>&1
fi

# Clone or update the repo
echo "[4/8] Cloning repository..."
cd /home/azureuser
if [ -d "emergenthack" ]; then
    cd emergenthack
    git fetch origin
    git checkout linux
    git pull origin linux
else
    git clone -b linux https://github.com/NafiGit/emergenthack.git
    cd emergenthack
fi

# Create .env file
echo "[5/8] Configuring environment..."
cat > .env << 'ENVEOF'
AZURE_OPENAI_ENDPOINT=https://eastus2.api.cognitive.microsoft.com
AZURE_OPENAI_API_KEY=579e293d41c54ff795d959d76a81353b
AZURE_OPENAI_DEPLOYMENT=gpt-5-2-chat
ENVEOF

# Install Node dependencies
echo "[6/8] Installing Node.js dependencies..."
npm install > /dev/null 2>&1

# Setup Minecraft server
echo "[7/8] Setting up Minecraft server..."
mkdir -p server/java-server
cd server/java-server

if [ ! -f "server.jar" ]; then
    echo "   Downloading Minecraft 1.19.2 server..."
    curl -sL "https://piston-data.mojang.com/v1/objects/f69c284232d7c7580bd89a5a4931c3581eae1378/server.jar" -o server.jar
fi

# Accept EULA
echo "eula=true" > eula.txt

# Optimized server.properties
cat > server.properties << 'PROPEOF'
#Minecraft server properties
enable-jmx-monitoring=false
rcon.port=25575
level-seed=
gamemode=survival
enable-command-block=true
enable-query=false
generator-settings={}
enforce-secure-profile=false
level-name=world
motd=Base Island - Onchain AI Civilization
query.port=25565
pvp=true
generate-structures=true
max-chained-neighbor-updates=1000000
difficulty=easy
network-compression-threshold=128
max-tick-time=120000
require-resource-pack=false
use-native-transport=true
max-players=20
online-mode=false
enable-status=true
allow-flight=true
broadcast-rcon-to-ops=true
view-distance=32
server-ip=
resource-pack-prompt=
allow-nether=true
server-port=25565
enable-rcon=true
sync-chunk-writes=true
op-permission-level=4
prevent-proxy-connections=false
hide-online-players=false
resource-pack=
entity-broadcast-range-percentage=100
simulation-distance=20
rcon.password=minecraft123
player-idle-timeout=0
force-gamemode=false
rate-limit=0
hardcore=false
white-list=false
broadcast-console-to-ops=true
spawn-npcs=true
spawn-animals=true
function-permission-level=2
level-type=minecraft\:normal
spawn-monsters=true
enforce-whitelist=false
spawn-protection=0
resource-pack-sha1=
max-world-size=29999984
PROPEOF

# OPs file
cat > ops.json << 'OPSEOF'
[
  {"uuid":"00000000-0000-0000-0000-000000000004","name":"Ahaan","level":4,"bypassesPlayerLimit":false},
  {"uuid":"00000000-0000-0000-0000-000000000001","name":"Architect","level":4,"bypassesPlayerLimit":false},
  {"uuid":"00000000-0000-0000-0000-000000000002","name":"Saumya","level":4,"bypassesPlayerLimit":false},
  {"uuid":"00000000-0000-0000-0000-000000000003","name":"Sumedha","level":4,"bypassesPlayerLimit":false}
]
OPSEOF

cd /home/azureuser/emergenthack

# Setup web client
echo "[8/8] Building web client..."
cd web-client
if [ ! -d "node_modules" ]; then
    pnpm install > /dev/null 2>&1
fi
if [ -d "dist" ]; then
    echo "   Web client dist exists, skipping build"
else
    npx rsbuild build > /dev/null 2>&1
fi
cd ..

echo ""
echo "=== SETUP COMPLETE ==="
echo ""

# JVM optimization flags for the server
JVM_ARGS="-Xmx10G -Xms6G \
-XX:+UseG1GC \
-XX:+ParallelRefProcEnabled \
-XX:MaxGCPauseMillis=200 \
-XX:+UnlockExperimentalVMOptions \
-XX:+DisableExplicitGC \
-XX:+AlwaysPreTouch \
-XX:G1NewSizePercent=30 \
-XX:G1MaxNewSizePercent=40 \
-XX:G1HeapRegionSize=8M \
-XX:G1ReservePercent=20 \
-XX:G1HeapWastePercent=5 \
-XX:G1MixedGCCountTarget=4 \
-XX:InitiatingHeapOccupancyPercent=15 \
-XX:G1MixedGCLiveThresholdPercent=90 \
-XX:G1RSetUpdatingPauseTimePercent=5 \
-XX:SurvivorRatio=32 \
-XX:+PerfDisableSharedMem \
-XX:MaxTenuringThreshold=1 \
-Dusing.aikars.flags=https://mcflags.emc.gs \
-Daikars.new.flags=true"

# Start everything in screen sessions
echo "Starting Minecraft server..."
screen -dmS minecraft bash -c "cd /home/azureuser/emergenthack/server/java-server && java $JVM_ARGS -jar server.jar nogui"

echo "Waiting for server to start..."
sleep 30

echo "Starting AI agents..."
screen -dmS agents bash -c "cd /home/azureuser/emergenthack && node src/demo.js"

echo "Starting web client proxy..."
screen -dmS webclient bash -c "cd /home/azureuser/emergenthack/web-client && node server.js --prod"

sleep 5

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me)

echo ""
echo "==========================================="
echo "   BASE ISLAND IS LIVE!"
echo "==========================================="
echo ""
echo "   Web Client:  http://${PUBLIC_IP}:8080"
echo "   MC Server:   ${PUBLIC_IP}:25565"
echo "   RCON:        ${PUBLIC_IP}:25575"
echo ""
echo "   Screen sessions:"
echo "     screen -r minecraft"
echo "     screen -r agents"
echo "     screen -r webclient"
echo ""
echo "==========================================="
