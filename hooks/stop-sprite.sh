#!/bin/bash
# Stop the Coding Companion Electron app
SPRITE_DIR="$HOME/.claude/coding-companion"
PID_FILE="$SPRITE_DIR/sprite.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
  fi
  rm -f "$PID_FILE"
fi

exit 0
