// SYNAPSE FORGE - Minecraft Server (flying-squid)
// Emergency 6-hour demo version

import mcServer from 'flying-squid';

console.log('🎮 Starting Synapse Forge Minecraft Server...\n');

const server = mcServer.createMCServer({
  'online-mode': false,
  port: 55916,
  version: '1.21.1',
  motd: 'Synapse Forge - AI Agent Civilization',
  'max-players': 20,
  generation: {
    name: 'superflat', // Flat world for easier demo
  },
  logging: true,
});

server.on('listening', () => {
  console.log('✅ Server running on port 55916');
  console.log('📍 Connect bots to: localhost:55916');
  console.log('🌍 World: Superflat (easy terrain for bots)');
  console.log('\nWaiting for agents to join...\n');
});

server.on('playerJoin', (client) => {
  console.log(`🤖 Agent "${client.username}" joined the simulation`);
});

server.on('playerLeave', (client) => {
  console.log(`👋 Agent "${client.username}" left the simulation`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log('Press Ctrl+C to stop server\n');
