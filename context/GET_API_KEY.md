# How to Get FREE OpenRouter API Key (30 seconds)

## Step 1: Go to OpenRouter
👉 https://openrouter.ai/keys

## Step 2: Sign In
- Click "Sign In"
- Use Google, GitHub, or email
- **No credit card required!** ✅

## Step 3: Create API Key
- Click "Create Key"
- Give it a name: "Synapse Forge"
- Copy the key (starts with `sk-or-...`)

## Step 4: Add to .env
```bash
# Linux
nano .env

# Windows
notepad .env
```

Paste:
```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Save and close.

## Done! 🎉

Free models available:
- ✅ Google Gemini Flash 1.5 (Fast, good quality)
- ✅ Meta Llama 3.1 8B (Open source)
- ✅ Qwen 2 7B (Fast, multilingual)

**No costs, no limits for basic usage!**

## If You Have Claude API Credits

Want to use Claude instead? Add this to .env:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Then change `demo.js` line 17:
```javascript
// Change this line to use Anthropic
import Anthropic from '@anthropic-ai/sdk';
```

But OpenRouter is FREE and works great! 🚀
