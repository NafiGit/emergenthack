# Windows Setup - Synapse Forge Demo

⏰ **Quick setup for Windows teammate**

## Step 1: Pull Latest Code

```bash
cd emergentaihack
git pull origin main
```

## Step 2: Get OpenRouter API Key (30 seconds)

1. Go to: https://openrouter.ai/keys
2. Sign in (Google/GitHub - FREE, no card)
3. Click "Create Key"
4. Copy key (starts with `sk-or-v1-...`)

## Step 3: Install Dependencies

```bash
# Double-click or run:
QUICK_START_WINDOWS.bat

# OR manually:
npm install
```

## Step 4: Add API Key

Open `.env` in Notepad:
```
OPENROUTER_API_KEY=sk-or-v1-paste-your-key-here
```

Save and close.

## Step 5: Start Server

**Terminal 1 (Command Prompt):**
```bash
npm run server
```

Wait for: `✅ Server running on port 55916`

## Step 6: Start Bots

**Terminal 2 (New Command Prompt):**
```bash
npm run demo
```

You should see:
```
🤖 Spawning Vulkan (Forge Master)...
✅ Vulkan spawned at...
🧠 Vulkan thinking...
💭 Vulkan: "I should find resources..."
```

## Troubleshooting

### Port Already in Use
```bash
# Windows: Find and kill process on port 55916
netstat -ano | findstr :55916
taskkill /PID <number> /F
```

### Server Won't Start
- Make sure you ran `npm install` first
- Check Node.js is installed: `node --version`
- Should be v18 or v20

### Bots Won't Connect
- Make sure server is running FIRST
- Check server terminal says "Server listening on port 55916"
- Try closing and restarting both terminals

### API Errors
- Check `.env` has correct OpenRouter key
- Make sure no spaces around `=` in `.env`
- Verify key at: https://openrouter.ai/keys

## What You'll See

**Server Terminal:**
```
✅ Server running on port 55916
🤖 Agent "Vulkan" joined the simulation
🤖 Agent "Terra" joined the simulation
🤖 Agent "Sage" joined the simulation
```

**Demo Terminal:**
```
🧠 Vulkan thinking... (tick 1)
💭 Vulkan: "I should explore and find iron"
💬 Vulkan: "Looking for resources to mine"
🚶 Vulkan exploring north

🧠 Terra thinking... (tick 1)
💭 Terra: "I want to map the terrain"
💬 Terra: "I'll scout the area"
🚶 Terra exploring east
```

## Quick Test (2 minutes)

1. Start server → See ✅
2. Start demo → See bots spawn
3. Watch console for AI decisions
4. Success! 🎉

## Next Steps

Once this works:
- Add more behaviors (mining, building)
- Make agents interact more
- Polish demo script

## Emergency Contact

If stuck, message Linux teammate or check:
- https://github.com/NafiGit/emergenthack

---

**Goal: Get this running in next 15 minutes!**
