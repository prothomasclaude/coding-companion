#!/bin/bash
# Start the Coding Companion Electron app if not already running
SPRITE_DIR="$HOME/.claude/coding-companion"
PID_FILE="$SPRITE_DIR/sprite.pid"

# Check if already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Already running, just set thinking
    "$SPRITE_DIR/hooks/set-status.sh" thinking
    exit 0
  fi
fi

# Set initial status
"$SPRITE_DIR/hooks/set-status.sh" thinking

# Start Electron app in background
# Unset ELECTRON_RUN_AS_NODE (set by Cursor/VSCode) so Electron runs in GUI mode
cd "$SPRITE_DIR"
ELECTRON_RUN_AS_NODE= ELECTRON_NO_ATTACH_CONSOLE= ./node_modules/electron/dist/electron . &>/dev/null &
echo $! > "$PID_FILE"

exit 0
