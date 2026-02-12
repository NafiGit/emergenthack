// Event Bus for bot actions (pub/sub pattern)
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

class BotEventBus extends EventEmitter {
  constructor() {
    super();
    this.setupLogSubscriber();
  }

  // Publish an event
  publish(eventType, data) {
    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      ...data
    };
    this.emit('bot-action', event);
    return event;
  }

  // Subscribe to events
  subscribe(callback) {
    this.on('bot-action', callback);
  }

  // Setup log file subscriber
  setupLogSubscriber() {
    this.subscribe((event) => {
      this.writeToLog(event);
    });
  }

  // Write event to agent-specific log file (max 100 lines)
  writeToLog(event) {
    const agentName = event.agent;
    if (!agentName) return;

    const agentDir = path.join(process.cwd(), 'agents', agentName);
    const logFile = path.join(agentDir, `${agentName}_actions.log`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    // Format log line
    const logLine = `[${event.timestamp}] ${event.type}: ${JSON.stringify(event.data || {})}\n`;

    // Read existing log
    let lines = [];
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      lines = content.split('\n').filter(line => line.trim());
    }

    // Add new line
    lines.push(logLine.trim());

    // Keep only last 100 lines (rolling log)
    if (lines.length > 100) {
      lines = lines.slice(-100);
    }

    // Write back to file
    fs.writeFileSync(logFile, lines.join('\n') + '\n');
  }
}

// Export singleton instance
export const eventBus = new BotEventBus();
