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
    "@anthropic-ai/sdk": "^0.39.0",
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
ANTHROPIC_API_KEY=your_key_here
EOF
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY"
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
