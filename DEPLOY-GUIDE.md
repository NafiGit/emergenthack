# MineForge Azure Deployment Guide (for Bunny)

Two prompts below. Copy-paste each into your terminal step by step.

---

## PROMPT 1: Set Up the Azure VM

### 1A. Create the VM (run on your local machine with Azure CLI)

If you don't have Azure CLI, install it first: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

```bash
# Login to Azure
az login

# Create resource group (pick a region close to you)
az group create --name mineforge-rg --location centralindia

# Create the VM — Ubuntu 22.04, 4 vCPUs, 16GB RAM
az vm create \
  --resource-group mineforge-rg \
  --name mineforge-vm \
  --image Canonical:0001-com-ubuntu-server-jammy:22_04-lts:latest \
  --size Standard_D4s_v3 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --os-disk-size-gb 64 \
  --public-ip-sku Standard

# Open ALL required ports in one command
az vm open-port --resource-group mineforge-rg --name mineforge-vm --port 25565,9112,3002,3003,3004,4000 --priority 1000
```

After the VM is created, note the **publicIpAddress** from the output. Then SSH in:

```bash
ssh azureuser@<YOUR_VM_PUBLIC_IP>
```

### 1B. Install everything on the VM (run these INSIDE the VM via SSH)

Copy this entire block and paste it. It installs Java, Node.js, pnpm, and all system deps:

```bash
# System update
sudo apt-get update && sudo apt-get upgrade -y

# Java 17 (for Minecraft server)
sudo apt-get install -y openjdk-17-jre-headless

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm (for web-client)
sudo npm install -g pnpm

# Canvas native deps (for spectator viewer)
sudo apt-get install -y build-essential python3 pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# screen (to run services in background)
sudo apt-get install -y git screen

# Verify versions
echo "--- Versions ---"
java -version 2>&1 | head -1
node --version
npm --version
pnpm --version
echo "--- All good! ---"
```

### 1C. Clone the repo and install dependencies

```bash
cd ~
git clone https://github.com/NafiGit/emergenthack.git
cd emergenthack
git checkout main
git submodule update --init --recursive

# Install Node deps
npm install

# Install web-client deps
cd web-client && pnpm install && cd ..
```

### 1D. Configure environment

Ask Lokesh for the MONAD_PRIVATE_KEY. Paste API keys where indicated:

```bash
cd ~/emergenthack
cp .env.example .env
nano .env
```

Fill in the `.env` like this (replace the placeholder values):

```
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://synapse-forge-openai.openai.azure.com
AZURE_OPENAI_API_KEY=<ask-nafi-or-check-team-chat>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# OpenRouter (backup, free)
OPENROUTER_API_KEY=<ask-nafi-or-check-team-chat>

# Monad (ask Lokesh for private key)
MONAD_PRIVATE_KEY=<paste-lokesh-private-key-here>
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_REWARD_AMOUNT=0.001
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

---

## PROMPT 2: Deploy and Run

### 2A. Start the Minecraft server

```bash
cd ~/emergenthack

# Start server in a screen session
screen -dmS minecraft bash -c "npm run start-minecraft-server"

# Wait for it to fully start (watch for "Done" in logs)
sleep 30
screen -r minecraft
```

You should see `Done (X.XXXs)! For help, type "help"`. Press **Ctrl+A then D** to detach (leave it running).

### 2B. Build the arena village (one-time only, skip if world already has arenas)

```bash
cd ~/emergenthack
npm run build-arena-village
```

Wait for it to finish (takes ~30 seconds). You'll see "Arena village built!"

### 2C. Start the arena bots

```bash
screen -dmS arena bash -c "cd ~/emergenthack && npm run start-arena-bot"

# Check it's working
sleep 10
screen -r arena
```

You should see bots spawning and matches starting. Press **Ctrl+A then D** to detach.

### 2D. Start the AI civilization agents (optional, for the builder bots)

```bash
screen -dmS agents bash -c "cd ~/emergenthack && npm run start-ai-agents"
```

### 2E. Start the web client (browser access)

```bash
screen -dmS webclient bash -c "cd ~/emergenthack/web-client && node server.js --prod"
```

### 2F. Verify everything is running

```bash
# Check all screen sessions
screen -ls

# Should show:
#   minecraft  (running)
#   arena      (running)
#   agents     (running) — if you started it
#   webclient  (running)
```

### 2G. Access the server

- **Web client (browser):** `http://<YOUR_VM_PUBLIC_IP>:9112`
- **Minecraft Java client:** Add server `<YOUR_VM_PUBLIC_IP>:25565` (version 1.16.2)
- **Spectator viewers:** `http://<YOUR_VM_PUBLIC_IP>:3002` (and 3003, 3004)

---

## Quick Reference — Useful Commands

```bash
# View running services
screen -ls

# Attach to a service (to see logs)
screen -r minecraft    # or arena, agents, webclient

# Detach from a screen (leave it running)
# Press: Ctrl+A then D

# Stop a service
screen -r minecraft    # attach first
# Then press: Ctrl+C

# Restart everything from scratch
screen -ls | grep -oP '\d+\.' | xargs -I{} screen -S {} -X quit
# Then repeat steps 2A-2E

# Check what ports are listening
sudo ss -tulpn | grep -E '25565|9112|3002|4000'

# Check VM public IP
curl -s ifconfig.me
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Can't connect to server" | Check ports are open: `az vm open-port` (step 1A) |
| "npm install fails on canvas" | Run the `sudo apt-get install` block from step 1B again |
| Web client blank page | Make sure webclient screen is running: `screen -r webclient` |
| Bots not fighting | Check arena screen for errors: `screen -r arena` |
| "EULA not accepted" | Server auto-accepts it; if not, run `echo "eula=true" > ~/emergenthack/server/java-server/eula.txt` |
| Out of memory | VM needs at least 16GB RAM (Standard_D4s_v3) |
