// Direct Messaging System — Per-agent inboxes
// Types: direct_message, help_request, location_share, danger_alert

const MAX_INBOX = 10;
let messageId = 0;

class MessageSystem {
  constructor() {
    this.inboxes = {}; // agentName -> messages[]
  }

  _ensureInbox(agent) {
    if (!this.inboxes[agent]) {
      this.inboxes[agent] = [];
    }
  }

  send(from, to, type, content) {
    this._ensureInbox(to);
    const msg = {
      id: ++messageId,
      from,
      to,
      type,
      content,
      timestamp: Date.now(),
      read: false,
    };
    this.inboxes[to].push(msg);
    // Rolling window — keep last MAX_INBOX messages
    if (this.inboxes[to].length > MAX_INBOX) {
      this.inboxes[to].shift();
    }
    return msg;
  }

  broadcast(from, type, content) {
    const sent = [];
    for (const agent of Object.keys(this.inboxes)) {
      if (agent !== from) {
        sent.push(this.send(from, agent, type, content));
      }
    }
    return sent;
  }

  // Call this when a new agent joins so it has an inbox
  registerAgent(name) {
    this._ensureInbox(name);
  }

  getRecent(agent, limit = 3) {
    this._ensureInbox(agent);
    return this.inboxes[agent].slice(-limit);
  }

  getUnread(agent) {
    this._ensureInbox(agent);
    return this.inboxes[agent].filter(m => !m.read);
  }

  markRead(agent) {
    this._ensureInbox(agent);
    for (const msg of this.inboxes[agent]) {
      msg.read = true;
    }
  }
}

// Export singleton
export const messageSystem = new MessageSystem();
