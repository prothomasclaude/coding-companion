#!/bin/bash
# Force a state for a few seconds, to try a sprite pack. The real state comes from
# Claude Code's session files (see sessions.js), not from this script.
# Usage: set-status.sh <state> [context]
# Examples: set-status.sh working
#           set-status.sh working error
#           set-status.sh idle commit
STATUS_FILE="$HOME/.claude/coding-companion/status.json"
STATE="${1:-idle}"
CONTEXT="${2:-}"
if [ -n "$CONTEXT" ]; then
  echo "{\"state\":\"$STATE\",\"context\":\"$CONTEXT\",\"timestamp\":$(date +%s%3N)}" > "$STATUS_FILE"
else
  echo "{\"state\":\"$STATE\",\"timestamp\":$(date +%s%3N)}" > "$STATUS_FILE"
fi
