#!/usr/bin/env python3
"""
Agent Event Monitor - View real-time agent events
"""
import requests
import time
import sys
from datetime import datetime

BOT_API = "http://localhost:8765"

def format_timestamp(ts):
    """Format ISO timestamp to readable time"""
    try:
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        return dt.strftime('%H:%M:%S')
    except:
        return ts

def format_event(event):
    """Format event for display"""
    time_str = format_timestamp(event.get('timestamp', ''))
    event_type = event.get('event', '').replace('agent:', '')
    data = event.get('data', {})

    agent = data.get('agent', '?')

    # Format based on event type
    if event_type == 'joined':
        pos = data.get('position', {})
        return f"[{time_str}] ✅ {agent} joined at ({int(pos.get('x',0))}, {int(pos.get('y',0))}, {int(pos.get('z',0))})"

    elif event_type == 'left':
        reason = data.get('reason', 'unknown')
        return f"[{time_str}] ❌ {agent} left: {reason}"

    elif event_type == 'spoke':
        msg = data.get('message', '')
        return f"[{time_str}] 💬 {agent}: \"{msg}\""

    elif event_type == 'moved':
        dist = data.get('distance', 0)
        return f"[{time_str}] 🚶 {agent} moved {dist:.1f} blocks"

    elif event_type == 'mode_changed':
        old = data.get('oldMode', '')
        new = data.get('newMode', '')
        return f"[{time_str}] 🔄 {agent} mode: {old} → {new}"

    elif event_type == 'started_building':
        struct = data.get('structure', '')
        return f"[{time_str}] 🏗️  {agent} started building {struct}"

    elif event_type == 'finished_building':
        struct = data.get('structure', '')
        blocks = data.get('blocksPlaced', 0)
        return f"[{time_str}] ✅ {agent} finished {struct} ({blocks} blocks)"

    elif event_type == 'placed_block':
        block = data.get('blockType', '')
        pos = data.get('position', {})
        return f"[{time_str}] 🧱 {agent} placed {block} at ({pos.get('x')}, {pos.get('y')}, {pos.get('z')})"

    elif event_type == 'error':
        err = data.get('error', '')
        return f"[{time_str}] ⚠️  {agent} error: {err}"

    else:
        return f"[{time_str}] {event_type}: {agent}"

def show_stats():
    """Show event statistics"""
    try:
        response = requests.get(f"{BOT_API}/events/stats", timeout=5)
        stats = response.json()

        print("\n" + "="*60)
        print("   📊 AGENT EVENT STATISTICS")
        print("="*60)
        print(f"\nTotal Events: {stats['totalEvents']}")

        print("\n📈 Events by Type:")
        for event_type, count in sorted(stats['eventTypes'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {event_type:25s} {count:5d}")

        print("\n🤖 Events by Agent:")
        for agent, count in sorted(stats['agentActivity'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {agent:15s} {count:5d}")

        print("\n🕐 Recent Activity:")
        for event in stats['recentActivity'][-5:]:
            print(f"   {format_event(event)}")

        print()

    except Exception as e:
        print(f"Error: {e}")

def watch_events(auto_rejoin=False):
    """Watch events in real-time with optional auto-rejoin"""
    print("="*60)
    print("   👁️  AGENT EVENT MONITOR")
    if auto_rejoin:
        print("   🔄 AUTO-REJOIN ENABLED")
    print("="*60)
    print("Watching for agent events... (Ctrl+C to stop)\n")

    last_count = 0
    disconnected_agents = set()

    try:
        while True:
            response = requests.get(f"{BOT_API}/events/recent?limit=50", timeout=5)
            events = response.json()

            # Show new events only
            if len(events) > last_count:
                new_events = events[last_count:]
                for event in new_events:
                    print(format_event(event))

                    # Auto-rejoin on disconnect
                    if auto_rejoin and event.get('event') == 'agent:left':
                        agent = event.get('data', {}).get('agent')
                        if agent and agent not in disconnected_agents:
                            disconnected_agents.add(agent)
                            print(f"   🔄 Triggering rejoin for {agent}...")

                            try:
                                rejoin_response = requests.post(
                                    f"{BOT_API}/bot/rejoin",
                                    json={"bot_name": agent},
                                    timeout=5
                                )
                                print(f"   ✅ Rejoin triggered: {rejoin_response.json().get('message', 'OK')}")
                            except Exception as e:
                                print(f"   ❌ Rejoin failed: {e}")

                    # Clear disconnected set on successful join
                    if event.get('event') == 'agent:joined':
                        agent = event.get('data', {}).get('agent')
                        if agent in disconnected_agents:
                            disconnected_agents.remove(agent)

                last_count = len(events)

            time.sleep(1)  # Poll every second

    except KeyboardInterrupt:
        print("\n\n✋ Stopped monitoring")
    except Exception as e:
        print(f"\n❌ Error: {e}")

def show_agent_events(agent_name, limit=20):
    """Show events for specific agent"""
    try:
        response = requests.get(f"{BOT_API}/events/agent/{agent_name}?limit={limit}", timeout=5)
        events = response.json()

        print(f"\n📋 Events for {agent_name} (last {limit}):")
        print("-"*60)
        for event in events:
            print(format_event(event))
        print()

    except Exception as e:
        print(f"Error: {e}")

def show_help():
    """Show usage help"""
    print("""
📊 AGENT EVENT MONITOR
=====================

USAGE:
  python event_monitor.py [command] [options]

COMMANDS:
  watch       - Watch events in real-time (default)
  stats       - Show event statistics
  agent NAME  - Show events for specific agent
  clear       - Clear event log

OPTIONS:
  --auto-rejoin   - Automatically trigger rejoin when agents disconnect

EXAMPLES:
  python event_monitor.py
  python event_monitor.py watch --auto-rejoin
  python event_monitor.py stats
  python event_monitor.py agent Agent1
  python event_monitor.py clear

AUTO-REJOIN MODE:
  When enabled, the monitor will automatically call the /bot/rejoin endpoint
  whenever an agent:left event is detected. This provides resilient agent
  connections that automatically recover from disconnects, timeouts, and errors.

  Example:
    python event_monitor.py watch --auto-rejoin

API ENDPOINTS:
  GET  /events/recent        - Get recent events
  GET  /events/stats         - Get statistics
  GET  /events/agent/:name   - Get events by agent
  GET  /events/type/:type    - Get events by type
  POST /events/clear         - Clear event log
  POST /bot/rejoin           - Trigger agent rejoin
""")

if __name__ == "__main__":
    # Check for auto-rejoin flag
    auto_rejoin = '--auto-rejoin' in sys.argv
    args = [arg for arg in sys.argv[1:] if not arg.startswith('--')]

    if len(args) < 1:
        watch_events(auto_rejoin=auto_rejoin)
    else:
        cmd = args[0].lower()

        if cmd == "stats":
            show_stats()
        elif cmd == "watch":
            watch_events(auto_rejoin=auto_rejoin)
        elif cmd == "agent" and len(args) >= 2:
            show_agent_events(args[1])
        elif cmd == "clear":
            response = requests.post(f"{BOT_API}/events/clear", timeout=5)
            print("✅ Event log cleared")
        else:
            show_help()
