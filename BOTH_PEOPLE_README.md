# Synapse Forge - Team Setup (2 People)

## Current Status

✅ Code committed with OpenRouter (FREE models)
✅ Server configured for Minecraft 1.12.2 (stable)
✅ 3 AI agents ready (Vulkan, Terra, Sage)

## Next 30 Minutes - Both People Do This

### 🐧 Linux Person

```bash
cd ~/Desktop/emergentaihack
git pull origin main

# Server already running? If not:
npm run server

# In new terminal:
npm run demo
```

### 🪟 Windows Person

```bash
cd emergentaihack
git pull origin main

# Install (if first time):
npm install

# Add API key to .env:
# OPENROUTER_API_KEY=sk-or-v1-...

# Terminal 1:
npm run server

# Terminal 2:
npm run demo
```

## ✅ Success Checklist

Both people should see:

- [ ] Server starts: `✅ Server running on port 55916`
- [ ] 3 bots spawn: `🤖 Spawning Vulkan...`
- [ ] Bots connect: `✅ Vulkan spawned at...`
- [ ] AI decisions: `🧠 Vulkan thinking...`
- [ ] Actions happening: `💬 Vulkan: "Looking for resources"`

## Timeline (5 Hours Left)

```
Now (30 min):
├─ BOTH: Get basic demo running
└─ Verify bots make AI decisions

Next 2 hours:
├─ Linux: Improve behaviors (mining, exploring)
└─ Windows: Polish demo script, test presentation

Next 2 hours:
├─ BOTH: Full test run together
└─ Fix any critical bugs

Final hour:
├─ BOTH: Practice demo
└─ Prepare presentation
```

## Demo Script (Draft)

**0:00-0:30** - "We built AI agents that live in Minecraft"
**0:30-1:00** - Show server + 3 agents spawning
**1:00-2:00** - Show agent decisions in real-time
**2:00-3:00** - Agents interact and chat
**3:00-4:00** - Explain: No hardcoded behavior, pure LLM
**4:00-5:00** - "Phase 2 will add this to Monad blockchain"

## Emergency Contacts

- Linux person has OpenRouter key saved
- Windows person: Get key at https://openrouter.ai/keys
- Both: Check GitHub for latest code

---

**GOAL: Working demo in 30 minutes!**
