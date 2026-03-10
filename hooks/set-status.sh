#!/bin/bash
# Write status to the coding companion status file
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
