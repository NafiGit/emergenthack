# SYNAPSE FORGE - 6-HOUR EMERGENCY DEMO

🚨 **URGENT: Demo in 6 hours!**

## Quick Start (2 People)

### 🐧 Linux Person (Server + Core)

```bash
# 1. Setup (5 minutes)
chmod +x QUICK_START_LINUX.sh
./QUICK_START_LINUX.sh

# 2. Add API key to .env
nano .env
# Add your ANTHROPIC_API_KEY

# 3. Start server (Terminal 1)
npm run server

# 4. Start agents (Terminal 2)
npm run demo

# 5. Watch magic happen!
# - Console shows agent decisions
# - http://localhost:3002 shows 3D view
```

### 🪟 Windows Person (Multi-Agent + Polish)

```bash
# 1. Pull latest code
git pull origin main

# 2. Setup (5 minutes)
QUICK_START_WINDOWS.bat

# 3. Add API key to .env
# Edit .env with Notepad
# Add your ANTHROPIC_API_KEY

# 4. Start server (Terminal 1)
npm run server

# 5. Start agents (Terminal 2)
npm run demo

# 6. Open browser
# http://localhost:3002
```

## What You'll See

- **Console**: Agent thoughts and actions in real-time
- **3D Viewer**: Bots moving, mining, exploring
- **Chat**: Agents talking to each other

## Demo Script (2 minutes)

```
0:00 - "3 AI agents powered by Claude in Minecraft"
0:20 - Show console with agent decisions
0:40 - Show 3D viewer with bots moving
1:00 - Point out autonomous chat between agents
1:20 - Explain: "No hardcoded behavior, pure LLM"
1:40 - Show different personalities (Vulkan mines, Terra explores, Sage socializes)
2:00 - "This is Phase 1. Phase 2 adds blockchain on Monad"
```

## If Something Breaks

**Server won't start?**
- Check port 55916 is free: `lsof -i :55916` (Linux) or `netstat -ano | findstr 55916` (Windows)
- Kill existing: `kill -9 <PID>`

**Bots won't connect?**
- Make sure server is running first
- Check console for errors

**Claude API errors?**
- Verify .env has correct API key
- Check API key has credits
- Check internet connection

**No 3D view?**
- Non-critical, agents still work
- Check http://localhost:3002
- Look for port conflicts

## Task List (6 Hours)

- [ ] Hour 1: Setup both machines, get 1 bot running
- [ ] Hour 2: Claude decision loop working
- [ ] Hour 3: 3 bots with different personalities
- [ ] Hour 4: Behaviors (mining, exploring, chatting)
- [ ] Hour 5: Polish viewer, test full demo
- [ ] Hour 6: Demo script, practice presentation

## Emergency Contact

Both people should test independently first, then coordinate!

**Server must run BEFORE bots connect.**
