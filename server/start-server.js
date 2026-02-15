// BASE ISLAND - Minecraft Java Server Launcher (1.19.2 + Java 17)

import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, 'java-server');
const SERVER_JAR = join(SERVER_DIR, 'server.jar');
const EULA_FILE = join(SERVER_DIR, 'eula.txt');
const PORT = 25565;

console.log('🎮 Starting Base Island Minecraft Server (Java 1.19.2)...\n');

// Verify server.jar exists
if (!existsSync(SERVER_JAR)) {
  console.error('❌ server.jar not found at', SERVER_JAR);
  console.error('   Download Minecraft 1.19.2 server from https://www.minecraft.net/en-us/download/server');
  process.exit(1);
}

// Auto-accept EULA
writeFileSync(EULA_FILE, 'eula=true\n');

// Launch Java Minecraft server
const serverProcess = spawn('java', [
  '-Xmx2G',
  '-Xms1G',
  '-jar', SERVER_JAR,
  'nogui',
], {
  cwd: SERVER_DIR,
  stdio: ['pipe', 'pipe', 'pipe'],
});

serverProcess.stdout.on('data', (data) => {
  const line = data.toString().trim();
  if (!line) return;

  // Detect server ready
  if (line.includes('Done (') && line.includes('For help,')) {
    console.log('✅ Server running on port', PORT);
    console.log('📍 Connect bots to: localhost:' + PORT);
    console.log('🌍 World: Superflat (easy terrain for bots)');
    console.log('🌐 Web client: http://localhost:3002');
    console.log('\nWaiting for agents to join...\n');
  }

  // Auto-op agents when they join
  if (line.includes('joined the game')) {
    const match = line.match(/(\w+) joined the game/);
    if (match) {
      const name = match[1];
      if (['Saumya', 'Sumedha', 'Ahaan'].includes(name)) {
        setTimeout(() => {
          serverProcess.stdin.write(`op ${name}\n`);
          console.log(`🔑 Auto-opped agent: ${name}`);
        }, 1000);
      }
    }
  }

  // Detect player joins/leaves
  if (line.includes('joined the game')) {
    const match = line.match(/(\w+) joined the game/);
    if (match) console.log(`🤖 Agent "${match[1]}" joined the simulation`);
  } else if (line.includes('left the game')) {
    const match = line.match(/(\w+) left the game/);
    if (match) console.log(`👋 Agent "${match[1]}" left the simulation`);
  } else {
    console.log('[Server]', line);
  }
});

serverProcess.stderr.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.error('[Server ERR]', line);
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start Java server:', error.message);
  console.error('   Make sure Java 17 is installed: java -version');
  process.exit(1);
});

serverProcess.on('close', (code) => {
  console.log(`\nServer process exited with code ${code}`);
  process.exit(code || 0);
});

// Forward stdin to server console
process.stdin.on('data', (data) => {
  serverProcess.stdin.write(data);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping server...');
  serverProcess.stdin.write('stop\n');
  setTimeout(() => {
    serverProcess.kill();
    process.exit(0);
  }, 10000);
});

console.log('Press Ctrl+C to stop server\n');
