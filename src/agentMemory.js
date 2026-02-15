// Shared Blackboard — Inter-agent knowledge store
// Categories: resources, poi (points of interest), objectives

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

class AgentMemory {
  constructor() {
    this.store = {
      resources: new Map(),
      poi: new Map(),
      objectives: new Map(),
    };
  }

  set(category, key, value, author, ttl = DEFAULT_TTL) {
    if (!this.store[category]) return;
    this.store[category].set(key, {
      value,
      author,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(category, key) {
    if (!this.store[category]) return null;
    const entry = this.store[category].get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store[category].delete(key);
      return null;
    }
    return entry;
  }

  getAll(category) {
    if (!this.store[category]) return {};
    this._cleanup(category);
    const result = {};
    for (const [key, entry] of this.store[category]) {
      result[key] = entry;
    }
    return result;
  }

  getSummary() {
    const summary = {};
    for (const category of Object.keys(this.store)) {
      this._cleanup(category);
      const entries = [];
      for (const [key, entry] of this.store[category]) {
        entries.push(`${key}: ${JSON.stringify(entry.value)} (by ${entry.author})`);
      }
      summary[category] = entries;
    }
    return summary;
  }

  _cleanup(category) {
    const now = Date.now();
    for (const [key, entry] of this.store[category]) {
      if (now - entry.timestamp > entry.ttl) {
        this.store[category].delete(key);
      }
    }
  }
}

// Export singleton
export const agentMemory = new AgentMemory();
