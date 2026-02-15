#!/usr/bin/env bash
# ============================================================================
# ARENA EVOLUTION — 8 worktrees, 8 ralph loops, 1 overseer
# Each bot gets its own worktree + claude -p ralph loop that evolves strategy
# All 8 bots fight on the same MC server, logs are tailable per bot
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DISPATCH="/mnt/skills/parallel-worktrees/dispatch.sh"
LOG_DIR="/tmp/arena-logs"
WORKTREE_BASE="/tmp/arena-worktrees"
MAX_ROUNDS="${1:-10}"          # pass as arg or default 10
ROUND_DURATION="${2:-90}"      # seconds per combat round
STRAT_DIR="$REPO_ROOT/strategies"

BOTS=(Pvp1 Pvp2 Sumo1 Sumo2 Spleef1 Spleef2 Archer1 Archer2)

# ============================================================================
# PHASE 0: SETUP
# ============================================================================
echo "=== ARENA EVOLUTION SETUP ==="
mkdir -p "$LOG_DIR" "$STRAT_DIR"

# Create initial strategy files if missing
for bot in "${BOTS[@]}"; do
  [[ -f "$STRAT_DIR/${bot}.json" ]] && continue
  case "$bot" in
    Pvp*)
      cat > "$STRAT_DIR/${bot}.json" <<'STRATEGY'
{
  "name": "BOTNAME", "arena": "pvp", "version": 1,
  "combat": {
    "attack_range": 3.5, "chase_sprint_distance": 5,
    "strafe_chance": 0.5, "strafe_duration_ms": 200,
    "sprint_jump_crit_chance": 0.3, "crit_duration_ms": 300,
    "heal_threshold": 10, "shield_after_attack": false,
    "approach_style": "direct", "combo_delay_ms": 0
  },
  "notes": "Initial default — tune these values based on combat logs",
  "history": []
}
STRATEGY
      sed -i "s/BOTNAME/$bot/" "$STRAT_DIR/${bot}.json"
      ;;
    Sumo*)
      cat > "$STRAT_DIR/${bot}.json" <<'STRATEGY'
{
  "name": "BOTNAME", "arena": "sumo", "version": 1,
  "combat": {
    "center_retreat_threshold": 8, "attack_range": 3.5,
    "sprint_attack": true, "knockback_combo_delay_ms": 200,
    "edge_awareness": true, "retreat_sprint_ms": 400,
    "approach_style": "aggressive"
  },
  "notes": "Initial default — tune these values based on combat logs",
  "history": []
}
STRATEGY
      sed -i "s/BOTNAME/$bot/" "$STRAT_DIR/${bot}.json"
      ;;
    Spleef*)
      cat > "$STRAT_DIR/${bot}.json" <<'STRATEGY'
{
  "name": "BOTNAME", "arena": "spleef", "version": 1,
  "combat": {
    "chase_distance": 4, "sprint_threshold": 7,
    "dig_radius_x": 2, "dig_radius_z": 2, "dig_depth": 3,
    "dig_under_self_fallback": true,
    "approach_style": "chase_then_dig"
  },
  "notes": "Initial default — tune these values based on combat logs",
  "history": []
}
STRATEGY
      sed -i "s/BOTNAME/$bot/" "$STRAT_DIR/${bot}.json"
      ;;
    Archer*)
      cat > "$STRAT_DIR/${bot}.json" <<'STRATEGY'
{
  "name": "BOTNAME", "arena": "archery", "version": 1,
  "combat": {
    "strafe_chance": 0.4, "strafe_duration_ms": 400,
    "forward_chance": 0.15, "backward_chance": 0.15,
    "move_duration_ms": 300,
    "charge_base_ms": 300, "charge_per_distance_ms": 20, "max_charge_ms": 1000,
    "gravity_base": 1.6, "gravity_per_distance": 0.04,
    "cooldown_ms": 1500, "lead_target": false,
    "preferred_distance": 12
  },
  "notes": "Initial default — tune these values based on combat logs",
  "history": []
}
STRATEGY
      sed -i "s/BOTNAME/$bot/" "$STRAT_DIR/${bot}.json"
      ;;
  esac
done

echo "Strategy files ready in $STRAT_DIR"

# Ensure arena-bot.js reads strategies + writes per-bot logs
# (The ralph loop agents will handle code modifications)

# ============================================================================
# PHASE 1: KILL STALE PROCESSES
# ============================================================================
cleanup_stale() {
  echo "[cleanup] Killing stale arena processes..."
  pkill -f 'node.*arena-bot' 2>/dev/null || true
  pkill -f 'node.*single-bot' 2>/dev/null || true
  sleep 2
  # Verify MC server is running
  if ! pgrep -f 'java.*server.jar' > /dev/null; then
    echo "[cleanup] MC server not running! Starting..."
    cd "$REPO_ROOT"
    npm run start-minecraft-server &
    MC_PID=$!
    echo "[cleanup] Waiting 30s for MC server startup..."
    sleep 30
  fi
}

