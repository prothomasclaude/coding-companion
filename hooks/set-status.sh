#!/bin/bash
# Write status to the coding companion status file
STATUS_FILE="$HOME/.claude/coding-companion/status.json"
STATE="${1:-idle}"
echo "{\"state\":\"$STATE\",\"timestamp\":$(date +%s%3N)}" > "$STATUS_FILE"
