#!/bin/bash
# Stop the Coding Companion Electron app
SPRITE_DIR="$HOME/.claude/coding-companion"
PID_FILE="$SPRITE_DIR/sprite.pid"

# Sessions opened before the SessionEnd hook was removed still call this when they close.
# The sprite now leaves by itself once no session is left: only a manual call stops it.
if [ ! -t 0 ] && timeout 1 grep -q '"SessionEnd"'; then exit 0; fi

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
  fi
  rm -f "$PID_FILE"
fi

exit 0
