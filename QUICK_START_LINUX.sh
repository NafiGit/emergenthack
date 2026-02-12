#!/bin/bash
# SYNAPSE FORGE - 6-HOUR EMERGENCY SETUP (LINUX)

set -e

echo "🚀 Synapse Forge - Emergency Demo Setup (Linux)"
echo "================================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✓ Node.js $(node --version)"

# Create project structure
cd ~/Desktop/emergentaihack
echo "📁 Creating project structure..."

mkdir -p src/agents src/behaviors server

# Initialize package.json
cat > package.json << 'EOF'
{
  "name": "synapse-forge",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "server": "node server/start-server.js",
    "demo": "node src/demo.js"
  },
  "dependencies": {
    "mineflayer": "^4.20.1",
    "mineflayer-pathfinder": "^2.4.5",
    "mineflayer-collectblock": "^1.4.1",
    "prismarine-viewer": "^1.28.0",
    "flying-squid": "^1.17.1",
    "axios": "^1.6.7",
    "dotenv": "^16.4.0"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies (this takes 2-3 minutes)..."
npm install

# Create .env file
if [ ! -f .env ]; then
    echo "🔑 Creating .env file..."
    cat > .env << 'EOF'
# Get FREE API key at: https://openrouter.ai/keys
OPENROUTER_API_KEY=your_key_here
EOF
    echo ""
    echo "⚠️  IMPORTANT: Get FREE OpenRouter API key"
    echo "   1. Go to: https://openrouter.ai/keys"
    echo "   2. Sign in (free, no credit card needed)"
    echo "   3. Copy your API key"
    echo "   4. Edit .env and paste it"
    echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your API key"
echo "2. Run: npm run server    (Terminal 1)"
echo "3. Run: npm run demo      (Terminal 2)"
echo ""
