/**
 * Agent Event Bus - Centralized event system for agent activities
 *
 * Events:
 * - agent:joined - When an agent connects
 * - agent:left - When an agent disconnects
 * - agent:moved - When an agent moves
 * - agent:spoke - When an agent says something
 * - agent:started_building - When an agent starts building
 * - agent:finished_building - When an agent finishes building
 * - agent:placed_block - When an agent places a block
 * - agent:error - When an agent encounters an error
 * - agent:mode_changed - When agent mode changes (follow, patrol, etc.)
 */

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.eventLog = [];
    this.maxLogSize = 1000;
    this.logFile = '/tmp/agent_events.log';
    this.subscribers = new Map();

    // Set up event logging
    this.setupLogging();
  }

  setupLogging() {
    // Log all events to file
    this.onAny((eventName, data) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: eventName,
        data: data
      };

      // Add to in-memory log
      this.eventLog.push(logEntry);
      if (this.eventLog.length > this.maxLogSize) {
        this.eventLog.shift();
      }

      // Append to file
      fs.appendFileSync(
        this.logFile,
        JSON.stringify(logEntry) + '\n',
        { encoding: 'utf8' }
      );
    });
  }

  // Listen to all events
  onAny(callback) {
    const originalEmit = this.emit.bind(this);
    this.emit = function(eventName, ...args) {
      if (eventName !== 'newListener' && eventName !== 'removeListener') {
        callback(eventName, ...args);
      }
      return originalEmit(eventName, ...args);
    };
  }

  // Agent lifecycle events
  emitAgentJoined(agentName, position) {
    this.emit('agent:joined', {
      agent: agentName,
      position: position,
      timestamp: Date.now()
    });
  }

  emitAgentLeft(agentName, reason) {
    this.emit('agent:left', {
      agent: agentName,
      reason: reason,
      timestamp: Date.now()
    });
  }

  emitAgentError(agentName, error) {
    this.emit('agent:error', {
      agent: agentName,
      error: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  }

  // Agent activity events
  emitAgentMoved(agentName, fromPos, toPos) {
    this.emit('agent:moved', {
      agent: agentName,
      from: fromPos,
      to: toPos,
      distance: this.calculateDistance(fromPos, toPos),
      timestamp: Date.now()
    });
  }

  emitAgentSpoke(agentName, message) {
    this.emit('agent:spoke', {
      agent: agentName,
      message: message,
      timestamp: Date.now()
    });
  }

  emitAgentModeChanged(agentName, oldMode, newMode, target) {
    this.emit('agent:mode_changed', {
      agent: agentName,
      oldMode: oldMode,
      newMode: newMode,
      target: target,
      timestamp: Date.now()
    });
  }

  // Building events
  emitAgentStartedBuilding(agentName, structure, location) {
    this.emit('agent:started_building', {
      agent: agentName,
      structure: structure,
      location: location,
      timestamp: Date.now()
    });
  }

  emitAgentFinishedBuilding(agentName, structure, blocksPlaced) {
    this.emit('agent:finished_building', {
      agent: agentName,
      structure: structure,
      blocksPlaced: blocksPlaced,
      timestamp: Date.now()
    });
  }

  emitAgentPlacedBlock(agentName, blockType, position) {
    this.emit('agent:placed_block', {
      agent: agentName,
      blockType: blockType,
      position: position,
      timestamp: Date.now()
    });
  }

  // Utility methods
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return 0;
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Get recent events
  getRecentEvents(limit = 100) {
    return this.eventLog.slice(-limit);
  }

  // Get events by type
  getEventsByType(eventType, limit = 100) {
    return this.eventLog
      .filter(e => e.event === eventType)
      .slice(-limit);
  }

  // Get events by agent
  getEventsByAgent(agentName, limit = 100) {
    return this.eventLog
      .filter(e => e.data && e.data.agent === agentName)
      .slice(-limit);
  }

  // Clear event log
  clearLog() {
    this.eventLog = [];
    fs.writeFileSync(this.logFile, '', { encoding: 'utf8' });
  }

  // Get event statistics
  getStats() {
    const stats = {
      totalEvents: this.eventLog.length,
      eventTypes: {},
      agentActivity: {},
      recentActivity: this.eventLog.slice(-10)
    };

    this.eventLog.forEach(entry => {
      // Count by event type
      stats.eventTypes[entry.event] = (stats.eventTypes[entry.event] || 0) + 1;

      // Count by agent
      if (entry.data && entry.data.agent) {
        const agent = entry.data.agent;
        stats.agentActivity[agent] = (stats.agentActivity[agent] || 0) + 1;
      }
    });

    return stats;
  }
}

// Create singleton instance
const eventBus = new AgentEventBus();

// Rejoin event
class RejoinEvent {
  emitAgentRejoinRequested(agentName, reason) {
    eventBus.emit('agent:rejoin_requested', {
      agent: agentName,
      reason: reason,
      timestamp: Date.now()
    });
  }
}

// Add rejoin method to event bus
Object.assign(eventBus, new RejoinEvent());

// Example subscribers
eventBus.on('agent:joined', (data) => {
  console.log(`✅ ${data.agent} joined at (${Math.round(data.position?.x)}, ${Math.round(data.position?.y)}, ${Math.round(data.position?.z)})`);
});

eventBus.on('agent:left', (data) => {
  console.log(`❌ ${data.agent} left: ${data.reason}`);
});

eventBus.on('agent:rejoin_requested', (data) => {
  console.log(`🔄 Rejoin requested for ${data.agent}: ${data.reason}`);
});

eventBus.on('agent:error', (data) => {
  console.log(`⚠️  ${data.agent} error: ${data.error}`);
});

eventBus.on('agent:spoke', (data) => {
  console.log(`💬 ${data.agent}: "${data.message}"`);
});

eventBus.on('agent:mode_changed', (data) => {
  console.log(`🔄 ${data.agent} mode: ${data.oldMode} → ${data.newMode}`);
});

eventBus.on('agent:started_building', (data) => {
  console.log(`🏗️  ${data.agent} started building ${data.structure}`);
});

eventBus.on('agent:finished_building', (data) => {
  console.log(`✅ ${data.agent} finished ${data.structure} (${data.blocksPlaced} blocks)`);
});

export default eventBus;