# ============================================================================
# ROUND LOOP
# ============================================================================
for round in $(seq 1 "$MAX_ROUNDS"); do
  echo ""
  echo "================================================================"
  echo "  ROUND $round / $MAX_ROUNDS"
  echo "================================================================"

  cleanup_stale

  # ------------------------------------------------------------------
  # PHASE 2: RUN COMBAT ROUND
  # ------------------------------------------------------------------
  echo "[round $round] Starting combat round (${ROUND_DURATION}s)..."

  # Clear old per-bot logs
  for bot in "${BOTS[@]}"; do
    > "$LOG_DIR/${bot}.log"
  done

  cd "$REPO_ROOT"

  # Start arena bots — tee combined output while also logging per-bot
  node src/arena-bot.js 2>&1 | while IFS= read -r line; do
    echo "$line"
    # Route to per-bot log files based on [BotName] prefix
    for bot in "${BOTS[@]}"; do
      if [[ "$line" == *"[$bot]"* || "$line" == *"[HEALTH-CHECK][$bot]"* ]]; then
        echo "$line" >> "$LOG_DIR/${bot}.log"
        break
      fi
    done
    # Global status lines go to all
    if [[ "$line" == *"GLOBAL STATUS"* || "$line" == *"==="* ]]; then
      echo "$line" >> "$LOG_DIR/global.log"
    fi
  done &
  BOT_PID=$!

  # Let bots connect (15s) + fight (ROUND_DURATION)
  echo "[round $round] Bots starting... waiting ${ROUND_DURATION}s for combat"
  sleep "$((ROUND_DURATION + 15))"

  # Kill bot process
  kill $BOT_PID 2>/dev/null || true
  pkill -f 'node.*arena-bot' 2>/dev/null || true
  sleep 3

  echo "[round $round] Combat round complete. Logs in $LOG_DIR/"
  echo "[round $round] Per-bot log sizes:"
  for bot in "${BOTS[@]}"; do
    SIZE=$(wc -l < "$LOG_DIR/${bot}.log" 2>/dev/null || echo 0)
    echo "  $bot: $SIZE lines"
  done

  # ------------------------------------------------------------------
  # PHASE 3: EVOLVE STRATEGIES (8 parallel agents via dispatch.sh)
  # ------------------------------------------------------------------
  echo ""
  echo "[round $round] Evolving strategies with 8 parallel agents..."

  EVOLUTION_PROMPT="$(cat <<'EVOLVE_PROMPT'
You are an arena bot STRATEGY OPTIMIZER. You have been assigned ONE strategy file for ONE specific bot.

## YOUR JOB
1. Read your assigned strategy JSON file to learn which bot you are optimizing
2. Read that bot's combat logs from /tmp/arena-logs/<BotName>.log
3. Read the global status from /tmp/arena-logs/global.log
4. Analyze combat performance:
   - Is HP dropping? (taking damage = opponent is hitting us)
   - Is opponent HP dropping? (we are landing hits)
   - Are attacks connecting? (ATK count increasing)
   - For archery: are arrows landing? (check HP changes relative to ARW count)
   - For spleef: are blocks being dug effectively? (DIG count + opponent falling)
   - For sumo: are we staying on platform? (y coordinate stays ~11)
   - Deaths vs kills ratio
   - Distance patterns (are we too far? too close?)
5. Based on analysis, MODIFY the strategy JSON with improved parameters
6. Add a note to the "history" array explaining what you changed and why
7. Increment the "version" number

## STRATEGY PARAMETER GUIDE

### PvP (Pvp1, Pvp2)
- attack_range: distance to start attacking (lower = closer, more damage)
- chase_sprint_distance: distance above which to sprint (higher = sprint sooner)
- strafe_chance: 0.0-1.0, how often to strafe after attacking
- sprint_jump_crit_chance: 0.0-1.0, chance of critical hit combo
- heal_threshold: HP below which to eat golden apple (1-20)
- shield_after_attack: if true, try to block after each swing
- combo_delay_ms: ms between attacks (0 = spam, 200+ = timed)

### Sumo (Sumo1, Sumo2)
- center_retreat_threshold: distance from center to start retreating (lower = riskier)
- knockback_combo_delay_ms: ms between hits for max knockback
- approach_style: "aggressive" (always push) or "defensive" (wait and counter)

### Spleef (Spleef1, Spleef2)
- chase_distance: how close to get before digging
- dig_radius_x/z: how wide to dig around opponent
- dig_depth: how many layers down to search
- approach_style: "chase_then_dig" or "predict_and_dig" or "surround"

### Archery (Archer1, Archer2)
- strafe_chance: how often to move sideways (higher = harder to hit)
- charge_base_ms / charge_per_distance_ms: bow charge timing
- gravity_base / gravity_per_distance: aim arc compensation
- lead_target: if true, aim ahead of moving opponent
- preferred_distance: ideal range (further = safer but harder to hit)
- cooldown_ms: time between shots (lower = more aggressive)

