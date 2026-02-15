#!/bin/bash
# Base Island VM Startup Script

# Kill existing screens
screen -ls 2>/dev/null | grep -oP '\d+\.' | xargs -r -I{} screen -S {} -X quit 2>/dev/null
screen -wipe 2>/dev/null

echo "Starting Minecraft server (10GB RAM, Aikar's G1GC flags)..."
screen -dmS minecraft bash -c 'cd /home/azureuser/emergenthack/server/java-server && java -Xmx10G -Xms6G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -jar server.jar nogui 2>&1 | tee /tmp/mc-server.log'

echo "Waiting 40s for server to initialize..."
sleep 40

echo "Starting AI agents..."
screen -dmS agents bash -c 'cd /home/azureuser/emergenthack && node src/demo.js 2>&1 | tee /tmp/agents.log'

echo "Starting web client proxy..."
screen -dmS webclient bash -c 'cd /home/azureuser/emergenthack/web-client && node server.js --prod 2>&1 | tee /tmp/webclient.log'

sleep 5

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
screen -ls
echo ""
echo "   Server: $(tail -1 /tmp/mc-server.log 2>/dev/null)"
echo "   Agents: $(tail -1 /tmp/agents.log 2>/dev/null)"
echo "   Web:    $(tail -1 /tmp/webclient.log 2>/dev/null)"
echo "==========================================="