## ALSO ALLOWED: MODIFY COMBAT CODE
If parameter tuning alone isn't enough, you can ALSO modify src/arena-bot.js.
Look at the combat tick function for your arena type (pvpTick, sumoTick, spleefTick, archeryTick).
You can add new behaviors like:
- Shield blocking patterns (PvP)
- Combo timing (attack-wait-attack for knockback chains)
- Predictive aiming (archery: lead the target based on velocity)
- Strategic retreating (sumo: bait opponent to edge then counter)
- Dig patterns (spleef: L-shapes, spirals, cut-offs)

## IMPORTANT
- Read the ACTUAL logs. Don't guess. The data tells you what's working.
- Make ONE or TWO changes per iteration, not everything at once.
- Keep notes in history[] so future iterations know what was tried.
- If a previous change made things WORSE (more deaths, fewer hits), REVERT it.

## OUTPUT
Write the modified strategy JSON back to the same file path.
If you modified arena-bot.js, write those changes too.
EVOLVE_PROMPT
)"

  cd "$REPO_ROOT"
  bash "$DISPATCH" \
    -p "strategies/*.json" \
    -n 8 \
    -m "$EVOLUTION_PROMPT" \
    -o "strategies/*.json" \
    --tools "Bash,Read,Write,Edit,Glob,Grep"

  echo "[round $round] Strategy evolution complete."

  # ------------------------------------------------------------------
  # PHASE 4: OVERSEER ANALYSIS
  # ------------------------------------------------------------------
  echo ""
  echo "[round $round] Running overseer analysis..."

  OVERSEER_PROMPT="$(cat <<'OVERSEER'
You are the ARENA EVOLUTION OVERSEER. You monitor ALL 8 bots across 4 arenas and provide cross-cutting strategic insights.

## YOUR JOB
1. Read ALL 8 strategy files in strategies/*.json
2. Read ALL 8 bot logs from /tmp/arena-logs/*.log
3. Read the global status from /tmp/arena-logs/global.log
4. For EACH arena pair, determine:
   - Who is winning (fewer deaths, more kills)?
   - What strategy differences explain the performance gap?
   - What should the LOSING bot try differently?
5. Look for cross-arena insights:
   - Does a technique that works in one arena apply to another?
   - Are any bots stuck in degenerate loops (same position, no combat)?
   - Are any bots failing to connect or crashing?
6. Write your analysis to strategies/overseer-insights.md
   Format:
   ```
   # Overseer Round N Analysis

   ## PvP: Pvp1 vs Pvp2
   Winner: [who] | Score: [kills-deaths]
   Key insight: [what's working]
   Recommendation for loser: [what to try]

   ## Sumo: Sumo1 vs Sumo2
   ...

   ## Spleef: Spleef1 vs Spleef2
   ...

   ## Archery: Archer1 vs Archer2
   ...

   ## Cross-Arena Insights
   - [insight 1]
   - [insight 2]

   ## Skill Ratings (1-10)
   | Bot | Strafe | Chase | Block | Attack | Special |
   ...
   ```

7. If any bot is clearly broken (0 attacks, stuck, crashing), note it prominently.
8. The strategy optimizer agents will read this file next round.

## ALSO CHECK
- Are bots actually in their arenas? (position in health checks should match arena bounds)
- Are health values changing? (if HP never drops, combat isn't happening)
- Is the server responsive? (if all bots show N/A distance, server may be lagging)

Read EVERY log file. Be thorough. This is the brain of the evolution system.
OVERSEER
)"

  cd "$REPO_ROOT"
  claude --print --dangerously-skip-permissions --no-session-persistence \
    --tools "Bash,Read,Write,Edit,Glob,Grep" \
    -p "$OVERSEER_PROMPT" \
    > "$LOG_DIR/overseer-round-${round}.txt" 2>&1

  echo "[round $round] Overseer report: $LOG_DIR/overseer-round-${round}.txt"
  echo ""

  # Show quick summary
  if [[ -f "$STRAT_DIR/overseer-insights.md" ]]; then
    echo "--- OVERSEER SUMMARY ---"
    head -30 "$STRAT_DIR/overseer-insights.md"
    echo "------------------------"
  fi

  echo ""
  echo "Round $round complete. Strategy versions:"
  for bot in "${BOTS[@]}"; do
    VER=$(grep -o '"version": [0-9]*' "$STRAT_DIR/${bot}.json" 2>/dev/null | grep -o '[0-9]*' || echo "?")
    echo "  $bot: v$VER"
  done
done

echo ""
echo "================================================================"
echo "  ARENA EVOLUTION COMPLETE ($MAX_ROUNDS rounds)"
echo "  Logs: $LOG_DIR/"
echo "  Strategies: $STRAT_DIR/"
echo "  Overseer reports: $LOG_DIR/overseer-round-*.txt"
echo "================================================================"
